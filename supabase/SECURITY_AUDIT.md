# Supabase Schema Security Audit

_Date: 2025-02-24_

This document captures the security review that was carried out on `supabase/schema_latest_latest.sql`. The focus was to identify ways an authenticated end-user could escalate privileges or tamper with authoritative data through overly permissive Row Level Security (RLS) policies.

## Summary of Findings

| # | Area | Severity | Description | Resolution |
|---|------|----------|-------------|------------|
| 1 | `perizinan` RLS | High | Students could self-approve their leave requests by crafting `INSERT/UPDATE` statements that set `approval_status`, `approved_by`, or other moderator-managed fields. | Replaced the permissive policies with explicit `DROP/CREATE` statements that require `approval_status = 'pending'` and all moderator fields to remain `NULL` for self-service writes. |
| 2 | `absences` RLS | High | Users could forge or edit attendance rows directly because client roles were allowed to `INSERT` and `UPDATE` the table without any server-side validation. | Removed the legacy write policies so that only security-definer RPCs (`save_attendance_record`, etc.) can mutate the table while users retain read-only access to their own rows. |

## Details

### 1. Leave Approval Tampering (`perizinan` table)

* **Issue:** The previous `perizinan_insert_own` and `perizinan_update_own` policies only checked that `auth.uid() = user_id`. A malicious client could therefore submit a row that was already `approved`, set `approved_by`, pre-populate timestamps, or flip the `status` flag without any staff interaction.
* **Impact:** Direct privilege escalation — students could self-approve or retroactively edit approval decisions, undermining the leave workflow integrity.
* **Fix:** The schema now drops any existing version of these policies and recreates them with strict checks:
  * Inserts must keep `approval_status = 'pending'`, `status = false`, and every moderator-owned column (`approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`) at `NULL`.
  * Updates are only allowed while a request remains pending and the same moderator-owned columns stay untouched.

### 2. Attendance Forgery (`absences` table)

* **Issue:** RLS policies previously allowed authenticated users to `INSERT` and `UPDATE` their own `absences` rows. Because the mobile app already performs client-side inserts, an attacker could bypass the GPS, schedule, and duplicate checks enforced by RPC functions by directly mutating the table through Supabase.
* **Impact:** Users could create arbitrary "Hadir" / "Pulang" entries, erase late marks, or overwrite coordinates, resulting in untrustworthy attendance records.
* **Fix:** The write policies have been dropped entirely. End-users now only have `SELECT` access to their own rows, and the existing security-definer RPCs remain responsible for validated writes.

## Recommendations / Follow-Ups

1. **Moderator Policies:** If an internal dashboard is introduced, create dedicated policies for admins/teachers to review and update `perizinan` rows instead of granting `FOR ALL` access.
2. **Monitoring:** Consider adding a scheduled check that alerts when someone attempts to call the removed policies to detect malicious automation scripts.
3. **Function Hardening:** For public RPCs (e.g., `get_biodata_siswa`), add rate limiting or captcha challenges to further minimize enumeration risk.

The current changes close the most critical privilege escalation vectors discovered during this review.
