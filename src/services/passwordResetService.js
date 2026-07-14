import { createClient } from '@supabase/supabase-js'
import supabase from '../config/supabase.js'
import { requestOtp, verifyOtp } from './otpService.js'
import { validateEmail, validatePassword } from '../utils/validators.js'

class PasswordResetError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message)
    this.name = 'PasswordResetError'
    this.code = code
    this.statusCode = statusCode
  }
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new PasswordResetError(
      'Password reset service is temporarily unavailable.',
      'SERVICE_UNAVAILABLE',
      503
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Step 1: Validate the email exists in profiles, then send a password_reset OTP.
 */
export async function requestPasswordReset(email) {
  const emailResult = validateEmail(email)
  if (!emailResult.valid) {
    throw new PasswordResetError(emailResult.message, 'VALIDATION_ERROR')
  }

  const cleanEmail = emailResult.value

  // Verify user exists in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (profileError) {
    throw new PasswordResetError(
      'Unable to verify account. Please try again.',
      'SERVER_ERROR',
      500
    )
  }

  if (!profile) {
    throw new PasswordResetError(
      'No account found with this email.',
      'USER_NOT_FOUND',
      404
    )
  }

  // Send OTP using the existing OTP service with 'password_reset' type
  await requestOtp(cleanEmail, 'password_reset')

  return { message: 'Password reset OTP sent to your email.' }
}

/**
 * Step 2: Verify OTP and update the password using Supabase Admin API.
 */
export async function completePasswordReset(email, otp, newPassword) {
  if (!email || !otp || !newPassword) {
    throw new PasswordResetError(
      'Email, OTP, and new password are required.',
      'MISSING_FIELDS'
    )
  }

  const emailResult = validateEmail(email)
  if (!emailResult.valid) {
    throw new PasswordResetError(emailResult.message, 'VALIDATION_ERROR')
  }

  const passwordResult = validatePassword(newPassword)
  if (!passwordResult.valid) {
    throw new PasswordResetError(passwordResult.message, 'VALIDATION_ERROR')
  }

  const cleanEmail = emailResult.value

  // Verify the OTP — this will throw OtpError on failure
  await verifyOtp(cleanEmail, otp, 'password_reset')

  // Look up the user ID from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (profileError || !profile) {
    throw new PasswordResetError(
      'Account not found. Please try again.',
      'USER_NOT_FOUND',
      404
    )
  }

  // Update the password via Supabase Admin API
  const adminClient = getServiceRoleClient()

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    profile.id,
    { password: newPassword }
  )

  if (updateError) {
    throw new PasswordResetError(
      'Failed to update password. Please try again.',
      'PASSWORD_UPDATE_FAILED',
      500
    )
  }

  return { message: 'Password has been reset successfully.' }
}
