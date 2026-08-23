# 🎯 Range Shooter (sebelumnya Target Range TV)

**Neon Cyber Arena — Interactive Shooting Game for Android TV & Smartphone**
*Version: v2.0.0-alpha (dalam pengerjaan) · Repo: [danskiv/target-range-tv](https://github.com/danskiv/target-range-tv) (public)*

---

## 🌟 Tentang Proyek

**Range Shooter** adalah game arcade menembak multi-layar yang mengubah Android TV menjadi **Neon Cyber Arena** dan HP Android menjadi **senjata kendali gerak** (gyroscope). Arena neon berpartikel, target bergerak cerdas, announcer suara English, dan latensi ~3ms di Wi-Fi rumah.

- **Renderer modern**: PixiJS (WebGL2) + fallback Canvas 2D — ADR-004
- **Input andal**: APK native (SensorManager rotation vector), tanpa izin runtime — ADR-003
- **Kalibrasi presisi**: 5-titik affine (tengah + 4 pojok) + drift-damping — ADR-005
- **Layout responsif**: mengikuti resolusi TV apa pun (720p/1080p/4K)

> **Dokumen utama: [`PRD-v2.md`](PRD-v2.md)** (v2.0.0 APPROVED) — baca sebelum dokumen lain.

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat
- Python 3.11+ (server)
- Android TV / MiTV (app WebView) atau browser modern
- HP Android + APK controller

### 2. Menjalankan Server Hub
```bash
cd /home/ubuntu/Github/target-range-tv
./venv/bin/python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8095
```
Atau systemd (NODIX1): `systemctl start target-range`

### 3. Bermain
1. **TV**: buka `http://<IP-SERVER>:8095/v2` (atau `/tv` untuk v1) — otomatis join room terbaru.
2. **HP**: install APK controller → deteksi server otomatis → **KALIBRASI 5 titik** → **MULAI GAME**.
3. **Bidik & tembak!** — crosshair mengikuti gerakan HP, tap untuk menembak.

## 📚 Dokumentasi

| Dokumen | Isi |
|---|---|
| [`OVERVIEW.md`](OVERVIEW.md) | Gambaran proyek & struktur |
| [`PRD-v2.md`](PRD-v2.md) | **Sumber kebenaran produk v2** (APPROVED) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arsitektur + diagram alur data |
| [`CHANGELOG.md`](CHANGELOG.md) | Riwayat versi |
| [`CODING_STANDARD.md`](CODING_STANDARD.md) | Gaya kode |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Alur kontribusi |
| [`TESTING.md`](TESTING.md) | Strategi pengujian |
| [`AUDIT_LOG.md`](AUDIT_LOG.md) | Temuan & pelajaran (baca sebelum ngoding) |
| `docs/` | Spesifikasi detail (01-06) + ADR |

## ⚠️ Catatan Penting
- **AP isolation router WAJIB nonaktif** — tanpa itu TV↔HP tidak bisa saling jangkau (lihat AUDIT_LOG #9).
- **Satu slot TV per room** — jangan pasang observer/klien TV kedua saat main (AUDIT_LOG #10).
- Versioning: SemVer; `v1.x` = Target Range TV lama, `v2.x` = Range Shooter baru.
