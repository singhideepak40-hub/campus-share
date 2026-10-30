/**
 * CampusShare v2 - Database & Storage Adapter
 * Provides local SQL execution via Node v22's built-in node:sqlite,
 * with fallbacks for standard in-memory transactional mock data.
 * Featuring team personas: Deepak Singhi, Sougata, Pragyan, Prof. R. Sharma.
 */

let sqlite;
try {
  sqlite = require('node:sqlite');
} catch (e) {
  sqlite = null;
}

const { appendAuditBlock } = require('./domain/audit');

class CampusDatabase {
  constructor() {
    this.useSqlite = false;
    this.db = null;
    this.memoryStore = {
      clockOffsetMinutes: 0,
      activePersona: 'deepak',
      profiles: [],
      resources: [],
      credentials: [],
      credential_prereqs: [],
      resource_requirements: [],
      user_credentials: [],
      bookings: [],
      creditLedger: [],
      waitlist: [],
      auditChain: [],
      conditionReports: [],
      incidents: [],
      anomalyFlags: []
    };

    this.initDatabase();
    this.seedInitialData();
  }

  initDatabase() {
    if (sqlite && sqlite.DatabaseSync) {
      try {
        this.db = new sqlite.DatabaseSync(':memory:');
        this.useSqlite = true;
        this.createSqliteTables();
      } catch (err) {
        console.warn('[DB] SQLite memory init failed, using robust memory store:', err.message);
        this.useSqlite = false;
      }
    }
  }

  createSqliteTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        trust_tier TEXT NOT NULL DEFAULT 'new',
        credits_balance INT NOT NULL DEFAULT 100,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        safety_level TEXT,
        hourly_credits INT NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        purpose TEXT,
        status TEXT NOT NULL,
        priority_score REAL DEFAULT 0,
        decision_reason TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  seedInitialData() {
    const now = new Date();

    // 1. Seed Profiles (Deepak Singhi, Sougata, Pragyan, Prof. Sharma)
    this.memoryStore.profiles = [
      {
        id: 'usr-deepak',
        name: 'Deepak Singhi',
        email: 'deepak.singhi@campus.edu',
        role: 'user',
        trust_tier: 'standard',
        credits_balance: 135,
        hours_past_30d: 4.0,
        created_at: new Date(now.getTime() - 45 * 86400000).toISOString()
      },
      {
        id: 'usr-sougata',
        name: 'Sougata Mandal',
        email: 'sougata.mandal@campus.edu',
        role: 'user',
        trust_tier: 'trusted',
        credits_balance: 180,
        hours_past_30d: 14.5,
        created_at: new Date(now.getTime() - 120 * 86400000).toISOString()
      },
      {
        id: 'usr-pragyan',
        name: 'Pragyan Talukdar',
        email: 'pragyan.talukdar@campus.edu',
        role: 'manager',
        trust_tier: 'trusted',
        credits_balance: 450,
        hours_past_30d: 2.0,
        created_at: new Date(now.getTime() - 300 * 86400000).toISOString()
      },
      {
        id: 'usr-sharma',
        name: 'Prof. R. Sharma',
        email: 'r.sharma@campus.edu',
        role: 'owner',
        trust_tier: 'trusted',
        credits_balance: 999,
        hours_past_30d: 0.0,
        created_at: new Date(now.getTime() - 365 * 86400000).toISOString()
      }
    ];

    // 2. Seed Credentials & Prerequisite Graph
    this.memoryStore.credentials = [
      { id: 'LAB_SAFETY_101', name: 'General Lab Safety 101', validity_days: 365 },
      { id: 'LASER_SAFETY_SOP', name: 'Class 4 CO2 Laser Safety SOP', validity_days: 180, training_resource_id: 'res-laser' },
      { id: 'BASIC_ELECTRONICS', name: 'High-Voltage Circuit Safety', validity_days: 365 },
      { id: 'CNC_CERT', name: '5-Axis CNC Precision Machining Certification', validity_days: 180, training_resource_id: 'res-cnc' }
    ];

    this.memoryStore.credential_prereqs = [
      { credential_id: 'LASER_SAFETY_SOP', requires_credential_id: 'LAB_SAFETY_101' },
      { credential_id: 'CNC_CERT', requires_credential_id: 'LAB_SAFETY_101' },
      { credential_id: 'CNC_CERT', requires_credential_id: 'BASIC_ELECTRONICS' }
    ];

    // 3. User Credentials
    this.memoryStore.user_credentials = [
      {
        id: 'uc-1',
        user_id: 'usr-deepak',
        credential_id: 'LAB_SAFETY_101',
        status: 'verified',
        expires_at: new Date(now.getTime() + 200 * 86400000).toISOString()
      },
      {
        id: 'uc-2',
        user_id: 'usr-deepak',
        credential_id: 'BASIC_ELECTRONICS',
        status: 'verified',
        expires_at: new Date(now.getTime() + 180 * 86400000).toISOString()
      },
      {
        id: 'uc-3',
        user_id: 'usr-sougata',
        credential_id: 'LAB_SAFETY_101',
        status: 'verified',
        expires_at: new Date(now.getTime() + 250 * 86400000).toISOString()
      },
      {
        id: 'uc-4',
        user_id: 'usr-sougata',
        credential_id: 'LASER_SAFETY_SOP',
        status: 'verified',
        expires_at: new Date(now.getTime() + 120 * 86400000).toISOString()
      },
      {
        id: 'uc-5',
        user_id: 'usr-sougata',
        credential_id: 'CNC_CERT',
        status: 'verified',
        expires_at: new Date(now.getTime() + 300 * 86400000).toISOString()
      },
      {
        id: 'uc-6',
        user_id: 'usr-pragyan',
        credential_id: 'LAB_SAFETY_101',
        status: 'verified',
        expires_at: new Date(now.getTime() + 365 * 86400000).toISOString()
      },
      {
        id: 'uc-7',
        user_id: 'usr-pragyan',
        credential_id: 'LASER_SAFETY_SOP',
        status: 'verified',
        expires_at: new Date(now.getTime() + 365 * 86400000).toISOString()
      }
    ];

    // 4. Seed Resources
    this.memoryStore.resources = [
      {
        id: 'res-laser',
        owner_id: 'usr-sharma',
        name: 'Epilog Fusion Pro 48 CO2 Laser Cutter',
        category: 'Fabrication',
        location: 'MakerWing Bay 4',
        safety_level: 'Level 3: Supervised',
        hourly_credits: 15,
        description: 'Industrial 80W CO2 laser precision cutting and engraving system. Capable of handling wood, acrylic, delrin, fabrics, and marked metals.',
        rules_text: 'Requires verified safety SOP and active fume extraction. Clean honeycomb bed before and after use.',
        status: 'active'
      },
      {
        id: 'res-cnc',
        owner_id: 'usr-sharma',
        name: 'Haas Mini Mill 5-Axis CNC Center',
        category: 'Fabrication',
        location: 'Precision Machine Shop Bay 1',
        safety_level: 'Level 4: Restricted',
        hourly_credits: 30,
        description: 'Heavy industrial machining center for aluminum, brass, and steel components. Mandatory technician co-presence.',
        rules_text: 'G-code dry run required before stock engagement. Eye and ear protection mandatory.',
        status: 'active'
      },
      {
        id: 'res-scope',
        owner_id: 'usr-sharma',
        name: 'Rigol DS1054Z 100MHz Digital Oscilloscope',
        category: 'Electronics',
        location: 'Circuit Design Lab 204',
        safety_level: 'Level 1: General',
        hourly_credits: 5,
        description: '4-channel 50MHz-100MHz digital storage oscilloscope with protocol decoding for I2C, SPI, and UART.',
        rules_text: 'Do not exceed 300V input limit without high-voltage attenuator probe.',
        status: 'active'
      },
      {
        id: 'res-sla',
        owner_id: 'usr-sharma',
        name: 'Formlabs Form 3+ Stereolithography 3D Printer',
        category: 'Fabrication',
        location: 'Rapid Prototyping Bay 2',
        safety_level: 'Level 2: Trained',
        hourly_credits: 12,
        description: 'Precision photopolymer resin 3D printing. Requires chemical glove handling and isopropyl alcohol wash SOP.',
        rules_text: 'Nitrile gloves mandatory when opening UV amber chamber.',
        status: 'active'
      },
      {
        id: 'res-tensile',
        owner_id: 'usr-pragyan',
        name: 'Instron 5969 Dual Column Tensile Tester',
        category: 'Materials Testing',
        location: 'Materials Characterization 102',
        safety_level: 'Level 3: Supervised',
        hourly_credits: 25,
        description: '50kN load capacity universal mechanical tester for tensile, compression, and 3-point bend stress testing.',
        rules_text: 'Calibration check required prior to load cell zeroing.',
        status: 'active'
      },
      {
        id: 'res-gpu',
        owner_id: 'usr-pragyan',
        name: 'NVIDIA HGX A100 80GB Training Node',
        category: 'Advanced Computing',
        location: 'HPC Server Room 3 (SSH Slurm)',
        safety_level: 'Level 2: Trained',
        hourly_credits: 20,
        description: 'High-throughput cluster node with 8x A100 Tensor Core GPUs for distributed deep learning and simulation.',
        rules_text: 'Strict 4-hour max allocation during peak research deadlines.',
        status: 'active'
      },
      {
        id: 'res-book-sze',
        owner_id: 'usr-sharma',
        name: 'Semiconductor Devices: Physics and Technology (S.M. Sze, 3rd Ed.)',
        category: 'Books & Archives',
        location: 'Central Library • Rare Reserve R-14',
        safety_level: 'Level 1: General',
        hourly_credits: 2,
        description: 'Comprehensive reference on semiconductor device physics, energy bands, p-n junctions, and bipolar transistors. 48-hr loan with condition tracking.',
        rules_text: 'Strict condition baseline check before checkout and upon return.',
        status: 'active'
      },
      {
        id: 'res-book-shigley',
        owner_id: 'usr-sharma',
        name: "Shigley's Mechanical Engineering Design (Special Reference Hardcover)",
        category: 'Books & Archives',
        location: 'MakerWing Reference Nook Shelf B',
        safety_level: 'Level 1: General',
        hourly_credits: 3,
        description: 'Standard mechanical failure theories, fatigue limits, fasteners, springs, and power screws. Mandatory return inspection.',
        rules_text: 'Return in pristine binding condition.',
        status: 'active'
      }
    ];

    // Resource Requirements
    this.memoryStore.resource_requirements = [
      { resource_id: 'res-laser', credential_id: 'LASER_SAFETY_SOP' },
      { resource_id: 'res-cnc', credential_id: 'CNC_CERT' },
      { resource_id: 'res-scope', credential_id: 'LAB_SAFETY_101' },
      { resource_id: 'res-sla', credential_id: 'LAB_SAFETY_101' },
      { resource_id: 'res-tensile', credential_id: 'LAB_SAFETY_101' },
      { resource_id: 'res-gpu', credential_id: 'LAB_SAFETY_101' },
      { resource_id: 'res-book-sze', credential_id: 'LAB_SAFETY_101' },
      { resource_id: 'res-book-shigley', credential_id: 'LAB_SAFETY_101' }
    ];

    // 5. Seed Comprehensive Booking History (for Deepak, Sougata, Pragyan)
    const today = new Date(now);
    today.setHours(14, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(16, 0, 0, 0);

    this.memoryStore.bookings = [
      {
        id: 'CS-2026-8891',
        resource_id: 'res-laser',
        resource_name: 'Epilog Fusion Pro 48 Laser Cutter',
        location: 'MakerWing Bay 4',
        user_id: 'usr-deepak',
        user_name: 'Deepak Singhi',
        start_at: today.toISOString(),
        end_at: todayEnd.toISOString(),
        purpose: 'Precision cutting 5mm carbon-reinforced acrylic for drone chassis',
        status: 'APPROVED',
        priority_score: 78.4,
        decision_reason: {
          result: 'approved',
          factors: [
            { label: 'Baseline Starting Score', impact: 100.0 },
            { label: 'Recent Usage (0.0h in past 30 days)', impact: 0.0 },
            { label: 'Verified Academic Urgency (Tier 4)', impact: 25.0 }
          ],
          competingCandidateScore: 64.2
        },
        created_at: new Date(now.getTime() - 4 * 3600000).toISOString()
      },
      {
        id: 'CS-2026-8104',
        resource_id: 'res-scope',
        resource_name: 'Rigol DS1054Z 100MHz Oscilloscope',
        location: 'Circuit Design Lab 204',
        user_id: 'usr-deepak',
        user_name: 'Deepak Singhi',
        start_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
        end_at: new Date(now.getTime() - 3 * 86400000 + 7200000).toISOString(),
        purpose: 'SPI/I2C sensor signal integrity characterization',
        status: 'RETURNED',
        priority_score: 82.0,
        decision_reason: { result: 'approved' },
        created_at: new Date(now.getTime() - 4 * 86400000).toISOString()
      },
      {
        id: 'CS-2026-7850',
        resource_id: 'res-book-sze',
        resource_name: 'Semiconductor Devices: Physics and Technology (S.M. Sze)',
        location: 'Central Library • Rare Reserve R-14',
        user_id: 'usr-deepak',
        user_name: 'Deepak Singhi',
        start_at: new Date(now.getTime() - 8 * 86400000).toISOString(),
        end_at: new Date(now.getTime() - 6 * 86400000).toISOString(),
        purpose: 'Thesis literature review on bipolar junction transistor bandgaps',
        status: 'CLOSED',
        priority_score: 95.0,
        decision_reason: { result: 'approved' },
        created_at: new Date(now.getTime() - 9 * 86400000).toISOString()
      },
      {
        id: 'CS-2026-8720',
        resource_id: 'res-cnc',
        resource_name: 'Haas Mini Mill 5-Axis CNC Center',
        location: 'Precision Machine Shop Bay 1',
        user_id: 'usr-sougata',
        user_name: 'Sougata Mandal',
        start_at: new Date(now.getTime() - 1 * 86400000).toISOString(),
        end_at: new Date(now.getTime() - 1 * 86400000 + 10800000).toISOString(),
        purpose: 'Custom aluminum 6061 planetary gearbox carrier machining',
        status: 'RETURNED',
        priority_score: 91.5,
        decision_reason: { result: 'approved' },
        created_at: new Date(now.getTime() - 2 * 86400000).toISOString()
      },
      {
        id: 'CS-2026-8419',
        resource_id: 'res-sla',
        resource_name: 'Formlabs Form 3+ SLA Printer',
        location: 'Rapid Prototyping Bay 2',
        user_id: 'usr-sougata',
        user_name: 'Sougata Mandal',
        start_at: new Date(now.getTime() - 5 * 86400000).toISOString(),
        end_at: new Date(now.getTime() - 5 * 86400000 + 21600000).toISOString(),
        purpose: 'Biocompatible dental resin manifold prototype',
        status: 'CLOSED',
        priority_score: 88.0,
        decision_reason: { result: 'approved' },
        created_at: new Date(now.getTime() - 6 * 86400000).toISOString()
      }
    ];

    // 6. Credit Ledger Entries (Transaction History)
    this.memoryStore.creditLedger = [
      {
        id: 'cl-1',
        user_id: 'usr-deepak',
        booking_id: null,
        delta: +100,
        balance_after: 100,
        reason: 'Campus Onboarding Research Grant',
        created_at: new Date(now.getTime() - 45 * 86400000).toISOString()
      },
      {
        id: 'cl-2',
        user_id: 'usr-deepak',
        booking_id: 'CS-2026-7850',
        delta: -4,
        balance_after: 96,
        reason: 'Rare Reserve Textbook 48h Rental',
        created_at: new Date(now.getTime() - 8 * 86400000).toISOString()
      },
      {
        id: 'cl-3',
        user_id: 'usr-deepak',
        booking_id: 'CS-2026-7850',
        delta: +20,
        balance_after: 116,
        reason: 'On-Time Pristine Condition Return Bonus',
        created_at: new Date(now.getTime() - 6 * 86400000).toISOString()
      },
      {
        id: 'cl-4',
        user_id: 'usr-deepak',
        booking_id: 'CS-2026-8104',
        delta: -10,
        balance_after: 106,
        reason: 'Oscilloscope 2-Hour Lab Session',
        created_at: new Date(now.getTime() - 3 * 86400000).toISOString()
      },
      {
        id: 'cl-5',
        user_id: 'usr-deepak',
        booking_id: null,
        delta: +44,
        balance_after: 150,
        reason: 'Peer Safety SOP Review & Assistance Grant',
        created_at: new Date(now.getTime() - 1 * 86400000).toISOString()
      },
      {
        id: 'cl-6',
        user_id: 'usr-deepak',
        booking_id: 'CS-2026-8891',
        delta: -15,
        balance_after: 135,
        reason: 'Reservation Escrow: Laser Cutter Bay 4',
        created_at: new Date(now.getTime() - 4 * 3600000).toISOString()
      }
    ];

    // 7. Seed Waitlist
    this.memoryStore.waitlist = [
      {
        id: 'wl-1',
        booking_id: 'CS-2026-8891',
        candidate_name: 'Sougata Mandal',
        candidate_id: 'usr-sougata',
        position: 1,
        priority_score: 64.2,
        status: 'QUEUED',
        created_at: new Date(now.getTime() - 2 * 3600000).toISOString()
      }
    ];

    // 8. Seed Initial Cryptographic Audit Chain
    this.memoryStore.auditChain = [];
    appendAuditBlock(this.memoryStore.auditChain, {
      booking_id: 'CS-2026-8891',
      actor_id: 'usr-sharma',
      actor_name: 'Prof. R. Sharma',
      action: 'RESOURCE_REGISTERED',
      payload: { resource: 'Epilog Laser Cutter Bay 4', specs: '80W CO2, Air Assist' },
      timestamp: '2026-10-30T09:12:00.000Z'
    });

    appendAuditBlock(this.memoryStore.auditChain, {
      booking_id: 'CS-2026-8891',
      actor_id: 'usr-deepak',
      actor_name: 'Deepak Singhi',
      action: 'BOOKING_REQUESTED',
      payload: { slot: 'Today 14:00 - 16:00', urgency: 4, purpose: 'Drone Chassis' },
      timestamp: '2026-10-30T10:30:14.000Z'
    });

    appendAuditBlock(this.memoryStore.auditChain, {
      booking_id: 'CS-2026-8891',
      actor_id: 'usr-pragyan',
      actor_name: 'Pragyan Talukdar',
      action: 'REQUEST_APPROVED',
      payload: { priority_score: 78.4, dispatchRule: 'Fair-Share Algorithm v2' },
      timestamp: '2026-10-30T11:05:22.000Z'
    });

    appendAuditBlock(this.memoryStore.auditChain, {
      booking_id: 'CS-2026-8891',
      actor_id: 'usr-sougata',
      actor_name: 'Sougata Mandal',
      action: 'CHECKIN_COMPLETED',
      payload: { hmac_token_valid: true, checklist_items_passed: 3, photos_anchored: 3 },
      timestamp: '2026-10-30T14:02:18.000Z'
    });

    // 9. Seed Condition Reports
    this.memoryStore.conditionReports = [
      {
        id: 'cr-checkin-8891',
        booking_id: 'CS-2026-8891',
        phase: 'checkin',
        checklist_done: { ppe: true, fumeVent: true, cleanBed: true },
        notes: 'Pristine baseline captured by Sougata Mandal. Fume exhaust pressure optimal.',
        created_by: 'usr-sougata',
        created_at: '2026-10-30T14:02:18.000Z',
        photos: [
          { angle: 'Front Panel', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
          { angle: 'Honeycomb Bed', sha256: '7a91fc104239841f32a76bc827982fec327e51c892bc5432a93821034981fae2' },
          { angle: 'Serial Plate', sha256: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' }
        ]
      }
    ];

    if (this.useSqlite) {
      this.syncMemoryToSqlite();
    }
  }

  syncMemoryToSqlite() {
    try {
      const insertProfile = this.db.prepare(`
        INSERT OR REPLACE INTO profiles (id, name, email, role, trust_tier, credits_balance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of this.memoryStore.profiles) {
        insertProfile.run(p.id, p.name, p.email, p.role, p.trust_tier, p.credits_balance, p.created_at);
      }

      const insertRes = this.db.prepare(`
        INSERT OR REPLACE INTO resources (id, owner_id, name, category, location, description, safety_level, hourly_credits, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of this.memoryStore.resources) {
        insertRes.run(r.id, r.owner_id, r.name, r.category, r.location, r.description, r.safety_level, r.hourly_credits, r.status, new Date().toISOString());
      }
    } catch (e) {
      console.warn('[DB] SQLite sync error:', e.message);
    }
  }

  getVirtualClock() {
    const realNow = new Date();
    return new Date(realNow.getTime() + this.memoryStore.clockOffsetMinutes * 60000);
  }

  advanceClock(minutes) {
    this.memoryStore.clockOffsetMinutes += minutes;
    return this.getVirtualClock();
  }

  resetAll() {
    this.memoryStore.clockOffsetMinutes = 0;
    this.memoryStore.activePersona = 'deepak';
    this.seedInitialData();
    return true;
  }
}

const campusDb = new CampusDatabase();
module.exports = campusDb;
