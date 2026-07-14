import { AppError } from './AppError.js'

export class AuthAppError extends AppError {
  constructor(message, statusCode = 500, code = 'AUTH_FAILED') {
    super(message, statusCode)
    this.name = 'AuthAppError'
    this.code = code
  }
}

const AUTH_ERROR_MAP = [
  {
    match: (text, code) =>
      code === 'invalid_credentials' ||
      text.includes('invalid login credentials'),
    message: 'Invalid email or password.',
    statusCode: 401,
    errorCode: 'INVALID_CREDENTIALS',
  },
  {
    match: (text, code) =>
      code === 'email_exists' ||
      code === 'user_already_exists' ||
      text.includes('already registered') ||
      text.includes('user already registered'),
    message: 'This email is already registered.',
    statusCode: 409,
    errorCode: 'EMAIL_ALREADY_REGISTERED',
  },
  {
    match: (text, code) =>
      code === 'weak_password' || text.includes('password should be at least'),
    message: 'Password is too weak. Use at least 8 characters.',
    statusCode: 400,
    errorCode: 'WEAK_PASSWORD',
  },
  {
    match: (text, code) =>
      code === 'email_address_invalid' ||
      text.includes('email address is invalid') ||
      text.includes('invalid email'),
    message: 'Please enter a valid email address.',
    statusCode: 400,
    errorCode: 'INVALID_EMAIL',
  },
  {
    match: (text, code) =>
      code === 'user_not_found' || text.includes('user not found'),
    message: 'No account found with this email.',
    statusCode: 404,
    errorCode: 'USER_NOT_FOUND',
  },
  {
    match: (text, code) =>
      code === 'email_not_confirmed' || text.includes('email not confirmed'),
    message: 'Please confirm your email before signing in.',
    statusCode: 403,
    errorCode: 'EMAIL_NOT_CONFIRMED',
  },
  {
    match: (text) => text.includes('duplicate key') && text.includes('username'),
    message: 'This username is already taken.',
    statusCode: 409,
    errorCode: 'USERNAME_TAKEN',
  },
  {
    match: (text) => text.includes('duplicate key'),
    message: 'This email is already registered.',
    statusCode: 409,
    errorCode: 'EMAIL_ALREADY_REGISTERED',
  },
]

const RATE_LIMIT_MAP = [
  {
    match: (text, code) =>
      code === 'over_email_send_rate_limit' ||
      text.includes('email rate limit exceeded'),
    message: 'Too many emails sent. Please wait a few minutes and try again.',
    statusCode: 429,
    errorCode: 'RATE_LIMIT_EMAIL',
  },
  {
    match: (text, code) =>
      code === 'over_request_rate_limit' ||
      text.includes('too many requests') ||
      text.includes('signup cooldown') ||
      text.includes('rate limit'),
    message: 'Too many attempts. Please wait and try again.',
    statusCode: 429,
    errorCode: 'RATE_LIMIT',
  },
]

const NETWORK_MAP = [
  {
    match: (text, code) =>
      code === 'fetch_failed' ||
      text.includes('fetch failed') ||
      text.includes('network error') ||
      text.includes('unable to reach') ||
      text.includes('econnrefused') ||
      text.includes('enotfound') ||
      text.includes('etimedout') ||
      text.includes('network request failed'),
    message: 'Unable to reach authentication service. Please try again later.',
    statusCode: 503,
    errorCode: 'NETWORK_ERROR',
  },
]

function normalizeErrorInput(error) {
  const message =
    error?.message ||
    error?.error_description ||
    error?.msg ||
    String(error ?? '')

  const code = error?.code || error?.error_code || error?.name || ''

  const status = error?.status || error?.statusCode

  return {
    text: message.toLowerCase(),
    code: String(code).toLowerCase(),
    status,
  }
}

function matchRule(rules, text, code) {
  return rules.find((rule) => rule.match(text, code))
}

export function mapAuthError(error) {
  if (error instanceof AuthAppError) {
    return error
  }

  const { text, code, status } = normalizeErrorInput(error)

  const rateLimit = matchRule(RATE_LIMIT_MAP, text, code)
  if (rateLimit) {
    return new AuthAppError(rateLimit.message, rateLimit.statusCode, rateLimit.errorCode)
  }

  if (status === 429) {
    return new AuthAppError(
      'Too many attempts. Please wait and try again.',
      429,
      'RATE_LIMIT'
    )
  }

  const network = matchRule(NETWORK_MAP, text, code)
  if (network) {
    return new AuthAppError(network.message, network.statusCode, network.errorCode)
  }

  const auth = matchRule(AUTH_ERROR_MAP, text, code)
  if (auth) {
    return new AuthAppError(auth.message, auth.statusCode, auth.errorCode)
  }

  return new AuthAppError(
    'Authentication failed. Please try again.',
    500,
    'AUTH_FAILED'
  )
}

export function mapConfigError() {
  return new AuthAppError(
    'Authentication service is temporarily unavailable.',
    503,
    'AUTH_UNAVAILABLE'
  )
}
