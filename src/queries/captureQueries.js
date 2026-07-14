import supabase from '../config/supabase.js'

/**
 * Atomically transfer territory ownership.
 * Calls the PostGIS function capture_territory which locks the row,
 * logs the change, and updates the owner in one transaction.
 *
 * @param {string} territoryId
 * @param {string} newOwnerId
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export async function captureTerritory(territoryId, newOwnerId, sessionId) {
  const { data, error } = await supabase.rpc('capture_territory', {
    p_territory_id:  territoryId,
    p_new_owner_id:  newOwnerId,
    p_session_id:    sessionId,
  })

  if (error) throw error
  return data === true
}

/**
 * Get the ownership history for a specific territory.
 *
 * @param {string} territoryId
 * @returns {Promise<Array>}
 */
export async function getTerritoryHistory(territoryId) {
  const { data, error } = await supabase
    .from('territory_ownership_log')
    .select('id, prev_owner_id, new_owner_id, session_id, captured_at')
    .eq('territory_id', territoryId)
    .order('captured_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get all captures performed by a user (as attacker).
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserCaptures(userId) {
  const { data, error } = await supabase
    .from('territory_ownership_log')
    .select('id, territory_id, prev_owner_id, captured_at')
    .eq('new_owner_id', userId)
    .order('captured_at', { ascending: false })

  if (error) throw error
  return data || []
}
