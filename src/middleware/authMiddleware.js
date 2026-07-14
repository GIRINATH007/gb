import supabase from '../config/supabase.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Missing authorization token',
      code: 'AUTH_REQUIRED',
    })
  }

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token',
      code: 'AUTH_INVALID',
    })
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
  }

  return next()
}

export function requireSelf(req, res, next) {
  if (!req.user || req.user.id !== req.params.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      code: 'FORBIDDEN',
    })
  }

  return next()
}
