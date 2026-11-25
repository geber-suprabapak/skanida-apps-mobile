# Face Enrollment

1. `MainViewModel.startEnrollment` checks camera permission, queries `GET /v1/mobile/health` and `GET /v1/mobile/face/enrollment/status` in parallel, and opens `CameraScreen` in `EnrollmentStep.CAPTURE`.
2. The student captures ten temporary JPEG images (`<= 2 MiB` each, downsampled via `RGB_565` in `prepareImage`); an individual oversized capture is rejected before confirmation (`INV-MOBILE-005`).
3. After the 10th capture, `EnrollmentConfirmScreen` (`EnrollmentFlowScreens.kt`) displays a 10-photo thumbnail preview for student confirmation before upload.
4. Before starting multipart POST (`POST /v1/mobile/face/enrollment`), `MainViewModel.submitEnrollment` verifies the ten files on `Dispatchers.IO`, rechecks service readiness (`GET /v1/mobile/health`), and uploads them under field `files`.
5. A known success presents `EnrollmentSuccessScreen` with `imagesProcessed`, `imagesFailed`, and `totalEmbeddings`. Cancellation or an error after starting the POST enters `EnrollmentUnknownOutcomeScreen` with a `"Cek Status Pendaftaran"` action without blindly re-uploading the photos.
6. Temporary captures are cleaned up asynchronously on `Dispatchers.IO` after settlement, retake, navigation away, or `ViewModel.onCleared`.

**Evidence:** `MainViewModel.kt`, `ui/screens/CameraScreen.kt`, `ui/screens/EnrollmentFlowScreens.kt`, `data/api/Astra.kt`, `data/device/DeviceMedia.kt`.
