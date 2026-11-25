# Glossary

## Attendance Workflow

**Meaning:** Two-phase student flow that prepares an eligible attendance attempt via `AbsenceReportScreen`, captures a face image with CameraX, and completes the submission.
**Evidence:** `CONTEXT.md`, `app/src/main/java/id/skanida/nativeapp/domain/workflow/AttendanceWorkflow.kt`.

## BFF transport

**Meaning:** Shared Astra request layer (`Astra.kt`) that attaches Logto bearer token, `X-Request-Id`, `X-Astra-Contract-Version: v1`, timeout, and envelope error normalization.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/data/api/Astra.kt`.

## Face Enrollment

**Meaning:** Registering 10 student face JPEG photos through Astra (`POST /v1/mobile/face/enrollment`) for verification availability.
**Evidence:** `README.md`, `app/src/main/java/id/skanida/nativeapp/ui/screens/CameraScreen.kt`.

## Face Verification Readiness

**Meaning:** Combined server health (`DashboardFace.isServerHealthy`) and student enrollment state (`DashboardFace.isEnrolled`).
**Not:** A single unqualified boolean.
**Evidence:** `CONTEXT.md`, `app/src/main/java/id/skanida/nativeapp/data/model/AstraModels.kt`.

## Leave Request

**Aliases:** permit, perizinan.
**Meaning:** Student request to skip attendance with category, description (10–500 chars), and photo attachment.
**Evidence:** `CONTEXT.md`, `app/src/main/java/id/skanida/nativeapp/ui/screens/PermitsAndLeaveScreens.kt`.
