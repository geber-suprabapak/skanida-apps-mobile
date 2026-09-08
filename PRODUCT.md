# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary users are vocational high school students (siswa) of SMK Negeri 2 Magelang (Skanida). They use the app on personal smartphones during morning arrival and afternoon dismissal to record mandatory daily attendance, or beforehand from home to submit leave and sick permits.

## Product Purpose

Skanida Apps Mobile provides students with a dependable, fast mobile client to verify daily attendance on Western Indonesia Time (WIB) using geofencing and facial recognition, submit and monitor leave requests, inspect attendance history and schedules, and manage student profile data. Success means effortless, tamper-resistant check-in/out with instant status confirmation and transparent communication with school administrators.

## Positioning

An integrated student attendance client built specifically for SMK Negeri 2 Magelang's digital campus infrastructure. Unlike generic attendance or manual sign-in sheets, Skanida Apps Mobile ties physical student presence directly to an authenticated Logto identity through a two-phase verification mechanism (geofenced campus boundary check + Robin ML face verification) orchestrated by the Project Astra BFF.

## Operating Context

- **Environment**: Handheld Android and iOS smartphones on cellular data or campus Wi-Fi.
- **Time & Schedule**: Strict adherence to Western Indonesia Time (WIB, UTC+7) with server time synchronization (`/v1/mobile/time`) to prevent local clock tampering. Attendance windows follow daily school schedules: morning entry (`mulai_masuk` - `selesai_masuk`) and afternoon dismissal (`mulai_pulang` - `selesai_pulang`).
- **School Rituals**: Daily check-in at school gates or classrooms, afternoon check-out, and pre-session submission of sick notes (`sakit`) or family leave requests (`izin`) with supporting documentation.
- **System Ecosystem**:
  - Frontend: Expo React Native (SDK 57, React Native 0.86, React 19) with Uniwind (Tailwind CSS v4) and React Native Primitives.
  - Identity & Auth: Logto OIDC server with PKCE and Bearer token exchange.
  - Backend Gateway: Project Astra BFF (`/v1/mobile/...`) enforcing RBAC, validation, and domain stores.
  - Machine Learning & Storage: Robin ML face recognition service and Garage S3 object storage for face datasets, avatars, and permit attachments.
  - Administration: Project Chronos Next.js web portal for school staff and teachers.

## Capabilities and Constraints

- **Confirmed Capabilities**:
  - Secure authentication via Logto OIDC (login, session persistence, password updates, sign-out).
  - Student activation and account registration via Astra BFF (`POST /v1/auth/student/signup`).
  - Attendance Workflow: Precheck verifying student device GPS coordinates against the campus perimeter (`POST /v1/mobile/attendance/precheck`), followed by camera selfie capture and submission (`POST /v1/mobile/attendance/submit`).
  - Face Enrollment: Capturing and uploading 10 distinct facial training photos (JPEG, max 2MB) for Robin ML model enrollment.
  - Leave Requests (Perizinan): Submission of leave requests (`sakit`, `izin`) with date, explanation, and file attachments, plus real-time review of approval status (`GET /v1/mobile/permits`).
  - Dashboard: Real-time clock, today's attendance status (present / absent / leave / pending), time compensation, schedule breakdown, and dynamic primary action CTA.
  - History: Detailed log of past attendance records, check-in timestamps, punctuality flags (`Hadir` / `Terlambat`), and total hours.
  - Profile: Student NIS, full name, class enrollment, and avatar photo management.
- **Technical Constraints**:
  - The mobile client must remain thin; business rules, validation, and state transitions belong exclusively to Project Astra BFF. Supabase internals remain completely hidden.
  - Fixed portrait orientation.
  - Native permissions required for camera access and GPS location.
  - Strict domain language per `CONTEXT.md`: use "Attendance Workflow", "Leave Request", "Face Enrollment", and "Attendance".

## Brand Commitments

- **Name**: Skanida Apps / Skanida Apps Mobile.
- **Institution**: SMK Negeri 2 Magelang.
- **Voice & Tone**: Respectful, encouraging, functional, and clear Indonesian (Bahasa Indonesia) appropriate for high school students.
- **Visual Identity**: Official Skanida emblem (`assets/skanidatransparan.png`), clean card-based layout, with deliberate contrast for outdoor readability.

## Evidence on Hand

- Complete mobile codebase and routes in `skanida-apps-mobile/app/`.
- BFF API integration specifications in `skanida-apps-mobile/docs/bff-integration.md`.
- Mobile E2E verification reports in `MOBILE_E2E_TEST_REPORT.md` and `RELEASE_READINESS_REPORT.md`.
- Platform domain terminology in `CONTEXT.md` and `skanida-apps-mobile/CONTEXT.md`.

## Product Principles

- **Ground Truth Verification**: Attendance records require validated physical location within campus boundaries and biometric match against enrolled facial features.
- **Frictionless in the Field**: Attendance workflows must execute rapidly with clear visual feedback, minimizing student wait times at school entry points.
- **Transparent Recovery**: When conditions fail (out-of-bounds GPS, face mismatch, network interruption), present actionable, human-friendly guidance rather than cryptic errors.
- **Thin Client, Authoritative Gateway**: The client reflects state driven by Astra BFF contracts without duplicating backend business logic or assuming local authority.

## Accessibility & Inclusion

- Responsive typography respecting system accessibility font scaling.
- Minimum 44x44 dp interactive touch targets for mobile usability.
- High contrast text and UI elements for readability under direct outdoor sunlight during morning school entry.
- Direct, clear Indonesian terminology without unnecessary technical or administrative jargon.
