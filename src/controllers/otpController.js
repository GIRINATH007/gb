import { requestOtp, verifyOtp, OtpError } from '../services/otpService.js'

export const requestOtpController = async (req, res) => {
  try {
    const { email, otp_type } = req.body

    if (!email || !otp_type) {
      return res.status(400).json({
        success: false,
        message: 'Email and otp_type are required',
        code: 'BAD_REQUEST'
      })
    }

    await requestOtp(email, otp_type)

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {}
    })
  } catch (error) {
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      })
    }

    console.error(error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    })
  }
}

export const verifyOtpController = async (req, res) => {
  try {
    const { email, otp, otp_type } = req.body

    if (!email || !otp || !otp_type) {
      return res.status(400).json({
        success: false,
        message: 'Email, otp, and otp_type are required',
        code: 'BAD_REQUEST'
      })
    }

    await verifyOtp(email, otp, otp_type)

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {}
    })
  } catch (error) {
    if (error instanceof OtpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      })
    }

    console.error(error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    })
  }
}