import supabase from '../config/supabase.js'

/**
 * Convert a GPS path into a territory polygon and insert it.
 * Calls the PostGIS function create_territory_from_path.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array<{lat: number, lng: number}>} points — simplified GPS path
 * @param {number} [bufferMetres=20]
 * @param {string} [roomId] — scope territory to a room
 * @returns {Promise<{ territory_id: string, area_sqm: number }>}
 */
export async function createTerritory(userId, sessionId, points, bufferMetres = 20, roomId) {
  const { data, error } = await supabase.rpc('create_territory_from_path', {
    p_user_id:        userId,
    p_session_id:     sessionId,
    p_points:         JSON.stringify(points),
    p_buffer_metres:  bufferMetres,
    p_room_id:        roomId || null,
  })

  if (error) throw error
  return data?.[0] || { territory_id: null, area_sqm: 0 }
}

/**
 * Find existing territories (by other users) that overlap with a given geometry.
 * Calls the PostGIS function find_overlapping_territories.
 *
 * @param {object} geometry — The GeoJSON geometry of the new territory
 * @param {string} ownerId — Exclude the attacking user's own territories
 * @param {string} [roomId] — Scope overlap check to a single room
 * @returns {Promise<Array<{ territory_id: string, owner_id: string, overlap_sqm: number, overlap_percent: number }>>}
 */
export async function findOverlappingTerritories(geometry, ownerId, roomId) {
  const { data, error } = await supabase.rpc('find_overlapping_territories', {
    p_geometry:  geometry,
    p_owner_id:  ownerId,
    p_room_id:   roomId || null,
  })

  if (error) throw error
  return data || []
}

/**
 * Get all territories owned by a user.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserTerritories(userId) {
  const { data, error } = await supabase
    .from('territories')
    .select('id, area_sqm, capture_count, created_at, geometry')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get all territories for a specific room (for map overlay).
 * Returns GeoJSON-friendly format.
 *
 * @param {string} roomId
 * @returns {Promise<Array>}
 */
export async function getRoomTerritories(roomId) {
  const { data, error } = await supabase
    .from('room_territories_view')
    .select('id, owner_id, room_id, area_sqm, capture_count, created_at, geometry')
    .eq('room_id', roomId)

  if (error) throw error
  return data || []
}

/**
 * Get all territories visible on the map (for display).
 * Returns GeoJSON-friendly format.
 *
 * @returns {Promise<Array>}
 */
export async function getAllTerritories() {
  const { data, error } = await supabase
    .from('territories')
    .select('id, owner_id, area_sqm, capture_count, created_at, geometry')

  if (error) throw error
  return data || []
}

/**
 * Get territory stats for a user.
 *
 * @param {string} userId
 * @returns {Promise<{ total_area: number, territory_count: number }>}
 */
export async function getUserTerritoryStats(userId) {
  const { data, error } = await supabase
    .from('territories')
    .select('area_sqm')
    .eq('owner_id', userId)

  if (error) throw error

  const total = (data || []).reduce((sum, t) => sum + (t.area_sqm || 0), 0)
  return {
    total_area: Math.round(total),
    territory_count: (data || []).length,
  }
}
