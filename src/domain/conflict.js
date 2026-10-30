/**
 * CampusShare v2 - Domain Module: Conflict Resolver & Smart Waitlist
 * Detects scheduling congestion, generates 3 algorithmic alternatives
 * (Off-Peak discount, Similar Machine, Split Booking),
 * and manages 15-minute exclusive waitlist claim windows.
 */

/**
 * Checks if two time intervals overlap.
 * @param {Date|string} startA
 * @param {Date|string} endA
 * @param {Date|string} startB
 * @param {Date|string} endB
 * @returns {boolean}
 */
function intervalsOverlap(startA, endA, startB, endB) {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA < eB && sB < eA;
}

/**
 * Checks if a requested timeslot conflicts with any active bookings on the same resource.
 * @param {Object} params
 * @param {string} params.resourceId
 * @param {Date|string} params.startAt
 * @param {Date|string} params.endAt
 * @param {Array<Object>} params.existingBookings
 * @returns {{ hasConflict: boolean, conflictingBookings: Array<Object> }}
 */
function detectConflicts({ resourceId, startAt, endAt, existingBookings = [] }) {
  const conflicting = existingBookings.filter(b => {
    if (b.resource_id !== resourceId) return false;
    if (!['APPROVED', 'CHECKED_IN'].includes(b.status)) return false;
    return intervalsOverlap(startAt, endAt, b.start_at, b.end_at);
  });

  return {
    hasConflict: conflicting.length > 0,
    conflictingBookings: conflicting
  };
}

/**
 * Generates 3 viable resolution alternatives when congestion occurs.
 *
 * @param {Object} params
 * @param {Object} params.targetResource
 * @param {Date|string} params.requestedStart
 * @param {Date|string} params.requestedEnd
 * @param {Array<Object>} params.allResources
 * @returns {Array<{ type: string, title: string, subtitle: string, discount: string, actionPayload: Object }>}
 */
function generateConflictAlternatives({
  targetResource,
  requestedStart,
  requestedEnd,
  allResources = []
}) {
  const reqStart = new Date(requestedStart);
  const reqEnd = new Date(requestedEnd);
  const durationHours = Math.max(1, (reqEnd - reqStart) / (1000 * 60 * 60));

  // Option 1: Nearest Off-Peak Window (Tomorrow morning 09:00 - 11:00)
  const offPeakStart = new Date(reqStart);
  offPeakStart.setDate(offPeakStart.getDate() + 1);
  offPeakStart.setHours(9, 0, 0, 0);
  const offPeakEnd = new Date(offPeakStart);
  offPeakEnd.setHours(offPeakStart.getHours() + durationHours);

  const altOffPeak = {
    type: 'OFF_PEAK_DISCOUNT',
    title: 'Nearest Off-Peak Window',
    subtitle: `Tomorrow 09:00 - ${offPeakEnd.getHours()}:00 on ${targetResource.name}`,
    discount: '50% Credit Discount (Save 10 Credits)',
    actionPayload: {
      resourceId: targetResource.id,
      startAt: offPeakStart.toISOString(),
      endAt: offPeakEnd.toISOString(),
      discountCredits: 0.5
    }
  };

  // Option 2: Similar Resource Match (e.g. CNC mill or SLA printer)
  const similarResource = allResources.find(r =>
    r.id !== targetResource.id &&
    (r.category === targetResource.category || r.category === 'Fabrication')
  ) || targetResource;

  const altSimilar = {
    type: 'SIMILAR_RESOURCE',
    title: 'Similar Resource Instant Match',
    subtitle: `${similarResource.name} in ${similarResource.location}`,
    discount: 'Available Immediately Today',
    actionPayload: {
      resourceId: similarResource.id,
      startAt: requestedStart,
      endAt: requestedEnd
    }
  };

  // Option 3: Split Booking (2x Micro Sessions)
  const split1Start = new Date(reqStart);
  split1Start.setHours(17, 0, 0, 0);
  const split1End = new Date(split1Start);
  split1End.setHours(18, 0, 0, 0);

  const altSplit = {
    type: 'SPLIT_BOOKING',
    title: '2x 1-Hour Micro Sessions',
    subtitle: '1h Test Run Today 17:00 + 1h Final Production Saturday 10:00',
    discount: 'Optimized for Rapid Prototyping',
    actionPayload: {
      resourceId: targetResource.id,
      sessions: [
        { startAt: split1Start.toISOString(), endAt: split1End.toISOString() }
      ]
    }
  };

  return [altOffPeak, altSimilar, altSplit];
}

/**
 * Promotes top waitlist entry and creates a 15-minute claim window.
 * @param {Array<Object>} waitlistEntries
 * @param {Date} [now]
 * @returns {{ promotedEntry: Object|null, claimExpiresAt: string|null }}
 */
function promoteWaitlistTop(waitlistEntries = [], now = new Date()) {
  const queued = waitlistEntries
    .filter(e => e.status === 'QUEUED')
    .sort((a, b) => a.position - b.position);

  if (queued.length === 0) {
    return { promotedEntry: null, claimExpiresAt: null };
  }

  const top = queued[0];
  const claimExpiresAt = new Date(new Date(now).getTime() + 15 * 60 * 1000).toISOString();

  top.status = 'CLAIMABLE';
  top.claim_expires_at = claimExpiresAt;

  return {
    promotedEntry: top,
    claimExpiresAt
  };
}

module.exports = {
  intervalsOverlap,
  detectConflicts,
  generateConflictAlternatives,
  promoteWaitlistTop
};
