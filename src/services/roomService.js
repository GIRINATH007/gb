import { randomUUID } from 'node:crypto'
import supabase from '../config/supabase.js'
import { AuthAppError } from '../utils/authErrors.js'
import { processTrackingSession } from './territoryService.js'
import { getRoomTerritories as getTerritoriesQuery } from '../queries/territoryQueries.js'

const MAX_ROOMS_PER_USER = 5
const MAX_ROOM_MEMBERS = 20

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function createRoom(userId, roomName) {
  try {

    const { data: rooms, error: checkError } = await supabase
      .from('room_members')
      .select('room_id', { count: 'exact' })
      .eq('user_id', userId)

    if (checkError) {
      console.error('Room count check error:', checkError)
      throw new AuthAppError(checkError.message || 'Failed to check room count', 500, 'CHECK_ERROR')
    }

    if (rooms.length >= MAX_ROOMS_PER_USER) {
      throw new AuthAppError(
        `User can only be in ${MAX_ROOMS_PER_USER} rooms`,
        400,
        'MAX_ROOMS_EXCEEDED'
      )
    }


    let code = generateRoomCode()
    let codeExists = true
    let attempts = 0

    while (codeExists && attempts < 10) {
      const { data: existing } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .single()

      if (!existing) {
        codeExists = false
      } else {
        code = generateRoomCode()
        attempts++
      }
    }

    if (codeExists) {
      throw new AuthAppError(
        'Failed to generate unique room code',
        500,
        'CODE_GENERATION_ERROR'
      )
    }

  //rrom create
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        name: roomName,
        creator_id: userId,
        max_members: MAX_ROOM_MEMBERS,
      })
      .select()
      .single()

    if (roomError) {
      throw new AuthAppError('Failed to create room', 500, 'ROOM_CREATE_ERROR')
    }

    // Add creator
    const { data: member, error: memberError } = await supabase
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: userId,
        score: 0,
      })
      .select()
      .single()

    if (memberError) {

      await supabase.from('rooms').delete().eq('id', room.id)
      throw new AuthAppError('Failed to add creator to room', 500, 'MEMBER_ADD_ERROR')
    }

    return {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        creatorId: room.creator_id,
        maxMembers: room.max_members,
        createdAt: room.created_at,
      },
    }
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Create room failed', 500, 'ROOM_CREATE_FAILED')
  }
}
export async function joinRoomByCode(userId, code) {
  try {
    const { data: userRooms, error: checkError } = await supabase
      .from('room_members')
      .select('room_id', { count: 'exact' })
      .eq('user_id', userId)

    if (checkError) {
      throw new AuthAppError('Failed to check room count', 500, 'CHECK_ERROR')
    }

    if (userRooms.length >= MAX_ROOMS_PER_USER) {
      throw new AuthAppError(
        `User can only be in ${MAX_ROOMS_PER_USER} rooms`,
        400,
        'MAX_ROOMS_EXCEEDED'
      )
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, code, name, max_members')
      .eq('code', code)
      .single()

    if (roomError || !room) {
      throw new AuthAppError('Room not found', 404, 'ROOM_NOT_FOUND')
    }


    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .single()

    if (existingMember) {
      throw new AuthAppError('User already in room', 400, 'ALREADY_IN_ROOM')
    }

    const { data: members, error: membersError } = await supabase
      .from('room_members')
      .select('id', { count: 'exact' })
      .eq('room_id', room.id)

    if (membersError) {
      throw new AuthAppError('Failed to check room capacity', 500, 'CAPACITY_CHECK_ERROR')
    }

    if (members.length >= room.max_members) {
      throw new AuthAppError('Room is full', 400, 'ROOM_FULL')
    }

    const { data: newMember, error: addError } = await supabase
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: userId,
        score: 0,
      })
      .select()
      .single()

    if (addError) {
      throw new AuthAppError('Failed to join room', 500, 'JOIN_ERROR')
    }

    return {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        maxMembers: room.max_members,
      },
    }
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Join room failed', 500, 'JOIN_ROOM_FAILED')
  }
}

export async function getUserRooms(userId) {
  try {
    const { data: rooms, error } = await supabase
      .from('room_members')
      .select(
        `
        room_id,
        score,
        joined_at,
        rooms:room_id(
          id,
          code,
          name,
          creator_id,
          max_members,
          created_at
        )
      `
      )
      .eq('user_id', userId)

    if (error) {
      throw new AuthAppError('Failed to fetch rooms', 500, 'FETCH_ERROR')
    }

    const base = rooms.map(rm => ({
      id: rm.rooms.id,
      code: rm.rooms.code,
      name: rm.rooms.name,
      creatorId: rm.rooms.creator_id,
      maxMembers: rm.rooms.max_members,
      userScore: rm.score,
      joinedAt: rm.joined_at,
      createdAt: rm.rooms.created_at,
    }))

    // Enrich with territory count per room
    const enriched = await Promise.all(base.map(async (r) => {
      try {
        const { count } = await supabase
          .from('territories')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .eq('room_id', r.id)
        return { ...r, territoryCount: count ?? 0 }
      } catch {
        return { ...r, territoryCount: 0 }
      }
    }))
    return enriched
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Get rooms failed', 500, 'GET_ROOMS_FAILED')
  }
}

export async function getRoomLeaderboard(roomId) {
  try {
    const { data: leaderboard, error } = await supabase
      .from('room_leaderboard')
      .select('*')
      .eq('room_id', roomId)
      .order('rank', { ascending: true })

    if (error) {
      throw new AuthAppError('Failed to fetch leaderboard', 500, 'FETCH_ERROR')
    }

    return leaderboard.map(entry => ({
      userId: entry.user_id,
      username: entry.username,
      score: entry.score,
      rank: entry.rank,
      joinedAt: entry.joined_at,
    }))
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Get leaderboard failed', 500, 'LEADERBOARD_FAILED')
  }
}

export async function updateRoomScore(userId, roomId, scoreIncrement) {
  try {
    const { data: member, error: fetchError } = await supabase
      .from('room_members')
      .select('score')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .single()

    if (fetchError || !member) {
      throw new AuthAppError('User not in room', 404, 'USER_NOT_IN_ROOM')
    }

    // Update score
    const { data: updated, error: updateError } = await supabase
      .from('room_members')
      .update({
        score: member.score + scoreIncrement,
      })
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .select()
      .single()

    if (updateError) {
      throw new AuthAppError('Failed to update score', 500, 'UPDATE_ERROR')
    }

    return updated
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Update score failed', 500, 'UPDATE_SCORE_FAILED')
  }
}

export async function leaveRoom(userId, roomId) {
  try {
    // Verify user is actually in the room
    const { data: membership, error: memberCheckError } = await supabase
      .from('room_members')
      .select('id')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .maybeSingle()

    if (memberCheckError) {
      throw new AuthAppError('Failed to check membership', 500, 'CHECK_ERROR')
    }

    if (!membership) {
      throw new AuthAppError('User is not in this room', 400, 'NOT_IN_ROOM')
    }

    // Delete the membership
    const { error: deleteError } = await supabase
      .from('room_members')
      .delete()
      .eq('user_id', userId)
      .eq('room_id', roomId)

    if (deleteError) {
      throw new AuthAppError('Failed to leave room', 500, 'DELETE_ERROR')
    }

    // Re-count remaining members AFTER the delete to avoid off-by-one
    const { data: remaining, error: countError } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)

    if (!countError && (!remaining || remaining.length === 0)) {
      // Last member left — delete the room
      await supabase.from('rooms').delete().eq('id', roomId)
    }

    return { success: true }
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Leave room failed', 500, 'LEAVE_ROOM_FAILED')
  }
}

/**
 * Explicitly capture a path in a room (alternative to piggybacking on tracking).
 * Generates a temporary session reference and runs the territory pipeline.
 *
 * @param {string} userId
 * @param {string} roomId
 * @param {Array<{lat: number, lng: number}>} points
 * @param {number} distanceMetres
 * @returns {Promise<object>} Territory + captures + pointsEarned + scoreDelta
 */
export async function capturePathInRoom(userId, roomId, points, distanceMetres) {
  const tempSessionId = randomUUID()

  const result = await processTrackingSession(userId, tempSessionId, points, roomId)

  return {
    territory: result.territory,
    captures: result.captures,
    pointsEarned: result.pointsEarned,
    scoreDelta: result.scoreDelta,
  }
}

/**
 * Get all territories in a room (for map overlay as GeoJSON).
 *
 * @param {string} roomId
 * @returns {Promise<Array>}
 */
export async function getTerritoriesForRoom(roomId) {
  try {
    const territories = await getTerritoriesQuery(roomId)
    return territories
  } catch (error) {
    if (error instanceof AuthAppError) throw error
    throw new AuthAppError('Failed to fetch room territories', 500, 'TERRITORIES_FETCH_ERROR')
  }
}

/**
 * Get territory stats per user in a room.
 *
 * @param {string} roomId
 * @returns {Promise<Array<{ user_id: string, territory_count: number, total_area_sqm: number }>>}
 */
export async function getRoomTerritoryStats(roomId) {
  try {
    const { data, error } = await supabase.rpc('get_room_territory_stats', {
      p_room_id: roomId,
      p_user_id: null,
    })

    if (error) throw error
    return data || []
  } catch (error) {
    if (error instanceof AuthAppError) throw error
    throw new AuthAppError('Failed to fetch territory stats', 500, 'STATS_FETCH_ERROR')
  }
}

export async function getRoomDetails(roomId) {
  try {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, code, name, creator_id, max_members, created_at')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      throw new AuthAppError('Room not found', 404, 'ROOM_NOT_FOUND')
    }

    const { data: members, error: membersError } = await supabase
      .from('room_members')
      .select('id', { count: 'exact' })
      .eq('room_id', roomId)

    if (membersError) {
      throw new AuthAppError('Failed to fetch members', 500, 'MEMBERS_ERROR')
    }

    return {
      id: room.id,
      code: room.code,
      name: room.name,
      creatorId: room.creator_id,
      maxMembers: room.max_members,
      memberCount: members.length,
      createdAt: room.created_at,
    }
  } catch (error) {
    if (error instanceof AuthAppError) {
      throw error
    }
    throw new AuthAppError('Get room details failed', 500, 'DETAILS_FAILED')
  }
}
