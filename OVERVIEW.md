# OVERVIEW — Range Shooter

**Range Shooter** adalah game *arcade shooting range* multi-layar bergenre **Neon Cyber Arena** untuk **Android TV** dengan pengendali **HP Android (APK native)**. Pemain mengarahkan bidikan dengan memiringkan HP (gyroscope), layar TV menampilkan arena neon, target bergerak, partikel, dan announcer suara.

> **Sumber kebenaran: [`PRD-v2.md`](PRD-v2.md) (v2.0.0 APPROVED)** — baca sebelum dokumen lain.

---

## Platform & Perangkat

| Komponen | Teknologi | Catatan |
|---|---|---|
| **Layar TV** | Android TV / MiTV, app WebView → `/v2` | Resolusi responsif (720p/1080p/4K) |
| **Renderer TV** | **PixiJS (WebGL2)** + fallback Canvas 2D | ADR-004 |
| **Pengendali HP** | **APK Android** (SensorManager rotation vector) | ADR-003 — web controller digugurkan |
| **Server** | FastAPI + Uvicorn, port `8095` | systemd di laptop / NODIX1 cadangan |
| **Jaringan** | Wi-Fi rumah (WLAN), latensi ~3 ms | AP isolation router WAJIB nonaktif |

## Cara Menjalankan (Ringkas)

1. **Server**: `uvicorn server.main:app --host 0.0.0.0 --port 8095` (atau systemd `target-range.service` di NODIX1).
2. **TV**: buka `http://<server-ip>:8095/v2` di WebView TV (app `com.danskiv.targetrangetv`) — otomatis join room terbaru.
3. **HP**: install APK controller → deteksi server otomatis → **KALIBRASI 5 titik** → **MULAI GAME**.

## Struktur Dokumen

```
├── AGENTS.md             # Panduan agen AI (baca pertama)
├── PRD-v2.md             # SUMBER KEBENARAN produk v2 (APPROVED)
├── PRD.md                # Arsip PRD v1
├── OVERVIEW.md           # Dokumen ini
├── ARCHITECTURE.md       # Ringkasan arsitektur (detail: docs/01 + docs/adr/)
├── CHANGELOG.md          # Riwayat versi
├── CODING_STANDARD.md    # Gaya kode (Python/JS/Java)
├── CONTRIBUTING.md       # Alur kontribusi & commit
├── TESTING.md            # Unit/integration/manual test
├── AUDIT_LOG.md          # Temuan audit & pelajaran (baca sebelum ngoding!)
├── docs/                 # Spesifikasi detail (01-06 + adr/)
└── server/, tv/, tv-v2/, android-controller-app/, android-tv-app/
```

## Status Proyek

- **v1 (Target Range TV)**: selesai & teruji di TV MiTV 720p — fondasi input, kalibrasi, jaringan.
- **v2 (Range Shooter)**: `v2.0.0-alpha` — scaffold `/v2` (PixiJS + Neon Cyber Arena) **dalam pengerjaan**.
