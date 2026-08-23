# 01-ARCHITECTURE-SPEC — Arsitektur Sistem TV-Server-Controller
**Target Range TV: Topologi Jaringan, Aliran Data, & Tanggung Jawab Komponen**
*Version: v1.0.0*

---

## 1. Topologi Jaringan (Network Topology)

```
                       ┌────────────────────────────────────────┐
                       │           Router Wi-Fi Lokal           │
                       │           (LAN / 5 GHz Band)           │
                       └───────────────────┬────────────────────┘
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             │                             │                             │
             ▼                             ▼                             ▼
   ┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
   │ Android TV Display│         │ Backend Hub       │         │ HP Controller     │
   │ (IP: 192.168.1.10)│         │ (FastAPI Server)  │         │ (IP: 192.168.1.50)│
   │                   │         │ (IP: 192.168.1.10)│         │                   │
   │  [HTML5 Canvas]   │◀──WS───▶│  [ConnectionMgr] │◀──WS───▶│  [Gyro & Touch]   │
   │  [Web Audio API]  │ (/ws/tv)│  [Room State Hub] │(/ws/ctrl│  [Haptic Recoil]  │
   └───────────────────┘         └───────────────────┘         └───────────────────┘
```

> **Catatan Deployment Fleksibel**:
> Backend FastAPI dapat dijalankan langsung di mesin Android TV (via Termux / Android Service) ATAU di server mini lokal / laptop (NODIX1 / Mac / PC) yang berada dalam satu jaringan Wi-Fi dengan TV dan HP.

---

## 2. Tanggung Jawab Komponen (Component Responsibilities)

### 2.1. TV Display Client (`/tv`)
- **Render Engine**: Pure HTML5 Canvas 2D berjalan pada native 60 FPS.
- **Audio Engine**: Web Audio API (Synthesizer & Audio Buffer playback) untuk latensi suara 0 ms tanpa jeda HTML5 `<audio>`.
- **Authoritative Hit-Box Calculation**: Menghitung irisan koordinat tembakan $(X,Y)$ terhadap kotak batas (*Bounding Box*) sasaran aktif saat sinyal *FIRE* diterima.
- **Room Code & QR Code Generation**: Menghasilkan QR code berbasis IP address server lokal untuk memudahkan proses pairing controller.

### 2.2. HP Controller Client (`/controller`)
- **Sensor Reader**: Menangkap event `deviceorientation` dan `devicemotion` dari sensor hardware HP.
- **Orientation Normalizer & Throttler**: Menghitung selisih sudut terhadap titik kalibrasi dan membatasi pengiriman paket data ke 60/30 Hz.
- **Tactile Interface**: Menyediakan area sentuh pelatuk tembakan yang responsif (`pointerdown`) dan mengeksekusi getaran *haptic recoil* (`navigator.vibrate(35)`).

### 2.3. Backend Hub (`FastAPI Server`)
- **Room Management**: Mengelola pembuatan room, siklus hidup koneksi WebSocket, dan pemutusan sesi.
- **High-Throughput Message Routing**: Meneruskan paket posisi bidikan dan aksi tembakan dari HP Controller ke TV Display dengan overhead latensi $< 2$ ms.
- **Static Asset Serving**: Menyajikan file HTML, CSS, dan JavaScript untuk TV maupun Controller.
