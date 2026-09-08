# BFF Integration Plan - Skanida Apps Mobile

## Objective

Integrate `E:\skanida-apps-mobile` with Project Astra (`E:\project-astra`) as the mobile Backend-for-Frontend. Astra owns mobile business flows for dashboard, attendance, enrollment, permits, profile, activation, and time. Logto owns identity and RBAC; the client does not call Supabase directly.

## Current State

Mobile already has a BFF transport layer:

- `utils/bff.ts` handles base URL, Logto access token, `Authorization: Bearer`, `X-Request-Id`, timeout, envelope parsing, and normalized errors.
- `utils/bffMobileApi.ts` is the intended screen-facing adapter.
- Screens already call BFF helpers for dashboard, attendance submit/precheck, enrollment, permits, profile, avatar, password, and time.

Implementation status: automated mobile-side alignment is done.

Resolved mismatches:

- `getMobileHealth()` now expects `{ status: "healthy" | "unhealthy" }`.
- `BffDashboard` now matches Astra `profile`, `attendance`, `schedule`, `face`, `permit`, `primary_action`, and `server_time`.
- `listPermits()` now unwraps `{ items: BffPermit[] }`.
- `BffPermit` preserves `rejected_at`.
- `app/Dashboard.tsx` now reads Astra dashboard fields and uses dashboard payload for normal server/enrollment state.

## Target Boundary

Mobile talks to Astra through this base:

```txt
EXPO_PUBLIC_BFF_API_URL + /v1/mobile
```

Mobile uses Logto for login, logout, session refresh, and RBAC claims. Activation and all non-auth business flows go through Astra. No direct Supabase calls are allowed in the production mobile boundary.

## Astra Route Surface

```txt
GET   /v1/mobile/health
GET   /v1/mobile/dashboard
POST  /v1/mobile/attendance/precheck
POST  /v1/mobile/attendance/submit
GET   /v1/mobile/face/enrollment/status
POST  /v1/mobile/face/enrollment
GET   /v1/mobile/permits
POST  /v1/mobile/permits
GET   /v1/mobile/profile
PATCH /v1/mobile/profile/avatar
PATCH /v1/mobile/profile/password
GET   /v1/mobile/time
```

Envelope:

```ts
type SuccessEnvelope<T> = {
  success: true;
  message: string;
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
  };
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
};
```

`utils/bff.ts` already unwraps this envelope, so screens and adapters should work with `data` only.

## Implementation Strategy

### Phase 1 - Fix Adapter Contract

Status: done in `utils/bffMobileApi.ts`.

Goals:

- Make raw BFF types match Astra exactly.
- Add mapper helpers so screens consume stable mobile shapes.
- Fix health response from `operational` to `status`.
- Fix permit list from raw array to `{ items }`.
- Preserve `rejected_at`.
- Keep endpoint paths centralized in this file.

Recommended adapter pattern:

```ts
export async function listPermits(): Promise<MobilePermit[]> {
  const result = await bffRequest<{ items: BffPermit[] }>("/v1/mobile/permits");
  return result.items.map(toMobilePermit);
}
```

### Phase 2 - Align Dashboard

Status: done in `app/Dashboard.tsx`.

Goals:

- Stop reading `data.today_status`.
- Use `data.attendance.today_status`, `has_checked_in`, `has_checked_out`, `check_in_time`, `check_out_time`, and `total_work_hours`.
- Map Astra schedule fields into the existing UI schedule shape.
- Use `data.face.server_status` to set server readiness.
- Use `data.face.enrollment_status` to set enrollment state.
- Use `data.primary_action.allowed`, `type`, `label`, and `reason_message` for CTA state.
- Reduce duplicate calls to health and enrollment during normal dashboard load.

Keep important UX rules:

- Dashboard remains the first readiness/enrollment gate.
- Location/camera screens stay process-only.
- Success UX stays owned by Dashboard.
- User-facing copy stays generic: use `Server`, not internal backend names.

### Phase 3 - Verify Feature Screens

Status: automated verification done through typecheck, lint, and code search. Device smoke remains pending.

Check these screens compile and still match adapter return types:

- `app/attendance/AbsenceReport.tsx`
- `app/attendance/CameraAttendance.tsx`
- `app/profile/enroll.tsx`
- `app/perizinan/izin.tsx`
- `app/perizinan/status.tsx`
- `app/profile/ManageAccount.tsx`
- `app/extra/pengaturan.tsx`

Expected behavior:

- Attendance precheck gates before camera.
- Attendance submit sends image base64 + location to BFF.
- Enrollment sends exactly 10 JPEG files as multipart `files`.
- Permit list unwraps Astra `{ items }`.
- Profile/avatar/password use BFF.
- Time sync uses `GET /v1/mobile/time`.

### Phase 4 - Backend Boundary Audit

Status: done.

Verified identity boundary:

- `app/auth/Login.tsx`, `app/index.tsx`, and `app/_layout.tsx` use Logto.
- `utils/bff.ts` retrieves the Logto bearer token for Astra requests.
- `app/auth/Activate.tsx` submits to Astra and has no direct Supabase call.
- Business screens use Astra adapters only.

### Phase 5 - Validation

Status: automated validation passed.

Run in mobile repo:

```powershell
pnpm exec tsc --noEmit
pnpm lint
```

If Astra verification is needed, run in `E:\project-astra`:

```powershell
bun run typecheck
bun run lint
bun run test
```

Manual device smoke:

1. Login.
2. Open Dashboard.
3. Confirm server readiness and enrollment state show from dashboard data.
4. Start attendance precheck.
5. Submit attendance and confirm Dashboard popup shows `Processed in ...`.
6. Open enrollment and submit 10 JPEG images.
7. Create permit with and without attachment.
8. View permit status.
9. Open profile, update avatar, clear avatar, change password.
10. Relaunch app and confirm time sync.

## Done Criteria

- [x] Mobile adapter matches Astra response contracts.
- [x] Dashboard no longer reads stale fields.
- [x] Health uses `status`.
- [x] Permit list unwraps `{ items }`.
- [x] Direct Supabase business and auth leftovers are removed from the production mobile boundary.
- [x] Typecheck and lint pass.
- [ ] Manual flow checklist passes against running Astra.
