import express from 'express'
import * as territoryController from '../controllers/territoryController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', requireAuth, territoryController.listMyTerritories)
router.get('/all', requireAuth, territoryController.listAllTerritories)
router.get('/stats', requireAuth, territoryController.myStats)
router.get('/:id/history', requireAuth, territoryController.territoryHistory)

export default router
