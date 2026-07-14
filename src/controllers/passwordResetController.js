import {
  requestPasswordReset,
  completePasswordReset,
} from '../services/passwordResetService.js'
import { OtpError } from '../services/otpService.js'

export async function requestPasswordResetController(req, res) {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await requestPasswordReset(email)

    return res.status(200).json({
      success: true,
      message: result.message,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    const code = error.code || 'SERVER_ERROR'

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to send reset OTP',
      code,
    })
  }
}

export async function completePasswordResetController(req, res) {
  try {
    const { email, otp, new_password } = req.body

    if (!email || !otp || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Email, otp, and new_password are required',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await completePasswordReset(email, otp, new_password)

    return res.status(200).json({
      success: true,
      message: result.message,
    })
  } catch (error) {
    // Handle OTP-specific errors with their proper status codes
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      })
    }

    const statusCode = error.statusCode || 500
    const code = error.code || 'SERVER_ERROR'

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to reset password',
      code,
    })
  }
}
