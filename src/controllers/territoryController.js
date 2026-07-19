import {
  getUserTerritories,
  getAllTerritories,
  getUserTerritoryStats,
} from '../queries/territoryQueries.js'
import { getUserCaptures, getTerritoryHistory } from '../queries/captureQueries.js'

export async function listMyTerritories(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'AUTH_REQUIRED' })
    }

    const territories = await getUserTerritories(userId)
    return res.json({ success: true, data: territories })
  } catch (error) {
    console.error('[territories/list]', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

export async function listAllTerritories(req, res) {
  // MVP: global territory map deprecated — use GET /rooms/:roomId/territories
  return res.status(410).json({
    success: false,
    message: 'Global territories endpoint deprecated. Use room-scoped territories.',
    code: 'DEPRECATED',
  })
}

export async function myStats(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'AUTH_REQUIRED' })
    }

    const stats = await getUserTerritoryStats(userId)
    const captures = await getUserCaptures(userId)
    return res.json({
      success: true,
      data: { ...stats, captureCount: captures.length },
    })
  } catch (error) {
    console.error('[territories/stats]', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

export async function territoryHistory(req, res) {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing territory id' })
    }

    const history = await getTerritoryHistory(id)
    return res.json({ success: true, data: history })
  } catch (error) {
    console.error('[territories/history]', error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
