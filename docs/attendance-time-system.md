# Sistem Jam Absen Implementation

## Overview
Implementasi sistem validasi jam absen masuk dan pulang untuk aplikasi Skanida Apps yang mencakup validasi client-side dan server-side dengan Row Level Security (RLS) di Supabase.

## Features Implemented

### 1. Client-Side Time Validation (`lib/utils.ts`)
- ✅ Fungsi `checkAttendanceTime()` yang memvalidasi waktu berdasarkan jadwal sekolah
- ✅ Support untuk jadwal berbeda per hari (berdasarkan jadwal sekolah aktual):
  - **Senin (SENIN)**: Masuk 07:00-07:45, Pulang 15:00-16:00
  - **Selasa-Kamis (SELASA, RABU, KAMIS)**: Masuk 07:00-07:45, Pulang 15:15-16:00  
  - **Jumat (JUMAT)**: Masuk 07:00-07:45, Pulang 11:30-12:00
  - **Weekend**: Tidak diizinkan
- ✅ Return type `AttendanceTimeResult` dengan `canCheckIn` dan `canCheckOut`

### 2. UI Integration (`app/attendance/AbsenceReport.tsx`)
- ✅ Validasi waktu sebelum pengecekan lokasi
- ✅ Status baru `time_outside` untuk tracking validasi waktu
- ✅ Alert dan UI feedback yang informatif
- ✅ Pesan error: "Di luar jam absen. Silakan cek jadwal Anda."

### 3. Server-Side Validation (Supabase)
- ✅ PostgreSQL function `is_valid_attendance_time()` **now queries `time` table dynamically**
- ✅ RLS Policy `absences_insert_with_time_validation`
- ✅ Support timezone Asia/Jakarta
- ✅ Validasi untuk status 'Hadir', 'Datang', dan 'Pulang'
- ✅ **Dynamic schedule** - reads from `time` table in database
- ✅ Fallback to hardcoded values if table is empty

## Files Modified/Created

### Modified
1. `lib/utils.ts` - Added `checkAttendanceTime()` function
2. `app/attendance/AbsenceReport.tsx` - Added time validation integration
3. `supabase/schema.sql` - Added PostgreSQL function and updated RLS policy

### Created
1. `supabase/attendance-time-validation.sql` - Standalone SQL for time validation
2. `supabase/test-attendance-time-function.sql` - Test queries for validation

## Usage

### Client-Side
```typescript
import { checkAttendanceTime } from "~/lib/utils";

const timeCheck = checkAttendanceTime();
const canCheckIn = timeCheck.canCheckIn;
const canCheckOut = timeCheck.canCheckOut;
```

### Server-Side (Supabase)
```sql
-- Test the function
SELECT public.is_valid_attendance_time(
  '2024-01-08 07:30:00+07'::timestamptz, 
  'Hadir'
);
```

## Database Migration

1. Run the SQL in `supabase/schema.sql` (updated version)
   OR
2. Run the SQL in `supabase/attendance-time-validation.sql` separately

## Testing

### Client-Side Testing
Function tested with various scenarios (updated with actual schedule):
- ✅ Monday 7:30 AM (check-in): `{ canCheckIn: true, canCheckOut: false }`
- ✅ Monday 3:30 PM (check-out): `{ canCheckIn: false, canCheckOut: true }`
- ✅ Tuesday 3:30 PM (check-out): `{ canCheckIn: false, canCheckOut: true }`
- ✅ Friday 11:45 AM (check-out): `{ canCheckIn: false, canCheckOut: true }`
- ✅ Monday 10:00 AM (outside): `{ canCheckIn: false, canCheckOut: false }`
- ✅ Saturday (weekend): `{ canCheckIn: false, canCheckOut: false }`

### Server-Side Testing
Use `supabase/test-attendance-time-function.sql` to validate PostgreSQL function.

## Security

- ✅ Client-side validation untuk UX yang baik
- ✅ Server-side validation di RLS untuk security
- ✅ Function menggunakan timezone Asia/Jakarta
- ✅ Validasi pada tingkat database mencegah bypass
- ✅ **Dynamic schedule reading** - Server-side function now queries `time` table

## Database Integration

### Time Table Structure
The server-side PostgreSQL function now reads from the `time` table which has the following structure:
- `id`: uuid (primary key)
- `day_of_week`: varchar (e.g., "SENIN", "SELASA, RABU, KAMIS", "JUMAT")
- `start_time`: time (start of class period)
- `end_time`: time (end of class period)
- `description`: varchar (e.g., "UPACARA", "JAM KE 1", etc.)

### How It Works
1. **Check-in validation**: Queries the earliest `start_time` for the day and allows check-in up to 45 minutes after that time
2. **Check-out validation**: Queries the latest `end_time` for the day and allows check-out from 30 minutes before until 45 minutes after
3. **Fallback**: If the `time` table is empty or no schedule is found, the function falls back to hardcoded default times

### Benefits
- ✅ Schedule can be updated in Supabase without code changes
- ✅ Different schedules for special events can be added to the table
- ✅ Client-side keeps using efficient hardcoded validation for immediate feedback
- ✅ Server-side ensures data integrity with database-driven validation

## Future Enhancements

1. ~~Dynamic schedule configuration via database~~ ✅ **IMPLEMENTED** (server-side)
2. Holiday calendar integration  
3. Special schedule for school events (now possible by adding records to `time` table)
4. Attendance exception management for administrators
5. Client-side schedule fetching and caching from `time` table