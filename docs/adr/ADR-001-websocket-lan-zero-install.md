# ADR-001 — WebSocket LAN Zero-Install Architecture

## Status
**ACCEPTED** (v1.0.0 — 2026-08-23)

## Konteks
Permainan Target Range TV membutuhkan komunikasi dua arah yang sangat cepat (ultra low-latency) antara layar Android TV dan smartphone pengendali. Selain itu, hambatan adopsi pemain (*friction*) harus ditekan serendah mungkin agar permainan dapat dimainkan secara instan di ruang keluarga tanpa proses instalasi aplikasi APK di HP masing-masing pemain.

## Keputusan
1. **Web Controller (HTML5 DeviceOrientation + WebSocket)**:
   Menggunakan antarmuka web murni yang disajikan langsung oleh server backend lokal. Pemain hanya perlu memindai QR code di layar TV untuk langsung membuka web controller di browser bawaan HP (Chrome, Safari, dsb.).
2. **FastAPI + Uvicorn WebSocket Server**:
   Menjalankan server WebSocket lokal ringan yang bertindak sebagai jembatan pesan (*message router*) antar layar TV dan HP dengan latensi transmisi sub-10 milidetik pada jaringan Wi-Fi lokal.

## Konsekuensi
- **Positif**:
  - Nol instalasi (*Zero-Install*) bagi pemain di HP.
  - Kompatibel lintas platform (Android, iOS, iPadOS).
  - Setup instan dalam hitungan detik via scan QR.
- **Tantangan & Mitigasi**:
  - Kebijakan izin sensor di iOS Safari memerlukan interaksi klik tombol pertama kali (*User Gesture*). Disediakan layar sambutan "Mulai & Izinkan Sensor".
