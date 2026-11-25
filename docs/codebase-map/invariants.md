# Invariants

## INV-MOBILE-009 — Native offline access requests consent

**Rule:** Keep PKCE, `offline_access`, and `prompt=consent` in native AppAuth authorization requests so Logto can issue refresh tokens. Do not substitute a shared IdP policy or credential change for the client request.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/data/auth/Identity.kt`; [OIDC Offline Access](https://openid.net/specs/openid-connect-core-1_0-final.html#OfflineAccess).

## INV-MOBILE-008 — Dashboard recovery reloads its complete projection

**Rule:** Reconnect (`NetworkMonitor`) and advertised server/enrollment retries reload the same `GET /v1/mobile/dashboard` projection as initialization. A face-only health check cannot stand in for recovered attendance, schedule, or primary action.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/MainViewModel.kt`, `ui/screens/HomeScreen.kt`.

## INV-MOBILE-007 — Pending leave is not recorded attendance

**Rule:** Only explicitly `approved` leave requests enter the attendance calendar. Expand their effective period inclusively within the selected month, with legacy approvals treated as one day. Pending, rejected, and missing decisions cannot replace a recorded check-in or inflate leave totals; request status remains available in Perizinan.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/domain/workflow/AttendanceHistory.kt`, `app/src/test/java/id/skanida/nativeapp/AttendanceHistoryTest.kt`.

## INV-MOBILE-006 — Terminal session loss clears rendered identity and protected routes

**Rule:** Expired sessions without a refresh token, corrupt/incomplete Keystore sessions, and permanent refresh failures (`invalid_grant`, `invalid_client`, `unauthorized_client`) clear the encrypted session and account state while retaining theme/device preferences; transient refresh/network failures preserve the recoverable refresh token.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/data/auth/Identity.kt`, `SessionStore.kt`, `MainViewModel.kt`.

## INV-MOBILE-001 — Authenticated domain calls use Astra transport

**Rule:** Preserve Logto bearer token, `X-Request-Id`, timeout, envelope handling, and `X-Astra-Contract-Version: v1` validation in all Astra HTTP calls.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/data/api/Astra.kt`, `app/src/test/java/id/skanida/nativeapp/AstraEnvelopeTest.kt`.

## INV-MOBILE-002 — Precheck precedes capture/submission

**Rule:** Do not submit a face image until the workflow holds a current actionable server precheck via `MainViewModel.runAttendancePrecheck` and `AttendanceAttemptTracker`.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/domain/workflow/AttendanceWorkflow.kt`, `MainViewModel.kt`, `ui/screens/AbsenceReportScreen.kt`.

## INV-MOBILE-003 — Mocked/missing location blocks attendance

**Rule:** A mobile attendance attempt fails or blocks when location permission/coordinates are invalid or mocked (`LocationCompat.isMock`).
**Evidence:** `app/src/main/java/id/skanida/nativeapp/data/device/DeviceMedia.kt`.

## INV-MOBILE-004 — Attempt cancellation/expiry prevents stale submission

**Rule:** Preserve per-user attempt ownership, 10-minute TTL, generation checks, uncertain-outcome guard, and capture cleanup.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/domain/workflow/AttendanceWorkflow.kt`, `app/src/test/java/id/skanida/nativeapp/AttendanceWorkflowTest.kt`.

## INV-MOBILE-005 — Enrollment requires ten bounded temporary captures

**Rule:** Submit face enrollment only after ten camera captures (`<= 2 MiB` JPEG each), present a confirmation review step, recheck `GET /v1/mobile/health` before multipart upload, handle post-POST unknown outcomes without blind replay, and clean temporary files after submit, retry, or cancellation.
**Evidence:** `app/src/main/java/id/skanida/nativeapp/MainViewModel.kt`, `ui/screens/CameraScreen.kt`.
