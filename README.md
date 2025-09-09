### Dependency
  - Node.js LTS
  - Android Studio + Android SDK, NDK
  - Java JDK, use adoptium JDK
  - PNPM Package Manager
### Instalasi

```bash
# Kloning repositori
git clone https://github.com/geber-suprabapak/skanida-apps-mobile.git

# Navigasi ke proyek
cd skanida-apps-mobile

# Instal dependensi
pnpm install

# Prebuild aplikasi Expo
npx expo prebuild

# Jalankan di Android
pnpm android

# Atau mulai server pengembangan
pnpm start
```

> **Tips:** Pastikan Anda telah mengkonfigurasi Android Studio atau Xcode dengan benar sebelum menjalankan aplikasi!
