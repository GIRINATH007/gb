import express from 'express'
import * as passportController from '../controllers/passportController.js'
import { requireAuth, requireSelf } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/add', requireAuth, passportController.addCity)
router.get('/:id', requireAuth, requireSelf, passportController.getCities)

export default router
