/**
 * CampusShare v2 - Domain Module: Trust & Accountability
 * Evaluates behavioral telemetry (on-time returns, damages, no-shows)
 * with a 60-day half-life recency decay.
 *
 * SAFETY GUARDRAIL (Rule 12):
 * Automated penalties or tier drops NEVER execute silently.
 * Any negative shift triggers an anomaly flag requiring human manager review.
 */

const TRUST_WEIGHTS = {
  on_time: +5.0,
  good_rating: +3.0,
  late_minor: -5.0,
  late_severe: -15.0,
  no_show: -25.0,
  damage_minor: -20.0,
  damage_severe: -50.0
};

const TIER_LIMITS = {
  new: { maxActiveBookings: 1, maxWeeklyHours: 4, depositRequired: true },
  standard: { maxActiveBookings: 3, maxWeeklyHours: 12, depositRequired: false },
  trusted: { maxActiveBookings: 5, maxWeeklyHours: 25, depositRequired: false }
};

/**
 * Computes raw decayed score from a series of trust events.
 * Half-life = 60 days: event weight decays to 50% after 60 days.
 *
 * @param {Array<{ type: string, weight?: number, created_at: string | Date }>} events
 * @param {Date} [now]
 * @returns {number} Score bounded between 0 and 100 (starts at baseline 50)
 */
function calculateDecayedTrustScore(events = [], now = new Date()) {
  let score = 50.0; // Baseline starting score for new users
  const currentDate = new Date(now).getTime();

  for (const ev of events) {
    const evTime = new Date(ev.created_at).getTime();
    const daysAgo = Math.max(0, (currentDate - evTime) / (1000 * 60 * 60 * 24));
    
    // Half-life formula: 0.5^(days / 60)
    const decayFactor = Math.pow(0.5, daysAgo / 60.0);
    const baseWeight = ev.weight !== undefined ? ev.weight : (TRUST_WEIGHTS[ev.type] || 0);

    score += baseWeight * decayFactor;
  }

  return parseFloat(Math.max(0, Math.min(100, score)).toFixed(2));
}

/**
 * Determines trust tier based on score.
 * @param {number} score
 * @returns {'new'|'standard'|'trusted'}
 */
function getTierFromScore(score) {
  if (score >= 80.0) return 'trusted';
  if (score >= 40.0) return 'standard';
  return 'new';
}

/**
 * Checks whether user has exceeded weekly capacity caps.
 * @param {Object} params
 * @param {'new'|'standard'|'trusted'} params.trustTier
 * @param {number} params.activeBookingsCount
 * @param {number} params.hoursUsedThisWeek
 * @param {number} params.requestedHours
 * @returns {{ allowed: boolean, reason?: string, limits: Object }}
 */
function checkCapacityCaps({
  trustTier = 'new',
  activeBookingsCount = 0,
  hoursUsedThisWeek = 0,
  requestedHours = 1
}) {
  const limits = TIER_LIMITS[trustTier] || TIER_LIMITS.new;

  if (activeBookingsCount >= limits.maxActiveBookings) {
    return {
      allowed: false,
      reason: `Maximum active bookings reached for ${trustTier.toUpperCase()} tier (${activeBookingsCount}/${limits.maxActiveBookings}). Complete existing bookings before requesting new slots.`,
      limits
    };
  }

  if (hoursUsedThisWeek + requestedHours > limits.maxWeeklyHours) {
    return {
      allowed: false,
      reason: `Weekly hour cap exceeded for ${trustTier.toUpperCase()} tier (${(hoursUsedThisWeek + requestedHours).toFixed(1)}/${limits.maxWeeklyHours}h).`,
      limits
    };
  }

  return { allowed: true, limits };
}

module.exports = {
  TRUST_WEIGHTS,
  TIER_LIMITS,
  calculateDecayedTrustScore,
  getTierFromScore,
  checkCapacityCaps
};
