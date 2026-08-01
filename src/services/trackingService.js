import supabaseServiceRole from '../config/supabase.js'
import { AuthAppError } from '../utils/authErrors.js'

const PG_UNIQUE_VIOLATION = '23505'

// Loop Points economy — mirrors the frontend estimate (lib/tracking/scoring.js):
// 1 point per 10 m travelled + a flat 50-point bonus per completed loop.
// Credited to user_stats.loop_points via add_tracking_stats.
const POINTS_PER_METRE          = 0.1
const LOOP_BONUS_POINTS_PER_LOOP = 50

/**
 * Persist a completed room-scoped tracking session via the atomic
 * complete_room_tracking RPC (territory + partial capture + score sync).
 *
 * Idempotent on local_session_id — retries return alreadySaved: true.
 *
 * @param {string} userId
 * @param {{ localSessionId, roomId, startedAt, endedAt, distanceMetres, durationSeconds, points, loopsCompleted }} payload
 */
export async function completeSession(userId, payload) {
  const {
    localSessionId,
    roomId,
    startedAt,
    endedAt,
    distanceMetres,
    durationSeconds,
    points,
    loopsCompleted = 0,
  } = payload

  const loopPointsAwarded = Math.round((distanceMetres || 0) * POINTS_PER_METRE)
    + (loopsCompleted || 0) * LOOP_BONUS_POINTS_PER_LOOP

  const { data, error } = await supabaseServiceRole.rpc('complete_room_tracking', {
    p_user_id:           userId,
    p_room_id:           roomId,
    p_local_session_id:  localSessionId,
    p_started_at:        startedAt,
    p_ended_at:          endedAt,
    p_duration_seconds:  durationSeconds,
    p_distance_metres:   distanceMetres,
    p_points:            points,
    p_buffer_metres:     5,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('NOT_ROOM_MEMBER')) {
      throw new AuthAppError('You are not a member of this room', 403, 'NOT_ROOM_MEMBER')
    }
    if (msg.includes('INSUFFICIENT_POINTS')) {
      throw new AuthAppError('At least 2 GPS points are required', 400, 'VALIDATION_ERROR')
    }
    if (error.code === PG_UNIQUE_VIOLATION) {
      // Race on local_session_id — fetch existing result
      const { data: existing } = await supabaseServiceRole
        .from('tracking_sessions')
        .select('id')
        .eq('local_session_id', localSessionId)
        .single()

      if (existing) {
        return {
          id: existing.id,
          loopPointsAwarded,
          alreadySaved: true,
          territory: null,
        }
      }
    }
    throw error
  }

  const result = typeof data === 'string' ? JSON.parse(data) : data

  // Credit loop points (distance + loop bonus) as a non-competitive profile stat
  if (!result.alreadySaved && distanceMetres > 0) {
    try {
      const { error: statsErr } = await supabaseServiceRole.rpc('add_tracking_stats', {
        p_user_id:     userId,
        p_distance:    distanceMetres,
        p_loop_points: loopPointsAwarded,
      })
      if (statsErr) {
        console.warn('[tracking] distance stats update failed:', statsErr?.message)
      }
    } catch (err) {
      console.warn('[tracking] distance stats update failed:', err?.message)
    }
  }

  return {
    id: result.sessionId,
    loopPointsAwarded,
    alreadySaved: result.alreadySaved || false,
    territory: {
      territory: result.territory,
      captures: result.captures || [],
      pointsEarned: result.pointsEarned || 0,
      scoreDelta: result.scoreDelta || 0,
    },
  }
}
