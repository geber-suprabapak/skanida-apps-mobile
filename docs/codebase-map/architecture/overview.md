# Mobile Architecture

Expo routes and components call feature adapters rather than directly coupling to service details. Logto helpers store/refresh mobile sessions. `bffRequest` turns an endpoint/path plus options into contract-versioned Astra HTTP, supports JSON and multipart payloads, applies timeouts, and normalizes error envelopes.

The attendance workflow owns client-side attempt state while Astra owns eligibility and final domain persistence.

**Evidence:** `app/_layout.tsx`, `utils/logto.ts`, `utils/bff.ts`, `utils/bffMobileApi.ts`, `features/attendance-workflow/attendanceWorkflow.ts`.
