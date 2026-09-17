# System Architecture Design: SAP Permit To Work (PTW) Web App

This document outlines the software architecture, data modeling, integration patterns, security design, and deployment strategy for the **Permit To Work (PTW)** application built with **React**, **Vite**, **TypeScript**, **SAP OData V4**, and hosted on **SAP NetWeaver / S/4HANA BSP**.

---

## 1. Architectural Overview & Component Layers

The application is structured using a **Modular Layered Architecture** with strict domain isolation to allow multiple developers to work concurrently without code collisions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                             │
│  SAP UI5 Web Components for React (@ui5/webcomponents-react) + Tailwind│
│  ┌──────────────────┬──────────────────┬─────────────────────────────┐  │
│  │  Feature: Core   │ Feature: Approval│  Feature: Dashboard & LOTO  │  │
│  │  (Permit Wizard, │ (Workflow Engine,│  (Real-time KPIs, Isolation,│  │
│  │   Hazards, PPE)  │  Signatures)     │   Gas Testing, Print/Spool) │  │
│  └────────┬─────────┴────────┬─────────┴──────────────┬──────────────┘  │
└───────────┼──────────────────┼────────────────────────┼─────────────────┘
            │                  │                        │
┌───────────▼──────────────────▼────────────────────────▼─────────────────┐
│                      STATE & DATA SYNCHRONIZATION                       │
│  ┌─────────────────────────────────┐ ┌────────────────────────────────┐  │
│  │   Server State (TanStack Query) │ │   Client State (Zustand)       │  │
│  │   - OData Cache & Garbage Coll. │ │   - Active Wizard Step         │  │
│  │   - Optimistic Updates          │ │   - Filter Drawer State        │  │
│  │   - Background Auto-refetch     │ │   - Draft Local Persistence    │  │
│  └────────────────┬────────────────┘ └────────────────────────────────┘  │
└───────────────────┼─────────────────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────────────────┐
│                       CORE ODATA V4 & AUTH LAYER                        │
│  ┌─────────────────────────┐ ┌───────────────────┐ ┌──────────────────┐  │
│  │   SAP OData V4 Client   │ │   Auth Context    │ │ CSRF & ETag      │  │
│  │   - Axios with SAP Base │ │   - /ui2/start_up │ │ Interceptors     │  │
│  │   - $expand, $filter    │ │   - FLP Container │ │ - Auto-refresh   │  │
│  │   - Batch Multipart     │ │   - Roles & Plant │ │ - If-Match lock  │  │
│  └───────────┬─────────────┘ └─────────┬─────────┘ └────────┬─────────┘  │
└──────────────┼─────────────────────────┼────────────────────┼────────────┘
               │                         │                    │
        HTTPS (CORS in dev via proxy / Same-origin in SAP BSP)
               │                         │                    │
┌──────────────▼─────────────────────────▼────────────────────▼────────────┐
│                    SAP S/4HANA / NETWEAVER GATEWAY                      │
├──────────────────────────────────────────────────────────────────────────┤
│ • ICF Authentication: Basic / SAML2 / Kerberos / FLP SSO                 │
│ • User Context: /sap/bc/ui2/start_up                                     │
│ • OData V4 Service: /sap/opu/odata4/sap/zptw_srv/srvd_a2x/sap/zptw/0001/ │
│ • ABAP Backend: Business Object Processing (RAP BO / CAP / CDS Views)    │
│ • Database: SAP HANA (Database Tables: ZPTW_HEADER, ZPTW_HAZARD, etc.)  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure & Module Boundaries

The project adopts a **Feature-Driven Structure**. Each feature contains its own components, hooks, types, and API calls:

```
d:/App/PTW/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── ARCHITECTURE.md
├── README.md
├── DEVELOPER_TASKS.md
├── GIT_WORKFLOW.md
└── src/
    ├── main.tsx                         # App entrypoint & Provider tree
    ├── App.tsx                          # App shell & router
    ├── assets/                          # Static logos, icons, safety badges
    ├── core/                            # Shared core foundation (Lead Owned)
    │   ├── api/
    │   │   ├── odataClient.ts           # Axios instance with CSRF + ETag handlers
    │   │   └── odataEndpoints.ts        # Service URL constants & query builders
    │   ├── auth/
    │   │   ├── sapAuthContext.tsx       # SAP User authentication context
    │   │   └── useSapUser.ts            # Hook to access SAP user & permissions
    │   ├── types/
    │   │   ├── odata.types.ts           # OData V4 generic envelopes and metadata
    │   │   └── ptw.types.ts             # Permit domain entity interfaces
    │   └── utils/
    │       ├── csrfToken.ts             # CSRF token cache & refresher
    │       ├── sapDateFormatter.ts      # SAP EDM.Date & EDM.DateTimeOffset parsers
    │       └── errorHandler.ts          # SAP backend error message unpacker
    ├── shared/                          # Reusable UI components & layouts
    │   ├── components/
    │   │   ├── Navbar.tsx               # Fiori header / Shell bar
    │   │   ├── StatusBadge.tsx          # Status color codes (Draft, Active, etc.)
    │   │   ├── RiskPill.tsx             # Risk severity indicators (Low, Med, High)
    │   │   └── ConfirmDialog.tsx        # SAP-styled confirmation dialog
    │   └── hooks/
    │       └── useDebounce.ts
    └── features/                        # Functional domains (Assigned to Devs)
        ├── permits/                     # DEV 1: PTW Core & Lifecycle
        │   ├── components/
        │   │   ├── PermitWizard/        # Multi-step creation wizard
        │   │   │   ├── StepGeneral.tsx  # Work details, plant, area, equipment
        │   │   │   ├── StepHazards.tsx  # Hazard checklist (Mechanical, Chemical...)
        │   │   │   ├── StepPPE.tsx      # PPE selection grid
        │   │   │   └── StepRiskMatrix.tsx # 5x5 Consequence x Likelihood matrix
        │   │   └── PermitDetailView.tsx # Permit read/edit sheet
        │   ├── hooks/
        │   │   ├── usePermitQuery.ts    # Fetch permit details
        │   │   └── useCreatePermit.ts   # Save/Submit permit
        │   └── store/
        │       └── wizardStore.ts       # Temporary wizard state
        │
        ├── approvals/                   # DEV 2: Workflow & Digital Signatures
        │   ├── components/
        │   │   ├── ApprovalTimeline.tsx # Vertical step progression
        │   │   ├── SignaturePad.tsx     # Canvas-based digital signature capture
        │   │   ├── ActionToolbar.tsx    # Approve / Reject / Suspend buttons
        │   │   └── AuditLogTable.tsx    # Historical audit trail with timestamps
        │   └── hooks/
        │       ├── useApprovePermit.ts  # OData action for approval
        │       └── useRejectPermit.ts   # OData action for rejection
        │
        └── dashboard/                   # DEV 3: Dashboard, LOTO & Gas Testing
            ├── components/
            │   ├── KPICards.tsx         # Active, Expiring, Pending counters
            │   ├── PermitTable.tsx      # Searchable, filterable list of permits
            │   ├── LotoManager.tsx      # Lockout/Tagout isolation check table
            │   ├── GasTestingLog.tsx    # Atmospheric readings (O2, LEL, H2S, CO)
            │   └── PrintPreview.tsx     # Printable formal PTW document
            └── hooks/
                ├── useDashboardStats.ts # Aggregated metrics
                └── useLotoItems.ts      # Isolation records
```

---

## 3. SAP Authentication & Identity Architecture

The app supports **dual-mode deployment**: running inside the SAP Fiori Launchpad (FLP) or as a standalone SAP BSP application.

```
                  +--------------------------------+
                  |  Application Initialization   |
                  +---------------+----------------+
                                  |
                                  v
                   Is window.sap.ushell Available?
                                  |
                +-----------------+-----------------+
                | YES                               | NO
                v                                   v
   +---------------------------+       +---------------------------+
   |  Fiori Launchpad Mode     |       |  Standalone BSP Mode      |
   |                           |       |                           |
   | Extract user from Shell:  |       | Call SAP REST Service:    |
   | Container.getUser()       |       | GET /sap/bc/ui2/start_up  |
   | - ID: USHELL_USER         |       | - Returns: id, email,     |
   | - Roles, Plant, Language  |       |   roles, catalog, plant   |
   +-------------+-------------+       +-------------+-------------+
                 |                                   |
                 +-----------------+-----------------+
                                   |
                                   v
                  +--------------------------------+
                  | Populate React AuthContext     |
                  | (Available across entire app)  |
                  +--------------------------------+
```

### User Permissions & Roles
| Role Name | Technical Role | Permitted Actions |
| :--- | :--- | :--- |
| **Requester / Contractor** | `ZPTW_REQUESTER` | Create drafts, submit permits, view own permits |
| **Safety Officer (HSE)** | `ZPTW_SAFETY_OFFICER`| Review hazard controls, conduct gas test, approve Stage 1 |
| **Area Owner / Isolator** | `ZPTW_AREA_OWNER` | Verify LOTO isolation, approve Stage 2, handover site |
| **Operations Lead** | `ZPTW_APPROVER` | Issue final permit authorization, suspend work |
| **Administrator** | `ZPTW_ADMIN` | Configure master data (hazards, plants, isolation points) |

---

## 4. OData V4 Integration & Concurrency Design

### 4.1. Automatic CSRF Token Handshake
SAP Gateway requires a valid `X-CSRF-Token` for state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).

```
Client (React App)                           SAP Gateway
       |                                           |
       |--- 1. HEAD /sap/opu/odata4/... ---------->| (X-CSRF-Token: Fetch)
       |<-- 2. 200 OK (X-CSRF-Token: abc123xyz) ---|
       |    [Token cached in memory]               |
       |                                           |
       |--- 3. POST /Permits (Token: abc123xyz) -->|
       |<-- 4. 201 Created ------------------------|
       |                                           |
   [If Session / Token Expires]                    |
       |--- 5. PATCH /Permits('001') ------------->|
       |<-- 6. 403 Forbidden (CSRF Required) ------|
       |--- 7. Fetch Fresh Token ----------------->|
       |<-- 8. 200 OK (New Token) -----------------|
       |--- 9. Auto-retry PATCH Request ---------->|
       |<-- 10. 200 OK (Updated) ------------------|
```

### 4.2. Optimistic Concurrency with ETags
To prevent two users from overwriting the same permit simultaneously (e.g. an approver approving while the issuer edits details):
- Every read request retrieves `@odata.etag`.
- Mutating requests send `If-Match: <etag>`.
- If another user updated the permit in the interim, SAP Gateway returns `412 Precondition Failed`.
- The UI catches `412`, alerts the user, and reloads the latest state.

### 4.3. Batch Processing (`$batch`)
When creating a permit along with multiple hazards and PPE items, the frontend issues an OData V4 `$batch` request to ensure **transactional atomicity** (all items succeed or all fail in a single SAP database rollback).

---

## 5. Domain Data Model (Entity Relationship Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│                       PermitHeader                          │
├─────────────────────────────────────────────────────────────┤
│ PK  PermitId        : Edm.String (10)                       │
│     PermitType      : Edm.String (4) [HOT, COLD, CONF, ELEC]│
│     Title           : Edm.String (80)                       │
│     Description     : Edm.String (500)                      │
│     Plant           : Edm.String (4)                        │
│     Area            : Edm.String (10)                       │
│     Equipment       : Edm.String (18)                       │
│     Status          : Edm.String (4) [DRAF, SUBM, APPR, ACT]│
│     RiskLevel       : Edm.String (4) [LOW, MED, HIGH, CRIT] │
│     ValidFrom       : Edm.DateTimeOffset                    │
│     ValidTo         : Edm.DateTimeOffset                    │
│     CreatedBy       : Edm.String (12)                       │
│     CreatedAt       : Edm.DateTimeOffset                    │
│     @odata.etag     : Edm.String                            │
└───────────┬───────────────┬────────────────┬────────────────┘
            │ 1..*          │ 1..*           │ 1..*
            ▼               ▼                ▼
┌──────────────────┐ ┌─────────────┐ ┌────────────────────────┐
│   PermitHazard   │ │  PermitPPE  │ │    PermitIsolation     │
├──────────────────┤ ├─────────────┤ ├────────────────────────┤
│ HazardId (PK)    │ │ PpeId (PK)  │ │ IsolationId (PK)       │
│ PermitId (FK)    │ │ PermitId(FK)│ │ PermitId (FK)          │
│ HazardCategory   │ │ PpeCode     │ │ IsolationPoint (Tag#)  │
│ Description      │ │ Required(Y/N│ │ Type (Electrical/Mech) │
│ Severity (1-5)   │ └─────────────┘ │ Status (Locked/Tagged) │
│ Likelihood (1-5) │                 │ IsolatedBy (User)      │
│ ControlMeasure   │                 │ VerifiedBy (User)      │
└──────────────────┘                 └────────────────────────┘
            │ 1..*                           │ 1..*
            ▼                                ▼
┌───────────────────────────┐        ┌────────────────────────┐
│      PermitApproval       │        │     PermitGasTest      │
├───────────────────────────┤        ├────────────────────────┤
│ ApprovalStepId (PK)       │        │ TestId (PK)            │
│ PermitId (FK)             │        │ PermitId (FK)          │
│ ApproverRole (HSE/AREA/MGR│        │ TestTimestamp          │
│ ApproverUserId            │        │ OxygenPct (19.5-23.5%) │
│ Status (PEND/APPR/REJC)   │        │ FlammableLelPct (<10%) │
│ SignatureToken (Base64)   │        │ H2S_PPM (<10 PPM)      │
│ Comments                  │        │ CO_PPM (<25 PPM)       │
│ SignedAt                  │        │ TestedBy (User)        │
└───────────────────────────┘        └────────────────────────┘
```

---

## 6. SAP NetWeaver BSP Hosting Strategy

### 6.1. Relative MIME Asset Loading
Inside SAP NetWeaver, the application lives inside the ICF (Internet Communication Framework) node:
```
/sap/bc/bsp/sap/zptw_app/
```
In default Single Page Application setups, Vite generates absolute URLs:
```html
<!-- INCORRECT for SAP BSP -->
<script src="/assets/index-abc123.js"></script>
```
When deployed to SAP, the browser attempts to fetch `https://sap-server:44300/assets/index-abc123.js`, which hits the root ICF tree and returns `404 Not Found`.

**Our Solution**:
In `vite.config.ts`:
```ts
base: './'
```
This forces all assets to resolve relative to the current BSP page:
```html
<!-- CORRECT for SAP BSP -->
<script src="./assets/index-abc123.js"></script>
```

### 6.2. Production Deployment Options
1. **Automated CLI Deployment**:
   Using `nwabap-ui5-uploader`, the build output from `dist/` is automatically uploaded into the SAP MIME repository under the BSP Application `ZPTW_APP` and linked to an ABAP Transport Request.
2. **Manual SAP GUI Report**:
   Execute standard report `/UI5/UI5_REPOSITORY_LOAD` in transaction `SE38` to upload the zipped `dist/` bundle.

---

## 7. Performance & Security Best Practices

1. **Security**:
   - **Cross-Site Scripting (XSS)**: All user inputs sanitized before rendering; React handles HTML encoding natively.
   - **Cross-Site Request Forgery (CSRF)**: Enforced via SAP token handshake on every mutating HTTP method.
   - **Session Expiration**: Automatic redirect to SAP Logon or FLP session timeout handler.
2. **Performance**:
   - **Route Code Splitting**: Features are lazy-loaded (`React.lazy()`) to keep the initial BSP load under 300KB.
   - **OData Selective Queries**: Only requested fields are fetched using `$select` and `$expand`.
   - **Server State Caching**: TanStack Query caches responses for 5 minutes (`staleTime: 1000 * 60 * 5`), drastically reducing redundant round-trips to SAP Gateway.
