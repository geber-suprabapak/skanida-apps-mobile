## GitHub Copilot Context Guide for Skanida Apps Mobile

**Skanida Apps Mobile** is a React Native attendance & leave management system for Indonesian schools (WIB timezone). Key tech: Expo SDK 53, TypeScript, NativeWind (Tailwind), Zustand, Supabase v2.

---

### 1. Project Architecture & Data Flow

**File Structure Essentials:**
- `app/`: Expo Router file-based routes. Key screens: `auth/*` (login), `attendance/*` (check-in), `perizinan/*` (leave requests), `profile/*`.
- `components/ui/`: **Never modify**—reusable primitives (`Button`, `Card`, `Text`, `Icon`, etc.) with CVA variants.
- `store/`: Zustand stores per feature: `authStore.ts` (user + profile), `themeStore.ts`, `timeSyncStore.ts`.
- `utils/`: `supabase.ts` (configured with AsyncStorage), `timeSync.ts` (WIB sync).
- `lib/`: `utils.ts` has `cn()` (classname merge) and critical `toWIB()` / `formatDateWIB()` timezone helpers.

**Auth Flow:**
1. Supabase auth session persists in AsyncStorage.
2. On login, `useAuthStore.setUser()` triggers `fetchUserProfile()` (5-retry with 500ms backoff).
3. Profile object contains `full_name`, `nis`, `class_name`, `avatar_url`, `role`.

**Database Schema (Key Tables):**
- `absences`: `{id, user_id, date, status("present"/"home"/"leave"/"sick"), check_in_time, check_out_time, photo_url, created_at, approval_status}`
- `perizinan`: `{id, user_id, category("sakit"/"cuti"/"izin"), description, attachment_url, created_at, approval_status}`
- `user_profiles`: Extended user data linked to auth via `user_id`.

---

### 2. Styling & UI Components (NativeWind + CVA)

**Text Component (Do Not Use Raw `<Text>`):**
```tsx
import { Text } from "~/components/ui/text";
// Variants: default, h1, h2, h3, h4, p, blockquote, code, lead, large, small, muted
<Text variant="h3" className="text-primary">Title</Text>
<Text variant="muted">Subtitle</Text>
```

**Icon Pattern (Lucide → Icon Wrapper):**
```tsx
import { Icon } from "~/components/ui/icon";
import { Clock, CheckCircle, AlertCircle } from "lucide-react-native";
<Icon as={Clock} className="size-4" />  // 16px
<Icon as={CheckCircle} className="size-5 text-green-600" />  // 20px
<Icon as={AlertCircle} className="size-5 text-red-600" />  // 20px
// Size map: size-4→16px, size-5→20px, size-6→24px, size-8→32px
```

**Button Variants (from `components/ui/button.tsx`):**
- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
- `size`: "default" | "sm" | "lg" | "icon"
- Always 48px+ height for touch accessibility

**CSS Utility Classname Merge:**
```tsx
import { cn } from "~/lib/utils";
className={cn("px-4 py-2", isActive && "bg-blue-500", customClass)}
```

---

### 3. State Management with Zustand

**Pattern: One store per feature (in `store/`)**

Example (`useAuthStore`):
```tsx
import useAuthStore from "~/store/authStore";
const { user, userProfile, logout, setUser } = useAuthStore();
// setUser triggers profile fetch (with retry logic)
// Access profile: userProfile?.full_name, userProfile?.avatar_url
```

**Time Sync Store:**
- `useTimeSyncStore()` tracks local↔server time offset.
- Initialize via `timeSync.initialize()` in root layout (`app/_layout.tsx`).
- Always use synced time for database queries: `timeSync.getSyncedTime()`.

---

### 4. Timezone Handling (Critical for Indonesia WIB)

**Always use helpers from `lib/utils.ts`:**
```tsx
import { toWIB, formatDateWIB } from "~/lib/utils";

// Display: convert UTC to WIB
const displayDate = toWIB(new Date());  // Add 7 hours

// Database queries: must send as YYYY-MM-DD string in WIB
const queryDate = formatDateWIB(new Date());  // "2025-10-19"

// Never do manual offset; the helpers are canonical
```

**Why:** Supabase RPC functions expect WIB date strings for daily duplicate checks. Local time != UTC.

---

### 5. Supabase RPC Functions (Core System)

**All data operations use RPC functions (not direct table access) for business logic enforcement:**

**Attendance System:**
```tsx
// Check what action user can take (check-in/check-out/none)
const { data, error } = await supabase.rpc(
  "get_and_validate_attendance_action",
  {
    p_user_id: user.id,
    p_user_lat: location.coords.latitude,
    p_user_lon: location.coords.longitude,
  }
);
// Returns: AttendanceActionResponse
// { actionable: boolean, action_type: "check_in"|"check_out"|"none", message: string }
```

```tsx
// Save attendance record after photo capture
const { data, error } = await supabase.rpc(
  "save_attendance_record",
  {
    p_user_id: user.id,
    p_action_type: "check_in", // or "check_out"
    p_photo_path: photoUrl,
    p_latitude: coords.latitude,
    p_longitude: coords.longitude,
  }
);
```

**User Management:**
```tsx
// Get student biodata during activation
const { data, error } = await supabase.rpc("get_biodata_siswa", {
  p_nis: studentId
});
```

**Dashboard Status:**
```tsx
// Live validation status for dashboard
const { data, error } = await supabase.rpc("check_absensi_status", {
  p_user_id: user.id,
  p_date_wib: formatDateWIB(new Date())
});
```

**RPC Response Patterns:**
- All RPC functions return structured data with success/error indicators
- Location validation (500m radius) built into attendance RPCs
- WIB timezone handling automatic in server functions
- Business rules enforced server-side (schedule validation, duplicate prevention)

---

### 6. Location & Mock Detection

**Mock Location Detection (Critical Security):**
```tsx
import * as Location from "expo-location";

const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.High,
});

if (location.mocked) {
  throw new Error(
    "Terdeteksi lokasi palsu. Matikan pengaturan lokasi palsu untuk melanjutkan."
  );
}
```

**Location Permission Flow:**
```tsx
let { status } = await Location.getForegroundPermissionsAsync();
if (status !== "granted") {
  status = (await Location.requestForegroundPermissionsAsync()).status;
}
if (status !== "granted") {
  throw new Error("Izin lokasi ditolak. Absensi tidak dapat dilanjutkan.");
}
```

**School Location Validation:**
- School coordinates: `(-7.4503, 110.2241)`
- Maximum distance: 500 meters
- Distance calculation handled by RPC functions
- User sees location-based error messages from server

---

### 7. Attendance Workflow (Location-Aware Check-In)

**File: `app/attendance/AbsenceReport.tsx`**

1. **Permission:** Request location (foreground) via `expo-location`.
2. **Validation:** Calculate distance to school `(-7.4503, 110.2241)` → must be ≤500m.
3. **RPC Call:** `get_and_validate_attendance_action()` returns action type ("check_in" / "check_out" / "none").
4. **Image Capture:** Navigate to `CameraAttendance` with `actionType`, `latitude`, `longitude`.
5. **Upload:** Resize image (800px, 70% quality), name as `YYYY-MM-DD_${timestamp}_${userId}.png`, upload to `attendance-photos` bucket, insert `absences` record.

**Key Handlers:**
- `getCurrentLocation()`: Requests permission, validates within 500m, throws on mock location.
- `navigateToCamera()`: Passes route params for camera screen.

---

### 8. Leave Request Workflow (Single-File Component)

**File: `app/perizinan/izin.tsx` (~1,240 lines, optimized Oct 2025)**

**Internal Subcomponents (Stay in Same File):**
- `StepIndicator`: Shows 1/3 → 2/3 → 3/3 progress.
- `SectionHeader`: Icon + title + subtitle pattern.
- `CategoryButton`: Selection UI with validation feedback.
- `DescriptionCounter`: Real-time 10–500 char validation + progress bar.
- `ImageUploadButton`: Camera/gallery picker.
- `ImagePreviewCard`: Shows file size, delete/replace controls.
- `AlertBanner`: Reusable (warning/error/success/info).
- `FormSummary`: Pre-submit validation checklist.

**Form State Pattern:**
```tsx
const [formData, setFormData] = useState<FormData>({
  category: "sakit",
  description: "",
  image: null,
});
const validation = useMemo(() => ({
  category: !!formData.category,
  description: formData.description.trim().length >= 10,
  image: !!formData.image,
}), [formData]);
```

**Validation Rules:**
- Category: required.
- Description: 10–500 chars, live counter with progress bar.
- Image: required, max 10MB, displays file size + validation badge.
- Same-day check: Prevents duplicate submissions.

---

### 9. Developer Workflows & Commands

**Setup:**
```bash
pnpm install       # or bun install
npx expo prebuild  # Sync native config (Android/iOS)
pnpm start         # or bun start (Metro dev server + hot reload)
```

**Linting & Formatting (ESLint + Prettier):**
```bash
pnpm lint      # or bun lint (Check all files)
pnpm format    # or bun format (Auto-fix)
# Pattern: never manually fix lint errors; always run pnpm format / bun format
```

**Mobile Build & Run:**
```bash
pnpm android   # or bun android (Run on Android)
pnpm ios       # or bun ios (Run on iOS)
eas build --local --profile preview --platform android  # via build.sh
```

**Path Aliases:** Configured in `tsconfig.json` & `metro.config.js`—always use `~/` prefix (e.g., `~/components/ui/button`, `~/store/authStore`).

---

### 10. Error Handling & Monitoring

**Sentry Integration (in `app/_layout.tsx`):**
- Initialized with session replay (10% sample) + error replay (100% on error).
- PII enabled; feedback integration active.
- Errors auto-reported; no manual capture needed.

**Network Resilience:**
- `ConnectionChecker` component wraps root layout; disables submission when offline.
- Supabase client configured with `autoRefreshToken: true` and AsyncStorage for auth persistence.

**Structured Logging (Seen in `izin.tsx`):**
```tsx
const logger = (componentName: string) => ({
  info: (msg: string) => console.log(`[${componentName}] ℹ️ ${msg}`),
  error: (msg: string) => console.error(`[${componentName}] ❌ ${msg}`),
  success: (msg: string) => console.log(`[${componentName}] ✅ ${msg}`),
});
const log = logger("PerizinanScreen");
log.info("Starting form submission...");
```

---

### 11. Common Patterns & Anti-Patterns

**✅ DO:**
- Use `cn()` for conditional classnames: `cn("base", condition && "variant")`.
- Import from `~/` paths; never use relative imports outside same folder.
- Call `pnpm format` or `bun format` after editing; don't manually fix lint errors.
- Use `useMemo` for computed state; `useCallback` for event handlers.
- Always check `userProfile` before accessing (may be `null` during load).

**❌ DON'T:**
- Modify `components/ui/*`; they are canonical primitives.
- Use raw `<Text>` or `<View>`; always use `<Text variant="...">` component.
- Hardcode colors; use Tailwind classes (`text-blue-500`, `bg-red-600`).
- Mix `useState` and Zustand in same component unless needed (state management at store level).
- Forget timezone conversion; always use `formatDateWIB()` for DB queries.
- Extract leave form subcomponents to separate files (single-file design for maintainability).

---

### 12. Key Dependencies & Their Roles

- **Expo Router v5:** File-based routing + typed routes (enabled in `app.json`).
- **NativeWind v4 + Tailwind:** Utility-first CSS for React Native.
- **Zustand v5:** Lightweight state management.
- **Supabase-js v2:** Database, auth, storage (AsyncStorage-backed).
- **expo-location:** Geolocation (for attendance verification).
- **expo-image-picker:** Camera/gallery access.
- **lucide-react-native:** Icons (always wrap with `<Icon>` component).
- **@sentry/react-native:** Error tracking + session replay.

---

### 13. Example: Adding a New Feature

1. **Create screen** in `app/feature/NewScreen.tsx` (Expo Router auto-routes).
2. **Add store** in `store/newStore.ts` using Zustand pattern.
3. **Use UI components** from `components/ui/` only.
4. **Import from `~/`** and use path aliases.
5. **Call `pnpm format`** or **`bun format`** before committing.
6. **Test with `pnpm start`** (Android/iOS) or `pnpm android` / `pnpm ios`. (or use `bun` equivalents)

---

*Last Updated: October 19, 2025 | Branch: feat/izin-overhaul*
