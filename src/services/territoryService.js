import supabase from '../config/supabase.js'
import {
  createTerritory,
  findOverlappingTerritories,
} from '../queries/territoryQueries.js'
import { captureTerritory } from '../queries/captureQueries.js'
import { resolveCaptures } from './captureService.js'
import { calculateCreationPoints, calculateCapturePoints } from './scoringService.js'

/**
 * Process a completed tracking session through the territory pipeline.
 *
 * Steps:
 *   1. Convert GPS path to a territory polygon (PostGIS)
 *   2. Find overlapping territories owned by other users
 *   3. Resolve which territories are captured (pure logic)
 *   4. Execute captures atomically
 *   5. Calculate points earned
 *   6. If scoped to a room, update room_members.score
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array<{lat: number, lng: number}>} points — simplified GPS path
 * @param {string} [roomId] — scope territory processing to a room
 * @returns {Promise<{
 *   territory: { id: string, area_sqm: number } | null,
 *   captures: Array<{ territory_id: string, prev_owner_id: string, overlap_sqm: number }>,
 *   pointsEarned: number,
 *   scoreDelta: number,
 * }>}
 */
export async function processTrackingSession(userId, sessionId, points, roomId) {
  if (!points || points.length < 2) {
    return { territory: null, captures: [], pointsEarned: 0, scoreDelta: 0 }
  }

  // Step 1: Create territory polygon from path (scoped to room if provided)
  const territory = await createTerritory(userId, sessionId, points, 20, roomId)

  if (!territory.territory_id) {
    return { territory: null, captures: [], pointsEarned: 0, scoreDelta: 0 }
  }

  // Step 2: Fetch the geometry of the new territory (for overlap check)
  const { data: territoryRow } = await supabase
    .from('territories')
    .select('geometry')
    .eq('id', territory.territory_id)
    .single()

  if (!territoryRow?.geometry) {
    return { territory: { id: territory.territory_id, area_sqm: territory.area_sqm }, captures: [], pointsEarned: 0, scoreDelta: 0 }
  }

  // Step 3: Find overlapping territories (scoped to room if provided)
  const overlaps = await findOverlappingTerritories(
    territoryRow.geometry,
    userId,
    roomId
  )

  // Step 4: Resolve captures (pure logic — no DB)
  const captureResults = resolveCaptures(overlaps, {
    userId,
    pathLengthM: 0,
    sessionId,
  })

  // Step 5: Execute captures atomically
  const executedCaptures = []
  for (const cap of captureResults) {
    try {
      const success = await captureTerritory(cap.territory_id, userId, sessionId)
      if (success) {
        executedCaptures.push(cap)
      }
    } catch {
      // Log and continue — don't let one capture failure block the rest
      console.warn(`[territory] capture failed for ${cap.territory_id}`)
    }
  }

  // Step 6: Calculate points
  // Creation: 1 pt / 100m² of new territory
  const creationPoints = calculateCreationPoints(territory.area_sqm)
  // Capture: 2 pt / 100m² of overlap (if had prev owner), 3 pt / 100m² if unowned
  const capturePointsList = executedCaptures.map((cap) =>
    calculateCapturePoints(cap.overlap_sqm || 0, !!cap.prev_owner_id)
  )
  const territoryPoints = capturePointsList.reduce((sum, c) => sum + c.points, 0)
  const totalPoints = creationPoints.points + territoryPoints

  // Step 7: If scoped to a room, update room score
  let scoreDelta = 0
  if (roomId && totalPoints > 0) {
    try {
      // Score sync is now handled by the complete_room_tracking RPC
      scoreDelta = totalPoints
    } catch (err) {
      console.warn(`[territory] failed to update room score: ${err?.message}`)
    }
  }

  return {
    territory: { id: territory.territory_id, area_sqm: territory.area_sqm },
    captures: executedCaptures,
    pointsEarned: totalPoints,
    distancePoints: creationPoints.points,
    territoryPoints,
    capturePoints: capturePointsList,
    scoreDelta,
  }
}
