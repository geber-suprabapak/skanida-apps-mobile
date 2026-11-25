# Mobile Attendance

1. From `HomeScreen`, requesting attendance checks runtime camera and precision location permissions, then runs inline precheck right on the student pass card (cancellable via the `Batal` pill or Android Back).
2. `MainViewModel.runAttendancePrecheck` validates the signed-in approved student and resolves device location via `currentLocation` (`DeviceMedia.kt`) racing enabled `FUSED_PROVIDER`, `GPS_PROVIDER`, and `NETWORK_PROVIDER` with a short refinement window and fresh last-known fallback.
3. Permission denial, mocked location (`LocationCompat.isMock`), or invalid coordinates blocks/fails locally (`INV-MOBILE-003`).
4. The workflow calls `POST /v1/mobile/attendance/precheck`; only an actionable result creates a short-lived `AttendanceAttempt` (10-minute TTL, per-user ownership, generation counter) via `AttendanceAttemptTracker` (`INV-MOBILE-002`, `INV-MOBILE-004`).
5. When `allowed == true`, the app opens CameraX (`Page.ATTENDANCE`) immediately without an intermediate confirmation screen. When blocked or failed, `AttendancePrecheckDialog` (`AbsenceReportScreen.kt`) displays the status icon, message, and campus location name with a `"Periksa Ulang"` action right over `HomeScreen`.
6. On shutter tap, `CameraScreen` freezes the current `PreviewView` frame immediately while `prepareImage` normalizes the JPEG (`<= 5 MiB`), `MainViewModel.submitAttendancePhoto` validates the attempt, encodes Base64, and calls `POST /v1/mobile/attendance/submit`.
7. On success, it deletes the temporary capture, marks the attempt submitted, stores `PendingAttendanceSuccess` with a motivational quote for `AttendanceSuccessDialog` (with full-screen confetti), returns to `HomeScreen`, and reloads the complete dashboard projection (`INV-MOBILE-008`).
8. Definite 4xx rejections map to explicit terminal or retryable outcomes (`ATTENDANCE_BLOCKED` / 409, 413, other non-408 4xx). An ambiguous submit failure (timeout, I/O, 5xx) marks the attempt `UNCERTAIN` with no automatic POST replay and presents a `"Periksa Riwayat Presensi"` action.

**Evidence:** `domain/workflow/AttendanceWorkflow.kt`, `MainViewModel.kt`, `ui/screens/AbsenceReportScreen.kt`, `ui/screens/CameraScreen.kt`, `data/device/DeviceMedia.kt`.
