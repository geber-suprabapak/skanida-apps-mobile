# Eksperimen Skanida Kotlin / Jetpack Compose

Branch: `experiment/native-kotlin-compose`. Source aplikasi native: [`native-android/`](../native-android/README.md).

APK uji: [`artifacts/native-kotlin-compose/skanida-native-experiment.apk`](../artifacts/native-kotlin-compose/skanida-native-experiment.apk).

Ini hasil implementasi dan uji live terbatas, **belum bukti bahwa seluruh perilaku live sudah setara**. Atas izin pengguna, dibuat satu akun siswa sintetis melalui Logto M2M beserta profil/binding/enrollment Astra yang konsisten. Tidak ada deployment server atau penggantian aplikasi produksi.

## Ukuran yang diukur

| Artifact | Bytes | MB desimal | MiB | Jenis |
| --- | ---: | ---: | ---: | --- |
| Native experiment | 3.220.986 | 3,221 | 3,072 | R8, resource shrinking, signed kunci debug lokal, tidak debuggable |
| Native release | 3.208.686 | 3,209 | 3,060 | R8, resource shrinking, unsigned |
| React Native v1.3.0 vc22 arsip | 21.753.977 | 21,754 | 20,746 | Release arm64, tidak debuggable |
| React Native baseline `8f25aeb` arsip | 54.658.133 | 54,658 | 52,126 | Debuggable arm64; bukan pembanding release |

APK experiment 85,19% lebih kecil daripada APK release arsip. Pembanding adalah file lokal `artifacts/skanida-apps-v1.3.0-vc22-a59d0dd-evernight.apk`, bukan klaim ukuran distribusi live terbaru. Native mencakup empat ABI CameraX, sedangkan arsip RN hanya arm64. Perbandingan ini belum mengukur AAB/download Play Store, installed size, RAM, startup, baterai, atau throughput.

Inspeksi ZIP native menemukan **0 entry JavaScript/Hermes**. APK tidak membutuhkan Metro, React Native, atau runtime Expo.

SHA-256 APK experiment:

```text
a4a7b0ffe421ff9f2305a7bdb1c9c872c3a4534f0e39e2378d2312ac336059e7
```

Data ukuran/checksum lengkap: `artifacts/native-kotlin-compose/apk-size.json`.

## Bukti yang sudah ada

- `./gradlew :app:assembleExperiment :app:assembleRelease :app:testDebugUnitTest :app:lintExperiment` berhasil pada JDK 17 / SDK 36.
- Lima tes lulus, tanpa error/failure/skipped: tiga kontrak/error Astra dan dua pemrosesan riwayat. Tidak menjalankan suite Expo lama atau suite E2E luas.
- Android lint: 0 error, 50 warning, 1 hint. Warning termasuk saran versi dependensi, preferensi KTX, dan resource/icon bawaan. Tidak menambahkan baseline untuk menyembunyikan error.
- APK experiment final dipasang di emulator Android 16/API 36 x86_64. Login Logto melalui Chrome Custom Tab, callback native, role siswa, bearer Astra, dashboard/jadwal WIB, profil, riwayat dan daftar izin berhasil. Daftar akun uji kosong sesuai data server. Primary action menolak presensi karena wajah belum terdaftar.
- Izin kamera, preview CameraX, capture, normalisasi JPEG, dan upload multipart avatar ke Astra/Garage berhasil; UI menampilkan “Foto profil diperbarui”.
- Login awal mengungkap Logto tidak menerbitkan refresh token hanya dengan `offline_access`. Login kini meminta `prompt=consent`. Satu integration test opt-in memaksa refresh AppAuth sungguhan, lalu membaca profil/dashboard/izin Astra dan memeriksa penyimpanan sesi terenkripsi: 1 test lulus, 0 failure/error/skipped. Tidak ada hook test dalam APK produksi.
- APK optimized dipasang ulang setelah runner instrumentation selesai. Login dan dashboard kembali berhasil; force-stop/buka ulang tanpa clear data tetap langsung memuat dashboard akun yang sama.
- Notifikasi: izin OS, token FCM → registrasi Expo HTTP → penyimpanan token Astra berhasil. Sebelum mapping EAS, pengiriman ditolak `InvalidCredentials`. Setelah persetujuan eksplisit pengguna, ditambahkan hanya mapping `com.hfzrk.skanidaappsmobile.native` pada proyek EAS yang sama, menggunakan key FCM `skapps-skrrt` yang sudah ada. Mapping package utama tidak berubah, kunci privat tidak diambil atau dirotasi. Satu pesan ke akun uji mendapat tiket/receipt `ok` dan muncul sebagai NotificationRecord package `.native` dengan judul serta isi uji yang benar. Ini membuktikan delivery client; pemicu bisnis backend belum diuji.
- Logout melalui UI kembali ke welcome, menutup sesi Logto, dan readback Astra memastikan token notifikasi akun uji menjadi `NULL`.
- Readback sebelum logout memastikan tepat satu profil approved, student, binding, dan class enrollment aktif untuk akun uji. Astra, Logto, kedua PostgreSQL, PgBouncer, dan Garage tetap healthy. Tidak ada data wajah atau transaksi presensi/izin dibuat pada tahap ini.
- Welcome diperiksa pada phone 1080×2424, mode gelap dengan font scale 1,3, dan viewport tablet 1200×1920 / density 240 pada emulator yang sama. Ini bukan pengujian seluruh layar tablet atau perangkat fisik. Konfigurasi emulator dikembalikan setelah capture.
- Read-only live: discovery Logto mengembalikan issuer dan endpoint OIDC serta PKCE S256; `GET /v1/mobile/health` dengan header kontrak `v1` mengembalikan `healthy`. Tanpa header, Astra menolak dengan 426 `CONTRACT_VERSION_UNSUPPORTED`.

Screenshot berada di `artifacts/native-kotlin-compose/`, termasuk `dashboard-live-final.png`, `profile-live.png`, `avatar-upload-live.png`, dan `notifications-enabled-live.png`. Capture welcome/layout terdahulu juga disimpan; warna backdrop logo gelap telah diperbaiki setelah capture awal. Build log dan `apk-size.json` ada di direktori yang sama. Kredensial akun, token, serta bukti operasional rinci disimpan privat di luar repository dan tidak dimasukkan ke APK/Git.

## Kesetaraan yang masih perlu dibuktikan

| Perilaku | Implementasi native | Bukti runtime saat ini |
| --- | --- | --- |
| Login siswa, callback, bearer Astra, refresh/persist sesi, logout | AppAuth, AES-GCM/Keystore, transport `v1` | Callback/bearer/dashboard, refresh sungguhan, persist sesi setelah restart serta logout lulus |
| Aktivasi, pemulihan, lifecycle akun, ganti password | Endpoint dan validasi sesuai client lama | Form aktivasi tampil; operasi akun belum dijalankan |
| Dashboard, jadwal, primary action, waktu WIB | Mengonsumsi dashboard Astra | Dashboard live, jadwal, waktu WIB, dan blok enrollment tampil |
| Presensi masuk/pulang dan blok izin | Precheck, GPS, mock rejection, attempt per-user/TTL, CameraX, submit | Belum diuji pada akun/lokasi/perangkat nyata |
| Riwayat bulanan dan izin sakit | Gabungan record harian dan izin non-rejected | Dua tes pemrosesan lulus; kalender/daftar akun uji live termuat kosong sesuai server |
| Izin dengan kamera/galeri, konflik dan status | Multipart, batas keterangan/file, limit harian, kode error Astra | Submit dan keputusan live belum dijalankan |
| Profil, avatar, salin ID, tema | Endpoint profil/avatar dan kontrol native | Profil live, CameraX, upload avatar berhasil; tema/font diperiksa terbatas |
| Enrollment wajah 10 JPEG | CameraX, bounded files, health recheck, multipart, cleanup | Upload/verifikasi wajah nyata belum dijalankan |
| Push notification | FCM native → registrasi Expo HTTP → Astra | Token Astra, ticket/receipt `ok`, dan penerimaan Android `.native` lulus; pemicu bisnis backend belum diuji |
| Rilis pengganti aplikasi produksi | Package release asli + signing.properties | Release unsigned tersedia; signing resmi, instalasi upgrade, dan distribusi belum dilakukan |

Sisa uji penerimaan membutuhkan perangkat fisik dan wajah/lokasi yang sah: enrollment 10 foto, presensi masuk/pulang, serta submit/keputusan izin. Perubahan password melalui UI dan lifecycle aktivasi/pemulihan juga belum dijalankan. Tidak melewati mock-location/geofence, menggunakan wajah siswa lain, atau mengubah jadwal untuk membuat uji lulus.

## Plus / minus

**Plus:** APK jauh lebih kecil pada artifact yang diukur; UI Android menggunakan Compose/Material; tidak membutuhkan JavaScript engine atau bundler saat berjalan; kamera dan lokasi memakai Android native; kontrak/domain tetap dimiliki Astra sehingga tidak membutuhkan backend baru.

**Minus:** Android saja; iOS tidak ikut menjadi Kotlin. Kode native diperbarui melalui APK bertanda tangan, sehingga Expo OTA JavaScript tidak tersedia. Tetap ada biaya pemeliharaan implementasi Kotlin dan pembuktian kesetaraan terhadap client lama. Delivery push client sudah terbukti; pemicu backend dan jalur biometrik/lokasi belum terbukti end-to-end. Kecepatan dan RAM belum diukur, sehingga tidak diklaim lebih baik.

Source Expo yang sudah ada dipertahankan sebagai referensi pembanding dan perubahan lokal sebelumnya tidak dimasukkan ke commit native. Baca [`native-android/README.md`](../native-android/README.md) untuk build dan signing.

## Perubahan operasional terbatas

Akun uji: `native_compose_20261013`, NIS `9910132601`, kelas X AKL 1, role student tanpa hak admin. Password dan M2M secret hanya tersedia pada penyimpanan privat operator. Akun tetap aktif untuk uji lanjutan. Pemensiunan harus menonaktifkan profil/enrollment dan menyuspend identitas yang sama; jangan menghapus audit atau data siswa lain.

Mapping EAS yang ditambahkan hanya package `.native`, project `a423f8e9-23fd-472b-b405-f5ef8f726bf9`, key FCM existing `skapps-skrrt`. Readback membuktikan mapping aplikasi utama tidak berubah. Rollback tersedia sebagai `eas-native-push.mjs rollback` di direktori privat operator `~/.local/share/skanida-native-experiment/20261013/`; script memeriksa ID mapping yang dibuat lalu hanya menghapus mapping itu. Jangan menghapus shared FCM key atau mapping package utama.
