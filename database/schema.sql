-- ==============================================================================
-- CAMPUSSHARE v2: THE BOOKING SPINE - POSTGRESQL / SUPABASE PRODUCTION SCHEMA
-- Includes: RLS Policies, Tamper-Evident Audit Triggers, Exclusion Constraints,
-- Recursive Eligibility Graph CTEs, and Demo Clock Simulation Support.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'owner', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE trust_tier_type AS ENUM ('new', 'standard', 'trusted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE resource_status AS ENUM ('active', 'held', 'retired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE credential_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'REQUESTED',
        'ELIGIBILITY_FAILED',
        'PENDING_REVIEW',
        'APPROVED',
        'WAITLISTED',
        'CHECKED_IN',
        'OVERDUE',
        'RETURNED',
        'DISPUTED',
        'CANCELLED',
        'NO_SHOW',
        'CLOSED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE report_phase AS ENUM ('checkin', 'return');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM ('low', 'med', 'high');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('open', 'under_review', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE trust_event_type AS ENUM ('on_time', 'late', 'damage', 'no_show', 'good_rating');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. PROFILES & ORGANIZATIONS
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id TEXT NOT NULL DEFAULT 'CAMPUS-MAIN',
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    trust_tier trust_tier_type NOT NULL DEFAULT 'new',
    vouched_by UUID REFERENCES profiles(id),
    credits_balance INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RESOURCES & SAFETY PASSPORTS
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    owner_id UUID REFERENCES profiles(id),
    org_id TEXT NOT NULL DEFAULT 'CAMPUS-MAIN',
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    rules_text TEXT,
    requires_supervision BOOLEAN NOT NULL DEFAULT false,
    deposit_credits INT NOT NULL DEFAULT 10,
    max_booking_hours INT NOT NULL DEFAULT 4,
    status resource_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

-- 5. ELIGIBILITY GRAPH & CREDENTIALS
CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    validity_days INT NOT NULL DEFAULT 365,
    training_resource_id TEXT REFERENCES resources(id)
);

CREATE TABLE IF NOT EXISTS credential_prereqs (
    credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    requires_credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    PRIMARY KEY (credential_id, requires_credential_id)
);

CREATE TABLE IF NOT EXISTS resource_requirements (
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, credential_id)
);

CREATE TABLE IF NOT EXISTS user_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    doc_path TEXT,
    status credential_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. THE SPINE: BOOKINGS TABLE
-- Note the btree_gist exclusion constraint preventing double-bookings at DB level
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL REFERENCES resources(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    purpose TEXT,
    urgency_proof_path TEXT,
    status booking_status NOT NULL DEFAULT 'REQUESTED',
    decision_reason JSONB,
    priority_score NUMERIC(6, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_timeslot CHECK (end_at > start_at)
);

-- Exclusion constraint preventing double booking
DO $$ BEGIN
    ALTER TABLE bookings ADD CONSTRAINT no_overlap
      EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_at, end_at) WITH &&
      ) WHERE (status IN ('APPROVED', 'CHECKED_IN'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 7. WAITLIST SYSTEM
CREATE TABLE IF NOT EXISTS waitlist_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 1,
    claim_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, CLAIMABLE, CLAIMED, EXPIRED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. FAIRNESS & CREDIT LEDGER
CREATE TABLE IF NOT EXISTS credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    booking_id TEXT REFERENCES bookings(id),
    delta INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_stats (
    user_id UUID NOT NULL REFERENCES profiles(id),
    week_start DATE NOT NULL,
    hours_used NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    active_bookings INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, week_start)
);

-- 9. TRUST EVENTS & APPEALS
CREATE TABLE IF NOT EXISTS trust_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    booking_id TEXT REFERENCES bookings(id),
    type trust_event_type NOT NULL,
    weight NUMERIC(4, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trust_event_id UUID NOT NULL REFERENCES trust_events(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    note TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. CHECK-IN / CONDITION REPORTS & REPORT PHOTOS
CREATE TABLE IF NOT EXISTS condition_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    phase report_phase NOT NULL,
    checklist_done JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES condition_reports(id) ON DELETE CASCADE,
    angle TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. INCIDENTS & ANOMALY RULES
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    resource_id TEXT NOT NULL REFERENCES resources(id),
    reporter_id UUID NOT NULL REFERENCES profiles(id),
    severity incident_severity NOT NULL,
    description TEXT NOT NULL,
    ai_summary TEXT,
    status incident_status NOT NULL DEFAULT 'open',
    resolved_by UUID REFERENCES profiles(id),
    resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomaly_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    rule TEXT NOT NULL,
    evidence JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'FLAGGED',
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. UTILIZATION HEATMAP & NOTIFICATIONS
CREATE TABLE IF NOT EXISTS utilization_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id TEXT NOT NULL REFERENCES resources(id),
    day INT NOT NULL,
    hour INT NOT NULL,
    booked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. TAMPER-EVIDENT CRYPTOGRAPHIC AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    booking_id TEXT NOT NULL,
    actor_id UUID,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce immutability on audit_log at database level
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is tamper-evident and immutable. UPDATE or DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- 14. DEMO MODE TIME OFFSET TABLE
CREATE TABLE IF NOT EXISTS app_clock (
    id INT PRIMARY KEY DEFAULT 1,
    offset_minutes INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_clock (id, offset_minutes) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- 15. RECURSIVE ELIGIBILITY RESOLUTION FUNCTION
CREATE OR REPLACE FUNCTION check_resource_eligibility(target_resource_id TEXT, check_user_id UUID)
RETURNS TABLE (
    eligible BOOLEAN,
    missing_credential_id TEXT,
    missing_credential_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE need AS (
        SELECT credential_id FROM resource_requirements WHERE resource_id = target_resource_id
        UNION
        SELECT p.requires_credential_id
        FROM credential_prereqs p
        JOIN need n ON n.credential_id = p.credential_id
    )
    SELECT 
        (COUNT(n.credential_id) = 0) AS eligible,
        n.credential_id AS missing_credential_id,
        c.name AS missing_credential_name
    FROM need n
    JOIN credentials c ON c.id = n.credential_id
    WHERE n.credential_id NOT IN (
        SELECT uc.credential_id 
        FROM user_credentials uc 
        WHERE uc.user_id = check_user_id 
          AND uc.status = 'verified' 
          AND uc.expires_at > NOW()
    )
    GROUP BY n.credential_id, c.name;
END;
$$ LANGUAGE plpgsql;

-- 16. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Profiles: users read self or public directory; managers read org
CREATE POLICY "Users read own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Bookings: users read own bookings; owners read bookings for their owned resources; managers read all
CREATE POLICY "Bookings user visibility" ON bookings
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM resources r WHERE r.id = bookings.resource_id AND r.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin'))
    );

-- User Credentials: users read own; managers read org. doc_path protected from public
CREATE POLICY "Credentials visibility" ON user_credentials
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin'))
    );
