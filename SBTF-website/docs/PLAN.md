# Build Plan — SB Franchising System

**Created:** Wed, 30 Sep 2026
**Status:** Planning complete, execution not started
**Context:** [2026-09-29-session](2026-09-29-session.md) (foundation) · [2026-09-30-session](2026-09-30-session.md) (phases 0–5)
**Repo state at time of writing:** `809665f`, working tree clean

---

## 1. Current state

Phases 0–5 are shipped, verified, and committed. An operator can submit an application with documents through the web portal, and staff can review, verify, approve, take payment, and issue a franchise certificate.

**One bug in shipped functionality is still open.** The staff review flow writes notifications, but nothing ever reads them:

- `notifyUser()` (`src/lib/audit.ts:45-62`) writes to the `Notification` table. That create at `audit.ts:53` is the **only** `prisma.notification` call in the codebase. No bell, no badge, no list, no mark-as-read, and `isRead` is never read or written.
- When staff reject a document, the reason lands in `doc.remarks` — but the operator's application page never renders it (`(operator)/applications/[id]/page.tsx:132-139` shows only the status word). `application.remarks` isn't rendered either.

**Net effect:** an operator whose document is rejected opens their application, sees "Rejected", is given no reason, and has no way to learn that staff acted. The `needs_requirements` re-upload loop is unreachable in practice, even though staff can set that status (`APPLICATION_STATUS_PERMISSION.needs_requirements = "applications.request_requirements"`) and the operator can technically re-upload.

This is the first thing Phase 6 fixes, not because it is the largest item but because it makes a flow that looks complete actually work.

---

## 2. Scope correction — the operator side is a mobile app

An earlier assumption in this project's planning was that the operator-facing UI would live in the web portal alongside staff. **That is wrong.** The operator side is the Expo/React Native app; the web app is for staff and admin.

Consequence: the operator portal already built at `SBTF-website/src/app/(operator)/` is in the architecturally wrong place. It is **kept temporarily** as a reference and fallback, with its business logic extracted so the mobile app and the web portal share one implementation. Whether it ships is a later decision.

---

## 3. Architecture decision — mobile calls REST API routes

### The decision

The mobile app authenticates with Supabase and calls **REST route handlers in the Next.js app**, passing a Supabase JWT as `Authorization: Bearer <token>`. It does **not** talk directly to PostgREST/Storage.

### Why not direct database access

Direct access was evaluated first and is blocked. Findings from the RLS research:

| # | Blocker | Evidence |
|---|---|---|
| B1 | **No `storage.objects` RLS policies exist.** Zero matches for `storage` across all 3 migrations. The `application-documents` bucket was configured out-of-band. A mobile client cannot upload or download anything without a server to mint signed URLs. | `rls migration`; `src/lib/storage.ts:20-47` |
| B2 | **`application_status_history` is SELECT-only.** The mandatory initial `status: "pending"` row in `submitApplicationAction` cannot be created by a direct client. | `rls migration:71-73`; `(operator)/actions.ts:164-166` |
| B3 | **`updated_at` is `NOT NULL` with no DB default or trigger** on `operator_profiles`, `franchise_applications`, `application_documents`. Prisma's `@updatedAt` is client-side only, so a PostgREST insert that omits it fails. | `init migration` |
| B4 | **All `id` columns are `TEXT NOT NULL` with no DB default** — no sequences, no `gen_random_uuid()`. The client must generate every UUID. | `init migration` |
| B5 | **`users` has SELECT-only policy.** The `auth.users ⇄ users` sync (`src/lib/auth/sync.ts:19-39`, which also assigns the `operator` role) runs only from Next.js Server Actions. A mobile client authenticating directly would have a valid JWT but no Prisma user row, so `getCurrentUser()` returns `null`. | `rls migration:18-20` |
| B6 | **`system_settings` and `user_roles` have RLS with zero policies.** A direct client cannot read the `max_units_per_application` cap (seeded `2`) or its own roles/permissions. | `rls migration:101-108` |
| B7 | **`nextApplicationNo()` is read-max-then-increment**, not atomic. Safety today is a 3-attempt `catch {}` retry in a Server Action. | `src/lib/applications.ts:32-44`; `(operator)/actions.ts:133-176` |
| B8 | **Privilege escalation.** `franchise_applications` has a `FOR ALL` policy constraining only `operator_id`. An operator could set `status: "approved"`, `date_approved`, or `reviewed_by`, or delete their own application, and pass RLS. The anon key ships in the mobile bundle, so this is reachable. | `rls migration:49-59` |

**B8 alone rules out direct access** without a new migration, and B1/B5 mean it needs one regardless.

### What the API approach buys

- All validation, app-number retry, path-traversal checks, signed-URL minting, and audit logging stay in one place on the server.
- No new RLS required. The existing RLS remains what it already effectively is — defense-in-depth for direct table access from other roles, not the app's ACL (the Prisma connection owns the tables and bypasses it).
- The mobile app and web portal call the same service functions, so they cannot drift.

### Consequence for B5

A shared `requireApiUser()` helper verifies the JWT and **lazily runs the existing `syncUserFromAuth` on first request**. This is how mobile users get a Prisma row and the `operator` role without first signing in through the web app.

---

## 4. Phase 6 — Backend API layer (Next.js)

**Goal:** a complete, authenticated REST surface for the operator domain, with logic extracted so web and mobile share it.

### 6.1 Extract shared operator logic

Create **`src/lib/operator.ts`**, mirroring the `review.ts` pattern: pure async functions taking an explicit actor, independent of the Next request context. Absorb from `(operator)/actions.ts`:

- profile upsert (currently `prisma.operatorProfile.upsert` on `userId`)
- application submission — Zod validation, `getMaxUnitsPerApplication()` cap check, the 3-attempt `nextApplicationNo()` retry, nested unit + status-history creation
- document upload-URL minting — MIME allowlist, 10 MB size check, `buildDocumentPath()` sanitisation
- document registration — path-prefix assertion, compound-unique upsert, old-object cleanup

`(operator)/actions.ts` becomes thin: `requireUser()` → service → `revalidatePath()`. The portal keeps working, unchanged in behaviour.

### 6.2 API auth helper

`requireApiUser()` — verifies the Supabase JWT from the `Authorization` header, runs `syncUserFromAuth` lazily on first call, returns a `SessionUser`. Resolves **B5**. Reused by every route.

### 6.3 Routes

| Route | Purpose |
|---|---|
| `GET` / `PUT` `/api/operator/profile` | read/update operator profile |
| `GET` `/api/operator/applications` | operator's own applications |
| `POST` `/api/operator/applications` | full submit flow, server-side |
| `GET` `/api/operator/applications/[id]` | detail — **includes payments + franchise record**, which the web detail page currently omits |
| `POST` `/api/operator/applications/[id]/documents/upload-url` | signed upload URL (keeps the path-prefix check, **B1**) |
| `POST` `/api/operator/applications/[id]/documents` | register document, delete replaced object |
| `GET` `/api/operator/notifications` | **closes the feedback-loop bug** |
| `POST` `/api/operator/notifications/[id]/read` | makes `isRead` and its `@@index([userId, isRead])` useful |

Also notify **staff** when a new application is submitted — currently `submitApplicationAction` logs no activity and notifies nobody, so staff are never told a new application arrived.

### 6.4 Also in this phase

- **Render rejection reasons on the web operator detail page** (`doc.remarks`, `application.remarks`) and surface a `needs_requirements` call-to-action. The mobile app will do this properly, but the portal would otherwise keep the bug.
- **B7 stays as-is.** Read-max-then-increment plus retry is acceptable for this volume. Revisit only if a real collision is observed. Do not silently redesign it.

---

## 5. Phase 7 — Mobile app

**Goal:** a working Expo operator app.

Follow `SBTF-application/AGENTS.md` — it is binding and currently being violated:

> Use **Expo Router** for all navigation. Routes live in `src/app/` … Keep non-route code (components, hooks, utils) outside `src/app/`.

Other binding rules: always `npx expo install` (never raw `npm add`); never hand-create `ios/`/`android/`; native modules require a dev build, not Expo Go — which applies to `expo-secure-store` and any native Supabase storage dependency.

### 7.1 Setup

- Add `expo-router` and `@supabase/supabase-js`. **Not `@supabase/ssr`** — it is cookie/Request-Response based and does not work in React Native. Neither existing web client is RN-compatible (`client.ts` uses `createBrowserClient`, `server.ts` imports `next/headers`).
- Wire `expo-secure-store` for session persistence (already installed and registered as a config plugin in `app.json:24-26`).
- Create `src/app/` with `_layout.tsx`; repoint `package.json` `main` from `index.ts` to the router entry; register the router in `app.json`.

### 7.2 Screens

`sign-in` → `profile` → `dashboard` → `applications/new` (dynamic units) → `applications/[id]` (documents, camera capture) → `notifications`.

Reuse `@sb/shared` Zod schemas and constants (`APPLICATION_TYPES`, `DOCUMENT_TYPE_LABELS`, `MAX_DOCUMENT_BYTES`, `ALLOWED_DOCUMENT_MIME_TYPES`) so client and server validation stay consistent.

### 7.3 Note

`metro.config.js` does not exist. The monorepo currently works only because `package-lock.json` hoists to root `node_modules`. Add the Expo monorepo metro config as part of this phase, and verify the bundle actually builds.

---

## 6. Phase 8 — Test suite

**Goal:** make the verification reproducible from the repo.

Today: 0 committed tests. The 24 workflow assertions from 30 Sep ran from a temporary script that was then deleted, so the 24/24 result is not reproducible. `review.ts` was extracted specifically to make these testable.

Add **Vitest**:
- service-function tests for `operator.ts` and `review.ts` (port the 24 deleted assertions, plus the Phase 6 logic)
- API-route auth tests — 401 unauthenticated, 401 bad token, role enforcement, lazy `syncUserFromAuth`
- validation and business-rule tests — app-number retry, unit cap, document path-prefix assertion

No CI exists (`.github/` absent). Out of scope unless asked.

---

## 7. Phase 9 — Admin surface

**Goal:** make the dormant seeded permissions real. 14 of 29 seeded permissions are currently unreachable in the UI.

Priority order:

1. **Settings editor** — `system_settings` has no write path. An admin cannot change the franchise fee anywhere. Also removes the **3-way hardcoding** of `franchise_fee` (120) and `franchise_validity_years` (2) across `packages/shared/src/constants.ts:5-6`, `src/lib/settings.ts:9,13`, and `prisma/seed.ts:88-89`. Editing the constant today changes nothing.
2. **Activity log viewer** — `activity_logs` is write-only. `logActivity()` has 4 call sites and **no reader**, despite `logs.activity_view` being seeded to staff.
3. **Users and roles management** — `users.*` permissions orphaned.
4. **Analytics / reports** — `analytics_summaries`, `dashboard_reports`, `report_exports` are entirely inert: no `prisma.*` reference anywhere in `src/`. Strong demo value, least functional.
5. **TODA CRUD** — `toda.manage` is orphaned, and **no TODA rows are seeded**, so the operator dropdowns ship empty on a fresh database.
6. **Admin nav** — `(admin)/layout.tsx` has no `<nav>` at all, unlike the operator and staff layouts.

---

## 8. Explicitly deferred / not planned

- **Email delivery.** `SMTP_*` are empty placeholders in `.env.example:16-20`; no mailer dependency exists. Notifications are DB-only.
- **Login rate-limiting.** `login_attempts` is written on all 3 auth paths and **never read**; the `@@index` exists for a query nobody makes.
- **Status transition graph.** `setApplicationStatus` validates only the *target* status's permission, so staff can move `pending → rejected` directly. The document gate still protects approval. A strict transition table is a small addition to `review.ts` if wanted.
- **Retention enforcement.** 9 policies are seeded and nothing ever reads them; no purge job.
- **`SystemLog` is entirely inert** — never written, never read, despite being added as the ops audit sink.
- **Franchise registry + real renewal.** `applicationType: renewal` is a dropdown option functionally identical to `new`. `franchise.renew` is seeded but never checked. The lifecycle is incomplete at the expiry boundary.

---

## 9. Housekeeping before continuing

- **Rotate or delete the test accounts** — `admin@mabini.gov.ph`, `staff.test@mabini.gov.ph`, `operator.test@mabini.gov.ph` on `mabini.gov.ph`. They were created for verification, are documented as throwaway, and now sit in a **public** repo alongside a precise description of the application model. Not urgent for a capstone, but must not reach a real deployment.
- **Watch memory.** The machine has ~7.2 GB RAM and previously hit severe memory pressure. Run typecheck / lint / build **sequentially**, never in parallel.
- **PowerShell gotchas:** no heredocs (`<<'EOF'` fails) — write commit messages to a file and use `git commit -F`. `git push` can hang silently on a Credential Manager dialog; run it backgrounded with output redirected, then poll the log and `git rev-list --left-right --count origin/main...main` to confirm.
- **`git push` verification:** background it, then confirm `origin/main...main` reports `0  0`.

---

## 10. Corrections to earlier documentation

- **`tsbuildinfo` is not committed.** An audit flagged it as a tracked build artifact; it is not. Ignore that finding if it resurfaces.
- **The 30 Sep report describes notifications as a delivered feature.** Phases 4–5 notifications are written but never displayed. The report is accurate about the writes and inaccurate about delivery; Phase 6 corrects this.
