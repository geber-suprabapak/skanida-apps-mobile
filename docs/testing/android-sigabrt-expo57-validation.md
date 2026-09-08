# Android SIGABRT / Expo SDK 57 physical-device validation

## Purpose

This checklist validates the first Expo SDK 57 tester build after the Sentry
Hermes-profiler mitigation and upgrade. The build is deliberately shipped with
Sentry profiling disabled while the framework migration is being validated:

- \`profilesSampleRate = 0\`
- \`enableTombstone = true\` on Android, when supported by the installed SDK
- Sentry error/crash reporting, tracing, and existing Replay configuration remain enabled

The historical SIGABRT is suspected to involve Hermes sampling-profiler teardown
during React runtime destruction or an Expo Updates reload. That mechanism is
not considered confirmed unless a native stack or tombstone identifies the
profiler path. OEM and Android-version priorities below are test priorities,
not a conclusion that a manufacturer is the root cause.

## Build information

Complete this section from the exact artifact under test. Do not infer values
from a different build.

| Field                          | Value                                                   |
| ------------------------------ | ------------------------------------------------------- |
| App version                    |                                                         |
| Build number / \`versionCode\` |                                                         |
| Git commit                     |                                                         |
| Branch                         |                                                         |
| Expo SDK                       | \`57.x\`                                                |
| React Native                   | \`0.86.x\`                                              |
| \`@sentry/react-native\`       | \`8.13.0\` or exact resolved build value                |
| Android ABI                    | \`arm64-v8a\`, \`armeabi-v7a\`, or exact artifact value |
| EAS/build profile              |                                                         |
| Build date/time                |                                                         |
| Tester                         |                                                         |
| Sentry environment/release     |                                                         |

Before testing, verify that the artifact is the intended build and that its
release metadata is recorded. The source branch currently keeps profiling at
zero; do not use a later profiling-canary build for this checklist.

## Priority devices

Test at least one physical Android device from the first group when available:

1. Infinix, itel, or TECNO/another Transsion-family device, especially Android 12.
2. Vivo, especially Android 12.
3. A second physical Android device with a different manufacturer and Android version.

Any physical Android device is useful when the priority devices are
unavailable. Record the manufacturer, model, Android version, ABI, and battery
or optimization settings. Do not treat an OEM match as proof of causation.

## Test prerequisites

- Install the exact APK/AAB-derived build identified above.
- Use a test account and test data appropriate for camera/upload validation.
- Confirm that the device has a usable camera and enough storage.
- Have a known-good network path and a safe way to interrupt connectivity.
- Have screen recording available, but stop and save it at the first failure.
- If an OTA test update is not available, mark the OTA scenario **N/A**. Do not
  fabricate or publish an update solely for this checklist.

## Pass and failure rules

A pass requires that the app remains usable through the assigned scenarios,
returns from background/lock/reload without a process crash, and reports any
native crash to Sentry when connectivity and build credentials allow it.

If the app crashes, aborts, restarts unexpectedly, or shows a native fatal
dialog:

1. Stop the scenario immediately.
2. Record the approximate timestamp and the last user action.
3. Save the screen recording and any available Android crash-buffer output.
4. Submit the failure report below before continuing any stress testing.

The first failure is the most valuable observation. Continuing after it can
overwrite timing and log evidence.

## Manual scenarios

### 1. Cold launch

1. Force-stop the app from Android settings or the launcher app-info screen.
2. Launch the app.
3. Log in with the test account.
4. Reach the main application screen and wait for it to settle.
5. Repeat the force-stop and launch sequence at least five times.

Record any crash during process start, login, navigation, or initial data load.

### 2. Background and foreground

1. Open the app and reach a stable main screen.
2. Send the app to the background.
3. Wait at least 10 seconds.
4. Return to the app and verify that the current screen is usable.
5. Repeat at least 20 background/foreground cycles.

Include cycles from a normal screen and, if safe, after visiting a camera
screen. Do not intentionally kill the process unless the scenario says so.

### 3. Lock and unlock

1. Keep the app open on a stable screen.
2. Lock the device.
3. Wait at least 10 seconds.
4. Unlock the device and return to the app.
5. Repeat at least five times.

Record whether Android recreated the activity or returned to the same screen.

### 4. Attendance camera

1. Open the attendance camera.
2. Wait for the preview to become stable.
3. Capture an attendance image.
4. Submit/upload it and wait for the result.
5. Return to the previous screen.
6. Reopen the attendance camera and repeat the capture/submit flow at least
   three to five times.

Record whether the preview, capture, upload, or return navigation was active at
the time of any failure.

### 5. Rapid camera lifecycle

Repeat the following sequence at least 10 times:

1. Open the camera.
2. Back out before capturing an image.
3. Reopen the camera.
4. Capture an image.
5. Back out after capture, before or during the next transition.

Allow the UI to settle between repetitions and note any preview or permission
state that differs from the previous cycle.

### 6. Face enrollment

Exercise the complete supported face-enrollment flow, including all required
image captures and the final submission.

Also perform these subcases where the product supports them:

- cancel midway through enrollment;
- resume or restart the flow;
- navigate away during or immediately after image capture;
- complete a second enrollment attempt if the test account permits it.

Do not change image count or image-quality settings for this validation.

### 7. Network interruption

Where safe and without corrupting test data:

1. Begin an image upload or other supported network operation.
2. Disable Wi-Fi/mobile data or otherwise interrupt the test device network.
3. Observe the in-app failure state.
4. Restore connectivity.
5. Retry using the supported recovery action.

Verify that the failure/retry path does not terminate the process. Record
whether the camera was still mounted when connectivity was interrupted.

### 8. Expo Updates reload

Run this scenario only when a real test OTA update is available.

1. Launch the app with the camera closed.
2. Check for an update.
3. Download the update and apply/reload it using the app's normal flow.
4. Verify that the updated app starts and the main screen is usable.
5. Repeat the update/reload flow after previously visiting a camera screen.

If the test deployment has no OTA update, record **N/A — no test OTA
available**. Do not substitute a fabricated update. Capture the exact release
or update identifier if one is provided by the deployment owner.

### 9. Long-running session

Use the app normally for at least 20–30 minutes. During the session, exercise
several navigation paths, at least one camera flow, and background/foreground
cycles. Note the approximate time of any delayed UI, reload, or crash.

### 10. Relaunch stress

Repeat a reasonable stress cycle, such as 10 repetitions:

\`\`\`text
launch → use camera or update-related flow → background → foreground
→ close/force-stop → relaunch
\`\`\`

Use the same account and do not continue after the first crash without saving
the failure evidence.

## Failure report — submit the first failure first

Copy this template into the test result or issue. Fill in as much as possible
without including tokens, authentication headers, or unnecessary personal
data.

\`\`\`text
Device manufacturer:
Device model:
Android version:
App version:
Build/versionCode:
Approximate timestamp:
Current screen/route:
Previous action:
Was camera active?:
Was image upload active?:
Was an OTA update/reload happening?:
Was app backgrounded recently?:
Network state:
Battery state if relevant:
Crash observed?:
App auto-restarted?:
Sentry event ID/link if available:
Video/screen recording:
Additional notes:
\`\`\`

If a Sentry event is available, provide only the event ID or approved Sentry
link. Never paste \`SENTRY_AUTH_TOKEN\`, auth headers, cookies, or private API
responses into a report.

## Optional engineer-assisted Android logging

These commands are for an engineer or tester who has ADB access. They collect a
bounded crash buffer and device facts; they do not require application tokens.
Run them immediately after the first reproduction, before continuing tests.

From PowerShell:

\`\`\`powershell
adb devices
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.product.cpu.abilist

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
adb logcat -b crash -v threadtime -d -t 500 |
  Tee-Object -FilePath "android-crash-$stamp.log"

# Replace <application-id> with the package id shown by the build metadata.

adb shell dumpsys activity exit-info <application-id> |
Tee-Object -FilePath "android-exit-info-$stamp.log"
\`\`\`

The \`crash\` buffer command is intentionally bounded. Do not clear log buffers
before capture, and do not dump unrelated full-device logs. Redact application
data before sharing logs outside the approved engineering channel. If the
device or Android version does not support \`dumpsys activity exit-info\`, record
that it was unavailable and continue with the crash buffer.

## Test result

| Scenario               | Result (Pass/Fail/N/A) | Timestamp / notes | Tester initials |
| ---------------------- | ---------------------- | ----------------- | --------------- |
| Cold launch            |                        |                   |                 |
| Background/foreground  |                        |                   |                 |
| Lock/unlock            |                        |                   |                 |
| Attendance camera      |                        |                   |                 |
| Rapid camera lifecycle |                        |                   |                 |
| Face enrollment        |                        |                   |                 |
| Network interruption   |                        |                   |                 |
| Expo Updates reload    |                        |                   |                 |
| Long-running session   |                        |                   |                 |
| Relaunch stress        |                        |                   |                 |

Tester sign-off: **\*\*\*\***\_\_\_\_**\*\*\*\*** Date: **\*\*\*\***\_\_\_\_**\*\*\*\***

Engineer review / Sentry event correlation: **\*\***\*\***\*\***\_\_\_\_**\*\***\*\***\*\***
