import supabase from '../config/supabase.js'
import * as passportService from './passportService.js'

const PROFILE_PUBLIC_FIELDS =
  'id, username, avatar_url, bio, xp, level, created_at'

const STATS_CORE_FIELDS =
  'missions_completed, distance_travelled, energy, loop_points, global_rank, coins'

function createServiceError(message, code, statusCode = 400) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

export async function areFriends(userId, friendId) {
  const { data, error } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

async function getFriendsCount(userId) {
  const { count, error } = await supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return count || 0
}

export async function sendFriendRequest(senderId, receiverId) {
  if (senderId === receiverId) {
    throw createServiceError('Cannot send a friend request to yourself', 'SELF_REQUEST')
  }

  const { data: receiver, error: receiverError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', receiverId)
    .maybeSingle()

  if (receiverError) {
    throw receiverError
  }

  if (!receiver) {
    throw createServiceError('User not found', 'USER_NOT_FOUND', 404)
  }

  if (await areFriends(senderId, receiverId)) {
    throw createServiceError('Users are already friends', 'ALREADY_FRIENDS', 409)
  }

  const { data: pendingOutgoing, error: outgoingError } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')
    .maybeSingle()

  if (outgoingError) {
    throw outgoingError
  }

  if (pendingOutgoing) {
    throw createServiceError('Friend request already sent', 'REQUEST_EXISTS', 409)
  }

  const { data: pendingIncoming, error: incomingError } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('sender_id', receiverId)
    .eq('receiver_id', senderId)
    .eq('status', 'pending')
    .maybeSingle()

  if (incomingError) {
    throw incomingError
  }

  if (pendingIncoming) {
    throw createServiceError(
      'This user already sent you a friend request',
      'INCOMING_REQUEST_EXISTS',
      409
    )
  }

  const { error } = await supabase.from('friend_requests').insert([
    {
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
    },
  ])

  if (error) {
    if (error.code === '23505') {
      throw createServiceError('Friend request already exists', 'REQUEST_EXISTS', 409)
    }

    throw error
  }
}

export async function getPendingRequests(receiverId) {
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id, created_at')
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  if (!requests?.length) {
    return []
  }

  const senderIds = [...new Set(requests.map((row) => row.sender_id))]

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', senderIds)

  if (profilesError) {
    throw profilesError
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))

  return requests.map((row) => {
    const sender = profileById.get(row.sender_id)

    return {
      request_id: row.id,
      sender_id: sender?.id || row.sender_id,
      sender_username: sender?.username,
      sender_avatar: sender?.avatar_url,
      created_at: row.created_at,
    }
  })
}

export async function acceptFriendRequest(receiverId, requestId) {
  const { error } = await supabase.rpc('accept_friend_request', {
    p_request_id: requestId,
    p_receiver_id: receiverId,
  })

  if (error) {
    if (error.code === 'P0001' || error.message?.includes('not found')) {
      throw createServiceError('Friend request not found', 'REQUEST_NOT_FOUND', 404)
    }

    if (error.code === '23505') {
      throw createServiceError('Users are already friends', 'ALREADY_FRIENDS', 409)
    }

    throw error
  }
}

export async function rejectFriendRequest(receiverId, requestId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw createServiceError('Friend request not found', 'REQUEST_NOT_FOUND', 404)
  }
}

export async function getFriendsList(userId) {
  const { data: friendships, error } = await supabase
    .from('friends')
    .select('friend_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  if (!friendships?.length) {
    return []
  }

  const friendIds = friendships.map((row) => row.friend_id)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', friendIds)

  if (profilesError) {
    throw profilesError
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))

  return friendIds
    .map((friendId) => profileById.get(friendId))
    .filter(Boolean)
}

function resolveRelationshipStatus(targetId, friendIds, pendingByTarget) {
  if (friendIds.has(targetId)) {
    return 'friend'
  }

  const pending = pendingByTarget.get(targetId)

  if (pending === 'sent') {
    return 'pending_sent'
  }

  if (pending === 'received') {
    return 'pending_received'
  }

  return 'none'
}

export async function searchUsersByUsername(userId, username) {
  const trimmed = (username || '').trim()

  if (!trimmed) {
    return []
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${trimmed}%`)
    .neq('id', userId)
    .order('username', { ascending: true })
    .limit(20)

  if (error) {
    throw error
  }

  const profiles = data || []

  if (!profiles.length) {
    return []
  }

  const targetIds = profiles.map((profile) => profile.id)
  const targetIdSet = new Set(targetIds)

  const [
    { data: friendRows, error: friendsError },
    { data: pendingRows, error: pendingError },
  ] = await Promise.all([
    supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', userId)
      .in('friend_id', targetIds),
    supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('status', 'pending')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  ])

  if (friendsError) {
    throw friendsError
  }

  if (pendingError) {
    throw pendingError
  }

  const friendIds = new Set((friendRows || []).map((row) => row.friend_id))
  const pendingByTarget = new Map()

  for (const row of pendingRows || []) {
    if (row.sender_id === userId && targetIdSet.has(row.receiver_id)) {
      pendingByTarget.set(row.receiver_id, 'sent')
    } else if (row.receiver_id === userId && targetIdSet.has(row.sender_id)) {
      pendingByTarget.set(row.sender_id, 'received')
    }
  }

  return profiles.map((profile) => ({
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    relationship_status: resolveRelationshipStatus(
      profile.id,
      friendIds,
      pendingByTarget
    ),
  }))
}

export async function getFriendProfileSummary(userId, friendId) {
  if (!(await areFriends(userId, friendId))) {
    throw createServiceError('Users are not friends', 'NOT_FRIENDS', 403)
  }

  const [
    { data: profile, error: profileError },
    friends_count,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(PROFILE_PUBLIC_FIELDS)
      .eq('id', friendId)
      .single(),
    getFriendsCount(friendId),
  ])

  if (profileError) {
    if (profileError.code === 'PGRST116') {
      throw createServiceError('User not found', 'USER_NOT_FOUND', 404)
    }

    throw profileError
  }

  // Fetch stats — try with coins column first, fall back without it
  let stats = null
  const { data: statsData, error: statsError } = await supabase
    .from('user_stats')
    .select(STATS_CORE_FIELDS)
    .eq('user_id', friendId)
    .maybeSingle()

  if (statsError) {
    // If the error is about a missing column (e.g. coins not yet migrated),
    // retry with the base fields only
    const isColumnError =
      statsError.message?.includes('column') ||
      statsError.code === '42703'

    if (isColumnError) {
      const { data: fallbackStats, error: fallbackError } = await supabase
        .from('user_stats')
        .select('missions_completed, distance_travelled, energy, loop_points, global_rank')
        .eq('user_id', friendId)
        .maybeSingle()

      if (fallbackError) {
        throw fallbackError
      }

      stats = fallbackStats
    } else {
      throw statsError
    }
  } else {
    stats = statsData
  }

  return {
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    bio: profile.bio ?? '',
    xp: profile.xp,
    level: profile.level,
    created_at: profile.created_at,
    friends_count,
    stats: {
      missions_completed: stats?.missions_completed ?? 0,
      distance_travelled: stats?.distance_travelled ?? 0,
      energy: stats?.energy ?? 0,
      loop_points: stats?.loop_points ?? 0,
      global_rank: stats?.global_rank ?? null,
      coins: stats?.coins ?? 0,
    },
  }
}

export async function removeFriend(userId, friendId) {
  if (userId === friendId) {
    throw createServiceError('Cannot unfriend yourself', 'SELF_UNFRIEND')
  }

  if (!(await areFriends(userId, friendId))) {
    throw createServiceError('Users are not friends', 'NOT_FRIENDS', 403)
  }

  const { error: firstError } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId)

  if (firstError) {
    throw firstError
  }

  const { error: secondError } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', userId)

  if (secondError) {
    throw secondError
  }
}

export async function getFriendPassport(userId, friendId) {
  if (!(await areFriends(userId, friendId))) {
    throw createServiceError('Users are not friends', 'NOT_FRIENDS', 403)
  }

  return passportService.getVisitedCities(friendId)
}
