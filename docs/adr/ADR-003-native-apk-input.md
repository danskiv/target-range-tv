# ADR-003 — APK Native sebagai Satu-Satunya Jalur Input (menggantikan ADR-001)

## Status
**ACCEPTED** (v2.0.0-draft — 2026-08-23) · **SUPERSEDES** ADR-001

## Konteks
ADR-001 memutuskan **zero-install web controller** (HTML5 DeviceOrientation di browser HP). Uji empiris 2026-08-23 membuktikan kegagalan fundamental:
1. **Secure context**: API `DeviceOrientationEvent` (dan sensor generik) di browser Chrome **hanya aktif di HTTPS atau localhost**. Server LAN `http://10.10.10.1:8095` mematikan sensor secara diam-diam — crosshair tidak bergerak, tanpa pesan error.
2. Web controller tidak pernah bisa diuji coba secara andal di perangkat nyata pengguna (HP Android di WiFi rumah).

Sebaliknya, **APK native dengan `SensorManager` (`TYPE_ROTATION_VECTOR`) terbukti bekerja tanpa izin runtime apa pun**, diuji langsung via observer WebSocket: rotation mengalir (pitch/roll/yaw), crosshair dihitung, `TRIGGER_FIRE` diterima — tanpa popup izin.

## Keputusan
1. **Input v2 = APK Android native** (Java, SensorManager `TYPE_ROTATION_VECTOR`), protokol **WebSocket** ke server (bukan REST — REST vestigial v1 dipertahankan hanya untuk kompatibilitas uji).
2. **Web controller ditinggalkan** untuk input sensor. Halaman `/controller` dapat tetap ada sebagai cadangan visual/statistik, bukan jalur input utama.
3. Trade-off: pemain harus install APK sekali (bukan zero-install). Diterima demi keandalan — kesalahan ADR-001 dicatat sebagai pelajaran.

## Konsekuensi
- **Positif**: sensor stabil di jaringan HTTP LAN; tanpa izin runtime; latensi rendah (WebSocket).
- **Negatif**: kehilangan zero-install & kompatibilitas iOS; APK perlu build/sign/disain ulang per perubahan server host.
- **Mitigasi**: server IP dikonfigurasi via konstanta `SERVER_HOST` (build-time), dokumentasi install APK via QR link download.

## Pelajaran (dictatat untuk v2)
- Jangan pernah berasumsi API browser modern bekerja di LAN non-secure.
- Uji sensor di perangkat nyata SEBELUM memilih arsitektur input.
