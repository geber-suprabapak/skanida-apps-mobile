# Skanida Apps Mobile

Expo React Native app for Skanida student workflows: authentication, dashboard, face-based attendance, face enrollment, permits, profile management, and time sync.

## Runtime Architecture

The app uses Project Astra as its mobile Backend-for-Frontend (BFF). Logto owns mobile identity and RBAC; authenticated business flows go through Astra with a Logto access token.

Main mobile BFF files:

- `utils/bff.ts`: shared BFF transport, Logto bearer token, request ID, timeout, envelope parsing, and normalized errors.
- `utils/bffMobileApi.ts`: screen-facing API adapter for Astra endpoints.
- `utils/faceApiRuntime.ts`: mobile-safe server readiness state.
- `utils/enrollment.ts`: face enrollment status wrapper.

Project Astra path in this workspace:

```txt
E:\project-astra
```

## BFF-Covered Flows

- Dashboard: `GET /v1/mobile/dashboard`
- Server health: `GET /v1/mobile/health`
- Attendance precheck: `POST /v1/mobile/attendance/precheck`
- Attendance submit: `POST /v1/mobile/attendance/submit`
- Face enrollment status: `GET /v1/mobile/face/enrollment/status`
- Face enrollment upload: `POST /v1/mobile/face/enrollment`
- Permits: `GET /v1/mobile/permits`, `POST /v1/mobile/permits`
- Profile: `GET /v1/mobile/profile`
- Avatar: `PATCH /v1/mobile/profile/avatar`
- Password: `PATCH /v1/mobile/profile/password`
- Time sync: `GET /v1/mobile/time`

Activation is submitted to Astra with `POST /v1/auth/student/signup`; the mobile client does not call Supabase directly.

## Environment

Copy `.env.example` to `.env` and fill:

```txt
EXPO_PUBLIC_LOGTO_ENDPOINT=
EXPO_PUBLIC_LOGTO_APP_ID=
EXPO_PUBLIC_LOGTO_REDIRECT_URI=
EXPO_PUBLIC_BFF_API_URL=
EXPO_PUBLIC_SENTRY_DSN=
```

`EXPO_PUBLIC_BFF_API_URL` should point to the Astra base URL, without a trailing route. Example:

```txt
EXPO_PUBLIC_BFF_API_URL=http://localhost:3000
```

The mobile adapter appends `/v1/mobile/...`.

## Dependencies

- Node.js LTS
- PNPM
- Android Studio with Android SDK/NDK
- Java JDK, preferably Adoptium JDK
- Expo development build setup for native camera usage

## Installation

```bash
git clone https://github.com/geber-suprabapak/skanida-apps-mobile.git
cd skanida-apps-mobile
pnpm install
```

Run Metro:

```bash
pnpm start
```

Run Android:

```bash
pnpm android
```

Configure `ANDROID_HOME` before running Android builds.

## Validation

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Useful BFF references:

- `docs/bff-integration.md`
- `spec/bff/plan.md`
- `spec/bff/handoff.md`
- `spec/bff/tasks.md`
