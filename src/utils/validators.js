const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' }
  }

  const trimmed = email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: 'Invalid email format' }
  }

  return { valid: true, value: trimmed }
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' }
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' }
  }

  return { valid: true, value: password }
}

export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username is required' }
  }

  const trimmed = username.trim()

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: 'Username must be 3–20 characters (letters, numbers, underscore only)',
    }
  }

  return { valid: true, value: trimmed }
}

export function validateSignupInput({ email, password, username }) {
  const emailResult = validateEmail(email)
  if (!emailResult.valid) return emailResult

  const passwordResult = validatePassword(password)
  if (!passwordResult.valid) return passwordResult

  const usernameResult = validateUsername(username)
  if (!usernameResult.valid) return usernameResult

  return {
    valid: true,
    value: {
      email: emailResult.value,
      password: passwordResult.value,
      username: usernameResult.value,
    },
  }
}

export function validateLoginInput({ email, password }) {
  const emailResult = validateEmail(email)
  if (!emailResult.valid) return emailResult

  const passwordResult = validatePassword(password)
  if (!passwordResult.valid) return passwordResult

  return {
    valid: true,
    value: {
      email: emailResult.value,
      password: passwordResult.value,
    },
  }
}
