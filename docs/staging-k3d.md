# Local k3d staging

Use branch `k8s-prep`. The shared sandbox is on penacony, with Kubernetes
context `k3d-skanida-staging` and dummy data only. Configure these public values
in the ignored local `.env`; preserve any existing production env backup.

```dotenv
EXPO_PUBLIC_LOGTO_ENDPOINT=http://auth.192.168.21.122.nip.io:8080
EXPO_PUBLIC_LOGTO_APP_ID=ktok16dl83bmwh85jgc97
EXPO_PUBLIC_LOGTO_REDIRECT_URI=skanida://auth/callback
EXPO_PUBLIC_LOGTO_LOGOUT_URI=skanida://auth/callback
EXPO_PUBLIC_LOGTO_RESOURCE=https://api.skanida-staging.test
EXPO_PUBLIC_BFF_API_URL=http://api.192.168.21.122.nip.io:8080
```

The native Logto client must register the callback for both sign-in and sign-out.
Use the existing debug APK and Metro dev server for UI testing. Debug builds allow
HTTP; these settings and `LOGTO_COOKIE_SECURE=false` on web apps are sandbox-only.
Do not ship them in a production build. Keep Metro on localhost with `adb reverse`
when possible; LAN mode is needed only when devices cannot use that tunnel.

Validated on 2026-10-26 with agent-device, emulator Android16/API36:
NIS24002 signup → Astra school-admin approval → Logto sign-in → native dashboard
showing SISWA DUMMY2 from the shared Astra/PostgreSQL stack. No face is enrolled.
The emulator also has an older Skanida Apps Native package handling `skanida://`;
select Skanida Apps (com.hfzrk.skanidaappsmobile) for callbacks.

Workspace evidence and infrastructure report:
`../infra/k8s/STAGING-REPORT.md`, `../artifacts/k8s-staging/`,
`../.scratch/k8s-staging/{SPEC,TRACKER,HANDOFF}.md`. Credentials stay in protected
workspace fixtures and must not be copied to this document or production.
