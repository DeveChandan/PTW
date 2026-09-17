# Developer Task Matrix & Ownership Guide

This document defines the **Work Breakdown Structure (WBS)**, role assignments, file ownership, sprint milestones, and Definition of Done (DoD) for the **Permit To Work (PTW)** project.

---

## 👥 Team Roles & Responsibilities Summary

| Role | Engineer | Functional Scope | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Project Lead** | You | Core Framework, SAP Integration, DevOps & Governance | Architecture, Vite/BSP build config, OData V4 client, Auth/CSRF handshake, PR reviews, SAP deployment |
| **Developer 1** | Dev 1 | PTW Core & Creation Wizard | Multi-step Permit Form, Hazard identification, PPE checklist, 5x5 Risk Assessment Matrix |
| **Developer 2** | Dev 2 | Approval Workflow & Digital Signatures | Multi-tier Approval Chain, Digital Signature capture, Status state transitions, Audit Log timeline |
| **Developer 3** | Dev 3 | Operations Dashboard, LOTO & Reporting | Real-time KPI dashboard, LOTO isolation points, Gas Testing entry log, Printable PTW sheet |

---

## 📁 File & Module Ownership Matrix

To eliminate merge conflicts, **no developer touches another developer's domain folder** without prior alignment with the Lead.

```
┌──────────────────────────────┬──────────────────────────────┬─────────────────────────┐
│ Module / Directory           │ Primary Owner                │ Collaborator            │
├──────────────────────────────┼──────────────────────────────┼─────────────────────────┤
│ src/core/                    │ Project Lead                 │ Read-only for Devs      │
│ src/shared/components/       │ Project Lead                 │ Dev 1, 2, 3 (Shared)    │
│ src/features/permits/        │ Developer 1                  │ Lead (Code Review)      │
│ src/features/approvals/      │ Developer 2                  │ Lead (Code Review)      │
│ src/features/dashboard/      │ Developer 3                  │ Lead (Code Review)      │
│ vite.config.ts / package.json│ Project Lead                 │ None                    │
│ .env* / .nwabaprc            │ Project Lead                 │ None                    │
└──────────────────────────────┴──────────────────────────────┴─────────────────────────┘
```

---

## 🛠️ Detailed Task Breakdown by Developer

### 👑 Project Lead (Architect & Core Infrastructure)

#### Objective
Ensure a solid architectural foundation, robust SAP connectivity, reliable authentication, automated CSRF token handling, and streamlined BSP deployment.

#### Detailed Task Checklist
- [x] Establish repository structure, TypeScript configs, and Vite build pipeline.
- [ ] Implement `src/core/api/odataClient.ts`:
  - Axios instance configured with base URL and SAP client parameters.
  - Automatic `X-CSRF-Token: Fetch` interceptor on initial call.
  - Token cache with automatic refresh on `403 Forbidden` response.
  - ETag handling via `If-Match` headers for optimistic concurrency control.
- [ ] Implement `src/core/auth/sapAuthContext.tsx`:
  - Dual-mode user resolution: inspect `window.sap?.ushell?.Container` (FLP) vs fallback to `GET /sap/bc/ui2/start_up` (standalone BSP).
  - Expose current user context: `userId`, `userName`, `email`, `roles`, `defaultPlant`.
- [ ] Configure Vite proxy in `vite.config.ts` for local CORS-free debugging against SAP Gateway.
- [ ] Establish CI/CD and BSP deployment script (`deploy:bsp`) via `nwabap-ui5-uploader`.
- [ ] Perform Code Reviews and merge PRs from Dev 1, Dev 2, and Dev 3.

---

### 👷 Developer 1: PTW Core & Creation Wizard

#### Objective
Build the end-to-end permit creation flow, enabling plant technicians and contractors to draft and submit permits with full hazard and PPE specifications.

#### Assigned Directory
`src/features/permits/`

#### Detailed Task Checklist
- [ ] **Task 1.1: Multi-Step Permit Wizard Container**
  - Implement step-based wizard using UI5 `Wizard` or custom step progression (`StepGeneral`, `StepHazards`, `StepPPE`, `StepRiskMatrix`, `StepReview`).
  - Form validation for each step before advancing.
- [ ] **Task 1.2: Step 1 - General Work Details**
  - Plant dropdown (fetch from SAP Plant value help).
  - Functional Location / Equipment selector with search filter.
  - Permit Type selector (`Hot Work`, `Cold Work`, `Confined Space`, `Working at Height`, `Electrical`).
  - Validity period date-time pickers (`ValidFrom`, `ValidTo`) with constraint checks.
  - Contractor company name and number of workers on site.
- [ ] **Task 1.3: Step 2 - Hazard Checklist**
  - Category accordion: Mechanical, Thermal/Flammable, Electrical, Toxic/Chemical, Pressure, Height.
  - Toggle switch for each hazard with conditional "Control Measure" text input.
- [ ] **Task 1.4: Step 3 - Personal Protective Equipment (PPE)**
  - Visual PPE selector grid with icons: Hard Hat, Safety Boots, Respirator, Arc Flash Suit, Harness, Face Shield.
- [ ] **Task 1.5: Step 4 - 5x5 Risk Assessment Matrix**
  - Interactive grid: Consequence (1 to 5) vs Likelihood (1 to 5).
  - Dynamic calculation of overall Risk Level:
    - 1-4: **Low (Green)**
    - 5-9: **Medium (Yellow)**
    - 10-14: **High (Orange)**
    - 15-25: **Critical (Red)**
- [ ] **Task 1.6: OData Integration**
  - Connect to `POST /Permits` with deep insert or `$batch` request saving `PermitHeader`, `PermitHazards`, and `PermitPPE`.

---

### 🛡️ Developer 2: Approval Workflow & Digital Signatures

#### Objective
Implement the formal approval chain, status state machine, digital signature capture, and immutable audit trail.

#### Assigned Directory
`src/features/approvals/`

#### Detailed Task Checklist
- [ ] **Task 2.1: Approval Timeline Component**
  - Visual multi-tier progress tracker:
    1. *Stage 1: Applicant Submission*
    2. *Stage 2: Safety Officer (HSE) Verification*
    3. *Stage 3: Area Owner / Isolator Clearance*
    4. *Stage 4: Operations Approver Final Sign-off*
  - Status indicators: `Completed` (Green), `In Progress` (Blue), `Pending` (Gray), `Rejected` (Red).
- [ ] **Task 2.2: Digital Signature Pad**
  - HTML5 Canvas signature pad allowing mouse or touchscreen sign-off.
  - Convert signature to Base64 image string.
  - User identity stamp: append logged-in SAP User ID and UTC timestamp.
- [ ] **Task 2.3: Action Toolbar & Decision Modal**
  - Dynamic action buttons based on user role and current permit status:
    - **Approve**: Prompts for signature and optional notes.
    - **Reject**: Mandates rejection reason text.
    - **Request Clarification**: Sends permit back to applicant with comments.
    - **Emergency Suspend**: Immediate stop-work trigger for active permits.
- [ ] **Task 2.4: OData Workflow Actions**
  - Invoke SAP bound actions:
    - `POST /Permits('001')/com.sap.gateway.zptw.approve`
    - `POST /Permits('001')/com.sap.gateway.zptw.reject`
    - `POST /Permits('001')/com.sap.gateway.zptw.suspend`
- [ ] **Task 2.5: Audit Trail & History Log**
  - Table showing complete history of changes: Timestamp, User, Old Status, New Status, Comments.

---

### 📊 Developer 3: Operations Dashboard, LOTO & Reporting

#### Objective
Build the real-time operational dashboard for plant managers, the Lockout/Tagout (LOTO) isolation module, gas testing entry logs, and printable permit documents.

#### Assigned Directory
`src/features/dashboard/`

#### Detailed Task Checklist
- [ ] **Task 3.1: KPI Metrics & Status Cards**
  - Top metric counters:
    - *Total Active Permits* (Live in field)
    - *Pending Approvals* (Awaiting sign-off)
    - *Expiring Soon* (Within 2 hours)
    - *Suspended / LOTO Incomplete*
- [ ] **Task 3.2: Filterable Permit Data Table**
  - Table using UI5 `AnalyticalTable` or responsive grid.
  - Filter by: Plant, Status, Permit Type, Date Range, Risk Level.
  - Search by Permit ID, Equipment Name, or Contractor.
  - Click-through to view Permit Details.
- [ ] **Task 3.3: LOTO (Lockout / Tagout) Isolation Manager**
  - Tabular view of all isolation points:
    - Tag Number (e.g. `TAG-ELEC-401`)
    - Isolation Type (Electrical Breaker, Valve Flange, Mechanical Lock)
    - Status (`Applied`, `Verified`, `De-isolated`)
    - Isolated By & Verified By (SAP User IDs)
- [ ] **Task 3.4: Gas Testing Entry Log**
  - Required for Hot Work and Confined Space permits.
  - Inputs for:
    - Oxygen Level (`O2 %` - safe range 19.5% - 23.5%)
    - Flammable Gases (`LEL %` - must be < 10%)
    - Toxic Gases (`H2S PPM`, `CO PPM`)
  - Color-coded safety validation (Red if out of safe bounds).
- [ ] **Task 3.5: Printable PTW Document Preview**
  - Clean, formal print stylesheet conforming to OSHA / HSE regulatory standards.
  - Browser print trigger (`window.print()`) with print-optimized CSS hiding navigation bars.

---

## 🏁 Definition of Done (DoD) for Pull Requests

Before any developer submits a Pull Request to the Lead, the code must satisfy:
1. **TypeScript Compilation**: `npx tsc --noEmit` succeeds with **0 errors**.
2. **ESLint Cleanliness**: No lint errors or console warnings.
3. **Responsive UI**: Verified on desktop (1920x1080) and tablet (1024x768).
4. **OData Error Handling**: All network requests handle SAP backend exceptions gracefully with user-friendly error banners.
5. **No Cross-Domain Direct Imports**: Use shared components from `src/shared/` or core utilities from `src/core/`. Do not import private components across `features/`.
6. **Git Standards**: Feature branch branched from `develop`, Conventional Commit messages, and descriptive PR summary.
