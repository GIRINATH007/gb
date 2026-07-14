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

export async function refreshSession({ refresh_token }) {
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token })

    if (error || !data?.session) {
      throw mapAuthError(error || new Error('No session returned from refresh'))
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
