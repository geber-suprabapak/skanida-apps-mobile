# Mobile Attendance

1. `prepare` validates the signed-in user and reads current device location.
2. Permission denial, mocked location, or invalid coordinates blocks/fails locally.
3. The workflow calls the Astra precheck adapter; only an actionable result creates a short-lived attempt.
4. `complete` reads and size-validates the captured base64 image, rechecks attempt validity, then calls Astra submit with the prechecked action and coordinates.
5. On success it stores a success handoff; cancellation, expiry, and cleanup prevent stale/captured data reuse.

**Evidence:** `features/attendance-workflow/attendanceWorkflow.ts`, `utils/bff.ts`, `__tests__/attendance-workflow.test.ts`.
