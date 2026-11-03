# Mobile Attendance

1. `prepare` validates the signed-in user and reads current device location.
2. Permission denial, mocked location, or invalid coordinates blocks/fails locally.
3. The workflow calls the Astra precheck adapter; only an actionable result creates a short-lived attempt.
4. `complete` reads and size-validates the captured base64 image, rechecks attempt validity, then calls Astra submit with the prechecked action and coordinates.
5. On success it stores a success handoff; cancellation, expiry, and cleanup prevent stale/captured data reuse.
6. An ambiguous submit failure remains terminal for that attempt, with no automatic POST replay. The camera presents an explicit action to replace itself with the history screen; it does not claim that a timeout means failure or that an empty history proves an older request cannot still commit.

**Evidence:** `features/attendance-workflow/attendanceWorkflow.ts`, `app/attendance/CameraAttendance.tsx`, `utils/bff.ts`, `__tests__/attendance-workflow.test.ts`, `__tests__/camera-attendance-outcome-message.test.tsx`.
