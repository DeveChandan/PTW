# SAP Permit To Work (PTW) - Enterprise React Application

An enterprise-grade **Permit To Work (PTW)** web application built with **React**, **Vite**, **TypeScript**, and **SAP UI5 Web Components**, designed to integrate with **SAP S/4HANA / ECC via OData V4 Services** and deployed directly to **SAP NetWeaver BSP (Business Server Pages)** or embedded inside the **SAP Fiori Launchpad (FLP)**.

---

## 📑 Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Tech Stack](#2-tech-stack)
- [3. System Architecture & Hosting Model](#3-system-architecture--hosting-model)
- [4. Team Structure & Module Ownership](#4-team-structure--module-ownership)
- [5. Getting Started (Local Development)](#5-getting-started-local-development)
- [6. SAP OData V4 & Authentication Integration](#6-sap-odata-v4--authentication-integration)
- [7. Production Build & SAP BSP Deployment](#7-production-build--sap-bsp-deployment)
- [8. Governance & Project Documentation](#8-governance--project-documentation)

---

## 1. Executive Summary

In industrial and plant operations (oil & gas, chemical, manufacturing, utilities), a **Permit To Work (PTW)** is a formal safety document authorizing specific hazardous tasks (e.g., Hot Work, Confined Space Entry, High Voltage Isolation, Work at Height).

This application digitizes the end-to-end permit lifecycle:
1. **Permit Request & Hazard Identification**: Dynamic risk assessment (5x5 matrix), PPE selection, and contractor assignment.
2. **Lockout/Tagout (LOTO) & Gas Testing**: Electrical/mechanical isolation points and atmosphere safety checks.
3. **Multi-level Approval Workflow**: Sign-offs from Issuer, Safety Officer, Area Manager, and Operations Lead with digital signatures.
4. **Real-time Monitoring & Dashboard**: Active permits on plant map, expiration countdowns, and emergency stop/suspension.
5. **Permit Handover & Closure**: Site restoration checks and archiving into SAP Plant Maintenance (PM / EAM).

---

## 2. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 / 19 + TypeScript | Component architecture with strict typing |
| **Build Tooling** | Vite | Lightning-fast HMR and optimized production bundles |
| **UI Components** | SAP UI5 Web Components for React + Tailwind CSS | Native Fiori Horizon design standard with flexible styling |
| **Server State & Caching**| TanStack Query (React Query v5) | OData V4 query caching, mutations, optimistic updates |
| **Client State** | Zustand | Lightweight client UI state (wizard steps, filters, active modal) |
| **API Client** | Axios (custom OData V4 client) | Auto-CSRF token handshake, ETag support, batch requests |
| **Icons & Visuals** | Lucide React + SAP Icons | Enterprise icons and safety status indicators |
| **Backend Integration** | SAP OData V4 (RAP / CAP / SEGW) | RESTful transactional OData V4 endpoints |
| **Deployment Target** | SAP NetWeaver BSP / Fiori Launchpad | Host directly on SAP ICM / MIME Repository |

---

## 3. System Architecture & Hosting Model

For in-depth architectural diagrams, sequence diagrams, and design decisions, refer to [ARCHITECTURE.md](./ARCHITECTURE.md).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SAP Fiori Launchpad (FLP)                       │
│                                   OR                                   │
│            SAP NetWeaver Standalone BSP (/sap/bc/bsp/sap/zptw_app/)    │
├────────────────────────────────────────────────────────────────────────┤
│                       React + Vite Frontend Client                     │
│  ┌─────────────────┐ ┌───────────────────┐ ┌────────────────────────┐  │
│  │   UI Layer      │ │  State / Cache    │ │   OData V4 Client      │  │
│  │  (UI5 + Tailwind│ │ (TanStack Query + │ │ (CSRF Handshake,       │  │
│  │   Components)   │ │  Zustand)         │ │  ETag & Batch Handler) │  │
│  └────────┬────────┘ └─────────┬─────────┘ └───────────┬────────────┘  │
└───────────┼────────────────────┼───────────────────────┼───────────────┘
            │                    │                       │
     HTTPS Request with SAP Session Cookies & X-CSRF-Token
            │                    │                       │
┌───────────▼────────────────────▼───────────────────────▼───────────────┐
│                     SAP NetWeaver / S/4HANA ICM                        │
├────────────────────────────────────────────────────────────────────────┤
│  [ICF Authentication: Basic Auth / SAML2 / X.509 Client Cert / FLP]    │
├──────────────────────────────┬─────────────────────────────────────────┤
│ User Context Service         │ OData V4 Service Gateway                │
│ /sap/bc/ui2/start_up         │ /sap/opu/odata4/sap/zptw_srv/srvd/...   │
│ (User ID, Roles, Plant, Lang)│ (Permits, Hazards, Approvals, LOTO)     │
└──────────────────────────────┴─────────────────────────────────────────┘
```

---

## 4. Team Structure & Module Ownership

The engineering team consists of the **Main Lead** and **3 Dedicated Developers**. Each developer owns an isolated functional domain to prevent merge collisions:

```
                            ┌────────────────────────┐
                            │    MAIN PROJECT LEAD   │
                            │ Architecture & Core    │
                            │ Repo, CI/CD, BSP Deploy│
                            └───────────┬────────────┘
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│   DEVELOPER 1    │           │   DEVELOPER 2    │           │   DEVELOPER 3    │
│  PTW Core & Life │           │ Approvals & Sign │           │ Dashboard & LOTO │
├──────────────────┤           ├──────────────────┤           ├──────────────────┤
│• Multi-step Form │           │• Multi-tier Flow │           │• KPI Dashboard   │
│• Hazards & PPE   │           │• Digital Signs   │           │• LOTO Isolation  │
│• 5x5 Risk Matrix │           │• Status Machine  │           │• Gas Test Logs   │
│• Work Location   │           │• Audit Timeline  │           │• PDF / Print View│
└──────────────────┘           └──────────────────┘           └──────────────────┘
```

> 👉 For detailed task checklists, user stories, and acceptance criteria, see **[DEVELOPER_TASKS.md](./DEVELOPER_TASKS.md)**.
> 👉 For Git branching, PR reviews, and merge conventions, see **[GIT_WORKFLOW.md](./GIT_WORKFLOW.md)**.

---

## 5. Getting Started (Local Development)

### Prerequisites
- **Node.js**: v18.x or v20.x LTS
- **Package Manager**: npm (v9+) or pnpm
- **SAP Gateway Access**: Connection details to your SAP Development / Sandbox instance (URL, Client, Username, Password).

### Step 1: Clone & Install Dependencies
```bash
# Clone the repository
git clone <your-git-repository-url>
cd PTW

# Install dependencies
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` to point to your SAP system:
```env
# SAP Gateway Target URL (Vite Dev Proxy Target)
VITE_SAP_TARGET=https://s4dev.yourcompany.corp:44300
VITE_SAP_CLIENT=100

# Base path for SAP OData V4 Service
VITE_ODATA_BASE_URL=/sap/opu/odata4/sap/zptw_srv/srvd_a2x/sap/zptw_permits/0001/
```

### Step 3: Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
The Vite development proxy automatically handles CORS by forwarding `/sap/*` requests directly to your SAP host while maintaining session cookies.

---

## 6. SAP OData V4 & Authentication Integration

### Standalone vs. Fiori Launchpad User Resolution
1. **Fiori Launchpad (FLP)**:
   When running inside FLP, user info is retrieved from the shell container:
   ```ts
   const user = window.sap?.ushell?.Container?.getUser();
   const userId = user?.getId();
   const email = user?.getEmail();
   ```
2. **Standalone BSP**:
   The app invokes SAP's standard startup service:
   ```http
   GET /sap/bc/ui2/start_up HTTP/1.1
   ```
   Returns SAP User ID, user language, timezone, assigned roles, and catalog authorizations.

### CSRF Token Handshake (OData V4)
Modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid `X-CSRF-Token`:
- The OData client performs an initial `HEAD` / `GET` request with `X-CSRF-Token: Fetch`.
- The received token is cached in memory.
- If a subsequent modifying request receives `403 Forbidden` with header `X-CSRF-Token: Required`, the client automatically fetches a fresh token and transparently retries the request.

---

## 7. Production Build & SAP BSP Deployment

### Critical Rule for SAP BSP: Relative Base Path
SAP BSP applications are served under `/sap/bc/bsp/sap/<app_name>/`. If Vite outputs absolute paths (e.g. `/assets/index.js`), the browser attempts to load them from the SAP root domain `https://sap-server:44300/assets/...`, which returns **404 Not Found**.

In `vite.config.ts`, the base path is configured as:
```ts
export default defineConfig({
  base: './', // Crucial for SAP BSP relative asset resolution
  // ...
});
```

### Build for Production
```bash
npm run build
```
This generates the optimized bundle in the `dist/` directory.

### One build for DEV, QAS and production

The deployed app has no fixed SAP client and ignores build-time `VITE_SAP_CLIENT`.
It uses a valid `sap-client` launch parameter or `window.SAP_CURRENT_CLIENT`
when provided. Otherwise it sends no client override and lets SAP select the
client through its session and service logon configuration. Session discovery
can return the selected client; saved browser sessions do not force an old client
on a fresh launch. The login screen defaults to Automatic and permits an optional
three-digit client override, with no fixed list of client numbers.

Transport the same complete `dist/` folder across systems. API calls use the
hosting SAP origin. Basis must configure consistent client selection for the
app, startup and OData services in each system; the app cannot infer a client
from a hostname. A launch parameter remains available where explicit selection
is required. `VITE_SAP_CLIENT` and `VITE_SAP_TARGET` configure only the local
Vite development proxy, not the deployed client selection.

### Text encoding and icons after BSP deployment

The production build escapes Unicode characters in JavaScript and CSS as ASCII.
This preserves bullets, separators, dashes, and other UI symbols even when a BSP
MIME response declares a legacy character encoding. Keep source files in UTF-8
and serve HTML, JavaScript, and CSS as UTF-8 on SAP where possible.

Material Symbols icons are embedded directly in the production CSS as a WOFF2
data URL. All modules retain the complete icon set without Google Fonts access
or a separate font file that SAP might skip during upload. This increases the
CSS size by approximately 5.3 MB before compression. If the SAP host applies a
Content Security Policy, its `font-src` must permit `data:` for this font.

Upload the **entire** new `dist/` folder, including `index.html` and the matching
hashed CSS/JS files. Do not mix files from different builds. Clear the browser
cache after upload. The `.Ui5RepositoryBinaryFiles` upload rules still classify
the logo (and any future external WOFF2 assets) as binary.

Run `npm run test:bsp` to rebuild and check that generated scripts/styles are
ASCII-safe and that scripts, styles, and the icon font resolve beneath the BSP
application path. After uploading, reload with the browser cache cleared and
check the work-reference separators, missing-equipment dash, header bullet, and
icons across the permit wizard and other modules.

### Deploying to SAP NetWeaver BSP
You have two automated options:

#### Option A: Automated CLI Upload via `nwabap-ui5-uploader`
```bash
npm run deploy:bsp
```
*(Configured in `.nwabaprc` with your SAP Transport Request number, BSP application name e.g., `ZPTW_APP`, and package `$TMP` or custom package).*

#### Option B: SAP Standard Report `/UI5/UI5_REPOSITORY_LOAD`
1. Run `npm run build`.
2. Zip the contents of the `dist/` folder.
3. Log in to SAP GUI -> Transaction `SE38` or `SA38`.
4. Execute report `/UI5/UI5_REPOSITORY_LOAD`.
5. Enter BSP Application Name: `ZPTW_APP`.
6. Select **Upload** and point to your zipped `dist/` bundle.
7. Assign to an ABAP Transport Request.

---

## 8. Governance & Project Documentation

All team members must follow the project guides:
- 🏗️ **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System design, domain models, state management, OData V4 caching, and security.
- 📋 **[DEVELOPER_TASKS.md](./DEVELOPER_TASKS.md)**: Sprint breakdown, component boundaries, and DoD for Lead and Devs 1, 2, 3.
- 🔀 **[GIT_WORKFLOW.md](./GIT_WORKFLOW.md)**: Branching policy, commit messages, PR templates, and code review rules.

---

**Lead Architect & Maintainer**: Project Lead  
**Last Updated**: September 2026
