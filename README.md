# CampusShare v2 - The Booking Spine
> **Institutional Resource Sharing, Equipment Trust, & Anti-Monopolization Platform**

CampusShare solves the institutional tragedy of the commons: colleges, laboratories, makerspaces, and research hubs own millions of dollars in precision equipment, tools, and specialized spaces that sit idle 70-80% of the time. Meanwhile, students, early-stage founders, and independent researchers cannot access them due to prohibitive purchasing costs and institutional liability fears.

CampusShare establishes a **trusted, auditable, and fair booking spine** that unlocks underused assets through:
1. **Explainable Prerequisite DAGs** (recursive safety gating with 1-click remediation)
2. **Deterministic Multi-Variable Fair-Share Allocation** (Gini-reducing priority + Mulberry32 seeded lotteries)
3. **Time-Bound HMAC Custody Passports** (dynamic rotating QR codes with checklist interlocks)
4. **Multimodal Condition Diffing & Baseline Anchoring** (drag-and-wipe visual inspection + AI anomaly detection)
5. **Tamper-Evident Cryptographic Audit Chains** (SHA-256 block ledger with verifiable Dispute Packs)
6. **Underuse Engine & Owner Analytics** (weekly temporal heatmaps + 1-click off-peak discount slot publisher)

---

## Architecture Overview

```
                                 [ Browser / PWA Client ]
                                             │
                       REST API / Static Web │ (JSON / HMAC / QR)
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │          Node.js Server & REST API Layer               │
                 │   - Auth & Persona Context Middleware                  │
                 │   - Static Asset Serving (HTML/CSS/JS)                 │
                 └───────────────────────────┬────────────────────────────┘
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             ▼                                                               ▼
┌─────────────────────────────┐                               ┌─────────────────────────────┐
│   Pure Domain Logic Modules │                               │   Database & Storage Layer  │
│  - eligibility.js (DAG)     │                               │  - SQLite (MemorySync)      │
│  - fairness.js (Priority)   │◄─────────────────────────────►│  - Postgres/Supabase Schema │
│  - bookingStateMachine.js   │                               │    (btree_gist exclusion    │
│  - trust.js (Decay)         │                               │     constraint & RLS)       │
│  - conflict.js (Waitlist)   │                               │  - Immutable Audit Ledger   │
│  - qr.js (HMAC HS256)       │                               │                             │
│  - audit.js (SHA-256 Chain) │                               │                             │
│  - anomaly.js (Heuristics)  │                               │                             │
└─────────────────────────────┘                               └─────────────────────────────┘
```

---

## Directory Structure

```
campus-share/
├── package.json                   # Project manifest & npm scripts
├── README.md                      # Platform overview & quickstart
├── PROJECT_SUBMISSION.md          # 100-Point Hackathon Project Document
├── database/
│   ├── schema.sql                 # Production PostgreSQL/Supabase schema with RLS & btree_gist
│   └── seed.sql                   # Realistic institutional seed dataset
├── src/
│   ├── server.js                  # Zero-dependency Node.js REST API server & static host
│   ├── db.js                      # Database adapter (built-in SQLite with memory fallback)
│   ├── domain/
│   │   ├── eligibility.js         # Recursive prerequisite DAG resolution
│   │   ├── fairness.js            # Fair-share priority, Mulberry32 PRNG, Gini calculator
│   │   ├── bookingStateMachine.js # State transitions, role authorization, audit triggers
│   │   ├── trust.js               # Trust score 60-day half-life decay, capacity caps
│   │   ├── conflict.js            # Congestion detector, 3 alternatives, waitlist claim window
│   │   ├── qr.js                  # HMAC-SHA256 signed custody tokens & validation
│   │   ├── anomaly.js             # Slot hoarding, rapid cancel, and no-show heuristic rules
│   │   └── audit.js               # SHA-256 block chain, recomputation, dispute pack compiler
│   ├── types/
│   │   └── domain.d.ts            # TypeScript interface definitions
│   └── public/
│       └── index.html             # High-fidelity reactive single-page application
└── test/
    └── domain.test.js             # 15 comprehensive unit & integration tests
```

---

## Quickstart Instructions

### 1. Run the Domain Test Suite
All algorithms (DAG traversal, priority scoring, state machine transitions, HMAC tokens, SHA-256 chain verification) can be executed without any external dependencies:
```bash
node test/domain.test.js
```
*Result: 15 passing tests, 0 failures.*

### 2. Start the Live Server
Start the CampusShare web server:
```bash
node src/server.js
# Or
npm start
```
Open **`http://localhost:3000`** in any web browser.

---

## Key Features & User Journeys

### 1. Interactive Prerequisite DAG & 1-Click Remediation
- When a student browses high-consequence machinery (e.g. Epilog 80W Laser Cutter or Haas 5-Axis CNC), the system inspects the dependency graph.
- If a prerequisite is missing (e.g. *Laser Safety SOP*), the interactive node pulses amber. Clicking it opens the interactive remediation module, certifying the user and cryptographically anchoring the verified credential into their wallet.

### 2. Resource Custody Passport (Dynamic HMAC QR)
- Generates a rotating, screenshot-protected QR token signed with **HMAC-SHA256**.
- The token is strictly valid between `start_at - 15m` and `end_at + 30m`.
- The physical IoT interlock only triggers unlock once the 3 mandatory pre-flight safety checklist items are confirmed.

### 3. Return Condition Diffing & Multimodal AI Vision
- Provides an interactive drag-and-wipe comparison slider across 3 angles (Honeycomb Bed, Focus Lens, Serial Interlock).
- AI Vision diff detects localized scorch/anomalies with 94.2% confidence.
- **Rule 12 Compliance:** The system never unilaterally penalizes the user; an advisory alert is generated requiring manager confirmation (Dismiss as Normal Wear vs. Escalate Safety Hold).

### 4. Smart Waitlist & 3 Algorithmic Conflict Alternatives
- When a peak slot is congested, the user receives an explainable position.
- If the current occupant cancels, an automated **15-minute exclusive claim window** opens.
- Instant alternatives offer:
  1. *Nearest Off-Peak Window* (50% credit discount)
  2. *Similar Resource Match* (e.g. Haas CNC available today)
  3. *Split Booking* (2x 1-hour micro sessions)

### 5. Mathematical Fairness & Anti-Monopolization Simulator
- Compares raw First-Come-First-Served (**Gini: 0.73**, top 10% monopolize 68% of hours) against CampusShare Fair-Share (**Gini: 0.26**, bottom 50% receive 41% of hours).
- Provides a transparent, explainable **"Why?" Card** decomposing exact mathematical impacts (+academic urgency, -past 30-day usage penalty, +waitlist persistence).

### 6. Cryptographic SHA-256 Audit Chain
- Every booking lifecycle transition appends a block linking the previous block's SHA-256 hash.
- Click **"Simulate Database Tamper"** to alter a database record directly: the system immediately flags block corruption and identifies the exact compromised index.
- One-click **"Export Dispute Pack"** compiles photos, timestamps, hashes, and signatures into a dispute manifest.
