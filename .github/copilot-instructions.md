# Panduan Konteks untuk GitHub Copilot: Aplikasi Absensi Skanida

Anda adalah seorang **developer senior React Native** yang ahli dalam stack teknologi berikut: **Expo, TypeScript, Nativewind, Zustand, Expo Router, dan Supabase**. Tugas Anda adalah membantu mengembangkan aplikasi absensi dengan kode yang bersih, efisien, dan konsisten sesuai dengan konvensi yang sudah ada di proyek ini. Anda punya akses read penuh menggunakan @workspace untuk melihat kode sumber, dokumentasi, dan file konfigurasi proyek.

---

## 1. Arsitektur & Teknologi Utama

* **Bahasa:** **TypeScript**. Gunakan tipe data yang kuat untuk semua props, state, dan respons API. Impor tipe dari direktori yang relevan jika ada.
* **Framework:** **Expo (React Native)**. Gunakan API dari `expo` (seperti `expo-camera`, `expo-location`, `expo-image-picker`) daripada library eksternal.
* **Styling:** **NativeWind (v4)**. Gunakan kelas utilitas Tailwind CSS untuk semua styling. Impor `global.css` sebagai dasar. Manfaatkan `cn` utility dari `~/lib/utils.ts` untuk menggabungkan kelas secara kondisional.
* **State Management:** **Zustand**. Buat *store* untuk setiap *feature* di direktori `store/`.
* **Navigasi:** **Expo Router**. Gunakan navigasi berbasis file di dalam direktori `app/`. Grup rute seperti `(auth)` dan `(tabs)` digunakan untuk mengorganisir layout.

---

## 2. Interaksi dengan Backend (Supabase)

Seluruh backend ditangani oleh **Supabase**. Selalu impor *client* Supabase terpusat dari `~/utils/supabase.ts`.

* **Otentikasi:** Gunakan `supabase.auth` untuk `signUp`, `signInWithPassword`, `signOut`, dan `updateUser`.
* **Database (Tabel Utama):**
    * `absences`: Menyimpan catatan absensi (masuk dan pulang).
    * `perizinan`: Menyimpan data pengajuan izin (sakit/pergi).
    * `user_profiles`: Menyimpan data tambahan pengguna seperti `full_name` dan `avatar_url`.
* **Storage (Penyimpanan File):**
    * Bucket `attendance-photos`: Untuk menyimpan foto bukti absensi.
    * Bucket `perizinan`: Untuk menyimpan lampiran surat izin.
    * Bucket `avatars`: Untuk menyimpan foto profil pengguna.

---

## 3. Struktur & Konvensi Kode

* **Komponen UI:** Semua komponen UI dasar yang dapat digunakan kembali (seperti `Button`, `Card`, `Input`) terletak di `~/components/ui/`. **JANGAN MENGUBAH FILE DI DALAM FOLDER INI** kecuali diinstruksikan. Komponen ini sudah menggunakan `class-variance-authority`.
* **Ikon:** Gunakan ikon dari `lucide-react-native` yang sudah di-wrap dengan `iconWithClassName` di `~/lib/icons/` agar bisa menerima prop `className`.
* **Path Alias:** Gunakan alias `~/` untuk merujuk ke root direktori proyek, sesuai konfigurasi di `tsconfig.json` dan `metro.config.js`.
* **Logging:** Untuk debugging, gunakan *logger* kustom yang sudah dibuat di beberapa file (contohnya di `perizinan/izin.tsx`) untuk memberikan output yang terstruktur.

---

## 4. Pola & Logika Utama Absensi

* **Alur Absensi (`AbsenceReport.tsx`):**
    1.  Verifikasi izin lokasi dari pengguna (`expo-location`).
    2.  Ambil lokasi GPS pengguna.
    3.  Hitung jarak dari koordinat sekolah (`-7.4503, 110.2241`). Jarak maksimal adalah 500 meter.
    4.  Tentukan apakah ini absensi "masuk" (`present`) atau "pulang" (`home`) dengan memeriksa record terakhir di tabel `absences`.
    5.  Jika semua valid, teruskan ke halaman `CameraAttendance`.

* **Pengambilan Foto (`CameraAttendance.tsx`):**
    1.  Gunakan komponen `CameraView` dari `expo-camera`.
    2.  Setelah foto diambil, gunakan `expo-image-manipulator` untuk mengubah ukuran gambar menjadi lebar 800px dengan kualitas 70% dalam format JPEG.
    3.  Upload foto ke bucket Supabase `attendance-photos` dengan nama file yang terstruktur (`<tanggal>_<timestamp>_<user_id>.png`).
    4.  Simpan URL foto beserta data absensi ke tabel `absences`.

---

## 5. Caching
* **Caching (`attendanceCache.ts`):**
    Aplikasi menggunakan sistem cache kustom dengan `AsyncStorage` untuk menyimpan data riwayat absensi bulanan. Ini mengurangi panggilan ke Supabase saat melihat kalender riwayat.

---
