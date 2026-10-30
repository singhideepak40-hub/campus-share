/**
 * CampusShare v2 - Comprehensive Domain & Integration Test Suite
 * Validates algorithmic correctness, security boundaries,
 * state machine invariants, and cryptographic audit integrity.
 */

const assert = require('node:assert');

const { resolveAllPrerequisites, checkEligibility } = require('../src/domain/eligibility');
const { calculatePriorityScore, calculateGini, mulberry32, hashToUint32 } = require('../src/domain/fairness');
const { transitionBooking } = require('../src/domain/bookingStateMachine');
const { calculateDecayedTrustScore, getTierFromScore, checkCapacityCaps } = require('../src/domain/trust');
const { detectConflicts, generateConflictAlternatives, promoteWaitlistTop } = require('../src/domain/conflict');
const { signPassportToken, verifyPassportToken } = require('../src/domain/qr');
const { detectAnomalies } = require('../src/domain/anomaly');
const { verifyChain, appendAuditBlock, generateDisputePack } = require('../src/domain/audit');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

console.log('=======================================================');
console.log(' RUNNING CAMPUSSHARE v2 DOMAIN TEST SUITE');
console.log('=======================================================');

// 1. ELIGIBILITY GRAPH TESTS
console.log('\n[Module: Eligibility Graph]');
runTest('Recursive DAG Prerequisite Resolution', () => {
  const prereqs = [
    { credential_id: 'LASER_SAFETY_SOP', requires_credential_id: 'LAB_SAFETY_101' },
    { credential_id: 'CNC_CERT', requires_credential_id: 'LASER_SAFETY_SOP' }
  ];

  const resolved = resolveAllPrerequisites('CNC_CERT', prereqs);
  assert.strictEqual(resolved.has('CNC_CERT'), true);
  assert.strictEqual(resolved.has('LASER_SAFETY_SOP'), true);
  assert.strictEqual(resolved.has('LAB_SAFETY_101'), true);
  assert.strictEqual(resolved.size, 3);
});

runTest('Check Eligibility - Identifies Missing Gate and Remediation Path', () => {
  const reqs = [{ resource_id: 'res-laser', credential_id: 'LASER_SAFETY_SOP' }];
  const prereqs = [{ credential_id: 'LASER_SAFETY_SOP', requires_credential_id: 'LAB_SAFETY_101' }];
  const allCreds = [
    { id: 'LAB_SAFETY_101', name: 'Lab Safety 101' },
    { id: 'LASER_SAFETY_SOP', name: 'Laser Safety SOP', training_resource_id: 'res-laser' }
  ];
  // User only has Lab Safety 101, missing Laser Safety SOP
  const userCreds = [
    { credential_id: 'LAB_SAFETY_101', status: 'verified', expires_at: new Date(Date.now() + 86400000).toISOString() }
  ];

  const res = checkEligibility({
    resourceId: 'res-laser',
    resourceRequirements: reqs,
    credentialPrereqs: prereqs,
    allCredentials: allCreds,
    userCredentials: userCreds
  });

  assert.strictEqual(res.eligible, false);
  assert.deepStrictEqual(res.missing, ['LASER_SAFETY_SOP']);
  assert.strictEqual(res.remediation.length, 1);
  assert.strictEqual(res.remediation[0].credentialId, 'LASER_SAFETY_SOP');
});

// 2. FAIRNESS & MULTI-VARIABLE PRIORITY TESTS
console.log('\n[Module: Fairness & Priority]');
runTest('Fair-Share Priority Calculation with 30-Day Dampener', () => {
  const lowUsageUser = calculatePriorityScore({
    hoursUsedLast30d: 0,
    daysWaiting: 0,
    urgencyLevel: 4,
    trustTier: 'new'
  });

  const heavyUsageUser = calculatePriorityScore({
    hoursUsedLast30d: 18.5,
    daysWaiting: 0,
    urgencyLevel: 4,
    trustTier: 'new'
  });

  // Base 100 + 25 urgency = 125
  assert.strictEqual(lowUsageUser.score, 125.0);
  // Heavy user: 100 - (4 * 18.5) + 25 = 100 - 74 + 25 = 51.0
  assert.strictEqual(heavyUsageUser.score, 51.0);
  assert(lowUsageUser.score > heavyUsageUser.score, 'Low usage candidate must outrank heavy hoarder');
});

runTest('Deterministic Seeded Lottery via Mulberry32', () => {
  const seedString = 'res-laser:slot-2026-10-30-1400';
  const seedInt = hashToUint32(seedString);
  const rng1 = mulberry32(seedInt);
  const roll1 = rng1();

  const rng2 = mulberry32(seedInt);
  const roll2 = rng2();

  assert.strictEqual(roll1, roll2, 'Identical seed must yield identical pseudorandom float');
});

runTest('Gini Coefficient Equity Verification', () => {
  const severeMonopoly = [100, 0, 0, 0, 0];
  const perfectEqual = [20, 20, 20, 20, 20];

  const giniMonopoly = calculateGini(severeMonopoly);
  const giniEqual = calculateGini(perfectEqual);

  assert.strictEqual(giniEqual, 0.0);
  assert(giniMonopoly > 0.7, 'Monopoly distribution must have high Gini (> 0.7)');
});

// 3. BOOKING STATE MACHINE & RBAC TESTS
console.log('\n[Module: Booking State Machine]');
runTest('Valid Lifecycle Progression: APPROVED -> CHECKED_IN by User', () => {
  const booking = {
    id: 'CS-101',
    user_id: 'usr-1',
    status: 'APPROVED'
  };
  const actor = { id: 'usr-1', name: 'Alice', role: 'user' };

  const res = transitionBooking({
    booking,
    targetStatus: 'CHECKED_IN',
    actor,
    reason: 'Arrived at MakerSpace with verified checklist'
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.updatedBooking.status, 'CHECKED_IN');
  assert.strictEqual(res.auditEntry.action, 'STATUS_APPROVED_TO_CHECKED_IN');
});

runTest('Rejects Unauthorized State Transition', () => {
  const booking = { id: 'CS-101', user_id: 'usr-1', status: 'REQUESTED' };
  const actor = { id: 'usr-1', name: 'Alice', role: 'user' };

  // Regular user cannot unilaterally approve their own booking
  const res = transitionBooking({
    booking,
    targetStatus: 'APPROVED',
    actor
  });

  assert.strictEqual(res.ok, false);
  assert(res.error.includes('not authorized'));
});

// 4. TRUST TELEMETRY & RECENCY DECAY TESTS
console.log('\n[Module: Trust Telemetry]');
runTest('Trust Score Decays over 60-Day Half-Life', () => {
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

  const recentEvent = [{ type: 'on_time', weight: 10, created_at: now.toISOString() }];
  const decayedEvent = [{ type: 'on_time', weight: 10, created_at: sixtyDaysAgo.toISOString() }];

  const scoreRecent = calculateDecayedTrustScore(recentEvent, now);
  const scoreDecayed = calculateDecayedTrustScore(decayedEvent, now);

  // Baseline 50. Recent = 50 + 10 = 60. Decayed after 60 days = 50 + (10 * 0.5) = 55.
  assert.strictEqual(scoreRecent, 60.0);
  assert.strictEqual(scoreDecayed, 55.0);
});

runTest('Capacity Caps Enforce Weekly Limits', () => {
  const check = checkCapacityCaps({
    trustTier: 'new',
    activeBookingsCount: 1, // 'new' tier allows max 1
    hoursUsedThisWeek: 2,
    requestedHours: 1
  });

  assert.strictEqual(check.allowed, false);
  assert(check.reason.includes('Maximum active bookings reached'));
});

// 5. CONFLICT RESOLUTION & WAITLIST PROMOTION
console.log('\n[Module: Conflict Resolution]');
runTest('Detects Overlapping Timeslots on Same Resource', () => {
  const existing = [
    { resource_id: 'res-laser', status: 'APPROVED', start_at: '2026-10-30T14:00:00Z', end_at: '2026-10-30T16:00:00Z' }
  ];

  const conflict = detectConflicts({
    resourceId: 'res-laser',
    startAt: '2026-10-30T15:00:00Z',
    endAt: '2026-10-30T17:00:00Z',
    existingBookings: existing
  });

  assert.strictEqual(conflict.hasConflict, true);
  assert.strictEqual(conflict.conflictingBookings.length, 1);
});

runTest('Waitlist Promotion Allocates 15-Minute Exclusive Window', () => {
  const waitlist = [
    { id: 'wl-1', position: 1, status: 'QUEUED' },
    { id: 'wl-2', position: 2, status: 'QUEUED' }
  ];

  const now = new Date('2026-10-30T12:00:00Z');
  const promo = promoteWaitlistTop(waitlist, now);

  assert.strictEqual(promo.promotedEntry.id, 'wl-1');
  assert.strictEqual(promo.promotedEntry.status, 'CLAIMABLE');
  assert.strictEqual(promo.claimExpiresAt, '2026-10-30T12:15:00.000Z');
});

// 6. CUSTODY PASSPORT & HMAC QR SIGNING
console.log('\n[Module: Custody Passport & Signed QR]');
runTest('Signs and Validates HMAC-SHA256 Passport Token', () => {
  const startAt = new Date('2026-10-30T14:00:00Z');
  const endAt = new Date('2026-10-30T16:00:00Z');
  const tokenData = signPassportToken({
    bookingId: 'CS-8891',
    resourceId: 'res-laser',
    userId: 'usr-arjun',
    startAt,
    endAt
  });

  // Check-in at 14:05 (within allowed window)
  const verifyResult = verifyPassportToken({
    token: tokenData.token,
    expectedUserId: 'usr-arjun',
    expectedBookingId: 'CS-8891',
    checklistComplete: true,
    now: new Date('2026-10-30T14:05:00Z')
  });

  assert.strictEqual(verifyResult.valid, true);
  assert.strictEqual(verifyResult.payload.rid, 'res-laser');
});

runTest('Rejects Check-in When Safety Checklist Incomplete', () => {
  const startAt = new Date('2026-10-30T14:00:00Z');
  const endAt = new Date('2026-10-30T16:00:00Z');
  const tokenData = signPassportToken({
    bookingId: 'CS-8891',
    resourceId: 'res-laser',
    userId: 'usr-arjun',
    startAt,
    endAt
  });

  const verifyResult = verifyPassportToken({
    token: tokenData.token,
    expectedUserId: 'usr-arjun',
    expectedBookingId: 'CS-8891',
    checklistComplete: false, // Incomplete!
    now: new Date('2026-10-30T14:05:00Z')
  });

  assert.strictEqual(verifyResult.valid, false);
  assert(verifyResult.error.includes('Pre-operation safety checklist'));
});

// 7. TAMPER-EVIDENT CRYPTOGRAPHIC AUDIT CHAIN
console.log('\n[Module: Cryptographic Audit Chain]');
runTest('Verifies Valid SHA-256 Chained Ledger', () => {
  const chain = [];
  appendAuditBlock(chain, {
    booking_id: 'CS-1',
    actor_id: 'usr-1',
    actor_name: 'Alice',
    action: 'INIT',
    payload: { state: 'genesis' }
  });
  appendAuditBlock(chain, {
    booking_id: 'CS-1',
    actor_id: 'usr-2',
    actor_name: 'Bob',
    action: 'APPROVE',
    payload: { score: 95 }
  });

  const verification = verifyChain(chain);
  assert.strictEqual(verification.valid, true);
  assert.strictEqual(verification.totalBlocks, 2);
});

runTest('Detects Direct Database Tampering in Chain', () => {
  const chain = [];
  appendAuditBlock(chain, {
    booking_id: 'CS-1',
    actor_id: 'usr-1',
    actor_name: 'Alice',
    action: 'INIT',
    payload: { state: 'genesis' }
  });
  appendAuditBlock(chain, {
    booking_id: 'CS-1',
    actor_id: 'usr-2',
    actor_name: 'Bob',
    action: 'APPROVE',
    payload: { score: 95 }
  });

  // Simulate malicious tampering directly in database column
  chain[1].payload = { score: 999 };

  const verification = verifyChain(chain);
  assert.strictEqual(verification.valid, false);
  assert.strictEqual(verification.brokenAtIndex, 2);
});

console.log('\n=======================================================');
console.log(` TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('=======================================================');

if (testsFailed > 0) {
  process.exit(1);
}
