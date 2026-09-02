# Glossary

## Attendance Workflow

**Meaning:** Two-phase student flow that prepares an eligible attendance attempt, captures a face image, and completes the submission.
**Evidence:** `CONTEXT.md`, `features/attendance-workflow/attendanceWorkflow.ts`.

## BFF transport

**Meaning:** Shared Astra request layer that attaches Logto bearer token, request ID, contract header, timeout, and envelope handling.
**Evidence:** `utils/bff.ts`.

## Face Enrollment

**Meaning:** Registering student face images through Astra for verification availability.
**Evidence:** `README.md`, `utils/bffMobileApi.ts`.

## Face Verification Readiness

**Meaning:** Combined knowledge that the face service is available and the student has usable enrollment state.
**Not:** A single unqualified boolean.
**Evidence:** `CONTEXT.md`, `utils/faceApiRuntime.ts`, `utils/enrollment.ts`.

## Leave Request

**Aliases:** permit, perizinan.
**Meaning:** Student request to skip attendance.
**Evidence:** `CONTEXT.md`, `app/perizinan/`.
