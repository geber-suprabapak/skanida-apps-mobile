# Objective

Map Astra's structured `ATTENDANCE_BLOCKED` response into the existing attendance workflow seam.

# Requirements

- A submit race that is blocked by an approved Leave Period must remain actionable to the client and must not be reported as a generic unavailable error.

# Acceptance Criteria

- Existing attendance workflow tests have one red/green regression for the blocked response.
- No mobile UI change unless the existing seam requires it.

# Constraints

- Ticket 06 only; no unrelated UI or API refactors; no new dependencies.

# Relevant Areas

- `features/attendance-workflow/attendanceWorkflow.ts`, `utils/bff.ts`, and `__tests__/attendance-workflow.test.ts`.

# Implementation Notes

Preserve the server error code and message at the workflow boundary with the smallest type extension.
