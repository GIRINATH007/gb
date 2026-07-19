import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRoomMember } from '../middleware/roomMiddleware.js'
import * as roomController from '../controllers/roomController.js'

const router = Router()

router.post('/create', requireAuth, roomController.createRoom)
router.post('/join', requireAuth, roomController.joinRoom)
router.get('/my-rooms', requireAuth, roomController.getUserRooms)
router.get('/:roomId', requireAuth, requireRoomMember, roomController.getRoomDetails)
router.get('/:roomId/leaderboard', requireAuth, requireRoomMember, roomController.getRoomLeaderboard)
router.get('/:roomId/territories', requireAuth, requireRoomMember, roomController.getTerritories)
router.get('/:roomId/territories/stats', requireAuth, requireRoomMember, roomController.getTerritoryStats)
router.post('/:roomId/leave', requireAuth, requireRoomMember, roomController.leaveRoom)

export default router
