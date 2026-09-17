# Git Workflow & Team Collaboration Guide

This document establishes the Git branching model, commit conventions, Pull Request (PR) lifecycle, code review criteria, and SAP release tagging protocols for the **Permit To Work (PTW)** team.

---

## 🌿 Branching Model (GitFlow for SAP Releases)

We follow a modified **GitFlow** model tailored for enterprise SAP development and ABAP Transport Request (TR) release cycles:

```
┌────────────────────────────────────────────────────────────────────────┐
│ main          ─────●─────────────────────────────────● (Tagged: v1.0.0)│
│                    ▲                                 ▲                 │
│                    │                                 │                 │
│ release/v1.0.0     │                       ┌─────────┴ (Freeze/QA)     │
│                    │                       │                           │
│ develop       ─────●──────────●────────────●─────────● (Active Dev)    │
│                    ▲          ▲            ▲                           │
│                    │          │            │                           │
│ feature/core       └─(Dev 1)──┘            │                           │
│ feature/approvals             └─(Dev 2)────┘                           │
│ feature/dashboard                          └─(Dev 3)                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Primary Branches
1. **`main` (Production Protected)**:
   - Contains production-ready code deployed to SAP Quality (QAS) and Production (PRD) BSP repositories.
   - Direct pushes and force pushes are strictly blocked.
   - Merges into `main` occur only via release PRs approved by the **Project Lead**.
2. **`develop` (Integration Trunk)**:
   - The primary collaboration branch where all feature branches converge.
   - Automatically built and tested locally before merging.

### Working Branches
1. **Feature Branches**: `feature/<module>/<short-description>`
   - Created from `develop`.
   - Merged back into `develop` via Pull Request after Lead review.
2. **Bugfix Branches**: `bugfix/<issue-number>-<short-description>`
   - Created from `develop` to fix bugs identified during testing.
3. **Release Branches**: `release/vX.Y.Z`
   - Created when preparing a milestone build for SAP Transport Request assignment.

---

## 🏷️ Branch Naming Conventions

Each developer must name their branches strictly according to their assigned domain:

| Developer | Scope Prefix | Example Branch Names |
| :--- | :--- | :--- |
| **Developer 1** | `feature/permits/` | `feature/permits/wizard-container`<br>`feature/permits/hazard-checklist`<br>`feature/permits/risk-matrix-5x5` |
| **Developer 2** | `feature/approvals/` | `feature/approvals/timeline-component`<br>`feature/approvals/digital-signature`<br>`feature/approvals/status-actions` |
| **Developer 3** | `feature/dashboard/` | `feature/dashboard/kpi-summary-cards`<br>`feature/dashboard/loto-table`<br>`feature/dashboard/print-preview` |
| **Project Lead** | `chore/core/` or `release/` | `chore/core/odata-client-csrf`<br>`chore/core/bsp-deploy-config`<br>`release/v1.0.0` |

---

## 💬 Commit Message Standards (Conventional Commits)

All commits must follow the **Conventional Commits** specification:

```
<type>(<scope>): <short description in imperative mood>

[optional body explaining context and rationale]

[optional issue reference: e.g. Closes #12]
```

### Allowed Types
- **`feat`**: A new user-facing feature.
- **`fix`**: A bug fix.
- **`docs`**: Documentation changes only.
- **`style`**: Code formatting, semicolons, spacing (no logic change).
- **`refactor`**: Code restructuring without altering behavior.
- **`perf`**: Performance improvements.
- **`test`**: Adding or updating tests.
- **`chore`**: Maintenance, build configs, dependencies.

### Commit Examples
```bash
# Good examples:
git commit -m "feat(permits): implement 5x5 risk assessment calculation"
git commit -m "fix(approvals): prevent sign-off submission when signature pad is blank"
git commit -m "feat(dashboard): add gas testing entry log table with O2 thresholds"
git commit -m "chore(odata): refresh csrf token automatically on 403 response"

# Bad examples (DO NOT USE):
git commit -m "update"
git commit -m "fixed bugs"
git commit -m "changes for Chandan"
```

---

## 🚀 Step-by-Step Daily Developer Workflow

### 1. Start of Day: Synchronize with `develop`
```bash
git checkout develop
git pull origin develop
```

### 2. Create Your Feature Branch
```bash
git checkout -b feature/permits/hazard-checklist
```

### 3. Work & Commit Locally
Make small, atomic commits as you progress:
```bash
git add src/features/permits/components/StepHazards.tsx
git commit -m "feat(permits): add hazard category accordion with toggle controls"
```

### 4. Keep Your Branch Up to Date (Rebase onto `develop`)
Before opening a PR, always rebase against the latest `develop` to resolve conflicts locally:
```bash
git checkout develop
git pull origin develop
git checkout feature/permits/hazard-checklist
git rebase develop
```

### 5. Push Branch & Create Pull Request
```bash
git push -u origin feature/permits/hazard-checklist
```
Go to your Git repository (GitHub / GitLab / Bitbucket / Azure DevOps) and open a Pull Request targeting **`develop`**.

---

## 📋 Pull Request (PR) Checklist & Template

When opening a PR, paste and complete the following template:

```markdown
### 📝 Description
What does this PR do? (Brief summary of changes).

### 🎯 Feature Area
- [ ] Developer 1: Permits Core & Lifecycle
- [ ] Developer 2: Approvals & Digital Signatures
- [ ] Developer 3: Dashboard, LOTO & Reporting
- [ ] Lead: Core Infrastructure / OData / Auth

### 🔍 Self-Verification Checklist
- [ ] TypeScript check passed: `npx tsc --noEmit` returns 0 errors.
- [ ] Tested locally with Vite dev server against SAP mock/gateway.
- [ ] No direct imports from other `features/*` folders (only `shared/*` or `core/*`).
- [ ] Followed Conventional Commits convention.

### 📸 Screenshots (If UI changes were made)
[Attach screenshot or GIF here]
```

---

## 🛡️ Lead Review & Merge Policy

1. **At least 1 approval required**: All PRs must be approved by the **Project Lead**.
2. **Merge Strategy**: We use **Squash and Merge** into `develop`. This maintains a clean, linear git history where each feature corresponds to a single informative commit.
3. **Branch Deletion**: Delete the remote feature branch immediately after merging.

---

## 📦 SAP Release Tagging & Transport Request Linkage

When a milestone is ready for SAP Quality (QAS) or Production (PRD) transport:

1. Create a release branch:
   ```bash
   git checkout -b release/v1.0.0 develop
   ```
2. Build and verify the SAP BSP bundle:
   ```bash
   npm run build
   ```
3. Tag the release commit:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0 for SAP TR: DEVK900123"
   git push origin v1.0.0
   ```
4. Record the **ABAP Transport Request (TR)** number directly in the Git release notes:
   - **Git Tag**: `v1.0.0`
   - **SAP TR**: `DEVK900123` (Permit To Work Frontend Application)
   - **BSP Name**: `ZPTW_APP`
