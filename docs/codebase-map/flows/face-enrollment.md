# Face Enrollment

1. The enrollment screen checks face-service runtime readiness and requests front-camera permission.
2. The student captures ten temporary JPEG images; an individual image over the client size limit is rejected before confirmation.
3. Before upload, the screen rechecks runtime readiness and prepares the ten images as multipart form data.
4. `submitEnrollment` sends the request through the shared contract-versioned Astra BFF transport.
5. The screen presents Astra's processed/failed/embedding summary and cleans temporary captures after the submission attempt.

Missing permission, unavailable runtime, insufficient images, oversized capture, or Astra failure prevents a success state. Retry and cancellation paths also remove temporary captures on a best-effort basis.

**Evidence:** `app/profile/enroll.tsx`, `utils/enrollment.ts`, `utils/faceApiRuntime.ts`, `utils/bffMobileApi.ts`, `README.md`.
