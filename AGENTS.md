## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default five triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Development and verification

This is a native Android Kotlin + Jetpack Compose Gradle project (`settings.gradle.kts`, `app/build.gradle.kts`). Use `./gradlew :app:testDebugUnitTest` for unit tests, `./gradlew :app:lintRelease` for Android Lint, and `./gradlew :app:assembleDebug`, `./gradlew :app:assembleStaging`, or `./gradlew :app:assembleRelease` for APK builds. Use `app/build.gradle.kts` as the source of truth for dependencies and build configuration.

## Execution boundary

Logto owns mobile identity (`offline_access` + PKCE + `prompt=consent` via AppAuth); authenticated business flows use Astra's `/v1/mobile/*` API through `app/src/main/java/id/skanida/nativeapp/data/api/Astra.kt` and `MainViewModel.kt`. Never commit signing keys, `signing.properties`, `google-services.json`, `.env` secrets, or local bypasses.

<!-- repo-map:start -->
## Codebase semantic map

Start repository-wide orientation at `docs/codebase-map/README.md`.

- Domain vocabulary and aliases: `docs/codebase-map/glossary.md`
- Semantic module ownership: `docs/codebase-map/modules.md`
- Architecture boundaries: `docs/codebase-map/architecture/`
- Cross-module flows: `docs/codebase-map/flows/`
- Rules that changes must preserve: `docs/codebase-map/invariants.md`
- Recorded decision sources: `docs/codebase-map/decisions/README.md`

For structural questions such as symbol callers, imports, dependencies, or code relationships, prefer an available code graph / codebase-memory tool before broad repository scans. The graph is an accelerator; source code, tests, schemas, and project docs remain authoritative.

Read only the map pages relevant to the task, then inspect the implementation they point to.
<!-- repo-map:end -->
