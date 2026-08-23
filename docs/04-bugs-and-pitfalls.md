# 04-BUGS-AND-PITFALLS — Analisis Kritis Potensi Bug & Mitigasi
**Target Range TV: Hardware, Browser, Sensor, & Network Failure Modes**
*Version: v1.0.0*

---

## 1. Analisis Kerentanan Sensor (Gyroscope & Accelerometer)

### 🔴 Bug 1: Sensor Drift (Pergeseran Koordinat Bertahap)
* **Gejala**: Pemain memegang HP lurus menghadap TV, namun titik bidik (*crosshair*) di TV perlahan bergeser sendiri ke kiri/kanan/bawah seiring waktu.
* **Penyebab**: Akumulasi noise matematika integrasi data sensor IMU mikro-elektronik (*integration drift*) pada perangkat mobile.
* **Mitigasi Darsam**:
  1. **One-Tap Re-Center Button**: Tombol mengambang besar di controller HP (atau pemicu tap dua jari) bertuliskan *"Re-center / Arahkan ke TV"*. Saat ditekan, koordinat sudut saat ini langsung dijadikan *Offset Origin* $(0,0)$.
  2. **Auto Drift Damping**: Menerapkan *High-Pass Filter* sederhana untuk mengabaikan getaran mikro di bawah threshold $< 0.05^\circ/\text{detik}$.

---

### 🔴 Bug 2: Orientasi Layar Terbalik / Landscape Lock Issue
* **Gejala**: Sumbu Pitch (naik-turun) dan Roll/Yaw (kiri-kanan) tertukar 90 derajat saat HP diputar dari Portrait ke Landscape, membuat bidikan kacau balau.
* **Penyebab**: Browser mobile menghitung event `deviceorientation` relatif terhadap orientasi layar aktif (*Screen Orientation API*).
* **Mitigasi Darsam**:
  1. Kunci antarmuka controller pada mode **Portrait Only** via CSS (`@media (orientation: landscape) { display: show_rotate_warning }`).
  2. Standarisasi mapping sudut matematika:
     - $X_{\text{screen}} = (\text{gamma} - \text{gamma}_{\text{calibrated}}) \times \text{Sensitivity}$
     - $Y_{\text{screen}} = (\text{beta} - \text{beta}_{\text{calibrated}}) \times \text{Sensitivity}$

---

### 🔴 Bug 3: Izin Sensor di Browser iOS / Modern Android (Permission Wall)
* **Gejala**: Saat membuka web controller di Safari iOS 13+ atau beberapa varian Android Chrome, sensor gyro tidak merespons sama sekali (nilai selalu 0 atau null).
* **Penyebab**: Kebijakan keamanan browser modern mewajibkan interaksi pengguna eksplisit (*Explicit User Gesture*) sebelum memberikan akses ke `DeviceMotionEvent.requestPermission()`. Selain itu, beberapa browser memblokir sensor jika web diakses via `http://` tanpa SSL/TLS.
* **Mitigasi Darsam**:
  1. **Layar Awal Interaktif**: Tampilkan tombol besar **"Mulai Bermain & Aktifkan Sensor"** sebelum masuk ke arena permainan.
  2. **HTTPS / Localhost Exemption**: Mengaktifkan self-signed certificate atau memanfaatkan `http://localhost` / `http://*.local` agar browser mengizinkan sensor.

---

## 2. Analisis Kerentanan Jaringan & WebSocket

### 🔴 Bug 4: Wi-Fi Jitter & Packet Flooding (Lag Bidikan)
* **Gejala**: Gerakan kursor di layar TV patah-patah (*stuttering*) atau tiba-tiba melompat jauh (*teleporting*).
* **Penyebab**: Controller mengirim data sensor terlalu cepat (misal 120-200 Hz tanpa throttle) sehingga membanjiri antrean paket jaringan Wi-Fi lokal (*buffer bloat*).
* **Mitigasi Darsam**:
  1. **Fixed Tick Rate Throttling**: Controller hanya mengirim paket data gyro setiap **16.6 ms (60 Hz)** atau **33.3 ms (30 Hz)** menggunakan `requestAnimationFrame` atau timer terukur.
  2. **Format Payload Sangat Ramping (Binary / Compact Array)**: Kirim paket seringkas mungkin: `[player_id, pitch, yaw, trigger_flag]` alih-alih JSON besar berulang.

---

### 🔴 Bug 5: Reconnecting Socket Zombie / Handshake Ghost
* **Gejala**: Ketika layar HP redup (*screen timeout*) atau beralih tab sejenak, koneksi terputus. Saat HP dibuka kembali, TV menganggap ada 2 pemain padahal orang yang sama.
* **Penyebab**: Sesi WebSocket lama belum di-*garbage collect* oleh server saat koneksi baru masuk.
* **Mitigasi Darsam**:
  1. **Heartbeat / Ping-Pong**: Server mengirim ping tiap 3 detik; jika tidak ada respon dalam 6 detik, koneksi lama otomatis ditutup (*dropped*).
  2. **Session Token / Player ID**: HP menyimpan `client_session_id` di `sessionStorage` sehingga saat *reconnect*, status pemain lama langsung dipulihkan (*re-hydrated*).

---

## 3. Analisis Keterbatasan Hardware Android TV

### 🔴 Bug 6: TV Memory Exhaustion & Low FPS Throttling
* **Gejala**: Game berjalan mulus di 5 menit pertama, lalu perlahan mulai melambat (turun ke 15 FPS) hingga browser TV keluar sendiri (*Force Close / OOM Crash*).
* **Penyebab**: Kebocoran memori (*Memory Leak*) dari objek partikel peluru/pecahan botol yang dibuat terus-menerus tanpa penghapusan bersih (*Garbage Collection stutter*).
* **Mitigasi Darsam**:
  1. **Object Pooling Pattern**: Buat wadah tetap (misal: maksimal 50 partikel dan 10 target). Gunakan kembali objek yang sudah mati (*re-use instance*) daripada membuat `new Object()` setiap kali menembak.
  2. **Strict Canvas 2D without Heavy Blur Filters**: Jangan gunakan `filter: blur()` atau shadow berlebihan pada canvas TV karena GPU Android TV sangat lemah dalam pemrosesan multi-pass pixel shader.

---

## 4. Analisis Mekanik Permainan & UX

### 🔴 Bug 7: "Screen Edge Clamping Trap"
* **Gejala**: Pemain mengarahkan HP terlalu jauh ke samping, kursor tertahan di ujung layar TV. Ketika pemain mengembalikan tangan ke tengah, kursor malah tertinggal di samping.
* **Mitigasi Darsam**: Terapkan *Absolute Angular Mapping* (koordinat kursor murni dihitung dari sudut fisik tangan terhadap titik kalibrasi, bukan akumulasi kecepatan pergeseran *delta*).

---

### 🔴 Bug 8: Double-Trigger / Accidental Fire saat Haptic Recoil
* **Gejala**: Satu kali sentuhan tembakan menghasilkan 2-3 peluru keluar beruntun karena getaran HP memicu event sentuhan tambahan atau event `touchstart` + `click` ganda.
* **Mitigasi Darsam**: Terapkan `e.preventDefault()`, *Debounce Trigger* minimal 100 ms per tembakan (disesuaikan dengan *Rate of Fire* senjata), dan gunakan listener murni `pointerdown`.
