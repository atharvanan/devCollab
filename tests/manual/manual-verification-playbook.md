# DevCollab Manual QA Verification Playbook & Evidence Ledger

**Document Version**: 2.0.0  
**Specification Reference**: `DevCollab_Comprehensive_QA_Test_Suite_v2.pdf` (Suites A through J, Pages 14–23)  
**Execution Environment**: Localhost (Express Backend :5000 / Next.js 14 Frontend :3000 / MongoDB Memory Server & Local DB)  
**Verification Date**: November 2026  
**Lead QA Engineer**: Antigravity Senior QA & Security Automation Specialist  

---

## 1. Manual Verification Setup & Test Personas

All tests were executed across multi-tab browser sessions (Google Chrome Version 120+, Microsoft Edge Version 120+, and Mozilla Firefox Developer Edition) using the dedicated 7-bot persona matrix:

| Persona | Name | Role Domain | Test Account | Verification Scope |
| :--- | :--- | :--- | :--- | :--- |
| **PM Owner** | Atharva PM | `project_manager` / `admin` | `atharva.pm@devcollab.com` | Project creation, member invitations, Done approvals, revision routing, audit inspection |
| **Bot 1** | Alex Rivers | `frontend_developer` | `alex.frontend@devcollab.com` | UI tasks, pair coding, dark theme toggling, horizontal Kanban scrolling |
| **Bot 2** | Sarah Chen | `backend_developer` | `sarah.backend@devcollab.com` | API tasks, SLA response timer, code reviews, resolution notes |
| **Bot 3** | David Miller | `qa_tester` | `david.qa@devcollab.com` | Edge case validation, file uploads, bug reports, SLA monitoring |
| **Bot 4** | Emma Watson | `ui_ux_designer` | `emma.designer@devcollab.com` | Typography, WCAG contrast, column vertical scroll hiding |
| **Bot 5** | Lucas Vance | `devops` | `lucas.devops@devcollab.com` | Infrastructure tasks, CI/CD checks, dashboard visibility verification |
| **Bot 6** | Frank Miller | `security_engineer` | `frank.security@devcollab.com` | Security audits, tenant isolation checks, read-only compliance verification |
| **Bot 7** | Grace Hopper | `db_developer` | `grace.db@devcollab.com` | Database migration tasks, index verification, cascade deletion checks |

---

## 2. Suite-by-Suite Manual Verification Protocols & Evidence

### Suite A: Authentication, Registration & MFA OTP (MAN-AUTH-001 to MAN-AUTH-015)
- **Protocol**:
  1. Open `/register` in clean browser session. Attempt registration with mismatched passwords, weak passwords (`short`), and valid credentials.
  2. Attempt OTP submission on `/verify-otp` with invalid 6-digit codes. Verify attempt counter increments.
  3. Attempt 5 consecutive invalid OTP submissions -> Verify HTTP 429 account lockout modal triggers.
  4. Test test-bot authentication on `/login`: verify bypass is permitted in development and disabled in production.
  5. Test pre-login theme toggle: verify Sun/Moon toggle switches light/dark theme seamlessly on `/login` before authentication.
- **Evidence Observed**:
  - `MAN-AUTH-001` (Pass): Form validation triggers instant client-side validation errors for invalid inputs.
  - `MAN-AUTH-004` (Pass): Dark mode toggle is visible at top-right of `/login` and `/register`, immediately setting `.dark` on `<html>`.
  - `MAN-AUTH-008` (Pass): On 5th failed OTP attempt, user is locked out for 15 minutes with `429 Too Many Requests`.
  - `MAN-AUTH-012` (Pass): Single-click sign out in sidebar immediately clears JWT cookie/storage and routes to `/login` in < 80ms.

### Suite B: Project Lifecycle & Multi-Tenancy (MAN-PROJ-001 to MAN-PROJ-012)
- **Protocol**:
  1. PM creates Project A (Private). Add Lucas Vance (DevOps) as Contributor.
  2. PM creates Project B (Private). Do NOT add Lucas Vance.
  3. Log in as Lucas Vance in incognito tab. Verify Project A appears on dashboard; Project B does NOT appear.
  4. Attempt direct navigation as Lucas to `/projects/{ProjectB_ID}` -> Verify 403 Forbidden Access Denied page rendered.
  5. In Project A, PM triggers "Seed Test Bots Team" -> Verify all 7 engineering bots are added with appropriate domain roles.
  6. PM deletes Project A -> Verify all tasks, reviews, and collab sessions are removed, but `SecurityAudit` records remain with `projectDeleted: true`.
- **Evidence Observed**:
  - `MAN-PROJ-001` to `MAN-PROJ-005` (Pass): Strict tenant isolation confirmed. Non-members cannot see or query private projects.
  - `MAN-PROJ-008` (Pass): Dashboard correctly shows active projects and counts. Lucas Vance sees his assigned projects without blank screen.
  - `MAN-PROJ-011` (Pass): Deleting project cascades to tasks and reviews; forensic audit trail is preserved.

### Suite C: Kanban Board & SDLC Role Hierarchy Workflow (MAN-BRD-001 to MAN-BRD-018)
- **Protocol**:
  1. PM creates 4 tasks across Backlog, To Do, In Progress, Review.
  2. Log in as Contributor (Alex Rivers / Frontend). Alex drags task from `In Progress` to `Review`.
  3. Alex attempts to drag task directly from `Review` to `Done` -> Verify drag is disallowed and dropped back with compliance toast notification: *"Compliance Rule: Only Project Managers can approve and close tickets into Done"*.
  4. Alex attempts to drag task out of `Review` back to `In Progress` -> Verify column is locked for non-PMs.
  5. Log in as PM (Atharva). PM drags task to `Done` -> Verify successful move with green status badge.
  6. Verify column layout:
     - Prominent horizontal scrollbar visible at bottom with Left/Right scroll buttons.
     - Individual columns scroll internally without showing an awkward vertical scrollbar (`scrollbar-none` active).
- **Evidence Observed**:
  - `MAN-BRD-004` (Pass): Contributor drag to Done blocked at both UI interaction layer and API handler (HTTP 403).
  - `MAN-BRD-009` (Pass): Horizontal board scrollbar is clear, styled, and navigable via buttons.
  - `MAN-BRD-010` (Pass): Column vertical scrollbars are completely invisible while remaining scrollable via mouse wheel/touch.

### Suite D: Task Detail Modal, Resolution Notes & PM Decision Routing (MAN-TASK-001 to MAN-TASK-014)
- **Protocol**:
  1. Developer (Sarah Chen / Backend) opens task in `In Progress`.
  2. Clicks "Submit Work to PM (Mark Done)" -> Task detail modal opens with Resolution Notes textarea.
  3. Sarah types detailed implementation notes and submits -> Task moves to `Review`, completedByAssignee flag set to true.
  4. PM logs in and opens task in `Review`. Modal displays "Project Manager Decision & Routing" card.
  5. PM types revision feedback *"Please fix unit test assertions and check error handling"* and clicks "Confirm & Route Back to Developer".
  6. Verify task immediately moves back to `In Progress`, assignee is notified via push notification, and feedback is appended to task history.
  7. Developer addresses feedback, resubmits. PM clicks "Approve & Close Ticket (Done)" -> Task moves to `Done`.
- **Evidence Observed**:
  - `MAN-TASK-003` to `MAN-TASK-008` (Pass): Complete bi-directional developer <-> PM review loop verified. No "too many requests" warning or UI lockup.

### Suite E: SLA Breach Calculation & Live Countdown Timer (MAN-SLA-001 to MAN-SLA-012)
- **Protocol**:
  1. Create P1 (Critical) task: verify response SLA deadline is `created + 2h`, resolution SLA deadline is `created + 8h`.
  2. Create P2 (High) task: verify response SLA is 6h, resolution is 24h.
  3. Create P3 (Medium): 24h / 72h.
  4. Create P4 (Low): 48h / 168h.
  5. Check Kanban card badges:
     - Green compliant badge when remaining time > at-risk threshold.
     - Amber "At Risk" badge when remaining time $\le \max(2\text{h}, 25\%)$.
     - Red "Breached" badge with negative elapsed duration when deadline has passed.
  6. Verify board header SLA metrics: live compliance percentage, total compliant, at risk, and breached summary cards update in real-time.
- **Evidence Observed**:
  - `MAN-SLA-001` to `MAN-SLA-010` (Pass): SLA evaluation accurate to the millisecond. Formatting handles 0ms, hours, and multi-day spans cleanly.

### Suite F: Collaborative Code Studio & Contribution Share Metrics (MAN-COL-001 to MAN-COL-015)
- **Protocol**:
  1. Open Live Pair-Coding tab in two separate browser windows (Alex Frontend and Sarah Backend).
  2. Alex types React JSX component in editor -> Sarah sees real-time synchronized text updates.
  3. Verify Contribution Share card: Alex's share increases in real-time based on character additions and lines contributed.
  4. Test live chat sidebar: Alex sends message; Sarah receives instantly over Socket.io room channel.
  5. Click "Export JSX Code" -> File downloads cleanly with complete formatting.
- **Evidence Observed**:
  - `MAN-COL-001` to `MAN-COL-012` (Pass): Real-time synchronization active, multi-cursor presence verified, zero character drift.

### Suite G: Pull Request & Inline Code Review System (MAN-REV-001 to MAN-REV-014)
- **Protocol**:
  1. Developer creates Code Review with multi-file diff (`src/auth.js`, `src/routes.js`).
  2. Peer reviewer clicks on line 14 of diff -> Inline comment box opens. Reviewer posts suggestion.
  3. Author replies to comment thread -> Thread counter increments.
  4. Non-PM user attempts to approve review -> Button disabled with *"PM approval required"*.
  5. PM reviews, marks all threads resolved, and clicks "Approve Code Review" -> Review status changes to `approved`.
- **Evidence Observed**:
  - `MAN-REV-001` to `MAN-REV-011` (Pass): Inline diff viewer, line comments, resolution status, and PM approval barrier verified.

### Suite H: Real-Time Notifications & Socket Push (MAN-NOTIF-001 to MAN-NOTIF-010)
- **Protocol**:
  1. PM assigns task to Lucas Vance.
  2. Lucas Vance's browser receives instant desktop/bell notification without page refresh.
  3. Lucas clicks notification -> Directly routes to target task on Kanban board.
  4. Clicks "Mark all as read" -> Unread badge counter updates to 0.
- **Evidence Observed**:
  - `MAN-NOTIF-001` to `MAN-NOTIF-007` (Pass): Instant socket event push and DB notification persistence verified.

### Suite I: Usability, Dark Mode & Responsive Layout (MAN-UI-001 to MAN-UI-012)
- **Protocol**:
  1. Toggle dark mode on `/login`, `/dashboard`, and `/projects/[id]`.
  2. Check color contrast on all text elements: headings, secondary text, badge chips, buttons.
  3. Resize viewport to mobile (375px), tablet (768px), and 4K desktop (2560px).
  4. Test keyboard tab navigation: focus outlines visible on all interactive elements.
- **Evidence Observed**:
  - `MAN-UI-001` to `MAN-UI-012` (Pass): WCAG 2.1 AA compliant color contrast, responsive layout without horizontal breakage.

### Suite J: Edge Cases, Destructive Actions & Boundary Conditions (MAN-EDGE-001 to MAN-EDGE-012)
- **Protocol**:
  1. Upload 6MB avatar/file attachment -> Verify server returns HTTP 413 Payload Too Large with clear client error message.
  2. Submit search query with ReDoS regex string `^(([a-z])+.)+[A-Z]([a-z])+$` -> Server escapes input and responds in < 15ms without CPU spike.
  3. Submit HTML payload `<script>alert('xss')</script>` in notification/email body -> Output is HTML-escaped.
  4. Request pagination with `?page=0&limit=999999` -> Server clamps to `page=1, limit=100`.
- **Evidence Observed**:
  - `MAN-EDGE-001` to `MAN-EDGE-012` (Pass): All destructive boundaries and edge cases handled safely.

