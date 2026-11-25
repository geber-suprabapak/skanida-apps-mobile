# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Primary users are vocational high school students (siswa) of SMK Negeri 2 Magelang (Skanida). They use the app on personal Android smartphones (including older low-RAM devices running Android 7.0 / API 24+) during morning arrival and afternoon dismissal to record mandatory daily attendance, or beforehand from home to submit leave and sick permits.

## Product Purpose

Skanida Apps Mobile provides students with a dependable, fast native Android client to verify daily attendance on Western Indonesia Time (WIB) using geofencing and facial recognition, submit and monitor leave requests, inspect attendance history and schedules, and manage student profile data. Success means effortless, tamper-resistant check-in/out with instant status confirmation and transparent communication with school administrators.

## Positioning

An integrated student attendance client built specifically for SMK Negeri 2 Magelang's digital campus infrastructure. Unlike generic attendance or manual sign-in sheets, Skanida Apps Mobile ties physical student presence directly to an authenticated Logto identity through a two-phase verification mechanism (geofenced campus boundary check + Robin ML face verification) orchestrated by the Project Astra BFF.

## Operating Context

- **Environment**: Handheld Android smartphones (API 24–36, including 2 GB RAM devices) on cellular data or campus Wi-Fi.
- **Time & Schedule**: Strict adherence to Western Indonesia Time (WIB, UTC+7) with server time synchronization (`GET /v1/mobile/dashboard` `server_time.now`) to prevent local clock tampering. Attendance windows follow daily school schedules: morning entry (`start_check_in_at` – `end_check_in_at`) and afternoon dismissal (`start_check_out_at` – `end_check_out_at`).
- **School Rituals**: Daily check-in at school gates or classrooms, afternoon check-out, and pre-session submission of sick notes (`sakit`) or family leave requests (`pergi` / `izin`) with supporting documentation.
- **System Ecosystem**:
  - Client: Native Android Kotlin 2.2 + Jetpack Compose (Material 3), CameraX, AppAuth, OkHttp 4, Coil 2, and Firebase Cloud Messaging.
  - Identity & Auth: Logto OIDC server with PKCE, `offline_access`, `prompt=consent`, and Bearer token exchange.
  - Backend Gateway: Project Astra BFF (`/v1/mobile/*`, `/v1/auth/student/*`) enforcing RBAC, validation, `X-Astra-Contract-Version: v1`, and domain stores.
  - Machine Learning & Storage: Robin ML face recognition service and object storage behind Astra for face datasets, avatars, and permit attachments.
  - Administration: Project Chronos Next.js web portal for school staff and teachers.

## Capabilities and Constraints

- **Confirmed Capabilities**:
  - Secure authentication via Logto OIDC (login, Keystore AES-GCM session persistence, password updates, sign-out).
  - Student activation and password recovery via Astra BFF (`POST /v1/auth/student/signup`, `POST /v1/auth/student/reset-password`).
  - Attendance Workflow: Precheck verifying student device GPS coordinates against the campus perimeter (`POST /v1/mobile/attendance/precheck`), followed by CameraX selfie capture and streaming Base64 submission (`POST /v1/mobile/attendance/submit`).
  - Face Enrollment: Capturing and uploading 10 distinct facial training photos (JPEG, max 2 MiB each) for Robin ML model enrollment.
  - Leave Requests (Perizinan): Submission of leave requests (`sakit`, `pergi`) with date, explanation (10–500 chars), and photo attachment, plus real-time review of approval status (`GET /v1/mobile/permits`).
  - Dashboard: Live WIB clock, today's attendance status, schedule timeline, current-month attendance ring, and dynamic primary action CTA.
  - History: Monthly calendar grid and log of past attendance records with punctuality flags (`Hadir` / `Terlambat`) and approved leave expansion.
  - Profile & Settings: Student biodata, avatar management, face enrollment entry, notification channel filters, and theme selection (`Sistem` / `Terang` / `Gelap`).
- **Technical Constraints**:
  - The mobile client stays thin; business rules, validation, and state transitions belong exclusively to Project Astra BFF.
  - Native permissions required for camera access, precision GPS location (with mock-location rejection), and notifications (API 33+).
  - Strict domain language per `CONTEXT.md`: use "Attendance Workflow", "Leave Request", "Face Enrollment", and "Attendance".

## Brand Commitments

- **Name**: Skanida Apps / Skanida Apps Mobile.
- **Institution**: SMK Negeri 2 Magelang.
- **Voice & Tone**: Respectful, encouraging, functional, and clear Indonesian (Bahasa Indonesia) appropriate for high school students.
- **Visual Identity**: Official Skanida emblem (`app/src/main/res/drawable/skanida_logo.png`), Indigo-Cobalt laminated Digital Student Pass (`DESIGN.md`), with >= 4.5:1 contrast for outdoor readability.

## Evidence on Hand

- Native Android codebase in `app/src/main/java/id/skanida/nativeapp/` and unit tests in `app/src/test/java/id/skanida/nativeapp/`.
- BFF API integration specifications in `docs/bff-integration.md` and `contracts/astra-v1.json`.
- Semantic codebase map in `docs/codebase-map/README.md`.
- Design tokens and screen hierarchy in `DESIGN.md` and domain vocabulary in `CONTEXT.md`.

## Product Principles

- **Ground Truth Verification**: Attendance records require validated physical location within campus boundaries and biometric match against enrolled facial features.
- **Frictionless in the Field**: Attendance workflows execute rapidly with clear visual feedback, minimizing student wait times at school entry points even on older devices.
- **Transparent Recovery**: When conditions fail (out-of-bounds GPS, face mismatch, network interruption), present actionable, human-friendly guidance rather than cryptic errors.
- **Thin Client, Authoritative Gateway**: The client reflects state driven by Astra BFF contracts without duplicating backend business logic or assuming local authority.

## Accessibility & Inclusion

- Responsive typography (`sp` units) respecting system accessibility font scaling.
- Minimum 48x48 dp interactive touch targets and full-row toggleables for Android usability.
- High contrast (>= 4.5:1 WCAG AA) text, status badges, and buttons in both light and dark modes for direct outdoor sunlight readability.
- Reduce Motion support honoring `ANIMATOR_DURATION_SCALE` and clean TalkBack semantics.
