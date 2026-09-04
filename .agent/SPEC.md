# Objective

Execute all remediation phases (Phases 1–4) documented in `docs/UI_AUDIT_REPORT.md` for `skanida-apps-mobile` to resolve all 47 verified findings (7 P0, 15 P1, 16 P2, 9 P3), elevate the Audit Health Score from 6/20 to >= 18/20, and achieve full native platform conformance (iOS HIG & Android Material 3).

# Requirements

## Phase 1: Hardening & Integrity Restoration (P0 Blockers)
- [ ] **Keyboard Occlusion**: Wrap `app/profile/ManageAccount.tsx` and `app/perizinan/izin.tsx` in `KeyboardAvoidingView` (with proper iOS `behavior="padding"` and offset) so inputs and submit buttons remain visible when virtual keyboard opens.
- [ ] **Purge Test Fixtures from Production**: Remove `face_sample.jpg` file interception logic from `app/attendance/CameraAttendance.tsx` (lines 334–351) and `app/profile/enroll.tsx` (lines 509–521).
- [ ] **Eliminate Fatal iOS Exit Trap**: Remove `BackHandler.exitApp()` on iOS in `components/ConnectionChecker.tsx` (line 88); replace non-cancelable fatal alert with a non-blocking offline banner.
- [ ] **Camera Permission Denial Recovery**: Add `Linking.openSettings()` recovery button to camera permission denied screen in `app/attendance/CameraAttendance.tsx` (lines 460–490).
- [ ] **Fix Component Ref Forwarding**: Wrap primitives (`Input`, `Card`, `Badge`, `Text`) in `React.forwardRef` and attach explicit `displayName`.
- [ ] **Fix Android Back Trapping**: Ensure `hardwareBackPress` handlers in `app/auth/Login.tsx`, `app/auth/Activate.tsx`, and `app/auth/ResetPassword.tsx` check `router.canGoBack()` before returning `true`.
- [ ] **Fix Modal Dismissal**: Add `onRequestClose` to Modal in `components/ui/pop-up.tsx` (line 277).
- [ ] **Fix Password Validation Contradiction**: Align password requirement copy and regex in `app/profile/ManageAccount.tsx` (line 801).

## Phase 2: Platform Adaptivity & Navigation Architecture
- [ ] **Native Bottom Tab Navigation**: Introduce native tabs (`app/(tabs)/_layout.tsx`) connecting Dashboard, Riwayat, Perizinan, and Pengaturan without trapping users in push stacks.
- [ ] **Restore Native Stack Headers**: Configure native `Stack.Screen` headers in `_layout.tsx` to restore native iOS back-swipe and Android Predictive Back gestures.
- [ ] **Safe Area Inset Clearance**: Correct bottom safe-area insets on `app/attendance/CameraAttendance.tsx` shutter controls and avatar bottom sheet in `app/profile/ManageAccount.tsx` to clear the 34pt iOS Home Indicator.
- [ ] **Tablet/Foldable Constraints**: Constrain tablet widths to `max-w-2xl mx-auto` on `Dashboard.tsx`, `status.tsx`, and `pengaturan.tsx`.
- [ ] **Fix Touch Target Sizing**: Remove inverted `sm:h-9` classes in `button.tsx` and `input.tsx`; enforce minimum 48px heights.
- [ ] **Dynamic Type Scaling Safeguards**: Add `maxFontSizeMultiplier={1.3}` to protect large clock headings and status cards from text clipping.

## Phase 3: Design Tokens & Visual Harmonization
- [ ] **Synchronize Root Tokens**: In `global.css`, set `--color-primary` to Electric Blue `#0066FF` (`hsl(216 100% 50%)`).
- [ ] **Enforce Biometric Blue Rule**: Recolor Dashboard hero card to Midnight Slate (`#0F172A`) and navigation buttons to Soft Stone (`#F5F5F5` / `#171717`); reserve Electric Blue strictly for biometric verification and primary attendance submission.
- [ ] **Fix Dark Mode Contrast**: Purge hardcoded `bg-white` input backgrounds in `app/auth/Activate.tsx`; add dark mode tokens to `AlertBanner`.
- [ ] **Purge Ad-Hoc Grays**: Replace raw Tailwind `gray-*` classes with semantic tokens (`bg-card`, `bg-background`, `border-border`).
- [ ] **Border-First Elevation**: Replace `border-[3px]` with subtle 1px `border border-border` in `app/extra/riwayat.tsx`.
- [ ] **Expand Badge Variants**: Add semantic variants (`hadir`, `terlambat`, `izin`, `sakit`) to `components/ui/badge.tsx`.

## Phase 4: Ergonomics, Performance & Polish
- [ ] **Universal 48x48dp Touch Targets**: Ensure all icon buttons, back buttons, and switches have at least 48x48dp touch clearance (`hitSlop` / `min-h-[48px]`).
- [ ] **Screen Reader Accessibility**: Add complete `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` to all interactive controls; add `AccessibilityInfo.announceForAccessibility` for camera capture events.
- [ ] **Respect Reduce Motion**: Bypass 60-node confetti animation in `components/ui/pop-up.tsx` when `AccessibilityInfo.isReduceMotionEnabled()` is true.
- [ ] **Attachment Image Compression**: Downscale permit attachments using `expo-image-manipulator` (max 1280px, 0.7 JPEG quality) before upload.
- [ ] **Eliminate Base64 Regex Main-Thread Lag**: Offload or streamline base64 image parsing in `features/attendance-workflow`.
- [ ] **Virtualize History List**: Replace unvirtualized mapping in `app/extra/riwayat.tsx` with `FlatList` and `getItemLayout`.
- [ ] **Replace RN Image**: Use `expo-image` across all avatar and logo components for caching and smooth loading.
- [ ] **Native Material Ripple**: Configure `android_ripple` on `Pressable` primitives.
- [ ] **UX Copy Localization**: Replace residual informal slang (`"This screen ga ada, how?"`) with clean Bahasa Indonesia (`"Halaman Tidak Ditemukan"`).

# Acceptance Criteria
- [ ] All 7 P0 blockers resolved with zero regressions.
- [ ] Re-running `/impeccable audit` achieves an Audit Health Score of >= 18/20 (Rating Band: Excellent).
- [ ] Typecheck (`pnpm exec tsc --noEmit`) passes with 0 errors.
- [ ] Linter (`pnpm lint`) passes.
- [ ] Test suites (`npm test` / `pnpm test`) pass 100%.

# Constraints
- Must adhere strictly to domain language in `CONTEXT.md` ("Attendance Workflow", "Leave Request", "Face Enrollment", "Attendance").
- Must adhere strictly to `DESIGN.md` ("The Digital Student Pass", Electric Blue `#0066FF`, Midnight Slate `#0F172A`, 48dp touch target minimum).
- Client remains thin: all business logic goes through Project Astra BFF (`/v1/mobile/...`). No direct Supabase calls.
- Portrait orientation only.

# Relevant Areas
- `app/Dashboard.tsx`
- `app/attendance/CameraAttendance.tsx`, `AbsenceReport.tsx`
- `app/profile/enroll.tsx`, `ManageAccount.tsx`
- `app/perizinan/izin.tsx`, `status.tsx`
- `app/extra/riwayat.tsx`, `pengaturan.tsx`
- `app/auth/Login.tsx`, `Activate.tsx`, `AuthSelector.tsx`, `ResetPassword.tsx`, `callback.tsx`
- `components/ui/*` (`button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `text.tsx`, `pop-up.tsx`)
- `components/ConnectionChecker.tsx`
- `global.css`
- `docs/UI_AUDIT_REPORT.md`

# Implementation Notes
Execution organized into 4 sequential phases, tracked via `.agent/TRACKER.md` and handed off via `.agent/HANDOFF.md`. Each phase undergoes incremental validation (`tsc`, `lint`, `test`).
