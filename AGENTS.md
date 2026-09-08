## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default five triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

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
