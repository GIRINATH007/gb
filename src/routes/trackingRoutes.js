import express from 'express'
import * as trackingController from '../controllers/trackingController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/complete', requireAuth, trackingController.complete)

export default router
