# Timezone Double-Offset Fix

## Problem
Aplikasi menampilkan waktu **+7 jam lebih cepat** dari waktu sebenarnya.

**Contoh:**
- Waktu sebenarnya: **10:22 WIB**
- Yang ditampilkan: **17:22** ❌

## Root Cause

### Kesalahan Konsep: Double Timezone Conversion

JavaScript `Date` object **otomatis** mengkonversi ke timezone device saat di-display:

```typescript
// WRONG - Double offset!
const utcDate = timeSync.getSyncedTime(); // UTC time dari server
const wibDate = toWIB(utcDate);           // Tambah +7 jam manual
format(wibDate, "HH:mm:ss");              // Device timezone (+7) applied again!
// Result: UTC + 7 + 7 = UTC+14 ❌
```

### Flow yang Salah (Before):

1. **Server** mengirim: `03:22 UTC` (= 10:22 WIB)
2. **timeSync.getSyncedTime()** returns: `Date` object representing `03:22 UTC`
3. **toWIB()** adds 7 hours: `10:22 UTC` 
4. **Device timezone (WIB)** auto-converts saat display: `10:22 UTC` → `17:22 WIB` ❌

### Flow yang Benar (After):

1. **Server** mengirim: `03:22 UTC` (= 10:22 WIB)
2. **timeSync.getSyncedTime()** returns: `Date` object representing `03:22 UTC`
3. **Device timezone (WIB)** auto-converts saat display: `03:22 UTC` → `10:22 WIB` ✅

## Solution

### ❌ JANGAN Gunakan `toWIB()` untuk Display

```typescript
// WRONG ❌
const displayTime = toWIB(timeSync.getSyncedTime());
```

### ✅ GUNAKAN Date Object Langsung

```typescript
// CORRECT ✅
const displayTime = timeSync.getSyncedTime();
// Date object akan otomatis ditampilkan dalam timezone device
```

## Updated Pattern

### 1. Display Time (Dashboard, UI)

```typescript
// Get server time
const currentTime = timeSync.getSyncedTime();

// Format untuk display - otomatis WIB di device WIB
const formatted = format(currentTime, "HH:mm:ss", { locale: id });
// Result: "10:22:00" ✅
```

### 2. Date for Database Queries

```typescript
// Get today's date in WIB timezone
const today = formatDateWIB(timeSync.getSyncedTime());
// Result: "2025-10-03" ✅

// Query database
supabase.from('absences').eq('date', today);
```

### 3. Timestamp for Filenames

```typescript
const now = timeSync.getSyncedTime();

// Extract components (auto dalam device timezone)
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");

const filename = `${day}${month}${year}_${now.getTime()}.jpg`;
// Result: "03102025_1696305720000.jpg" ✅
```

## When to Use `toWIB()`

**HANYA** untuk `formatDateWIB()` internal implementation:

```typescript
// lib/utils.ts
export function formatDateWIB(date: Date): string {
  const wibDate = toWIB(date); // Convert untuk extract date components
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

**Alasan:** Kita pakai `.getUTCFullYear()` dll, jadi perlu shift +7 jam dulu agar UTC components = WIB date.

## Files Updated

### ✅ Fixed Files:
- `app/Dashboard.tsx` - Removed `toWIB()` from display logic
- `app/attendance/CameraAttendance.tsx` - Removed `toWIB()` from timestamps
- `lib/utils.ts` - Kept `toWIB()` only for internal use

### ✅ Already Correct:
- `utils/timeSync.ts` - Correctly uses UTC from server
- `components/ui/pop-up.tsx` - Uses `getSyncedTime()` directly
- `components/ui/attendance-calendar/utils.ts` - Uses `formatDateWIB()` correctly

## Key Takeaways

1. **JavaScript Date objects are timezone-aware** - mereka otomatis convert ke local timezone saat di-display
2. **timeSync.getSyncedTime()** returns UTC `Date` object - **sudah siap pakai** untuk display
3. **toWIB()** hanya untuk internal date arithmetic - **JANGAN** untuk display
4. **formatDateWIB()** untuk database queries - returns string `YYYY-MM-DD` dalam WIB timezone

## Testing

### Before Fix:
```
Waktu server: 10:22 WIB (03:22 UTC)
Waktu ditampilkan: 17:22 ❌
```

### After Fix:
```
Waktu server: 10:22 WIB (03:22 UTC)
Waktu ditampilkan: 10:22 ✅
```

---

**Status:** ✅ FIXED
**Date:** 2025-10-03
**Impact:** Critical - Attendance time accuracy
