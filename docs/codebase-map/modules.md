# Modules

## Expo routes and UI

**Purpose:** Navigate/authenticate students and present dashboard, attendance, leave, profile, and history screens.
**Entry points:** `app/_layout.tsx`, `app/`.

## BFF and Logto

**Purpose:** Manage OIDC session/token lifecycle and invoke Astra’s contract-versioned API.
**Entry points:** `app/auth/Login.tsx`, `utils/logto.ts`, `utils/bff.ts`, `utils/bffMobileApi.ts`.
**Login flow:** The Login route immediately opens Logto’s OIDC authorization page; identity input is collected only by Logto, not by the mobile app.

## Attendance workflow

**Purpose:** Coordinate location, precheck, capture, submission, cancellation, TTL, and success handoff.
**Entry point:** `features/attendance-workflow/attendanceWorkflow.ts`.

## Face enrollment

**Purpose:** Combine service readiness, camera permission, ten-image capture, multipart Astra submission, and temporary-file cleanup.
**Entry points:** `app/profile/enroll.tsx`, `utils/enrollment.ts`, `utils/faceApiRuntime.ts`.
**Depends on:** BFF/Logto transport and device camera/filesystem adapters.

## Shared components

**Purpose:** Render UI primitives, camera/attendance surfaces, calendar, time-sync, and notification support.
**Entry points:** `components/`, `app/attendance/`.
