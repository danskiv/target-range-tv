# AUDIT LOG — Range Shooter

Catatan temuan audit, bug, dan pelajaran — beserta resolusi. **Baca sebelum mengubah kode** agar pelajaran v1 tidak diulang.

| # | Tanggal | Temuan / Bug | Akar Masalah | Resolusi | Status |
|---|---|---|---|---|---|
| 1 | 2026-08-23 | Web controller (HTML5 sensor) tidak berfungsi di HP | API sensor browser **hanya aktif di secure context** (HTTPS/localhost); server LAN HTTP mematikannya diam-diam | Ganti ke **APK native** (SensorManager, tanpa izin) — ADR-003; web controller digugurkan | ✅ Ditutup |
| 2 | 2026-08-23 | APK: aksi one-shot (shoot/reload/kalibrasi) tak pernah jalan; baru bekerja setelah BACK | **Executor tunggal dimonopoli aim loop** (POST `/api/controller/aim` tiap ~30ms) → aksi kelaparan di antrian | **Action executor terpisah** dari aim loop (commit `1d7f0de`) | ✅ Ditutup |
| 3 | 2026-08-23 | Titik kuning kalibrasi tidak muncul di TV | (a) cache WebView memuat JS lama; (b) dot digambar TAPI tertutup overlay lobby | Cache-bust `?v=` + no-cache headers + badge versi; `CALIB_START` menyembunyikan lobby (commit `f71eaee`, `3ca9ec0`) | ✅ Ditutup |
| 4 | 2026-08-23 | Room bertambah tiap refresh `/tv` | Halaman TV membuat room acak (`TG`+random) tiap load | TV join **room terbaru** dari `/api/info` (commit `ed5606a`) | ✅ Ditutup |
| 5 | 2026-08-23 | Mojibake `ðŸŽ¯` di halaman | Python Windows membaca file dengan **cp1252**, bukan UTF-8 | `read_text(encoding='utf-8')` + charset header (commit `32e41f2`) | ✅ Ditutup |
| 6 | 2026-08-23 | Crosshair mentok `x=0,y=0` (pojok kiri-atas) | Kalibrasi degenerate tersimpan (tembakan buta) → transformasi affine rusak | Guard `isTransformGood()`: tolak bad-fit/all-zero; netralkan load rusak (commit `abb42c3`) | ✅ Ditutup |
| 7 | 2026-08-23 | Titik kalibrasi "tidak di pojok" (tampil ~12% masuk) | Titik didefinisikan 0.12/0.88 — terlalu ke dalam | Pindah ke **pojok sejati 0.05/0.95** (TV & APK sinkron) | ✅ Ditutup |
| 8 | 2026-08-23 | **Semua koordinat bergeser di TV 720p** (titik tengah tampil 95% kanan) | Canvas & HUD **hardcode 1920x1080px**; WebView TV 1280x720 menskalakan tak proporsional | **Layout responsif** `100vw/100vh` + canvas ikut viewport (commit `5f36455`) | ✅ Ditutup |
| 9 | 2026-08-23 | TV tidak bisa menjangkau laptop/HP di WLAN | **AP isolation** router aktif (perangkat WiFi diblokir antar-teman) | Matikan AP isolation di router; topologi WLAN terbukti 3ms | ✅ Ditutup |
| 10 | 2026-08-23 | Observer mencuri slot TV → TV tuli | `room.tv_socket` **satu slot**; klien kedua menggantikan TV | Larang observer saat main; dokumentasi di CONTRIBUTING | ✅ Ditutup |
| 11 | 2026-08-23 | `server_ip` salah (`10.0.0.84` = interface Oracle) | Deteksi default-route memilih enp0s6, bukan wg0 | Env `RANGE_SERVER_IP=10.10.10.1` di systemd | ✅ Ditutup |
| 12 | 2026-08-23 | ADB ke HP gagal (TLS handshake diam) | Bug adb 34.0.4 aarch64 Debian | Jalur ADB HP ditinggalkan; pakai observer + APK | ✅ Ditutup (workaround) |

## Pelajaran Abadi (jangan diulang)

1. **Uji sensor di perangkat nyata sebelum memilih arsitektur input.**
2. **Jangan hardcode resolusi** — selalu responsif.
3. **Satu slot TV per room** — jangan pernah connect klien TV kedua.
4. **Cache WebView TV jahat** — selalu bump `?v=` dan verifikasi badge di layar.
5. **Executor APK**: pisahkan aksi dari loop sensor.
6. **AP isolation router** harus nonaktif untuk topologi WLAN.
7. **Dokumen & kode sinkron dalam satu commit** — konsistensi adalah hukum.

---

*Setiap temuan baru: tambahkan baris di tabel ini + update CHANGELOG dalam commit yang sama.*
