/**
 * CampusShare v2 - Domain Type Definitions
 */

export type UserRole = 'user' | 'owner' | 'manager' | 'admin';
export type TrustTier = 'new' | 'standard' | 'trusted';
export type ResourceStatus = 'active' | 'held' | 'retired';
export type CredentialStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export type BookingStatus =
  | 'REQUESTED'
  | 'ELIGIBILITY_FAILED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'WAITLISTED'
  | 'CHECKED_IN'
  | 'OVERDUE'
  | 'RETURNED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'CLOSED';

export interface Profile {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: UserRole;
  trust_tier: TrustTier;
  vouched_by?: string;
  credits_balance: number;
  created_at: string;
}

export interface Resource {
  id: string;
  owner_id: string;
  org_id: string;
  name: string;
  category: string;
  location: string;
  description?: string;
  rules_text?: string;
  requires_supervision: boolean;
  deposit_credits: number;
  max_booking_hours: number;
  status: ResourceStatus;
  created_at: string;
}

export interface Booking {
  id: string;
  resource_id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  purpose?: string;
  urgency_proof_path?: string;
  status: BookingStatus;
  decision_reason?: any;
  priority_score?: number;
  created_at: string;
  updated_at?: string;
}

export interface AuditBlock {
  index: number;
  booking_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  payload: any;
  timestamp: string;
  prev_hash: string;
  hash: string;
}
