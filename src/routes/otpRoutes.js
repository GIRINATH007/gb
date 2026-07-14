import express from 'express'
import {
    requestOtpController,
    verifyOtpController
} from '../controllers/otpController.js'

const router = express.Router()

router.post('/request-otp', requestOtpController)
router.post('/verify-otp', verifyOtpController)

export default router