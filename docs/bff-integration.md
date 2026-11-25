# BFF Integration Guide

## Purpose

This document records the native Android client integration with Project Astra, the BFF API used by Skanida Apps Mobile.

Mobile stays thin:

- Logto owns identity, sessions, and RBAC (`Identity.kt`, `SessionStore.kt`).
- Business data and workflow decisions come from Astra (`/v1/mobile/*`).
- Database and storage internals stay hidden behind Astra.

## Active Boundary

Build configuration keys (in `.env`, environment variables, or `-P` Gradle properties):

```txt
EXPO_PUBLIC_BFF_API_URL
EXPO_PUBLIC_LOGTO_ENDPOINT
EXPO_PUBLIC_LOGTO_APP_ID
EXPO_PUBLIC_LOGTO_RESOURCE
EXPO_PUBLIC_LOGTO_REDIRECT_URI
```

Transport and typed models:

- Transport helper: `app/src/main/java/id/skanida/nativeapp/data/api/Astra.kt`
- Typed models & mappers: `app/src/main/java/id/skanida/nativeapp/data/model/AstraModels.kt`
- Workflow state & orchestration: `app/src/main/java/id/skanida/nativeapp/MainViewModel.kt`

The transport helper:

- retrieves fresh bearer tokens via `Identity.accessToken()`
- sends `Authorization: Bearer <access_token>`
- sends `X-Request-Id: native-<uuid>` and `X-Astra-Contract-Version: v1`
- validates `X-Astra-Contract-Version: v1` on every response
- unwraps Astra success envelopes and normalizes error envelopes into `AstraError`

## Current Astra Contract

```txt
GET   /v1/mobile/health
GET   /v1/mobile/dashboard
POST  /v1/mobile/attendance/precheck
POST  /v1/mobile/attendance/submit
GET   /v1/mobile/attendance
GET   /v1/mobile/face/enrollment/status
POST  /v1/mobile/face/enrollment
GET   /v1/mobile/permits
POST  /v1/mobile/permits
GET   /v1/mobile/profile
PATCH /v1/mobile/profile/avatar
PATCH /v1/mobile/profile/password
GET   /v1/mobile/notifications/token
PATCH /v1/mobile/notifications/token
POST  /v1/auth/student/signup
POST  /v1/auth/student/reset-password
```

## Validation

Required local checks:

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:lintRelease
./gradlew :app:assembleDebug :app:assembleStaging :app:assembleRelease
```
