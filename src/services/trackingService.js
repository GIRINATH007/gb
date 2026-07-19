import supabaseServiceRole from '../config/supabase.js'
import { AuthAppError } from '../utils/authErrors.js'

const PG_UNIQUE_VIOLATION = '23505'

/**
 * Persist a completed room-scoped tracking session via the atomic
 * complete_room_tracking RPC (territory + partial capture + score sync).
 *
 * Idempotent on local_session_id — retries return alreadySaved: true.
 *
 * @param {string} userId
 * @param {{ localSessionId, roomId, startedAt, endedAt, distanceMetres, durationSeconds, points }} payload
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
  } = payload

  const { data, error } = await supabaseServiceRole.rpc('complete_room_tracking', {
    p_user_id:           userId,
    p_room_id:           roomId,
    p_local_session_id:  localSessionId,
    p_started_at:        startedAt,
    p_ended_at:          endedAt,
    p_duration_seconds:  durationSeconds,
    p_distance_metres:   distanceMetres,
    p_points:            points,
    p_buffer_metres:     20,
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
          loopPointsAwarded: 0,
          alreadySaved: true,
          territory: null,
        }
      }
    }
    throw error
  }

  const result = typeof data === 'string' ? JSON.parse(data) : data

  // Optionally credit distance only (non-competitive profile stat)
  if (!result.alreadySaved && distanceMetres > 0) {
    try {
      const { error: statsErr } = await supabaseServiceRole.rpc('add_tracking_stats', {
        p_user_id:     userId,
        p_distance:    distanceMetres,
        p_loop_points: 0,
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
    loopPointsAwarded: 0,
    alreadySaved: result.alreadySaved || false,
    territory: {
      territory: result.territory,
      captures: result.captures || [],
      pointsEarned: result.pointsEarned || 0,
      scoreDelta: result.scoreDelta || 0,
    },
  }
}
