import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import * as passwordResetController from '../controllers/passwordResetController.js'

const router = Router()

router.post('/signup', authController.signup)
router.post('/login', authController.login)
router.post('/logout', authController.logout)
router.post('/refresh', authController.refresh)
router.post('/password-reset/request', authController.passwordResetRequest)
router.post('/password-reset/complete', passwordResetController.completePasswordResetController)

export default router

