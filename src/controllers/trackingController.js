import * as trackingService from '../services/trackingService.js'

export async function saveTrack(req, res, next) {
  try {
    const userId = req.user.id
    const {
      localSessionId,
      roomId,
      startedAt,
      endedAt,
      durationSeconds,
      points,
      distanceMetres,
      loops,
    } = req.body

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'roomId is required for tracking',
        code: 'VALIDATION_ERROR',
      })
    }

    if (!localSessionId || !startedAt || !endedAt || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing or malformed tracking data payloads.',
        code: 'VALIDATION_ERROR',
      })
    }

    // Numeric guard — prevent negative/NaN values from corrupting stats
    const safeDuration = Math.max(0, parseInt(durationSeconds, 10) || 0)
    const safeDistance  = Math.max(0, parseFloat(distanceMetres) || 0)
    const loopsCompleted = Array.isArray(loops)
      ? Math.max(0, loops.length)
      : Math.max(0, parseInt(loops, 10) || 0)

    // Size guard — prevent abuse via enormous payloads
    if (points.length > 50_000) {
      return res.status(400).json({
        success: false,
        message: `Too many GPS points (${points.length}). Maximum is 50,000.`,
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await trackingService.completeSession(userId, {
      localSessionId,
      roomId,
      startedAt,
      endedAt,
      durationSeconds: safeDuration,
      distanceMetres:  safeDistance,
      points,
      loopsCompleted,
    })

    return res.status(201).json({
      success: true,
      loopPointsAwarded: result.loopPointsAwarded,
      territory: result.territory || null,
      alreadySaved: result.alreadySaved || false,
    })
  } catch (error) {
    next(error)
  }
}
