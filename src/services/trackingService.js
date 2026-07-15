import { supabaseServiceRole } from '../config/supabase.js'
import { processTrackingSession } from './territoryService.js'

// Award 1 loop point per 100 metres walked/run.
const LOOP_POINTS_PER_METRE = 0.01

// Postgres unique-violation error code.
const PG_UNIQUE_VIOLATION = '23505'

/**
 * Persist a completed tracking session and atomically update user stats.
 *
 * Idempotent: if local_session_id already exists (e.g. "Try Again" retry on
 * the client), the existing row is returned WITHOUT re-crediting stats so
 * distance and loop points are never double-counted.
 *
 * @param {string} userId
 * @param {{ localSessionId, startedAt, endedAt, distanceMetres, durationSeconds, points }} payload
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
    avgPaceSecondsPerKm = 0,
    splits = [],
  } = payload

  const loopPoints = Math.round(distanceMetres * LOOP_POINTS_PER_METRE)

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
      elevation_gain_metres:    elevationGainMetres,
      avg_pace_seconds_per_km:  avgPaceSecondsPerKm,
      splits:                   splits,
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
    p_loop_points:    loopPoints,
    p_elevation_gain: elevationGainMetres,
  })

  if (statsError) throw statsError

  // Process territory pipeline (non-blocking — don't fail session if territory fails)
  const territoryResult = await processTrackingSession(
    userId,
    data.id,
    points || [],
  ).catch((err) => {
    console.warn('[tracking] territory pipeline error:', err?.message)
    return null
  })

  return {
    ...data,
    loopPointsAwarded: loopPoints,
    territory: territoryResult,
    alreadySaved: false,
  }
}
