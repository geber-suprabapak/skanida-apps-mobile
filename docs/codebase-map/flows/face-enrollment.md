# Face Enrollment

1. The enrollment screen checks face-service runtime readiness and requests front-camera permission.
2. The student captures ten temporary JPEG images; an individual image over the client size limit is rejected before confirmation.
3. Before upload, the screen rechecks runtime readiness and prepares the ten images as multipart form data.
4. `submitEnrollment` sends the request through the shared contract-versioned Astra BFF transport.
5. A known success presents Astra's processed/failed/embedding summary. Cancellation or an error after starting the POST presents an unknown outcome, with no upload-retry action. A status-read button reports the current enrollment state without treating it as proof that the canceled request completed; a not-enrolled read may race an in-flight request. Failed status reads can be retried without resending photos.
6. Temporary captures are cleaned after settlement or unmount. Pre-upload readiness errors retain the capture retry path; canceling the client does not promise server rollback.

Missing permission, unavailable runtime, insufficient images, oversized capture, or Astra failure prevents a success state. Retry and cancellation paths also remove temporary captures on a best-effort basis.

**Evidence:** `app/profile/enroll.tsx`, `utils/enrollment.ts`, `utils/faceApiRuntime.ts`, `utils/bffMobileApi.ts`, `README.md`.
