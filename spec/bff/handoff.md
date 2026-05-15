# BFF Integration Handoff

## Context

Project Astra (`E:\project-astra`) is the BFF API for Skanida Apps Mobile (`E:\skanida-apps-mobile`). Astra is already implemented; this handoff is for mobile-side integration alignment.

Use Serena first in both repos when inspecting code. Current mobile repo already has `utils/bff.ts` and `utils/bffMobileApi.ts`.

Status: mobile-side automated implementation is done. Use this handoff for review, follow-up fixes, or device smoke.

## Key Rule

Do not let screens depend directly on raw BFF quirks. Keep raw Astra types and mapping inside `utils/bffMobileApi.ts`; screens should receive stable mobile-facing shapes.

## Work Order

1. Read `spec/bff/plan.md`.
2. Edit `utils/bffMobileApi.ts`.
3. Edit `utils/faceApiRuntime.ts`.
4. Edit `app/Dashboard.tsx`.
5. Verify dependent screens.
6. Run validation commands.

## Critical Contract Fixes

### Health

Astra:

```ts
data: {
  status: "healthy" | "unhealthy";
}
```

Mobile must stop using `operational`.

### Dashboard

Astra dashboard shape:

```ts
type BffDashboard = {
  profile: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    nis: string | null;
    class_name: string | null;
    absence_number: string | null;
    avatar_url: string | null;
    role: string | null;
  };
  attendance: {
    today_status: "pending" | "present" | "absent" | "leave";
    has_checked_in: boolean;
    has_checked_out: boolean;
    check_in_time: string | null;
    check_out_time: string | null;
    total_work_hours: number | null;
  };
  schedule: {
    day_key: string;
    start_check_in_at: string | null;
    end_check_in_at: string | null;
    start_check_out_at: string | null;
    end_check_out_at: string | null;
    compensation_minutes: number | null;
  } | null;
  face: {
    server_status: "healthy" | "unhealthy";
    enrollment_status: "enrolled" | "not_enrolled";
    message: string;
  };
  permit: {
    has_active_permit: boolean;
    active_category: string | null;
  };
  primary_action:
    | {
        allowed: true;
        type: "check_in" | "check_out";
        label: string;
        reason_code: null;
        reason_message: null;
      }
    | {
        allowed: false;
        type: null;
        label: string;
        reason_code: string;
        reason_message: string;
      };
  server_time: {
    now: string;
    timezone: string;
    source: "bff";
  };
};
```

Mobile must stop using:

```txt
data.today_status.*
data.service_operational
data.schedule.mulai_masuk
data.schedule.selesai_masuk
data.schedule.mulai_pulang
data.schedule.selesai_pulang
data.schedule.kompensasi_waktu
```

### Permits

Astra:

```ts
data: {
  items: BffPermit[];
}
```

Mobile must unwrap `items`.

### Enrollment

Astra upload:

```txt
multipart field: files
count: exactly 10
content-type: image/jpeg
max per file: 2MB
```

Keep `app/profile/enroll.tsx` using `submitEnrollment(files)` unless there is a real contract mismatch.

### Attendance

Precheck request:

```ts
{
  latitude: number;
  longitude: number;
}
```

Submit request:

```ts
{
  action_type: "check_in" | "check_out";
  image_base64: string;
  latitude: number;
  longitude: number;
}
```

Submit response:

```ts
{
  attendance_type: "check_in" | "check_out";
  status_label: string;
  processed_ms: number;
}
```

## Suggested Adapter Exports

Keep these as screen-facing functions:

```ts
getDashboard()
getMobileHealth()
getServerTime()
precheckAttendance()
submitAttendance()
getEnrollmentStatus()
submitEnrollment()
listPermits()
createPermit()
getProfile()
updateAvatar()
changePassword()
```

Prefer adding mapping helpers in the same file:

```ts
toMobileSchedule()
toMobilePermit()
toMobileRuntime()
toMobileAttendanceStatus()
```

## Direct Supabase Rules

Allowed in v1:

- Auth login/signup/reset/logout/session.
- `utils/bff.ts` token retrieval.
- Activation RPC until a separate BFF activation contract exists.

Not allowed after this integration:

- Dashboard data direct from Supabase.
- Attendance business data direct from Supabase.
- Permit business data direct from Supabase.
- Profile business data direct from Supabase, except auth/session refresh if still needed.
- Enrollment business data direct from Supabase.

## Commands

Mobile:

```powershell
pnpm exec tsc --noEmit
pnpm lint
```

Astra:

```powershell
bun run typecheck
bun run lint
bun run test
```

## Starter Prompt

```txt
You are in E:\skanida-apps-mobile. Use Serena first. Project Astra is in E:\project-astra and is the current BFF API.

Implement the BFF integration from spec/bff/plan.md, spec/bff/handoff.md, and spec/bff/tasks.md.

Scope:
1. Fix utils/bffMobileApi.ts to match current Astra contracts.
2. Fix utils/faceApiRuntime.ts to use health.status.
3. Update app/Dashboard.tsx to consume Astra dashboard shape and reduce duplicate health/enrollment fetches.
4. Verify attendance, enrollment, permit, profile, and time screens against adapter exports.
5. Keep Supabase Auth direct in v1.
6. Keep user-facing copy generic. Do not expose internal backend names.
7. Run pnpm exec tsc --noEmit and pnpm lint.

Do not edit Project Astra unless the mobile integration reveals a confirmed BFF contract bug.
```

## Final Report Template

```txt
Changed:
- ...

Validation:
- pnpm exec tsc --noEmit: ...
- pnpm lint: ...

Remaining:
- ...
```
