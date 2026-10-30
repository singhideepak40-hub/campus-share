-- ==============================================================================
-- CAMPUSSHARE v2: THE BOOKING SPINE - SEED DEMONSTRATION DATASET
-- Preloads: Profiles, Credentials, Prerequisite DAG, Specialized Resources,
-- Booking Spine Records, Cryptographic Audit Block Chain, & Condition Baselines.
-- ==============================================================================

-- 1. PROFILES & PERSONAS
INSERT INTO profiles (id, org_id, name, email, role, trust_tier, credits_balance)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'CAMPUS-MAIN', 'Deepak Singhi', 'deepak.singhi@campus.edu', 'user', 'standard', 135),
  ('22222222-2222-2222-2222-222222222222', 'CAMPUS-MAIN', 'Sougata', 'sougata@campus.edu', 'user', 'trusted', 180),
  ('33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Prof. R. Sharma', 'r.sharma@campus.edu', 'owner', 'trusted', 999),
  ('44444444-4444-4444-4444-444444444444', 'CAMPUS-MAIN', 'Pragyan', 'pragyan@campus.edu', 'manager', 'trusted', 450)
ON CONFLICT (id) DO NOTHING;

-- 2. CREDENTIALS
INSERT INTO credentials (id, name, validity_days, training_resource_id)
VALUES
  ('LAB_SAFETY_101', 'General Lab Safety 101', 365, NULL),
  ('LASER_SAFETY_SOP', 'Class 4 CO2 Laser Safety SOP', 180, 'res-laser'),
  ('BASIC_ELECTRONICS', 'High-Voltage Circuit Safety', 365, 'res-scope'),
  ('CNC_CERT', '5-Axis CNC Precision Machining Certification', 180, 'res-cnc')
ON CONFLICT (id) DO NOTHING;

-- 3. PREREQUISITE GRAPH (DAG EDGES)
INSERT INTO credential_prereqs (credential_id, requires_credential_id)
VALUES
  ('LASER_SAFETY_SOP', 'LAB_SAFETY_101'),
  ('CNC_CERT', 'LAB_SAFETY_101'),
  ('CNC_CERT', 'BASIC_ELECTRONICS')
ON CONFLICT DO NOTHING;

-- 4. USER CREDENTIAL BADGES
INSERT INTO user_credentials (user_id, credential_id, status, expires_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'LAB_SAFETY_101', 'verified', NOW() + INTERVAL '200 days'),
  ('22222222-2222-2222-2222-222222222222', 'LAB_SAFETY_101', 'verified', NOW() + INTERVAL '250 days'),
  ('22222222-2222-2222-2222-222222222222', 'LASER_SAFETY_SOP', 'verified', NOW() + INTERVAL '120 days'),
  ('22222222-2222-2222-2222-222222222222', 'BASIC_ELECTRONICS', 'verified', NOW() + INTERVAL '300 days')
ON CONFLICT DO NOTHING;

-- 5. RESOURCES
INSERT INTO resources (id, owner_id, org_id, name, category, location, description, rules_text, requires_supervision, deposit_credits, max_booking_hours, status)
VALUES
  ('res-laser', '33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Epilog Fusion Pro 48 CO2 Laser Cutter', 'Fabrication', 'Mechanical Engg MakerWing, Bay 4', 'Industrial 80W CO2 laser precision cutting and engraving system. Capable of handling wood, acrylic, delrin, fabrics, and marked metals.', 'Requires verified safety SOP and active fume extraction. Clean honeycomb bed before and after use.', true, 15, 3, 'active'),
  ('res-cnc', '33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Haas Mini Mill 5-Axis CNC Center', 'Fabrication', 'Precision Machine Shop Bay 1', 'Heavy industrial machining center for aluminum, brass, and steel components. Mandatory technician co-presence.', 'G-code dry run required before stock engagement. Eye and ear protection mandatory.', true, 30, 4, 'active'),
  ('res-scope', '33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Rigol DS1054Z 100MHz Digital Oscilloscope', 'Electronics', 'Circuit Design Lab 204', '4-channel 50MHz-100MHz digital storage oscilloscope with protocol decoding for I2C, SPI, and UART.', 'Do not exceed 300V input limit without high-voltage attenuator probe.', false, 5, 6, 'active'),
  ('res-sla', '33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Formlabs Form 3+ Stereolithography 3D Printer', 'Fabrication', 'Rapid Prototyping Bay 2', 'Precision photopolymer resin 3D printing. Requires chemical glove handling and isopropyl alcohol wash SOP.', 'Nitrile gloves mandatory when opening UV amber chamber.', false, 12, 8, 'active'),
  ('res-tensile', '44444444-4444-4444-4444-444444444444', 'CAMPUS-MAIN', 'Instron 5969 Dual Column Tensile Tester', 'Materials Testing', 'Materials Characterization 102', '50kN load capacity universal mechanical tester for tensile, compression, and 3-point bend stress testing.', 'Calibration check required prior to load cell zeroing.', true, 25, 3, 'active'),
  ('res-gpu', '44444444-4444-4444-4444-444444444444', 'CAMPUS-MAIN', 'NVIDIA HGX A100 80GB Training Node', 'Advanced Computing', 'Server Room 3 (SSH Slurm Access)', 'High-throughput cluster node with 8x A100 Tensor Core GPUs for distributed deep learning and simulation.', 'Strict 4-hour max allocation during peak research deadlines.', false, 20, 4, 'active'),
  ('res-book-sze', '33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Semiconductor Devices: Physics and Technology (S.M. Sze, 3rd Ed.)', 'Books & Archives', 'Central Library, Rare Reserve R-14', 'Comprehensive reference on semiconductor device physics, energy bands, p-n junctions, and bipolar transistors. 48-hr loan with condition tracking.', 'Mandatory condition baseline check before checkout and upon return.', false, 2, 48, 'active'),
  ('res-book-shigley', '33333333-3333-3333-3333-333333333333', 'CAMPUS-MAIN', 'Shigley Mechanical Engineering Design (Special Reference Hardcover)', 'Books & Archives', 'MakerWing Reference Nook Shelf B', 'Standard mechanical failure theories, fatigue limits, fasteners, springs, and power screws. Mandatory return inspection.', 'Return in pristine binding condition.', false, 3, 24, 'active')
ON CONFLICT (id) DO NOTHING;

-- 6. RESOURCE REQUIREMENTS
INSERT INTO resource_requirements (resource_id, credential_id)
VALUES
  ('res-laser', 'LASER_SAFETY_SOP'),
  ('res-cnc', 'CNC_CERT'),
  ('res-scope', 'LAB_SAFETY_101'),
  ('res-sla', 'LAB_SAFETY_101'),
  ('res-tensile', 'LAB_SAFETY_101'),
  ('res-gpu', 'LAB_SAFETY_101'),
  ('res-book-sze', 'LAB_SAFETY_101'),
  ('res-book-shigley', 'LAB_SAFETY_101')
ON CONFLICT DO NOTHING;

-- 7. THE SPINE: ACTIVE BOOKING
INSERT INTO bookings (id, resource_id, user_id, start_at, end_at, purpose, status, priority_score, decision_reason)
VALUES (
  'CS-2026-8891',
  'res-laser',
  '11111111-1111-1111-1111-111111111111',
  NOW() + INTERVAL '1 hour',
  NOW() + INTERVAL '3 hours',
  'Precision cutting 5mm carbon-reinforced acrylic for drone chassis',
  'APPROVED',
  78.4,
  '{"result":"approved","factors":[{"label":"Baseline Starting Score","impact":100.0},{"label":"Recent Usage (0.0h in past 30 days)","impact":0.0},{"label":"Verified Academic Urgency (Tier 4)","impact":25.0}],"competingCandidateScore":64.2}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 8. INITIAL CRYPTOGRAPHIC AUDIT LOG
INSERT INTO audit_log (booking_id, actor_id, actor_name, action, payload, prev_hash, hash, created_at)
VALUES 
  (
    'CS-2026-8891',
    '33333333-3333-3333-3333-333333333333',
    'Prof. R. Sharma',
    'RESOURCE_REGISTERED',
    '{"resource":"Epilog Laser Cutter Bay 4","specs":"80W CO2, Air Assist"}'::jsonb,
    '0000000000000000000000000000000000000000000000000000000000000000',
    'e5b9f71c3a6e9a8f4b2d1c0e3a6f8b9d2e1c0a4b7f9d1e3a6c8b0d2e4f6a8b1c',
    NOW() - INTERVAL '5 hours'
  ),
  (
    'CS-2026-8891',
    '11111111-1111-1111-1111-111111111111',
    'Deepak Singhi',
    'BOOKING_REQUESTED',
    '{"slot":"Today 14:00 - 16:00","urgency":4,"purpose":"Drone Chassis"}'::jsonb,
    'e5b9f71c3a6e9a8f4b2d1c0e3a6f8b9d2e1c0a4b7f9d1e3a6c8b0d2e4f6a8b1c',
    'a2c4e6f8b0d2e4f6a8b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5',
    NOW() - INTERVAL '4 hours'
  ),
  (
    'CS-2026-8891',
    '44444444-4444-4444-4444-444444444444',
    'Pragyan',
    'REQUEST_APPROVED',
    '{"priority_score":78.4,"dispatchRule":"Fair-Share Algorithm v2"}'::jsonb,
    'a2c4e6f8b0d2e4f6a8b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5',
    'b1d3f5a7c9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3',
    NOW() - INTERVAL '3 hours'
  ),
  (
    'CS-2026-8891',
    '11111111-1111-1111-1111-111111111111',
    'Deepak Singhi',
    'CHECKIN_COMPLETED',
    '{"hmac_token_valid":true,"checklist_items_passed":3,"photos_anchored":3}'::jsonb,
    'b1d3f5a7c9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3',
    'c2e4a6b8d0f2a4b6c8e0a2c4e6f8a0b2d4f6a8b0c2e4f6a8b0d2e4f6a8b0c2e4',
    NOW() - INTERVAL '15 minutes'
  );
