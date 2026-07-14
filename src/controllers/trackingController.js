import * as trackingService from '../services/trackingService.js'

/**
 * POST /tracking/complete
 * Requires: Authorization: Bearer <token>
 * Body: { localSessionId, startedAt, endedAt, durationSeconds, distanceMetres, points }
 */
export async function complete(req, res) {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authenticated user',
        code: 'AUTH_REQUIRED',
      })
    }

    const {
      localSessionId,
      startedAt,
      endedAt,
      distanceMetres,
      durationSeconds,
      points,
      elevationGainMetres,
      avgPaceSecondsPerKm,
      splits,
    } = req.body

    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'points must be a non-empty array',
        code: 'MISSING_POINTS',
      })
    }

    if (!Number.isFinite(distanceMetres) || distanceMetres < 0) {
      return res.status(400).json({
        success: false,
        message: 'distanceMetres must be a non-negative number',
        code: 'INVALID_DISTANCE',
      })
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      return res.status(400).json({
        success: false,
        message: 'durationSeconds must be a non-negative number',
        code: 'INVALID_DURATION',
      })
    }

    const session = await trackingService.completeSession(userId, {
      localSessionId,
      startedAt,
      endedAt,
      distanceMetres,
      durationSeconds,
      points,
      elevationGainMetres,
      avgPaceSecondsPerKm,
      splits,
    })

    return res.status(201).json({ success: true, data: session })
  } catch (error) {
    console.error('[tracking/complete]', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete tracking session',
      code: error.code || 'TRACKING_COMPLETE_ERROR',
    })
  }
}
