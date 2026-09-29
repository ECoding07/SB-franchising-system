# Build Plan — SB Franchising System

**Created:** Wed, 30 Sep 2026
**Last updated:** Wed, 30 Sep 2026 — mobile confirmed as a panel requirement
**Status:** Planning complete, execution not started
**Context:** [2026-09-29-session](2026-09-29-session.md) (foundation) · [2026-09-30-session](2026-09-30-session.md) (phases 0–5)
**Repo:** https://github.com/ECoding07/SB-franchising-system (branch `main`)
**Repo state at time of writing:** `f8df581`, working tree clean

> **Graded requirement:** the capstone panel requires the operator side to ship as a **mobile app**. Phases 6 and 7 are therefore the critical path. See section 2.

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

> **Confirmed by the user: the capstone panel requires the operator side to be a mobile app.** This is a graded deliverable, not a preference. Mobile work is therefore on the critical path and must not be traded away for admin features. The phase order below reflects that.

Consequence: the operator portal already built at `SBTF-website/src/app/(operator)/` is in the architecturally wrong place. It is **kept temporarily** as a reference and fallback, with its business logic extracted so the mobile app and the web portal share one implementation. Whether it ships before the capstone is **Q2** in §10.

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

### 7.0 Prove the build toolchain first — do this before writing any screen

**This is the single biggest schedule risk to a graded mobile deliverable, and it is cheap to test.** Do it first.

`SBTF-application/AGENTS.md:40`:

> Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.

`expo-secure-store` is already a dependency and is registered as a config plugin (`app.json:24-26`). It is a **native module**. Once Phase 7 wires it for session persistence — the correct choice for auth tokens — **the app will no longer run in Expo Go.**

There is no clean escape. `@react-native-async-storage/async-storage` is also a native module, so switching to it just moves the problem. React Native has no `document.cookie`, so a persisted session always needs a native store.

**Therefore: plan for a development/EAS build, and prove it works before investing in the app.** If the toolchain cannot produce an APK on this machine, that must be discovered before Phase 7.2, not after.

Two gaps that block any cloud build, both currently missing:

- **`app.json` has no `bundleIdentifier` (iOS) or `package` (Android).** EAS requires both. Set them before attempting a build.
- **No `eas.json` exists.** Needs a `development` profile at minimum (`AGENTS.md:34`).

Confirm the demo path with the user before building screens — see **Q1** in §10. If the panel expects a QR-code scan, the presentation plan changes.

### 7.1 Setup

- Set app identity in `app.json` (`ios.bundleIdentifier`, `android.package`) and add `eas.json` with a `development` profile.
- Add `expo-router` and `@supabase/supabase-js`. **Not `@supabase/ssr`** — it is cookie/Request-Response based and does not work in React Native. Neither existing web client is RN-compatible (`client.ts` uses `createBrowserClient`, `server.ts` imports `next/headers`).
- Wire `expo-secure-store` for session persistence (already installed, plugin already registered).
- Create `src/app/` with `_layout.tsx`; repoint `package.json` `main` from `index.ts` to the router entry; register the router in `app.json`.
- Use `npx` — `AGENTS.md:13` says `bunx` only if `bun.lock` is present, and it is not.

### 7.2 Screens

`sign-in` → `profile` → `dashboard` → `applications/new` (dynamic units) → `applications/[id]` (documents, camera capture) → `notifications`.

Reuse `@sb/shared` Zod schemas and constants (`APPLICATION_TYPES`, `DOCUMENT_TYPE_LABELS`, `MAX_DOCUMENT_BYTES`, `ALLOWED_DOCUMENT_MIME_TYPES`) so client and server validation stay consistent.

The `notifications` screen and rendering of staff rejection reasons (`doc.remarks`) are what close the feedback-loop bug from section 1 for the operator. This is the deliverable the panel will exercise directly.

### 7.3 Note

`metro.config.js` does not exist. The monorepo currently works only because `package-lock.json` hoists to root `node_modules`. Add the Expo monorepo metro config as part of this phase, and verify the bundle actually builds.

---

## 6. Phase 8 — Test suite

**Priority:** lower than Phases 6 and 7. Because mobile is a panel requirement, this is deliberately **not** moved ahead of app-building work. It is placed here because the refactors in Phases 6 and 7 are what make it cheap, and because untested shared logic shared by two clients is the main correctness risk introduced by the API approach.

**Goal:** make the verification reproducible from the repo.

Today: 0 committed tests. The 24 workflow assertions from 30 Sep ran from a temporary script that was then deleted, so the 24/24 result is not reproducible. `review.ts` was extracted specifically to make these testable.

Add **Vitest**:
- service-function tests for `operator.ts` and `review.ts` (port the 24 deleted assertions, plus the Phase 6 logic)
- API-route auth tests — 401 unauthenticated, 401 bad token, role enforcement, lazy `syncUserFromAuth`
- validation and business-rule tests — app-number retry, unit cap, document path-prefix assertion

No CI exists (`.github/` absent). Out of scope unless asked.

---

## 7. Phase 9 — Admin surface

> **Deliberately deferred.** The user initially chose this as the next build, but once it was confirmed that mobile is a panel requirement, mobile moved ahead. This phase remains valuable and is not cancelled — it is queued behind the graded deliverable. **Q3** in §10 asks whether the panel grades admin functionality, which would change that ordering.

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

- **Rotate or delete the test accounts** — `admin@mabini.gov.ph`, `staff.test@mabini.gov.ph`, `operator.test@mabini.gov.ph` on `mabini.gov.ph`. They were created for verification, are documented as throwaway, and now sit in a **public** repo (https://github.com/ECoding07/SB-franchising-system) alongside a precise description of the application model. Not urgent for a capstone, but must not reach a real deployment.
- **Stop the stale dev server.** A `next start` process may still hold port 3000 from the 30 Sep verification. Check with `Get-NetTCPConnection -LocalPort 3000 -State Listen`, then `Stop-Process -Id <pid> -Force`. It serves a stale build otherwise.
- **Watch memory.** The machine has ~7.2 GB RAM and previously hit severe memory pressure. Run typecheck / lint / build **sequentially**, never in parallel.
- **PowerShell gotchas:** no heredocs (`<<'EOF'` fails) — write commit messages to a file and use `git commit -F`. `git push` can hang silently on a Credential Manager dialog; run it backgrounded with output redirected, then poll the log and `git rev-list --left-right --count origin/main...main` to confirm. If stuck `git` processes remain, kill them and retry with `GCM_INTERACTIVE=Never` set.
- **Remote:** `origin` = `https://github.com/ECoding07/SB-franchising-system.git`, branch `main`.

---

## 10. Open questions — deferred to the user

Recorded so nothing is lost between sessions. These are decisions only the user can make, not gaps in the plan. **Do not guess at any of them** — each changes the work materially.

### Q1. How will the mobile app be demonstrated? *(ask before Phase 7.0)*

The most consequential open question. `expo-secure-store` is a native module, so the app will not run in Expo Go once it persists the session (see §7.0). The demo path determines whether an EAS account, signing, and a build pipeline are needed.

- **EAS cloud build** — install `expo-dev-client` from EAS, or run the debug variant of an EAS build. Needs a free Expo account.
- **Local native build** — `npx expo run:android` with Android Studio, or `run:ios` with Xcode (macOS only). This machine is Windows, so **iOS local builds are not possible**.
- **Expo Go with a workaround** — possible only by storing the session somewhere non-native (e.g. in-memory + re-login each launch). Weakens the product and is not recommended.

**Needed from the user:** Expo account available? Android device for demo? Presentation expects a QR scan or a pre-installed build? Time-boxed to be built how?

### Q2. Does the operator web portal ship, or is it deleted before the capstone?

Currently "kept temporarily" (see §2). It works and is a usable fallback, but it is not the graded deliverable and it duplicates the mobile experience.

- Ship both — operators get a browser option; costs maintenance of two clients.
- Delete before submission — cleaner deliverable, matches the panel requirement exactly, loses the fallback if a phone has no network at demo time.

**Needed from the user:** keep or delete?

### Q3. Is the admin surface expected before the panel?

Phase 9 is deferred (§7). If the panel grades admin/analytics functionality, the deferral is wrong and the phase order should change.

**Needed from the user:** does the panel grade anything beyond operator-mobile + staff web?

### Q4. Which test accounts are in use, and are they rotated?

Housekeeping, but user-owned (§9). The three `mabini.gov.ph` accounts were created for verification and sit in a **public** repo describing the application model.

---

## 11. Corrections to earlier documentation

- **`tsbuildinfo` is not committed.** An audit flagged it as a tracked build artifact; it is not. Ignore that finding if it resurfaces.
- **The 30 Sep report describes notifications as a delivered feature.** Phases 4–5 notifications are written but never displayed. The report is accurate about the writes and inaccurate about delivery; Phase 6 corrects this.
- **The panel requires a mobile app on the operator side.** This is now recorded in section 2; it was previously assumed to be a preference and is not.
- **Session 30 Sep handoff.** The previous summary carried an outdated claim that `franchise_fee` was unreadable and the bucket uncreated; both were resolved earlier. It also listed `/admin`, `/staff`, `/operator` as route paths, which are route *groups* — the real URLs are `/overview`, `/queue`, `/dashboard`.
