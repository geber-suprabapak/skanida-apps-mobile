# Skanida Apps Mobile BFF Migration Status

This note is superseded by:

- `docs/bff-integration.md`
- `spec/bff/plan.md`
- `spec/bff/handoff.md`
- `spec/bff/tasks.md`

Current status:

- Mobile BFF adapter now targets current Project Astra route contracts.
- Dashboard consumes Astra dashboard data for attendance, server readiness, enrollment state, and primary action.
- Health uses `{ status: "healthy" | "unhealthy" }`.
- Permit list unwraps `{ items }`.
- Profile avatar update/clear no longer refreshes Supabase user just to sync local avatar state.
- Direct Supabase business usage is limited to the documented activation RPC exception.

Validation:

- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed with one existing warning in `components/ui/input.tsx`.
- `bun run typecheck`, `bun run lint`, and `bun run test` passed in `E:\project-astra`.
