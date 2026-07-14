import { signupInit, signupComplete } from '../services/signupService.js'

export const signupInitController = async (req, res) => {
  try {
    const { email, password, username } = req.body
    const result = await signupInit(email, password, username)
    
    res.status(200).json({
      success: true,
      message: result.message
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'SERVER_ERROR'
    })
  }
}

export const signupCompleteController = async (req, res) => {
  try {
    const { email, otp, password } = req.body
    const result = await signupComplete(email, otp, password)
    
    res.status(200).json({
      success: true,
      message: 'Signup completed successfully',
      data: result
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'SERVER_ERROR'
    })
  }
}
