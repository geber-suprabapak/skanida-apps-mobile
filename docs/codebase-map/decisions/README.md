# Decision Index

| Decision | Status | Source | Affects |
| --- | --- | --- | --- |
| Astra is the mobile BFF | Documented | `README.md`, `data/api/Astra.kt` | All business calls |
| Native Kotlin + Jetpack Compose cutover | Accepted | `app/build.gradle.kts`, `DESIGN.md` | Full Android client |
| Deepen mobile workflow modules | Accepted | `docs/adr/0001-deepen-mobile-workflow-modules.md` | Attendance, session, face readiness, dashboard |
| Logto owns mobile identity | Documented | `README.md`, `data/auth/Identity.kt` | Authentication |
| Attendance uses two phases | Observed | `domain/workflow/AttendanceWorkflow.kt` | Precheck & Camera flow |

Rationale beyond these sources is not recorded.
