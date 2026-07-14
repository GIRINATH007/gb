import * as statsService from '../services/statsService.js'

const STATS_UPDATE_FIELDS = [
  'missions_completed',
  'distance_travelled',
  'energy',
  'loop_points',
]

function pickAllowedFields(source, allowedFields) {
  return allowedFields.reduce((updates, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      updates[field] = source[field]
    }

    return updates
  }, {})
}

export async function getStats(req, res) {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      })
    }

    const stats = await statsService.getStatsByUserId(id)

    return res.status(200).json({
      success: true,
      data: stats,
    })
  } catch (error) {
    return res.status(error.code === 'PGRST116' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch stats',
      code: error.code || 'STATS_FETCH_ERROR',
    })
  }
}

export async function updateStats(req, res) {
  try {
    const { id } = req.params
    const updates = pickAllowedFields(req.body || {}, STATS_UPDATE_FIELDS)

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      })
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update data provided',
      })
    }

    const updatedStats = await statsService.updateStatsByUserId(id, updates)

    return res.status(200).json({
      success: true,
      data: updatedStats,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update stats',
      code: error.code || 'STATS_UPDATE_ERROR',
    })
  }
}

export async function incrementStats(req, res) {
  try {
    const { id } = req.params
    const { xp, energy, loop_points } = req.body

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      })
    }

    const updatedStats = await statsService.incrementStats(id, { xp, energy, loop_points })

    return res.status(200).json({
      success: true,
      data: updatedStats,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to increment stats',
      code: error.code || 'STATS_INCREMENT_ERROR',
    })
  }
}
