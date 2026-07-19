import supabase from '../config/supabase.js'

/**
 * Ensures the authenticated user is a member of the room referenced by
 * req.body.roomId or req.params.roomId.
 */
export async function requireRoomMember(req, res, next) {
  const roomId = req.body?.roomId || req.params?.roomId

  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'roomId is required',
      code: 'VALIDATION_ERROR',
    })
  }

  const { data, error } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', req.user.id)
    .maybeSingle()

  if (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify room membership',
      code: 'MEMBERSHIP_CHECK_ERROR',
    })
  }

  if (!data) {
    return res.status(403).json({
      success: false,
      message: 'You are not a member of this room',
      code: 'NOT_ROOM_MEMBER',
    })
  }

  return next()
}
