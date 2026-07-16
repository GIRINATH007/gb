import supabaseServiceRole from '../config/supabase.js'
import { processTrackingSession } from './territoryService.js'

// Award 1 loop point per 100 metres walked/run.
const LOOP_POINTS_PER_METRE = 0.01

// Loop bonus constants.
const LOOP_BONUS_PTS = 20
const LOOP_MIN_DISTANCE_M = 150
const LOOP_MAX_CLOSURE_M = 30
const LOOP_MIN_POINTS = 4

// Postgres unique-violation error code.
const PG_UNIQUE_VIOLATION = '23505'

function haversine(a, b) {
  const R = 6371000
  const toRad = (d) => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Persist a completed tracking session and atomically update user stats.
 *
 * Idempotent: if local_session_id already exists (e.g. "Try Again" retry on
 * the client), the existing row is returned WITHOUT re-crediting stats so
 * distance and loop points are never double-counted.
 *
 * @param {string} userId
 * @param {{ localSessionId, startedAt, endedAt, distanceMetres, durationSeconds, points, roomId }} payload
 * @returns {Promise<object>} Session row plus loopPointsAwarded
 */
export async function completeSession(userId, payload) {
  const {
    localSessionId,
    startedAt,
    endedAt,
    distanceMetres,
    durationSeconds,
    points,
    elevationGainMetres = 0,
    // === REMOVED (temporary): Splits/pace ===
    // avgPaceSecondsPerKm = 0,
    // splits = [],
    roomId,
  } = payload

  const loopPoints = Math.round(distanceMetres * LOOP_POINTS_PER_METRE)

  // Loop bonus: +20 if path returns to start (haversine < 30m) and is long enough
  let loopBonus = 0
  if (
    distanceMetres >= LOOP_MIN_DISTANCE_M &&
    Array.isArray(points) && points.length >= LOOP_MIN_POINTS
  ) {
    const startEndDist = haversine(points[0], points[points.length - 1])
    if (startEndDist < LOOP_MAX_CLOSURE_M) {
      loopBonus = LOOP_BONUS_PTS
    }
  }

  const loopPointsTotal = loopPoints + loopBonus

  // Attempt to insert the tracking session record.
  const { data, error } = await supabaseServiceRole
    .from('tracking_sessions')
    .insert([{
      user_id:                  userId,
      local_session_id:         localSessionId,
      distance_metres:          distanceMetres,
      duration_seconds:         durationSeconds,
      started_at:               startedAt,
      ended_at:                 endedAt,
      points:                   points,
      // === REMOVED (temporary): Splits/pace/elevation ===
      // elevation_gain_metres:    elevationGainMetres,
      // avg_pace_seconds_per_km:  avgPaceSecondsPerKm,
      // splits:                   splits,
    }])
    .select()
    .single()

  // Unique violation → session already saved (client retry path).
  // Return the existing row without re-crediting stats.
  if (error?.code === PG_UNIQUE_VIOLATION) {
    const { data: existing, error: fetchError } = await supabaseServiceRole
      .from('tracking_sessions')
      .select()
      .eq('local_session_id', localSessionId)
      .single()

    if (fetchError) throw fetchError
    return { ...existing, loopPointsAwarded: 0, alreadySaved: true }
  }

  if (error) throw error

  // Atomically credit distance, loop points, and elevation to the user's stats row.
  const { error: statsError } = await supabaseServiceRole.rpc('add_tracking_stats', {
    p_user_id:        userId,
    p_distance:       distanceMetres,
    p_loop_points:    loopPointsTotal,
    p_elevation_gain: elevationGainMetres,
  })

  if (statsError) throw statsError

  // Process territory pipeline (non-blocking — don't fail session if territory fails)
  const territoryResult = await processTrackingSession(
    userId,
    data.id,
    points || [],
    roomId,
  ).catch((err) => {
    console.warn('[tracking] territory pipeline error:', err?.message)
    return null
  })

  return {
    ...data,
    loopPointsAwarded: loopPointsTotal,
    loopBonusAwarded: loopBonus,
    territory: territoryResult,
    alreadySaved: false,
  }
}
