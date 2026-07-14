import express from 'express'
import * as profileController from '../controllers/profileController.js'
import { requireAuth, requireSelf } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/:id', requireAuth, requireSelf, profileController.getProfile)
router.put('/:id', requireAuth, requireSelf, profileController.updateProfile)

export default router
