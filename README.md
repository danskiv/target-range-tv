# 🎯 Target Range TV (CyberShooter / RangeMaster)
**Interactive Multi-Screen Target Shooting Game for Android TV & Smartphone**
*Version: v1.0.0*

---

## 🌟 Tentang Proyek

**Target Range TV** adalah game arcade latihan menembak (*Target Practice*) interaktif yang mengubah Android TV Anda menjadi arena tembak dan Smartphone menjadi senjata pengendali (*Air-Gun Controller*) menggunakan sensor Gyroscope & Accelerometer.

- **Zero-Install Controller**: Cukup scan QR code di layar TV untuk langsung bermain via web browser HP.
- **Ultra-Low Latency**: Komunikasi real-time sub-15ms via local WebSocket.
- **Dynamic Targets**: Sasaran statis (papan target, botol kaca), bergerak di rel konveyor, piring terbang (*clay pigeon*), sandera penalti, dan barel bom peledak.
- **Haptic & Audio Polish**: Dilengkapi getaran recoil di HP dan efek suara renyah Web Audio API di TV.

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat Sistem
- Python 3.10+
- Android TV / Smart TV / Komputer dengan browser modern
- Smartphone Android / iOS yang terhubung ke jaringan Wi-Fi yang sama

### 2. Menjalankan Server Hub
```bash
cd /home/ubuntu/Github/target-range-tv
# Jalankan server FastAPI
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Membuka Permainan
1. **Layar TV**: Buka browser di Android TV lalu akses `http://<IP-SERVER-LOKAL>:8080/tv`
2. **Pengendali HP**: Pindai QR Code yang tampil di layar TV untuk membuka controller.
3. **Mulai Membidik**: Arahkan HP ke tengah layar TV, tekan tombol **"KALIBRASI"**, dan siap menembak!

---

## 📚 Dokumentasi Lengkap

Daftar dokumen teknis terstruktur di folder `docs/`:
- [`PRD.md`](PRD.md) — Spesifikasi produk, variasi sasaran, dan sistem skor.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — Standar kode, struktur folder, dan versioning.
- [`docs/01-architecture-spec.md`](docs/01-architecture-spec.md) — Topologi jaringan & arsitektur sistem.
- [`docs/02-sensor-gyro-math.md`](docs/02-sensor-gyro-math.md) — Formula matematika gyro, LERP, & clamping.
- [`docs/03-websocket-protocol.md`](docs/03-websocket-protocol.md) — Skema payload event WebSocket.
- [`docs/04-bugs-and-pitfalls.md`](docs/04-bugs-and-pitfalls.md) — Analisis 8 potensi bug hardware, sensor, & jaringan.
- [`docs/05-game-loop-and-states.md`](docs/05-game-loop-and-states.md) — Diagram state machine & wave progression.
- [`docs/06-test-plan.md`](docs/06-test-plan.md) — 15 skenario pengujian komprehensif.
- [`docs/adr/`](docs/adr/) — Architecture Decision Records (ADR-001 & ADR-002).
