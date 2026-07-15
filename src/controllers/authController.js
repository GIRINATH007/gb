import * as authService from '../services/authService.js'
import * as coinService from '../services/coinService.js'

function handleError(res, error) {
  const statusCode = error.statusCode || 500
  const message = error.message || 'Authentication failed. Please try again.'
  const code = error.code || 'AUTH_FAILED'

  return res.status(statusCode).json({
    success: false,
    message,
    code,
  })
}

export async function signup(req, res) {
  return res.status(400).json({
    success: false,
    message: 'Signup requires OTP verification. Use /auth/signup-init and /auth/signup-complete.',
    code: 'OTP_SIGNUP_REQUIRED',
  })
}

export async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email and password',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await authService.login({ email, password })

    try {
      const coinReward = await coinService.addCoinsOnLogin(result.user.id)
      result.coinReward = coinReward
    } catch (coinError) {
      console.error('Failed to award coins on login:', coinError)
    }

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

export async function logout(req, res) {
  try {
    const result = await authService.logout()

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

export async function refresh(req, res) {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Missing refresh token',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await authService.refreshSession(refresh_token)

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleError(res, error)
  }
}
export async function passwordResetRequest(req, res) {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: refresh_token',
        code: 'VALIDATION_ERROR',
      })
    }

    const result = await authService.refreshSession({ refresh_token })

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleError(res, error)
  }
}
