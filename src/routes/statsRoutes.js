import express from 'express'
import * as statsController from '../controllers/statsController.js'
import { requireAuth, requireSelf } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/:id', requireAuth, requireSelf, statsController.getStats)
router.put('/:id', requireAuth, requireSelf, statsController.updateStats)
router.patch('/:id/increment', requireAuth, requireSelf, statsController.incrementStats)

export default router
