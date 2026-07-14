// ── Pure logic: determines capture outcomes based on overlap data ─────────────
// No database calls. Testable with plain objects.

// Minimum overlap % required for the attacker to capture a territory
const MIN_OVERLAP_PERCENT = 10

// Minimum overlap area in sqm to trigger a capture
const MIN_OVERLAP_AREA_SQM = 50

/**
 * Given a list of overlapping territories and the attacker's info,
 * determine which territories should be captured.
 *
 * @param {Array<{ territory_id: string, owner_id: string, overlap_sqm: number, overlap_percent: number }>} overlaps
 * @param {object} attackInfo — { userId, pathLengthM, sessionId }
 * @returns {Array<{ territory_id: string, reason: string }>}
 */
export function resolveCaptures(overlaps, attackInfo) {
  const captures = []

  for (const overlap of overlaps) {
    // Must exceed both thresholds
    if (overlap.overlap_percent >= MIN_OVERLAP_PERCENT &&
        overlap.overlap_sqm >= MIN_OVERLAP_AREA_SQM) {
      captures.push({
        territory_id: overlap.territory_id,
        prev_owner_id: overlap.owner_id,
        new_owner_id: attackInfo.userId,
        reason: `overlap_${overlap.overlap_percent.toFixed(1)}%`,
      })
    }
  }

  return captures
}

export const CAPTURE_THRESHOLDS = {
  MIN_OVERLAP_PERCENT,
  MIN_OVERLAP_AREA_SQM,
}
