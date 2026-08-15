---
status: accepted
---

# Deepen mobile workflow modules

Skanida Mobile will deepen four workflow modules behind small interfaces: **Attendance Workflow**, session restoration, **Face Verification Readiness**, and the Dashboard read model. The rollout is **Attendance Workflow → session restoration → Face Verification Readiness → Dashboard**; the first implementation slice is Attendance Workflow because its native/security seam carries the highest device risk. Each module keeps platform and BFF details behind targeted adapters, uses generation guards for stale results, and is tested through its interface before native smoke testing. This preserves the current BFF, WIB, mock-location, notification, and native behavior while increasing depth, leverage, and locality.

## Considered options

- A generic adapter layer was rejected: one broad seam would create shallow modules without a second real adapter.
- Route params and a global Zustand attempt store were rejected for Attendance Workflow: an opaque process-local attempt identity keeps policy and temporary state local.
- Client-side schedule authority was rejected: BFF `primary_action` remains authoritative and missing action data fails closed.
- An all-at-once cutover was rejected: candidate-level contract tests and smoke checks localize regressions.

## Consequences

Attendance Workflow owns a two-phase `prepare`/`complete` lifecycle, one-shot submission protection, typed expected outcomes, and best-effort idempotent temporary-file cleanup. Session restoration owns normalized auth events, role routing inputs, profile hydration, and notification registration ordering; `authStore.setUser` becomes a synchronous state setter. Face Verification Readiness returns typed combined and partial facts with in-flight deduplication but no persistent cache. Dashboard uses one coalesced latest-generation refresh path and fails closed when the BFF does not provide a valid primary action.
