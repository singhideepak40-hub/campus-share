/**
 * CampusShare v2 - Domain Module: Anomaly Detection Engine
 * Rule-based heuristic pattern analyzer detecting slot hoarding,
 * rapid last-minute cancellations, and repetitive monopolization.
 */

/**
 * Scans user booking history against anti-abuse heuristics.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Array<Object>} params.userBookings
 * @param {Date} [params.now]
 * @returns {Array<{ rule: string, severity: 'LOW'|'MED'|'HIGH', evidence: Object, description: string }>}
 */
function detectAnomalies({ userId, userBookings = [], now = new Date() }) {
  const flags = [];
  const currentTime = new Date(now).getTime();
  const sevenDaysAgo = currentTime - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = currentTime - 30 * 24 * 60 * 60 * 1000;

  // RULE 1: Slot Hoarding (> 3 active or requested bookings within 7 days)
  const recentActive = userBookings.filter(b => {
    const createdAt = new Date(b.created_at || b.start_at).getTime();
    return (
      createdAt >= sevenDaysAgo &&
      ['REQUESTED', 'APPROVED', 'CHECKED_IN'].includes(b.status)
    );
  });

  if (recentActive.length >= 4) {
    flags.push({
      rule: 'SLOT_HOARDING_HEURISTIC',
      severity: 'HIGH',
      description: `User has scheduled ${recentActive.length} active or pending slots within 7 days, exceeding fair consumption guidelines.`,
      evidence: {
        activeBookingIds: recentActive.map(b => b.id),
        count: recentActive.length,
        timeframe: '7_days'
      }
    });
  }

  // RULE 2: Rapid Last-Minute Cancellations (Cancelled < 2h before start, >= 2 occurrences in 30 days)
  const lastMinuteCancels = userBookings.filter(b => {
    if (b.status !== 'CANCELLED') return false;
    const createdAt = new Date(b.created_at).getTime();
    if (createdAt < thirtyDaysAgo) return false;

    if (b.start_at && b.updated_at) {
      const startTime = new Date(b.start_at).getTime();
      const cancelTime = new Date(b.updated_at).getTime();
      const diffHours = (startTime - cancelTime) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 2.0;
    }
    return false;
  });

  if (lastMinuteCancels.length >= 2) {
    flags.push({
      rule: 'CHRONIC_LATE_CANCELLATION',
      severity: 'MED',
      description: `User cancelled ${lastMinuteCancels.length} bookings within 2 hours of slot commencement, denying access to waiting researchers.`,
      evidence: {
        cancelledBookingIds: lastMinuteCancels.map(b => b.id),
        count: lastMinuteCancels.length,
        timeframe: '30_days'
      }
    });
  }

  // RULE 3: Repeat No-Show Pattern (>= 2 no-shows in 30 days)
  const noShows = userBookings.filter(b => {
    if (b.status !== 'NO_SHOW') return false;
    const createdAt = new Date(b.created_at).getTime();
    return createdAt >= thirtyDaysAgo;
  });

  if (noShows.length >= 2) {
    flags.push({
      rule: 'HABITUAL_NO_SHOW_PATTERN',
      severity: 'HIGH',
      description: `User accumulated ${noShows.length} unexcused no-shows in the past 30 days. Interlock privileges paused pending manager interview.`,
      evidence: {
        noShowBookingIds: noShows.map(b => b.id),
        count: noShows.length
      }
    });
  }

  return flags;
}

module.exports = {
  detectAnomalies
};
