# Invariants

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
