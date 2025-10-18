# Dokumentasi Timezone WIB (UTC+7)

## 📅 Sistem Timezone Aplikasi

Aplikasi ini menggunakan **WIB (Waktu Indonesia Barat / UTC+7)** secara konsisten di seluruh sistem untuk menghindari inkonsistensi timezone dari device pengguna.

## 🔧 Utility Functions

Di `lib/utils.ts`, tersedia fungsi-fungsi berikut:

### `getWIBDate(): Date`
Mengembalikan objek Date yang sudah dikonversi ke timezone WIB (UTC+7).

```typescript
const wibNow = getWIBDate();
console.log(wibNow); // Date object in WIB timezone
```

### `getWIBDateString(): string`
Mengembalikan tanggal WIB dalam format `YYYY-MM-DD` (untuk query database).

```typescript
const today = getWIBDateString();
console.log(today); // "2025-10-02"
```

### `getWIBISOString(): string`
Mengembalikan ISO string UTC (untuk timestamp audit).

```typescript
const timestamp = getWIBISOString();
console.log(timestamp); // "2025-10-02T03:45:30.123Z"
```

## 📍 Implementasi

### 1. **Dashboard** (`app/Dashboard.tsx`)
- ✅ Menggunakan `getWIBDateString()` untuk query attendance hari ini
- ✅ Status "Hari Ini" berdasarkan tanggal WIB, bukan device timezone

### 2. **Camera Attendance** (`app/attendance/CameraAttendance.tsx`)
- ✅ Menyimpan record dengan tanggal WIB ke database
- ✅ Filename foto menggunakan format tanggal WIB
- ✅ Timestamp tetap ISO UTC untuk audit trail

### 3. **Riwayat Kehadiran** (`components/ui/attendance-calendar/utils.ts`)
- ✅ Kalender menggunakan WIB untuk menentukan "hari ini"
- ✅ Perbandingan tanggal menggunakan WIB sebagai reference

### 4. **Calendar Hooks** (`components/ui/attendance-calendar/hooks.ts`)
- ℹ️ Query menggunakan date field (YYYY-MM-DD) yang sudah WIB
- ℹ️ Display time menggunakan `toLocaleTimeString` dengan locale Indonesia

## ⚠️ Catatan Penting

1. **Field Database:**
   - `date` (DATE): Tanggal WIB dalam format `YYYY-MM-DD`
   - `created_at` (TIMESTAMP): ISO UTC string untuk audit
   
2. **Konsistensi:**
   - Semua operasi date comparison menggunakan WIB
   - Tidak ada lagi dependensi ke timezone device pengguna
   
3. **Testing:**
   - Test dengan device di timezone berbeda (misal: Singapura UTC+8, Bangkok UTC+7)
   - Pastikan tanggal "hari ini" tetap konsisten dengan WIB

## 🎯 Manfaat

- ✅ **Konsistensi**: Semua pengguna melihat data berdasarkan timezone Indonesia
- ✅ **Akurat**: Tidak ada lagi mismatch antara save dan display
- ✅ **Reliable**: Tidak bergantung pada setting timezone device pengguna
- ✅ **Maintainable**: Satu sumber kebenaran untuk semua operasi date/time

## 🔄 Migration Notes

Perubahan ini **backward compatible** karena:
- Database field `date` sudah menggunakan format YYYY-MM-DD
- Query tetap menggunakan format yang sama
- Hanya logic penentuan "today" yang berubah dari device local ke WIB

---

**Updated:** October 2, 2025  
**Version:** 1.1.0-openbeta.1
