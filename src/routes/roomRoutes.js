import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import * as roomController from '../controllers/roomController.js'

const router = Router()


router.post('/create', requireAuth, roomController.createRoom)
router.post('/join', requireAuth, roomController.joinRoom)
router.get('/my-rooms', requireAuth, roomController.getUserRooms)
router.get('/:roomId', roomController.getRoomDetails)
router.get('/:roomId/leaderboard', roomController.getRoomLeaderboard)
router.post('/:roomId/capture', requireAuth, roomController.capturePath)
router.get('/:roomId/territories', requireAuth, roomController.getTerritories)
router.get('/:roomId/territories/stats', requireAuth, roomController.getTerritoryStats)
router.post('/:roomId/score', requireAuth, roomController.updateScore)
router.post('/:roomId/leave', requireAuth, roomController.leaveRoom)

export default router
