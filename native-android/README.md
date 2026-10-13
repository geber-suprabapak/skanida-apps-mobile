# Skanida Apps Native

Eksperimen Android Kotlin + Jetpack Compose di branch `experiment/native-kotlin-compose`.
Modul ini membangun APK mandiri tanpa Node, React Native, Hermes, Expo runtime, Metro, atau WebView aplikasi. Login menggunakan browser sistem melalui AppAuth; kamera menggunakan CameraX.

## Menjalankan

Butuh JDK 17 dan Android SDK 36. Set `ANDROID_HOME` atau buat `local.properties` dengan `sdk.dir` lokal, lalu:

```sh
cd native-android
./gradlew :app:assembleExperiment
adb install -r app/build/outputs/apk/experiment/app-experiment.apk
```

Variant `experiment` dioptimalkan dengan R8/resource shrinking, tidak debuggable, dan ditandatangani dengan kunci debug lokal. Package `com.hfzrk.skanidaappsmobile.native` dapat dipasang bersama aplikasi lama. Ini APK uji, bukan rilis produksi.

Konfigurasi publik Logto/Astra dibaca dari `.env` aplikasi lama, variabel lingkungan, atau `-P` Gradle dengan nama `EXPO_PUBLIC_*` yang sama. Default menunjuk ke endpoint live. Jangan menaruh client secret atau kredensial admin dalam APK.

Login memakai client Logto dan redirect live yang sama: `skanida://auth/callback`. Jika Android menampilkan pilihan aplikasi saat kembali dari browser, pilih **Skanida Apps Native**. Jangan memilih aplikasi lama pada callback eksperimen.

## Build produksi

```sh
./gradlew :app:assembleRelease :app:bundleRelease
```

Package release adalah `com.hfzrk.skanidaappsmobile`. Tanpa `signing.properties`, release belum ditandatangani dan tidak dapat dipasang sebagai pembaruan produksi. Untuk memperbarui aplikasi lama, gunakan keystore/aset signing resmi yang sama dan `-PNATIVE_VERSION_CODE=<angka lebih besar dari versi terpasang>`; isi file lokal yang diabaikan Git:

```properties
storeFile=/path/to/official-release.jks
storePassword=...
keyAlias=...
keyPassword=...
```

APK native memakai kontrak Astra `v1` yang sudah ada, tanpa deployment server. Uji live memakai satu akun siswa sintetis yang dibuat atas izin pengguna. Mapping push EAS khusus package `.native` ditambahkan dengan kredensial FCM `skapps-skrrt` yang sudah ada; mapping aplikasi utama dan kunci tidak diubah.

## Cakupan

- Logto authorization code + PKCE, state/nonce AppAuth, refresh token, role siswa, logout browser, sesi terenkripsi AES-GCM dengan Android Keystore.
- Aktivasi akun, pemulihan kode sekolah, status akun pending/rejected/disabled, ganti password dan login ulang.
- Dashboard, waktu WIB, jadwal, server-side primary action dan status wajah.
- Presensi: izin kamera/lokasi presisi, penolakan mock location, precheck sebelum kamera, attempt per pengguna dengan TTL 10 menit, foto JPEG maksimal 5 MiB, submit masuk/pulang, pesan blok izin dari Astra.
- Kalender dan ringkasan per bulan; gabungan presensi masuk/pulang dan izin non-rejected mengikuti kalender aplikasi lama.
- Pengajuan sakit/pergi, bukti kamera/galeri, keterangan 10–500 karakter, batas pengajuan harian dan pesan konflik Astra, status/detail penolakan serta periode izin.
- Profil, avatar kamera/galeri/hapus, status enrollment, salin NIS/ID, tema sistem/terang/gelap.
- Enrollment: tepat 10 foto JPEG maksimal 2 MiB per foto, pemeriksaan kesiapan server sebelum upload multipart, cleanup foto sementara.
- Notifikasi: Firebase Messaging native → pendaftaran token Expo via HTTPS → Astra. Tidak menyertakan SDK/runtime Expo. Opt-out per pengguna, pencabutan izin OS, refresh token FCM, serta logout ditangani.

Notifikasi membutuhkan konfigurasi Firebase publik pada `app/google-services.json` atau `../certs/google-services.json`. Registrasi token Astra, receipt Expo `ok`, dan penerimaan pesan uji di emulator pada package `.native` sudah dibuktikan. Pengiriman dari pemicu bisnis backend belum diuji.

## Verifikasi ringan

```sh
./gradlew :app:testDebugUnitTest :app:lintExperiment
```

Lima tes kecil mencakup kontrak/envelope Astra, pesan race `ATTENDANCE_BLOCKED`, serta penggabungan riwayat harian/izin. Hasil build, ukuran APK, smoke emulator, dan batas verifikasi tercatat di [laporan eksperimen](../docs/native-kotlin-experiment.md).

Login live siswa, callback, dashboard/profil/riwayat/izin Astra, kamera/upload avatar, sesi setelah restart, refresh token sungguhan, logout/pencabutan token push, dan delivery push sudah diuji pada akun sintetis. Login meminta `prompt=consent` agar Logto menerbitkan refresh token untuk akses offline.

Satu integration test refresh tersedia di `IdentityLiveSmokeTest`, hanya untuk sesi akun uji milik operator. Test dilewati tanpa argumen `allowOwnedLiveSmoke=native-compose-20261013` dan memerlukan `expectedUserId` yang cocok persis. Jangan jalankan terhadap sesi akun lain. Runner Android dapat menghapus app/data uji setelah selesai; pasang ulang APK experiment untuk smoke manual.

Kesetaraan penuh belum diklaim: enrollment wajah dan presensi dengan GPS nyata, submit/keputusan izin, serta perubahan password melalui UI masih perlu dibuktikan. APK experiment tetap untuk pengujian, belum pengganti rilis produksi.

## Trade-off

APK Kotlin tidak mendukung pembaruan JavaScript Expo OTA. Perubahan kode native membutuhkan APK baru dengan signing yang sama. Eksperimen ini khusus Android; aplikasi iOS tetap menggunakan implementasi lama. Source Expo dipertahankan untuk pembandingan dan tidak ikut APK native.

Rujukan integrasi: [AppAuth Android](https://github.com/openid/AppAuth-Android), [Compose BOM](https://developer.android.com/develop/ui/compose/bom), dan [registrasi push Expo](https://github.com/expo/expo/blob/main/packages/expo-notifications/src/getExpoPushTokenAsync.ts).
