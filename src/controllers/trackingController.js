import * as trackingService from '../services/trackingService.js'

export async function saveTrack(req, res, next) {
    try {
        const userId = req.user.id;
        const {
            localSessionId,
            startedAt,
            endedAt,
            durationSeconds,
            points,
            distanceMetres,
            elevationGainMetres = 0,
            avgPaceSecondsPerKm = 0,
            splits = [],
            roomId,
        } = req.body;

        if (!localSessionId || !startedAt || !endedAt || !Array.isArray(points) || points.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing or malformed tracking data payloads.',
                code: 'VALIDATION_ERROR',
            });
        }

        const result = await trackingService.completeSession(userId, {
            localSessionId,
            startedAt,
            endedAt,
            durationSeconds,
            distanceMetres,
            points,
            elevationGainMetres,
            avgPaceSecondsPerKm,
            splits,
            roomId,
        });

        return res.status(201).json({
            success: true,
            loopPointsAwarded: result.loopPointsAwarded,
            territory: result.territory || null,
            alreadySaved: result.alreadySaved || false,
        });
    } catch (error) {
        next(error);
    }
}