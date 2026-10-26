# Invariants

## INV-MOBILE-007 — Pending leave is not recorded attendance

**Rule:** Only explicitly approved leave requests enter the attendance calendar. Pending, rejected and missing decisions cannot replace a recorded check-in or inflate leave totals; request status remains available in Perizinan.
**Evidence:** `components/attendance-calendar/utils.ts`, `__tests__/profile-attendance-history.test.ts`.

## INV-MOBILE-006 — Terminal session loss clears rendered identity and protected routes

**Rule:** Expired sessions without a refresh token, corrupt/incomplete sessions and permanent refresh failures clear the auth store and session-scoped cache while retaining preferences. Root Stack.Protected removes tabs and detail/legacy authenticated routes when user state is cleared; transient refresh/network failures preserve the recoverable session.
**Evidence:** `utils/logto.ts`, `store/authStore.ts`, `app/_layout.tsx`, `__tests__/logto-session.test.ts`.

## INV-MOBILE-001 — Authenticated domain calls use Astra transport

**Rule:** Preserve Logto bearer token, request ID, timeout, envelope handling, and `X-Astra-Contract-Version: v1` in BFF calls.
**Evidence:** `utils/bff.ts`.

## INV-MOBILE-002 — Precheck precedes capture/submission

**Rule:** Do not submit a face image until the workflow has a current actionable server precheck.
**Evidence:** `features/attendance-workflow/attendanceWorkflow.ts`, `__tests__/attendance-workflow.test.ts`.

## INV-MOBILE-003 — Mocked/missing location blocks attendance

**Rule:** A mobile attendance attempt fails or blocks when location permission/coordinates are invalid or mocked.
**Evidence:** `features/attendance-workflow/attendanceWorkflow.ts`.

## INV-MOBILE-004 — Attempt cancellation/expiry prevents stale submission

**Rule:** Preserve per-user attempt ownership, TTL, generation checks, and capture cleanup.
**Evidence:** `features/attendance-workflow/attendanceWorkflow.ts`.

## INV-MOBILE-005 — Enrollment requires ten bounded temporary captures

**Rule:** Submit face enrollment only after ten camera captures, reject an oversized capture, recheck service readiness before multipart upload, and clean temporary files after submit, retry, or cancellation paths.
**Evidence:** `app/profile/enroll.tsx`, `utils/bffMobileApi.ts`.
