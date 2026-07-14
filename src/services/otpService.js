import supabase from '../config/supabase.js'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { sendOtpEmail } from './emailService.js'
const OTP_LENGTH = 4
const OTP_EXPIRY_MINUTES = 5
const MAX_OTP_ATTEMPTS = 5
const OTP_COOLDOWN_MS = 60 * 1000
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const MAX_OTP_REQUESTS_PER_WINDOW = 5
const otpRequestLimits = new Map()

const ALLOWED_TYPES = [
  'signup',
  'password_reset',
  'login'
]

export class OtpError extends Error {
  constructor(
    message,
    code,
    statusCode = 400
  ) {
    super(message)

    this.name = 'OtpError'
    this.code = code
    this.statusCode = statusCode
  }
}

const generateOtp = () => {
  const max = 10 ** OTP_LENGTH
  return crypto
    .randomInt(0, max)
    .toString()
    .padStart(OTP_LENGTH, '0')
}

export const checkOtpRequestAllowed = (email, otpType) => {
  const key = `${email}:${otpType}`
  const now = Date.now()
  const current = otpRequestLimits.get(key)

  if (current?.cooldownUntil && current.cooldownUntil > now) {
    throw new OtpError(
      'Please wait before requesting another OTP',
      'OTP_COOLDOWN',
      429
    )
  }

  if (
    current &&
    now - current.windowStart <= OTP_RATE_LIMIT_WINDOW_MS &&
    current.count >= MAX_OTP_REQUESTS_PER_WINDOW
  ) {
    throw new OtpError(
      'Too many OTP requests. Please try again later',
      'OTP_RATE_LIMITED',
      429
    )
  }
}

const recordOtpRequest = (email, otpType) => {
  const key = `${email}:${otpType}`
  const now = Date.now()
  const current = otpRequestLimits.get(key)

  if (!current || now - current.windowStart > OTP_RATE_LIMIT_WINDOW_MS) {
    otpRequestLimits.set(key, {
      windowStart: now,
      count: 1,
      cooldownUntil: now + OTP_COOLDOWN_MS,
    })

    return
  }

  otpRequestLimits.set(key, {
    ...current,
    count: current.count + 1,
    cooldownUntil: now + OTP_COOLDOWN_MS,
  })
}

const assertOtpRequestAllowed = (email, otpType) => {
  checkOtpRequestAllowed(email, otpType)
  recordOtpRequest(email, otpType)
}

export const requestOtp = async (
  email,
  otpType
) => {

  email =
    email.toLowerCase().trim()

  otpType =
    otpType.toLowerCase().trim()

  if (
    !ALLOWED_TYPES.includes(otpType)
  ) {
    throw new OtpError(
      'Invalid OTP type',
      'INVALID_OTP_TYPE'
    )
  }

  assertOtpRequestAllowed(email, otpType)

  //Delete previous OTPs
  await supabase
    .from('otp_codes')
    .delete()
    .match({
      email,
      otp_type: otpType
    })

  const rawOtp = generateOtp()

  const hashedOtp =
    await bcrypt.hash(rawOtp, 10)

  const expiresAt = new Date(
    Date.now() +
    OTP_EXPIRY_MINUTES * 60000
  ).toISOString()

  const { error: insertError } =
    await supabase
      .from('otp_codes')
      .insert([
        {
          email,
          otp_code: hashedOtp,
          otp_type: otpType,
          expires_at: expiresAt,
          verified: false,
          attempts: 0
        }
      ])

  if (insertError) {

    console.error(
      'SUPABASE OTP INSERT ERROR:',
      insertError
    )

    throw new OtpError(
      insertError.message,
      'SERVER_ERROR',
      500
    )
  }

  //Replaced with email service later
  await sendOtpEmail(email, rawOtp)

  return true
}

export const verifyOtp = async (
  email,
  otp,
  otpType
) => {

  email =
    email.toLowerCase().trim()

  otpType =
    otpType.toLowerCase().trim()

  if (
    !ALLOWED_TYPES.includes(otpType)
  ) {
    throw new OtpError(
      'Invalid OTP type',
      'INVALID_OTP_TYPE'
    )
  }

  const { data, error } =
    await supabase
      .from('otp_codes')
      .select('*')
      .match({
        email,
        otp_type: otpType
      })
      .order('created_at', {
        ascending: false
      })
      .limit(1)

  if (
    error ||
    !data ||
    data.length === 0
  ) {
    throw new OtpError(
      'OTP not found',
      'OTP_NOT_FOUND',
      404
    )
  }

  const otpRecord = data[0]

  //Already verified
  if (otpRecord.verified) {

    await supabase
      .from('otp_codes')
      .delete()
      .eq('id', otpRecord.id)

    throw new OtpError(
      'OTP already verified',
      'OTP_ALREADY_VERIFIED'
    )
  }

  //Expired OTP
  if (
    new Date(otpRecord.expires_at)
    < new Date()
  ) {

    await supabase
      .from('otp_codes')
      .delete()
      .eq('id', otpRecord.id)

    throw new OtpError(
      'OTP expired',
      'OTP_EXPIRED'
    )
  }

  //Too many attempts
  if (
    otpRecord.attempts
    >= MAX_OTP_ATTEMPTS
  ) {

    await supabase
      .from('otp_codes')
      .delete()
      .eq('id', otpRecord.id)

    throw new OtpError(
      'OTP attempts exceeded',
      'OTP_ATTEMPTS_EXCEEDED'
    )
  }

  const isValid =
    await bcrypt.compare(
      otp,
      otpRecord.otp_code
    )

  //Invalid OTP
  if (!isValid) {

    await supabase
      .from('otp_codes')
      .update({
        attempts:
          otpRecord.attempts + 1
      })
      .eq('id', otpRecord.id)

    throw new OtpError(
      'Invalid OTP',
      'OTP_INVALID'
    )
  }

  //Success
  //Delete OTP after verification
  const { error: deleteError } =
    await supabase
      .from('otp_codes')
      .delete()
      .eq('id', otpRecord.id)

  if (deleteError) {

    throw new OtpError(
      'Failed to cleanup OTP',
      'SERVER_ERROR',
      500
    )
  }

  return true
}
