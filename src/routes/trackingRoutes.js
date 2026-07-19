import express from 'express'
import * as trackingController from '../controllers/trackingController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { requireRoomMember } from '../middleware/roomMiddleware.js'

const router = express.Router()

router.post('/complete', requireAuth, requireRoomMember, trackingController.saveTrack)

export default router
