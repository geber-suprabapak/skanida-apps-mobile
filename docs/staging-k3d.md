# Local k3d staging

Use permanent branch `k8s-staging`, tracking `origin/k8s-staging` in all seven repos.
The shared sandbox is on penacony, with Kubernetes
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
Bronya manual attendance for NIS24002 was also visible in native history at
09.28 WIB after relaunch. This completes the historical debug staging baseline;
standalone APK evidence is below. Physical-device push and real camera remain open.
Further QA fixed terminal-session cleanup and protected authenticated routes.
The student submitted a leave request with an emulator camera photo; Chronos
rejection/reason and reopening were observed as DITOLAK/MENUNGGU in this app.
The ongoing cross-app scope and remaining simulations are in infra's QA-REPORT.md.
The emulator also has an older Skanida Apps Native package handling `skanida://`;
select Skanida Apps (com.hfzrk.skanidaappsmobile) for callbacks.

## Standalone staging APK

```sh
pnpm android:staging
```

This local command reads the `staging` profile in `eas.json`, generates Android
with `--no-install --no-clean`, and runs `assembleRelease` for arm64-v8a and x86_64.
Expo57 recreates native directories by default; `--no-clean` preserves existing
generated state. Local dotenv files are excluded from this build environment.
The APK is `android/app/build/outputs/apk/release/app-release.apk`, with bundled
JavaScript/Hermes and the existing local debug signing key. It is for sandbox QA.
The command does not request EAS remote signing credentials.

### Bundled local debug APK

```sh
pnpm android:staging:debug
```

This uses the same staging-only public profile, sets `EXPO_NO_DOTENV=1`, and
builds a locally debug-signed APK with an embedded JavaScript bundle. It does
not call EAS or load local dotenv files. The debug-only config enables the
embedded-bundle option; on first launch, choose **Load embedded bundle** in the
Expo launcher. Do not connect Metro for the cold-start check. This is a QA
artifact, not a release build.

Validated 2026-10-29 on the Android 16/API 36 x86_64 emulator. The APK SHA256 is
`acbb3fa3776dbc2dd67b95f43b89d5e812e5a7c3584a7e438cd2b4cb8e21e988`; it
contains `assets/index.android.bundle`, supports arm64-v8a and x86_64, and is
debuggable. With no Metro listener or ADB reverse tunnel, the bundled route
cold-launched offline and retained the authenticated dummy session. Detailed
native limitations and evidence are in
`../../.scratch/system-hardening/remediation/evidence/M09.md`.

Before replacing an existing install, compare signer certificates and retain a
rollback APK. Restore it with `adb install -r`; do not uninstall or clear app
data. The 2026-10-29 QA run restored the pre-existing release APK this way and
confirmed the dashboard session remained.

The staging app label is **Skanida Apps (Staging)**. Only this channel permits HTTP
to the k3d ingress and disables Sentry JS/native telemetry and build uploads. OTA
is disabled in source config for all channels; verify the generated manifest and
APK rather than relying on an older generated Android tree. Production config
keeps HTTP disabled and its existing telemetry behavior.

Before installing over an existing emulator app, compare APK signer certificates,
retain its installed APK as rollback, and use `adb install -r` without uninstall
or data wipe. For a standalone check remove the emulator's Metro reverse tunnel;
check embedded sandbox endpoints, both ABIs, OTA-disabled manifest and bundled
JavaScript first. Test launch/login/history with no Metro access, then device-only
network loss/recovery. A release build is not proof that those runtime checks pass.

On 2026-10-28, the local two-ABI release built successfully in 9m56s. Verified APK
SHA256 `bd17f90cadc7a6b4ddfc043fdbe3f196e86cc6f7d4e07b9af339bdd384de91ad`,
30,004,527 bytes, is retained in the workspace as
`artifacts/k8s-staging/qa/skanida-staging-bd17f90c.apk`. APK inspection confirms
non-debuggable release, both ABIs, embedded Hermes, sandbox endpoints, staging
Expo config, matching prior signer, native Sentry auto-init false and OTA disabled.

Agent-device QA on Android16/API36 x86_64 passed with no Metro listener or reverse:
cold start to login, Logto SSO student24003, dashboard06:00/13:04/7.07hours,
profile24003/X PPLG1/absence3, October1Hadir/0other, and app force-stop persistence.
Wi-Fi and mobile data were disabled only on the emulator for about6.4seconds;
offline banner/retry preserved identity/data and recovery was automatic after
restoring both radio states. The retained debug APK permits install-only rollback;
device UID and all five source attendance records stayed unchanged.

The initial run omitted Expo57's new explicit `--no-clean` and regenerated ignored
Android output; key/env hashes were unchanged and the installed debug APK was then
retained outside that tree. The corrected command was tested afterward: APK, key,
manifest and both env files remained byte-identical. Metaspace/deprecation warnings
did not fail the build; Sentry upload was skipped. The repair below covers cold
start offline and refresh-token issuance. Access-expiry refresh, camera/Face and
physical-device push remain separate checks.
arm64 was compiled and packaged but has not been tested on an arm64 device.

### Cold-start recovery and offline authorization

QA found that a failed offline dashboard read could leave attendance blank after
the server/enrollment retry succeeded: those controls fetched only face state.
Dashboard retries and reconnect now reload the complete Astra dashboard projection.
Native authorization also requests explicit consent with PKCE and `offline_access`,
as required for this provider to issue refresh tokens.

The corrected APK SHA256 is
`1466d5792ee9db89a3681318fd242874c7b9622253a67c76dcd084ce45fbd744`,
30,004,371 bytes, retained as `artifacts/k8s-staging/qa/skanida-staging-1466d579.apk`.
All21mobile suites/205tests, typecheck, scoped lint and formatting passed. The
actual Dashboard and Login regressions failed before the fixes and passed afterward.
The cached two-ABI release build completed in1m53s; signer and sandbox guards match
the earlier release, which is retained as rollback.

Cold app start with both emulator radios off retained24003 and the offline banner.
After7.455seconds offline, restoring radios reloaded06:00/13:04 and Selesai without
login or retry; UI was observed647ms after the restore commands completed. This is
one functional sample, not a latency benchmark or a DNS-configuration repair.
Normal native logout/credential login then increased own active refresh tokens0→1
and added `offline_access` to the grant; identity fields/roles and five source
attendance records remained unchanged. No token value or identifier was extracted.

Existing sessions without a refresh token need a fresh login to obtain one. The
new native session was issued around15:48WIB on28October; keep it for the actual
access-token-expiry recovery check, without host clock changes or helper logins.

Workspace evidence and infrastructure report:
`../infra/k8s/STAGING-REPORT.md`, `../artifacts/k8s-staging/`,
`../.scratch/k8s-staging/{SPEC,TRACKER,HANDOFF}.md`. Credentials stay in protected
workspace fixtures and must not be copied to this document or production.
