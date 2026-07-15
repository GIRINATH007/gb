import { createClient } from '@supabase/supabase-js'
import  supabase  from '../config/supabase.js'
import { AuthAppError, mapAuthError, mapConfigError } from '../utils/authErrors.js'

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw mapConfigError()
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function sanitizeUser(user) {
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  }
}

async function createProfileAndStats(adminClient, userId, email, username) {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: userId,
      username,
      email,
    })
    .select()
    .single()

  if (profileError) {
    throw mapAuthError(profileError)
  }

  const { data: stats, error: statsError } = await adminClient
    .from('user_stats')
    .insert({ user_id: userId })
    .select()
    .single()

  if (statsError) {
    await adminClient.from('profiles').delete().eq('id', userId)
    throw mapAuthError(statsError)
  }

  return { profile, stats }
}

export async function signup({ email, password, username }) {
  try {
    const adminClient = getServiceRoleClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    if (authError) {
      throw mapAuthError(authError)
    }

    const user = authData.user

    if (!user) {
      throw new AuthAppError(
        'Authentication failed. Please try again.',
        500,
        'AUTH_FAILED'
      )
    }

    try {
      const { profile, stats } = await createProfileAndStats(
        adminClient,
        user.id,
        email,
        username
      )

      return {
        user: sanitizeUser(user),
        profile,
        stats,
      }
    } catch (error) {
      await adminClient.auth.admin.deleteUser(user.id)
      throw mapAuthError(error)
    }
  } catch (error) {
    console.error('RAW LOGIN ERROR:')
    console.error(error)
  
    if (error instanceof AuthAppError) {
      throw error
    }
  
    throw mapAuthError(error)
  }
}

export async function login({ email, password }) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw mapAuthError(error)
    }

    return {
      user: sanitizeUser(data.user),
      session: data.session,
    }
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw mapAuthError(error)
  }
}

export async function logout() {
  return {
    message: 'Logout is handled on the client. Clear the local token/session.',
  }
}

export async function refreshSession(refreshToken) {
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error) {
      throw mapAuthError(error)
    }

    if (!data.session) {
      throw new AuthAppError('Session refresh returned no session', 401, 'REFRESH_FAILED')
    }

    return {
      user: sanitizeUser(data.user),
      session: data.session,
    }
  } catch (error) {
    if (error instanceof AuthAppError) throw error
    throw mapAuthError(error)
  }
}

export async function requestPasswordReset(email) {
  try {
    const adminClient = getServiceRoleClient()

    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (profileErr || !profile) {
      throw new AuthAppError(
        'No account found with this email address',
        404,
        'USER_NOT_FOUND'
      )
    }

    // Strict 4-digit code generator logic
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString()
    const hashedOtp = await bcrypt.hash(otpCode, 10)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: otpErr } = await adminClient
      .from('otp_codes')
      .insert({
        user_id: profile.id,
        email,
        code_hash: hashedOtp,
        type: 'password_reset',
        expires_at: expiresAt
      })

    if (otpErr) throw mapAuthError(otpErr)

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transporter.sendMail({
      from: `"GeoLoop Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'GeoLoop - Password Reset Verification Code',
      text: `Your password reset verification code is: ${otpCode}. It expires in 15 minutes.`,
      html: `<p>Your password reset verification code is: <strong>${otpCode}</strong>.</p><p>It expires in 15 minutes.</p>`,
    })

    return true
  } catch (error) {
    if (error instanceof AuthAppError) throw error
    throw mapAuthError(error)
  }
}

export async function completePasswordReset(email, otpCode, newPassword) {
  try {
    const adminClient = getServiceRoleClient()

    const { data: otpRecords, error: otpErr } = await adminClient
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('type', 'password_reset')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (otpErr || !otpRecords || otpRecords.length === 0) {
      throw new AuthAppError(
        'Invalid or expired reset code',
        400,
        'INVALID_OTP'
      )
    }

    const latestRecord = otpRecords[0]

    const isValid = await bcrypt.compare(otpCode, latestRecord.code_hash)
    if (!isValid) {
      throw new AuthAppError(
        'Incorrect verification code',
        400,
        'INVALID_OTP'
      )
    }

    const { error: authErr } = await adminClient.auth.admin.updateUserById(
      latestRecord.user_id,
      { password: newPassword }
    )

    if (authErr) throw mapAuthError(authErr)

    await adminClient
      .from('otp_codes')
      .delete()
      .eq('id', latestRecord.id)

    return true
  } catch (error) {
    if (error instanceof AuthAppError) throw error
    throw mapAuthError(error)
  }
}