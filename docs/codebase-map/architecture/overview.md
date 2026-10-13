# Mobile Architecture

Expo routes and components call feature adapters rather than directly coupling to service details. Logto helpers store/refresh mobile sessions. `bffRequest` turns an endpoint/path plus options into contract-versioned Astra HTTP, supports JSON and multipart payloads, applies timeouts, and normalizes error envelopes.

The attendance workflow owns client-side attempt state while Astra owns eligibility and final domain persistence.

**Evidence:** `app/_layout.tsx`, `utils/logto.ts`, `utils/bff.ts`, `utils/bffMobileApi.ts`, `features/attendance-workflow/attendanceWorkflow.ts`.

The experimental `native-android/` Gradle project is an independent Android runtime. Compose calls `MainViewModel`; `Identity` manages AppAuth sessions encrypted by `SessionStore`; `Astra` owns bearer authentication, request IDs, JSON/multipart transport, and contract-version validation. Astra remains the business authority. CameraX and platform location provide device inputs; Firebase Messaging registers through the existing Expo push HTTP service without an Expo runtime. Release uses the original application ID and requires official signing to replace an installed production app. Experiment builds use a separate `.native` application ID.

**Native evidence:** `native-android/app/build.gradle.kts`, `native-android/app/src/main/java/id/skanida/nativeapp/{MainViewModel,Identity,SessionStore,Astra,DeviceMedia,PushService}.kt`, `native-android/README.md`.
