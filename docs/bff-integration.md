# BFF Integration Guide

## Purpose

This document records the current mobile integration with Project Astra, the BFF API used by Skanida Apps Mobile.

Mobile should stay thin:

- Logto owns identity, sessions, and RBAC.
- Business data and workflow decisions come from Astra.
- Supabase business internals stay hidden behind Astra.

## Active Boundary

Mobile base env:

```txt
EXPO_PUBLIC_BFF_API_URL
```

Transport helper:

```txt
utils/bff.ts
```

Screen-facing adapter:

```txt
utils/bffMobileApi.ts
```

The transport helper:

- reads the active Logto session
- sends `Authorization: Bearer <access_token>`
- sends `X-Request-Id`
- applies request timeout
- unwraps Astra success envelopes
- throws `BffRequestError` for Astra error envelopes

## Current Astra Contract

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

Common response envelope:

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

## Implemented Mobile Mapping

### Health

Astra returns:

```ts
{
  status: "healthy" | "unhealthy";
}
```

Mobile maps this into `FaceApiRuntimeStatusResult` through `utils/faceApiRuntime.ts`.

### Dashboard

Dashboard consumes:

- `profile`
- `attendance`
- `schedule`
- `face`
- `permit`
- `primary_action`
- `server_time`

`app/Dashboard.tsx` uses dashboard data as the primary gate for:

- server readiness
- enrollment state
- attendance state
- primary attendance CTA

The old top-level `today_status` and `service_operational` shapes are no longer used in code.

### Attendance

Precheck sends location only:

```ts
{
  latitude: number;
  longitude: number;
}
```

Submit sends:

```ts
{
  action_type: "check_in" | "check_out";
  image_base64: string;
  latitude: number;
  longitude: number;
}
```

Camera screens remain process-only. Dashboard owns readiness and success UX.

### Enrollment

Enrollment upload uses multipart field `files`.

Requirements enforced by Astra:

- exactly 10 files
- JPEG only
- 2MB max per file

### Permits

Astra returns permit lists as:

```ts
{
  items: BffPermit[];
}
```

`utils/bffMobileApi.ts` unwraps `items` and maps each item to the mobile permit shape.

### Profile

Profile, avatar update, avatar clear, and password change use BFF helpers. Avatar changes update local screen state from the BFF response and no longer require a Supabase `auth.getUser()` refresh.

## Identity and Direct-Backend Boundary

Logto handles login, logout, session refresh, and role claims. Astra handles activation and all business workflows. The mobile client may only retrieve the Logto bearer token in `utils/bff.ts`; it must not call Supabase Auth, PostgREST, storage, or RPC endpoints directly.

## Validation

Required local checks:

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Latest automated result:

- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed with one existing warning in `components/ui/input.tsx` for unused `placeholderClassName`.
- `bun run typecheck` in `E:\project-astra`: passed.
- `bun run lint` in `E:\project-astra`: passed.
- `bun run test` in `E:\project-astra`: passed, 64 unit tests.

Optional Astra checks:

```bash
bun run typecheck
bun run lint
bun run test
```

Manual smoke:

1. Login.
2. Open Dashboard.
3. Confirm readiness and enrollment state.
4. Run attendance precheck.
5. Submit attendance.
6. Confirm Dashboard success popup.
7. Enroll face with 10 JPEG images.
8. Create and view permits.
9. Update and clear avatar.
10. Change password.
11. Relaunch app and confirm time sync.
