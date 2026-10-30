/**
 * CampusShare v2 - Domain Module: Fairness & Allocation
 * Implements multi-variable fair-share priority scoring,
 * deterministic seeded lottery tie-breakers (mulberry32),
 * explainable "Why?" card factor decomposition, and Gini coefficient calculations.
 */

const crypto = require('node:crypto');

/**
 * 32-bit Mulberry PRNG for transparent, verifiable seeded lotteries.
 * @param {number} seed 32-bit unsigned integer
 * @returns {() => number} Random float in [0, 1)
 */
function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts a string seed (e.g. SHA-256 of resource + slot) into a 32-bit integer.
 * @param {string} text
 * @returns {number}
 */
function hashToUint32(text) {
  const hash = crypto.createHash('sha256').update(text).digest();
  return hash.readUInt32BE(0);
}

/**
 * Computes fair-share priority score with transparent factor decomposition.
 *
 * Formula:
 *   Base = 100.0
 *   - (4.0 * hoursUsedLast30d)    [Anti-monopolization penalty]
 *   + (2.0 * daysWaiting)         [Queue fairness bonus, max 30]
 *   + urgencyBonus                [Level 4: +25, Level 3: +15, Level 2: +5, Level 1: 0]
 *   + tierBonus                   ['trusted': +10, 'standard': +5, 'new': 0]
 *
 * @param {Object} params
 * @param {number} params.hoursUsedLast30d
 * @param {number} params.daysWaiting
 * @param {number|string} params.urgencyLevel - 1 to 4
 * @param {boolean} [params.urgencyVerified=true]
 * @param {'new'|'standard'|'trusted'} [params.trustTier='new']
 * @param {string} [params.resourceId]
 * @param {string} [params.slotIdentifier]
 * @returns {{ score: number, factors: Array<{ label: string, impact: number }>, lotterySeed: string, lotteryRoll: number }}
 */
function calculatePriorityScore({
  hoursUsedLast30d = 0,
  daysWaiting = 0,
  urgencyLevel = 1,
  urgencyVerified = true,
  trustTier = 'new',
  resourceId = 'res-default',
  slotIdentifier = 'slot-default'
}) {
  const factors = [];

  // 1. Base Score
  let score = 100.0;
  factors.push({ label: 'Baseline Starting Score', impact: 100.0 });

  // 2. 30-Day Usage Dampener (-4 per hour)
  const usagePenalty = -4.0 * Math.max(0, hoursUsedLast30d);
  score += usagePenalty;
  factors.push({
    label: `Recent Usage (${hoursUsedLast30d.toFixed(1)}h in past 30 days)`,
    impact: parseFloat(usagePenalty.toFixed(2))
  });

  // 3. Queue Wait Bonus (+2 per day waiting, max +30)
  const waitBonus = Math.min(30.0, 2.0 * Math.max(0, daysWaiting));
  score += waitBonus;
  if (daysWaiting > 0) {
    factors.push({
      label: `Waitlist Persistence (${daysWaiting.toFixed(1)} days queue time)`,
      impact: parseFloat(waitBonus.toFixed(2))
    });
  }

  // 4. Academic Urgency Multiplier
  let urgencyBonus = 0;
  const numUrgency = parseInt(urgencyLevel, 10) || 1;
  if (urgencyVerified) {
    if (numUrgency >= 4) urgencyBonus = 25.0; // Thesis / Capstone
    else if (numUrgency === 3) urgencyBonus = 15.0; // Graded Coursework
    else if (numUrgency === 2) urgencyBonus = 5.0; // Lab Exercise
  }
  score += urgencyBonus;
  if (urgencyBonus > 0) {
    factors.push({
      label: `Verified Academic Urgency (Tier ${numUrgency})`,
      impact: urgencyBonus
    });
  }

  // 5. Trust Tier Bonus
  const tierMap = { new: 0, standard: 5.0, trusted: 10.0 };
  const tierBonus = tierMap[trustTier] || 0;
  score += tierBonus;
  if (tierBonus > 0) {
    factors.push({
      label: `Institutional Trust Tier (${trustTier.toUpperCase()})`,
      impact: tierBonus
    });
  }

  // Final score clamping
  score = Math.max(0, Math.min(150, score));

  // Deterministic Seeded Lottery Roll for verifiable tie-breaking
  const seedString = `${resourceId}:${slotIdentifier}`;
  const seedInt = hashToUint32(seedString);
  const rng = mulberry32(seedInt);
  const lotteryRoll = parseFloat(rng().toFixed(5));

  return {
    score: parseFloat(score.toFixed(2)),
    factors,
    lotterySeed: seedString,
    lotteryRoll
  };
}

/**
 * Calculates Gini coefficient from an array of values (e.g. allocated hours).
 * 0.0 = perfect equality, 1.0 = absolute monopolization.
 * @param {number[]} values
 * @returns {number}
 */
function calculateGini(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += sorted[i];
  }
  if (sum === 0) return 0;

  let cumulativeAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cumulativeAbsDiff += Math.abs(sorted[i] - sorted[j]);
    }
  }

  const gini = cumulativeAbsDiff / (2 * n * sum);
  return parseFloat(gini.toFixed(3));
}

module.exports = {
  calculatePriorityScore,
  calculateGini,
  mulberry32,
  hashToUint32
};
