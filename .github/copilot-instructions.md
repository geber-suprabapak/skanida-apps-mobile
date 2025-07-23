## GitHub Copilot Context Guide for Skanida Apps Mobile

You are an AI coding assistant working on **Skanida Apps Mobile** (React Native + Expo + TypeScript). Use this guide to understand project-specific architecture, conventions, and workflows.

### 1. Project Architecture
- **Language:** TypeScript. Always use explicit types and import from relevant `~/types` or modules.
- **Frameworks:** Expo SDK 53, React Native 0.79, Expo Router v5, NativeWind v4, Zustand v5, Supabase-js v2.
- **Key folders:**
    - `app/`: File-based routes; layouts in `_layout.tsx`, groups `(auth)`, `(tabs)`.
    - `components/ui/`: Reusable UI components (Button, Card, Input, etc.)—**do not modify**.
    - `lib/`: `constants.ts`, `utils.ts` (exporting `cn()`), and icon wrappers in `lib/icons/`.
    - `store/`: One Zustand store per feature (e.g., `authStore.ts`, `attendanceStore.ts`).
    - `utils/`: `supabase.ts` (central Supabase client), `attendanceCache.ts` (AsyncStorage caching).

### 2. Styling & Utilities
- **NativeWind:** Use Tailwind utility classes in `className`; merge conditionally with `cn(...)` from `~/lib/utils.ts`.
- **Icons:** Import from `~/lib/icons/<IconName>.tsx`; these wrap `lucide-react-native` icons to accept `className`.

### 3. Data & Supabase Integration
- **Client:** Import `supabase` from `~/utils/supabase.ts`.
- **Database tables:**
    - `absences`: attendance records (types: `present`, `home`).
    - `perizinan`: leave requests (fields: reason, dates, file attachments).
    - `user_profiles`: additional user data (`full_name`, `avatar_url`).
- **Storage buckets:**
    - `attendance-photos`
    - `perizinan`
    - `avatars`
- **Upload pattern:** In `app/attendance/CameraAttendance.tsx`, resize with `expo-image-manipulator` (800px width, 70% quality), name file `<YYYY-MM-DD>_<timestamp>_<userId>.png`, upload to `attendance-photos`, then insert `absences` record.

### 4. Core Feature Workflows
- **Absence Reporting (`app/attendance/AbsenceReport.tsx`):**
    1. Request location permission and fetch location via `expo-location`.
    2. Calculate distance to school coords `(-7.4503, 110.2241)`, require ≤500m.
    3. Query last record in `absences` to decide `present` vs `home`.
    4. On valid location, navigate to `CameraAttendance`.
- **Leave Requests (`app/perizinan/izin.tsx`):**
    - Use custom `logger` for structured debugging.
    - Upload attachments to `perizinan` bucket and insert record in Supabase.

### 5. State Management & Caching
- **Zustand stores:** Each feature in `store/` (e.g., `useAuthStore`, `useAttendanceStore`).
- **Caching:** `utils/attendanceCache.ts` uses AsyncStorage to cache monthly attendance data for calendar views.

### 6. Developer Workflows & Scripts
- **Package manager:** pnpm (v10).
- **Scripts (pwsh):**
    - `pnpm install`
    - `npm run prebuild` or `npx expo prebuild` (sync native config)
    - `pnpm start` (Metro dev server + Expo Router)
    - `pnpm android`, `pnpm ios`
    - `pnpm lint`, `pnpm format`
- **Path aliases:** Configured in `tsconfig.json` & `metro.config.js` for `~/`.

---
