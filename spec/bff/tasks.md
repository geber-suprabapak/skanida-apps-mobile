# BFF Integration Tasks

Status: automated implementation done. Manual device smoke still pending because it needs a running mobile device/emulator and Astra runtime.

## P0 - Adapter Contract Alignment

- [x] Open `utils/bffMobileApi.ts`.
- [x] Replace health type from `{ operational: boolean }` to `{ status: "healthy" | "unhealthy" }`.
- [x] Replace old `BffDashboard` type with current Astra shape.
- [x] Add or update mobile-facing dashboard mapper.
- [x] Map `attendance.today_status` to current UI `todayStatus`.
- [x] Map `attendance.has_checked_in` to current UI `hasCheckedIn`.
- [x] Map `attendance.has_checked_out` to current UI `hasCheckedOut`.
- [x] Map `attendance.check_in_time` to current UI `checkInTime`.
- [x] Map `attendance.check_out_time` to current UI `checkOutTime`.
- [x] Map `attendance.total_work_hours` to current UI `totalWorkHours`.
- [x] Map `schedule.start_check_in_at` to `mulai_masuk`.
- [x] Map `schedule.end_check_in_at` to `selesai_masuk`.
- [x] Map `schedule.start_check_out_at` to `mulai_pulang`.
- [x] Map `schedule.end_check_out_at` to `selesai_pulang`.
- [x] Map `schedule.compensation_minutes` to `kompensasi_waktu`.
- [x] Preserve `primary_action.allowed`.
- [x] Preserve `primary_action.type`.
- [x] Preserve `primary_action.label`.
- [x] Preserve `primary_action.reason_code`.
- [x] Preserve `primary_action.reason_message`.
- [x] Preserve `face.server_status`.
- [x] Preserve `face.enrollment_status`.
- [x] Preserve `face.message`.
- [x] Change `listPermits()` to call `bffRequest<{ items: BffPermit[] }>`.
- [x] Change `listPermits()` to map `result.items`.
- [x] Add `rejected_at?: string | null` to `BffPermit`.
- [x] Map `rejected_at: permit.rejected_at ?? null`.
- [x] Keep `createPermit()` multipart fields: `category`, `description`, `date`, optional `attachment`.
- [x] Keep `submitEnrollment()` multipart field: `files`.
- [x] Keep `submitAttendance()` request body unchanged.
- [x] Keep `precheckAttendance()` request body unchanged.
- [x] Confirm `getServerTime()` keeps `epoch_ms`.

## P0 - Runtime Health Alignment

- [x] Open `utils/faceApiRuntime.ts`.
- [x] Replace `result.operational` usage with `result.status === "healthy"`.
- [x] Keep runtime states: `healthy`, `unhealthy`, `offline`, `misconfigured`.
- [x] Keep user-facing copy generic: `Server`, not internal backend names.
- [x] Ensure failed health call still returns `offline`.

## P0 - Dashboard Contract Alignment

- [x] Open `app/Dashboard.tsx`.
- [x] Replace `data.today_status.hasCheckedIn`.
- [x] Replace `data.today_status.hasCheckedOut`.
- [x] Replace `data.today_status.checkInStatus`.
- [x] Replace `data.today_status.today`.
- [x] Replace stale schedule field reads if any raw BFF schedule reaches the screen.
- [x] Set server readiness from dashboard `face.server_status`.
- [x] Set enrollment status from dashboard `face.enrollment_status`.
- [x] Use `primary_action.allowed` for CTA disabled logic where possible.
- [x] Use `primary_action.label` for CTA label where possible.
- [x] Preserve local time-window display if UI still needs it.
- [x] Remove or reduce duplicate dashboard focus calls to health/enrollment.
- [x] Keep Dashboard as earliest readiness/enrollment gate.
- [x] Keep camera/location screens process-only.
- [x] Keep attendance success popup on Dashboard.

## P1 - Feature Flow Verification

- [x] Check `app/attendance/AbsenceReport.tsx` uses `precheckAttendance()`.
- [x] Verify precheck still blocks before camera.
- [x] Check `app/attendance/CameraAttendance.tsx` uses `submitAttendance()`.
- [x] Verify `processed_ms` feeds pending success popup.
- [x] Check `app/profile/enroll.tsx` uses `submitEnrollment(files)`.
- [x] Verify enrollment sends 10 JPEG files.
- [x] Check `app/perizinan/izin.tsx` uses `listPermits()` and `createPermit()`.
- [x] Verify permit creation sends `date` as `YYYY-MM-DD`.
- [x] Check `app/perizinan/status.tsx` uses `listPermits()`.
- [x] Verify rejected permits can show `rejection_reason` and `rejected_at`.
- [x] Check `app/profile/ManageAccount.tsx` uses `getProfile()`, `updateAvatar()`, and `changePassword()`.
- [x] Avoid unnecessary `supabase.auth.getUser()` after avatar update if BFF response is enough.
- [x] Check `app/extra/pengaturan.tsx` uses `getProfile()`.
- [x] Check `utils/timeSync.ts` uses `getServerTime()`.

## P1 - Supabase Boundary Audit

- [x] Run search for `supabase.from`.
- [x] Run search for `supabase.rpc`.
- [x] Run search for `supabase.storage`.
- [x] Confirm business flows do not bypass BFF.
- [x] Document allowed auth/session direct calls.
- [x] Keep `app/auth/Activate.tsx` RPC as known v1 exception unless new BFF activation endpoint exists.

## P2 - Validation

- [x] Run `pnpm exec tsc --noEmit`.
- [x] Run `pnpm lint`.
- [x] If mobile errors are unrelated/pre-existing, record exact file/line.
- [x] If Astra must be checked, run `bun run typecheck` in `E:\project-astra`.
- [x] If Astra must be checked, run `bun run lint` in `E:\project-astra`.
- [x] If Astra must be checked, run `bun run test` in `E:\project-astra`.

## P2 - Manual Smoke

- [ ] Login.
- [ ] Open Dashboard.
- [ ] Confirm dashboard loads profile/avatar.
- [ ] Confirm server readiness comes from BFF.
- [ ] Confirm enrollment state comes from BFF.
- [ ] Start attendance precheck.
- [ ] Submit attendance.
- [ ] Confirm Dashboard popup shows `Processed in ...`.
- [ ] Open enrollment screen.
- [ ] Submit 10 JPEG images.
- [ ] Create permit without attachment.
- [ ] Create permit with attachment.
- [ ] View permit status.
- [ ] Update profile avatar.
- [ ] Clear profile avatar.
- [ ] Change password.
- [ ] Relaunch app and confirm time sync.

## Completion Checklist

- [x] `spec/bff/plan.md` exists.
- [x] `spec/bff/handoff.md` exists.
- [x] `spec/bff/tasks.md` exists.
- [x] Adapter matches Astra contract.
- [x] Dashboard stale fields removed.
- [x] Health status fixed.
- [x] Permit `{ items }` unwrap fixed.
- [x] Supabase business leftovers documented or removed.
- [x] Typecheck result recorded.
- [x] Lint result recorded.
- [ ] Manual smoke result recorded.
