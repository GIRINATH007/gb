import supabase from '../config/supabase.js'
import { checkOtpRequestAllowed, requestOtp, verifyOtp } from './otpService.js'
import { signup as authServiceSignup } from './authService.js'
import { validatePassword, validateSignupInput } from '../utils/validators.js'

class SignupError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message)
    this.name = 'SignupError'
    this.code = code
    this.statusCode = statusCode
  }
}

const SIGNUP_SESSION_EXPIRY_MINUTES = 10

export const signupInit = async (email, password, username) => {
  const validation = validateSignupInput({ email, password, username })
  if (!validation.valid) {
    throw new SignupError(validation.message, 'VALIDATION_ERROR')
  }

  email = validation.value.email
  username = validation.value.username
  checkOtpRequestAllowed(email, 'signup')

  // Check if user already exists in profiles
  const { data: existingUser, error: checkError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (checkError) {
    throw new SignupError('Error checking existing user', 'SERVER_ERROR', 500)
  }

  if (existingUser) {
    throw new SignupError('User already registered', 'USER_ALREADY_EXISTS')
  }

  // Delete any existing signup session for this email
  await supabase
    .from('signup_sessions')
    .delete()
    .eq('email', email)

  // Create new signup session
  const expiresAt = new Date(Date.now() + SIGNUP_SESSION_EXPIRY_MINUTES * 60000).toISOString()

  const { error: insertError } = await supabase
    .from('signup_sessions')
    .insert([{
      email,
      username,
      otp_verified: false,
      expires_at: expiresAt
    }])

  if (insertError) {
    console.error('Signup session insert error:', insertError)
    throw new SignupError('Failed to create signup session', 'SERVER_ERROR', 500)
  }

  // Trigger OTP
  await requestOtp(email, 'signup')

  return { message: 'Signup session initiated. OTP sent to email.' }
}

export const signupComplete = async (email, otp, password) => {
  if (!email || !otp || !password) {
    throw new SignupError('Email, OTP, and password are required', 'MISSING_FIELDS')
  }

  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    throw new SignupError(passwordValidation.message, 'VALIDATION_ERROR')
  }

  email = email.toLowerCase().trim()

  // Check signup session
  const { data: sessionData, error: sessionError } = await supabase
    .from('signup_sessions')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (sessionError) {
    throw new SignupError('Error fetching signup session', 'SERVER_ERROR', 500)
  }

  if (!sessionData) {
    throw new SignupError('Signup session not found', 'SESSION_NOT_FOUND', 404)
  }

  if (new Date(sessionData.expires_at) < new Date()) {
    throw new SignupError('Signup session expired', 'SESSION_EXPIRED')
  }

  // Verify OTP only after the signup session has been validated.
  await verifyOtp(email, otp, 'signup')

  // Create the Supabase Auth user and initialize profile/stats
  // using the existing authService which handles all of this securely
  const authResult = await authServiceSignup({
    email,
    password,
    username: sessionData.username
  })

 
  // Clean up signup session
  await supabase
    .from('signup_sessions')
    .delete()
    .eq('id', sessionData.id)

  return authResult
}
