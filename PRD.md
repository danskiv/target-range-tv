# PRD — Target Range TV (CyberShooter / RangeMaster)
**Product Requirements Document**
*Version: v1.0.0 — Status: Draft / In Review*

---

## 1. Executive Summary & Vision

**Target Range TV** adalah game multi-layar interaktif (*Dual-Screen Interactive Game*) bergenre *Arcade Shooting Range / Target Practice*. 
- **Layar Utama (Android TV / Smart TV)**: Menampilkan arena tembak 1080p/4K 60 FPS, sasaran-sasaran bergerak, papan skor real-time, efek visual partikel, dan tata suara dinamis (*sound effects & announcer*).
- **Pengendali (HP Android / Smartphone)**: Berfungsi sebagai senjata penembak (*Air Gun / Laser Pointer*) yang memanfaatkan sensor **Gyroscope & Accelerometer** untuk mengarahkan bidikan (*crosshair*) di TV, layar sentuh sebagai pelatuk tembakan (*trigger*), dan motor getar (*haptic feedback*) untuk sensasi recoil tembakan.
- **Zero-Install Experience**: Pemain tidak perlu mengunduh aplikasi di HP. Cukup scan QR code di layar TV untuk langsung membuka web controller berlatensi ultra-rendah (<15 ms via local WebSocket).

---

## 2. Target Pengguna & Karakteristik Perangkat

| Entitas | Perangkat | Lingkungan / Resolusi | Spesifikasi & Batasan |
|---|---|---|---|
| **Layar TV** | Android TV, Google TV, Smart TV Box (Xiaomi Box, Chromecast, dsb.) | 1080p (1920x1080) / 4K @ 16:9, Browser Chromium / WebKit TV | CPU/RAM terbatas (1-2 GB RAM), hindari DOM bloat & CSS filter berlebihan. Canvas 2D / WebGL ringan. |
| **Pengendali** | Smartphone Android (Chrome / Brave / Samsung Internet) & iOS (Safari) | Portrait Touchscreen, 60–120 Hz | Wajib memiliki Gyroscope + Accelerometer hardware. |
| **Server Hub** | Local Host / VPS / Mesin TV lokal (FastAPI + WebSocket) | Local Wi-Fi (LAN) / 5 GHz Band | Latensi transmisi data per paket $\le 10$ ms. |

---

## 3. Game Loop & Core Mechanics

### 3.1. Alur Permainan (Session Flow)
1. **Lobby & Room Creation**: TV menyala, membuat Room Code 4-karakter (misal: `TG88`) dan menampilkan QR Code.
2. **Pairing**: Pemain memindai QR Code menggunakan kamera HP. Web controller terbuka dan otomatis terhubung ke room.
3. **Kalibrasi Titik Nol (*Zero-Point Calibration*)**: Pemain mengarahkan moncong HP ke tengah TV lalu menekan tombol **"KALIBRASI"** di layar HP untuk menyelaraskan koordinat $(0,0)$.
4. **Permainan Dimulai (Match Countdown 3.. 2.. 1.. FIRE!)**:
   - Ronde berjalan selama durasi tertentu (contoh: 60 detik).
   - Sasaran bermunculan dengan berbagai pola.
   - Pemain mengarahkan bidikan di TV dengan memiringkan/menggerakkan HP dan menekan layar untuk menembak.
5. **Amunisi & Reload**: Kapasitas peluru terbatas (misal 6 butir). Jika habis, pemain melakukan gerakan *Flick Up* (menyentak HP ke atas) atau menekan tombol reload.
6. **Hasil & Papan Skor (*Leaderboard*)**: Menampilkan akurasi tembakan, total skor, combo tertinggi, dan gelar ketangkasan (*Marksman, Sharpshooter, Rookie*).

---

## 4. Tipe Sasaran (Target Taxonomy)

| Tipe Sasaran | Pola Gerakan | Nilai Poin | Efek Khusus / Penalti |
|---|---|---|---|
| **Papan Lingkaran Klasik** | Statis di posisi tertentu | 10 (Luar) / 25 (Tengah) / 100 (Bullseye) | Menghilang setelah 3 detik jika tidak ditembak. |
| **Botol / Kendi Keramik** | Statis di atas meja/rak | 30 poin | Pecah berhamburan dengan partikel visual & suara renyah. |
| **Sasaran Rel Horizontal** | Bergerak kiri-ke-kanan dengan kecepatan bervariasi | 50 poin | Kecepatan bertambah seiring tingginya wave. |
| **Piring Terbang (*Clay Pigeon*)** | Melayang parabola di udara | 150 poin | Menuntut estimasi sudut tembak (*leading shot*). |
| **Sasaran Pop-Up** | Muncul mendadak dari balik barikade (1.5 detik) | 80 poin | Menguji kecepatan refleks seketika. |
| **Sandera / Warga Sipil (Hazard)** | Berdiri di samping target musuh | **-100 poin & Reset Combo** | Hukuman penalti skor jika tertembak. |
| **Barel Peledak (Explosive Barrel)** | Statis di tengah gerombolan | 50 poin + Ledakan Area | Menghancurkan seluruh target di radius 200px. |
| **Target Bos Raksasa (Wave Final)** | Bergerak dinamis dengan Health Bar (500 HP) | 1.000 poin bonus | Butuh tembakan bertubi-tubi dari semua pemain. |

---

## 5. Sistem Skor & Combo Multiplier

- **Hit Streak Multiplier**:
  - 1–4 hit berturut-turut: $1\times$
  - 5–9 hit berturut-turut: $2\times$
  - 10–19 hit berturut-turut: $3\times$
  - 20+ hit berturut-turut: $5\times$
- **Miss Penalty**: Sekali tembakan meleset (mengenai dinding kosong), pengganda combo langsung kembali ke $1\times$.
- **Akurasi Bonus**: Pemain dengan akurasi di atas 85% pada akhir ronde mendapat bonus $+500$ poin.

---

## 6. Mode Permainan (Game Modes)

1. **Mode Solo (Range Training)**: Latihan mandiri untuk memecahkan rekor skor tertinggi pribadi.
2. **Mode Co-op Wave Defense**: 2–4 pemain bahu-membahu menembak target sebelum waktu gelombang habis.
3. **Mode Versus (1v1 Quick Duel)**: 2 pemain berlomba menembak target yang sama. Siapa cepat dia dapat poin.

---

## 7. Roadmap Rilis

- **v0.1.0 (MVP Alpha)**: 1 Pemain, kalibrasi Gyro, sasaran statis + bergerak horizontal, pelatuk tembak, WebSockets LAN.
- **v0.2.0 (Audio & Polish)**: Integrasi Web Audio API (suara tembakan, reload, bullseye), sistem combo, haptic feedback HP.
- **v0.3.0 (Multiplayer 1v1)**: Dukungan multi-controller, dual crosshair (Biru & Merah), sistem room management.
- **v1.0.0 (Gold Release)**: Ragam mode permainan (Time Attack, Wave Boss), sound announcer, penyimpanan High Score lokal (SQLite/LocalStorage).
