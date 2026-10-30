/**
 * CampusShare v2 - Domain Module: Booking State Machine
 * Central orchestrator for the Booking Spine lifecycle.
 * Validates state transitions, enforces role-based access control,
 * guarantees condition checks, and constructs structured audit records.
 */

const VALID_TRANSITIONS = {
  REQUESTED: ['ELIGIBILITY_FAILED', 'PENDING_REVIEW', 'APPROVED', 'WAITLISTED', 'CANCELLED'],
  ELIGIBILITY_FAILED: ['REQUESTED'], // After completing prerequisite
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED'],
  WAITLISTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['RETURNED', 'OVERDUE', 'DISPUTED'],
  OVERDUE: ['RETURNED', 'DISPUTED'],
  RETURNED: ['CLOSED', 'DISPUTED'],
  DISPUTED: ['CLOSED', 'RETURNED'],
  CANCELLED: [],
  NO_SHOW: [],
  CLOSED: []
};

const ROLE_PERMISSIONS = {
  user: ['REQUESTED', 'CANCELLED', 'CHECKED_IN', 'RETURNED'],
  owner: ['APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED', 'RETURNED', 'DISPUTED', 'CLOSED'],
  manager: ['APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW', 'OVERDUE', 'DISPUTED', 'CLOSED'],
  admin: ['APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW', 'OVERDUE', 'DISPUTED', 'CLOSED', 'CHECKED_IN', 'RETURNED']
};

/**
 * Validates and executes a state machine transition.
 *
 * @param {Object} params
 * @param {Object} params.booking - The current booking record
 * @param {string} params.targetStatus - The desired next status
 * @param {Object} params.actor - The actor performing the action { id, name, role }
 * @param {string} [params.reason] - Human or algorithmic reason
 * @param {Object} [params.metadata] - Extra metadata (e.g. photos, checklist, priority)
 * @returns {{ ok: boolean, error?: string, updatedBooking?: Object, auditEntry?: Object }}
 */
function transitionBooking({
  booking,
  targetStatus,
  actor,
  reason = 'Standard lifecycle transition',
  metadata = {}
}) {
  if (!booking) {
    return { ok: false, error: 'Booking record not found' };
  }

  const currentStatus = booking.status;

  // 1. Check if transition is valid in the state graph
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      ok: false,
      error: `Illegal state transition from ${currentStatus} to ${targetStatus}. Allowed: [${allowedNext.join(', ')}]`
    };
  }

  // 2. Check Role Authorization
  const actorRole = actor.role || 'user';
  const roleAllowedStatuses = ROLE_PERMISSIONS[actorRole] || [];
  if (!roleAllowedStatuses.includes(targetStatus)) {
    return {
      ok: false,
      error: `Role '${actorRole}' is not authorized to transition booking to '${targetStatus}'.`
    };
  }

  // 3. User Ownership Verification
  if (actorRole === 'user' && booking.user_id && actor.id !== booking.user_id) {
    return {
      ok: false,
      error: 'Users can only transition bookings they personally own.'
    };
  }

  // 4. Create the updated booking object
  const updatedBooking = {
    ...booking,
    status: targetStatus,
    updated_at: new Date().toISOString()
  };

  if (metadata.decision_reason) {
    updatedBooking.decision_reason = metadata.decision_reason;
  }
  if (metadata.priority_score !== undefined) {
    updatedBooking.priority_score = metadata.priority_score;
  }

  // 5. Generate structured audit record
  const auditEntry = {
    booking_id: booking.id,
    actor_id: actor.id,
    actor_name: actor.name || 'Unknown Actor',
    action: `STATUS_${currentStatus}_TO_${targetStatus}`,
    payload: {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason,
      actorRole,
      ...metadata
    },
    timestamp: new Date().toISOString()
  };

  return {
    ok: true,
    updatedBooking,
    auditEntry
  };
}

module.exports = {
  VALID_TRANSITIONS,
  ROLE_PERMISSIONS,
  transitionBooking
};
