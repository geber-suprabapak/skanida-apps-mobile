# Time Synchronization Documentation

## Overview

Aplikasi Skanida Apps Mobile menggunakan sinkronisasi waktu dengan server untuk memastikan konsistensi waktu di seluruh aplikasi, terutama untuk fitur-fitur yang sensitif terhadap waktu seperti absensi.

## Architecture

### Time Sync Utility (`utils/timeSync.ts`)

Singleton class yang mengelola sinkronisasi waktu dengan server melalui Supabase Edge Function.

**Key Features:**

- **Server Time Sync**: Menggunakan edge function `timesync` untuk mendapatkan waktu server (UTC+7)
- **Network Delay Compensation**: Menghitung round-trip time untuk kompensasi delay jaringan
- **Auto Re-sync**: Otomatis re-sync setiap 5 menit
- **Fallback Graceful**: Jika sync gagal, tetap menggunakan waktu lokal sebagai fallback

**API:**

```typescript
// Get synchronized time
const currentTime = timeSync.getSyncedTime();

// Force immediate sync
await timeSync.syncWithServer();

// Force sync (ignore cooldown)
await timeSync.forceSyncWithServer();

// Get current offset
const offset = timeSync.getTimeOffset();
```

## Integration Points

### 1. Application Bootstrap (`app/_layout.tsx`)

Sinkronisasi waktu dimulai saat aplikasi pertama kali dibuka:

```typescript
useEffect(() => {
  timeSync.syncWithServer().catch((error) => {
    console.error("Initial time sync failed:", error);
  });
}, []);
```

### 2. Dashboard (`app/Dashboard.tsx`)

- Menampilkan waktu real-time yang tersinkronisasi
- Re-sync saat screen fokus
- Force sync saat pull-to-refresh
- Visual indicator (abu-abu = synced, kuning = lokal)

### 3. Camera Attendance (`app/attendance/CameraAttendance.tsx`)

- Penamaan file foto menggunakan waktu server
- Timestamp absensi menggunakan waktu server
- Display waktu saat success menggunakan waktu server

### 4. Success Popup (`components/ui/pop-up.tsx`)

- Menampilkan waktu saat absensi berhasil

### 5. Utility Functions (`lib/utils.ts`)

Semua fungsi utilitas waktu WIB menggunakan waktu server sebagai basis:

- `getWIBDate()`: Mendapatkan Date object WIB dari waktu server
- `getWIBDateString()`: Format YYYY-MM-DD dari waktu server
- `getWIBISOString()`: ISO string dari waktu server

### 6. Attendance Cache (`utils/attendanceCache.ts`)

- Menggunakan waktu server untuk menentukan bulan saat ini
- Force refresh menggunakan waktu server

### 7. Month Year Picker (`components/ui/month-year-picker.tsx`)

- Default maximum date menggunakan waktu server
- Range tahun menggunakan waktu server

## Edge Function Endpoint

**URL:** `https://stagingdb.hyacine.my.id/functions/v1/timesync`

**Response Format:**

```json
{
  "serverTime": "2025-10-03T02:52:05.672Z",
  "serverTimeUTC7": "2025-10-03T09:52:05.672Z",
  "formattedUTC7": "03/10/2025, 16.52.05"
}
```

## How It Works

### Initial Sync Flow

1. App boots → `_layout.tsx` triggers `timeSync.syncWithServer()`
2. Edge function dipanggil untuk mendapatkan waktu server
3. Round-trip time dihitung
4. Offset waktu disimpan: `offset = serverTime + (RTT/2) - clientTime`
5. Semua `getSyncedTime()` menggunakan: `new Date(Date.now() + offset)`

### Re-sync Strategy

- **Automatic**: Setiap 5 menit jika `getSyncedTime()` dipanggil
- **On Focus**: Saat Dashboard menjadi fokus
- **Manual**: Pull-to-refresh di Dashboard
- **Force**: Bisa dipaksa dengan `forceSyncWithServer()`

### Network Delay Compensation

```typescript
const requestTime = Date.now();
// ... call server ...
const responseTime = Date.now();
const roundTripTime = responseTime - requestTime;

// Estimate server time accounting for network delay (assume symmetric)
const estimatedServerTime = serverTime + roundTripTime / 2;
```

## Benefits

### 1. Consistency

- Semua user melihat waktu yang sama regardless zona waktu device
- Absensi tercatat dengan waktu yang konsisten

### 2. Accuracy

- Kompensasi network delay untuk akurasi lebih baik
- Tidak terpengaruh setting waktu device yang salah

### 3. Reliability

- Fallback ke waktu lokal jika sync gagal
- Visual indicator untuk user awareness
- Auto retry dengan exponential backoff

### 4. Performance

- Sync hanya setiap 5 menit, bukan setiap render
- Lightweight offset calculation
- Minimal network usage

## Testing

### Manual Testing

1. Ubah waktu device ke masa lalu/depan
2. Buka app dan lihat Dashboard
3. Waktu yang ditampilkan harus sesuai waktu server, bukan device
4. Cek logs untuk konfirmasi sync berhasil

### Error Scenarios

- **No internet**: Fallback ke waktu lokal, indicator kuning
- **Slow network**: Auto retry dengan delay
- **Server error**: Fallback ke waktu lokal

## Future Improvements

### ✅ Implemented Enhancements

1. **Persistent Offset** ✅
   - Offset terakhir disimpan di AsyncStorage
   - Digunakan saat cold start untuk menghindari delay
   - Auto-expire setelah 1 jam

2. **Background Sync** ✅
   - Sync otomatis setiap 15 menit di background
   - Sync saat app resume dari background
   - Efisien dengan AppState listener

3. **NTP Integration** ✅
   - Fallback ke WorldTimeAPI jika edge function gagal
   - Multi-level fallback: Server → NTP → Local
   - Seamless untuk user

4. **Drift Detection** ✅
   - Deteksi jika offset berubah > 5 detik
   - Warning di console dan store
   - Visual indicator untuk admin/debug

5. **Sync Status Store** ✅
   - Zustand store untuk status sync global
   - Accessible dari mana saja di app
   - Real-time status updates

### Components

#### TimeSyncIndicator Component

Reusable component untuk menampilkan status sync:

```tsx
import { TimeSyncIndicator } from "~/components/TimeSyncIndicator";

// Simple usage
<TimeSyncIndicator />

// With details
<TimeSyncIndicator showDetails={true} />

// Custom action
<TimeSyncIndicator onPress={() => console.log("Sync tapped")} />
```

**Status Icons:**

- 🟢 Green WiFi: Synced with server/NTP
- 🔵 Blue Clock: Syncing in progress
- 🔴 Red WiFi Off: Sync failed, using local time
- ⚠️ Orange Warning: Drift detected

### Additional Enhancements (Future)

1. **Persistent Offset**: Simpan offset terakhir di AsyncStorage untuk cold start
2. **Background Sync**: Sync di background untuk akurasi lebih baik
3. **NTP Integration**: Fallback ke NTP server jika edge function gagal
4. **Drift Detection**: Deteksi jika offset berubah signifikan
5. **Sync Status Store**: Zustand store untuk sync status global

### Monitoring

- Track sync success rate
- Monitor offset drift over time
- Alert jika offset > threshold (misalnya > 5 detik)

## Migration Notes

### Before (Old Behavior)

```typescript
const now = new Date(); // Device time
const currentTime = now.toLocaleTimeString();
```

### After (New Behavior)

```typescript
const now = timeSync.getSyncedTime(); // Server-synced time
const currentTime = now.toLocaleTimeString();
```

### Breaking Changes

None. API tetap sama, hanya sumber waktu yang berubah dari device ke server.

## Troubleshooting

### Issue: Waktu masih menampilkan waktu lokal

**Solution**:

- Cek network connection
- Cek logs untuk error sync
- Force refresh dengan pull-to-refresh

### Issue: Indicator selalu kuning

**Solution**:

- Cek edge function endpoint masih aktif
- Cek environment variables Supabase
- Cek network connectivity

### Issue: Offset drift over time

**Solution**:

- Re-sync otomatis akan handle ini
- Manual force sync jika perlu
- Pertimbangkan mengurangi `SYNC_INTERVAL`

---

**Version**: 1.0  
**Last Updated**: October 3, 2025  
**Author**: Development Team
