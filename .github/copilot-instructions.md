## GitHub Copilot Context Guide for Skanida Apps Mobile

You are an AI coding assistant working on **Skanida Apps Mobile** (React Native + Expo + TypeScript). Use this guide to understand project-specific architecture, conventions, and workflows.

### 1. Project Architecture
- **Language:** TypeScript. Always use explicit types and import from relevant `~/types` or modules.
- **Frameworks:** Expo SDK 53, React Native 0.79, Expo Router v5, NativeWind v4, Zustand v5, Supabase-js v2.
- **Key folders:**
    - `app/`: File-based routes; layouts in `_layout.tsx`, groups `(auth)`, `(tabs)`.
    - `components/ui/`: Reusable UI components (Button, Card, Input, etc.)—**do not modify**.
    - `lib/`: `constants.ts`, Must import icons from `lucide-react-native` and then wrap with `Icon` component.
    - `store/`: One Zustand store per feature (e.g., `authStore.ts`, `attendanceStore.ts`).
    - `utils/`: `supabase.ts` (central Supabase client), `attendanceCache.ts` (AsyncStorage caching).

### 2. Styling & Utilities
- **NativeWind:** Use Tailwind utility classes in `className`;
- **Icons (updated):**
  - Import the renderer: `import { Icon } from "~/components/ui/icon"`.
  - Import icon glyphs from lucide: `import { anyLucideIconName } from "lucide-react-native"`.
  - Usage: `<Icon as={ImportedLucideIconName} className="size-5 text-blue-500" />`
  - Do not pass `size`/`color` props directly to lucide icons. Style via `className`:
    - Size mapping: 16→`size-4`, 20→`size-5`, 24→`size-6`, 32→`size-8`
    - Colors: use `text-*` utilities (e.g., `text-white`, `text-green-600`, `text-red-600`, `text-blue-500`)

Example:
```tsx
import { Icon } from "~/components/ui/icon";
import { Clock, CheckCircle, AlertCircle } from "lucide-react-native";

<Icon as={Clock} className="size-4" />
<Icon as={CheckCircle} className="size-5 text-green-600" />
<Icon as={AlertCircle} className="size-5 text-red-600" />
```

### 3. UI Components & Patterns
- **Location & Structure:** All building-block components live in `components/ui/` (e.g., `button.tsx`, `card.tsx`, `input.tsx`, `pop-up.tsx`, `icon.tsx`).
- **Variants & Styling:** Use `class-variance-authority` (`cva`) to define variant props (e.g., `buttonVariants` in `button.tsx`). Pass `variant` and `size` props and merge classes with `cn(...)`.
- **Text Context:** UI primitives wrap children with `TextClassContext` for consistent typography (e.g., `buttonTextVariants`).
- **Icons:** Use `<Icon as={SomeLucideIcon} className="..." />` as described in Styling & Utilities.
- **Usage Pattern:** Always prefer these primitives over raw `View`/`Text`. They enforce theme tokens, spacing, and accessibility roles.

### 4. Data & Supabase Integration
- **Client:** Import `supabase` from `~/utils/supabase.ts` (configured with AsyncStorage for auth persistence).
- **Database tables:**
    - `absences`: attendance records (types: `present`, `home`).
    - `perizinan`: leave requests (fields: reason, dates, file attachments).
    - `user_profiles`: additional user data (`full_name`, `avatar_url`).
- **Storage buckets:**
    - `attendance-photos`
    - `perizinan`
    - `avatars`
- **Upload pattern:** In `app/attendance/CameraAttendance.tsx`, resize with `expo-image-manipulator` (800px width, 70% quality), name file `<YYYY-MM-DD>_<timestamp>_<userId>.png`, upload to `attendance-photos`, then insert `absences` record.

### 5. Core Feature Workflows
- **Absence Reporting (`app/attendance/AbsenceReport.tsx`):**
    1. Request location permission and fetch location via `expo-location`.
    2. Calculate distance to school coords `(-7.4503, 110.2241)`, require ≤500m.
    3. Query last record in `absences` to decide `present` vs `home`.
    4. On valid location, navigate to `CameraAttendance`.
- **Leave Requests (`app/perizinan/izin.tsx`):**
    - Use custom `logger` for structured debugging with component namespacing.
    - Upload attachments to `perizinan` bucket and insert record in Supabase.

### 6. State Management & Caching
- **Zustand stores:** Each feature in `store/` (e.g., `useAuthStore`, `useAttendanceStore`).
- **Caching:** `utils/attendanceCache.ts` uses AsyncStorage to cache monthly attendance data for calendar views.

### 7. Developer Workflows & Scripts
- **Lint Problem:** Don't fix lint errors manually. Instead, run `pnpm lint` to see issues and `pnpm format` to auto-fix formatting.
- **Package manager:** pnpm (v10).
- **Scripts:**
    - `pnpm install`
    - `npx expo prebuild` (sync native config)
    - `pnpm start` (Metro dev server + Expo Router)
    - `pnpm android`, `pnpm ios`
    - `pnpm lint`, `pnpm format`
- **Build:** `eas build --local --profile preview --platform android` (via `build.sh`)
- **Path aliases:** Configured in `tsconfig.json` & `metro.config.js` for `~/`.

### 8. Error Handling & Monitoring
- **Sentry:** Initialized in `app/_layout.tsx` with session replay and error reporting.
- **Debug patterns:** Use structured logging with component context (see `perizinan/izin.tsx` logger pattern).
- **Network checks:** `ConnectionChecker` component handles offline states.

---
