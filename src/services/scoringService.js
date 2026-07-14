// ── Pure logic: calculates points earned from territory actions ───────────────
// No database calls. Testable with plain objects.

const POINTS_PER_SQM_CREATED   = 0.01   // 1 point per 100 sqm of new territory
const POINTS_PER_SQM_CAPTURED  = 0.02   // 2x points for capturing from others
const BONUS_NEW_AREA_MULTIPLIER = 1.5   // bonus for capturing unowned territory

/**
 * Calculate points earned for creating a new territory.
 *
 * @param {number} areaSqm
 * @returns {{ points: number, breakdown: object }}
 */
export function calculateCreationPoints(areaSqm) {
  const points = Math.round(areaSqm * POINTS_PER_SQM_CREATED)
  return {
    points,
    breakdown: { type: 'created', areaSqm, rate: POINTS_PER_SQM_CREATED },
  }
}

/**
 * Calculate points earned for capturing territory from another player.
 *
 * @param {number} areaSqm
 * @param {boolean} hadPreviousOwner — false if the territory was unowned
 * @returns {{ points: number, breakdown: object }}
 */
export function calculateCapturePoints(areaSqm, hadPreviousOwner) {
  const multiplier = hadPreviousOwner ? 1 : BONUS_NEW_AREA_MULTIPLIER
  const points = Math.round(areaSqm * POINTS_PER_SQM_CAPTURED * multiplier)
  return {
    points,
    breakdown: {
      type: hadPreviousOwner ? 'captured' : 'unowned_capture',
      areaSqm,
      rate: POINTS_PER_SQM_CAPTURED,
      multiplier,
    },
  }
}
