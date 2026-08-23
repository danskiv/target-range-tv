# TESTING — Range Shooter

Strategi pengujian. Detail kasus: [`docs/06-test-plan.md`](docs/06-test-plan.md).

## 1. Unit Test (server)
Python `pytest` di `server/`.

```bash
cd /home/ubuntu/Github/target-range-tv
PYTHONPATH=. ./venv/bin/pytest -v server/test_server.py
```

Cakupan:
- `GET /api/info` → JSON benar (server_ip, rooms, latest_room).
- Room create/join: satu room, TV slot tunggal, player register.
- Relay action: `calib_start`/`calib_dot`/`calib_done` → TV menerima event benar.
- Guard: aksi ke room tanpa TV tidak crash.

## 2. Unit Test (APK — Java)
Tanpa framework formal (build manual); gunakan kelas uji kecil + log:
- `computeAffine()` → 5 titik presisi menghasilkan transform yang memetakan titik ke target (toleransi <1%).
- `isTransformGood()` → tolak all-zero / residual >30%.
- Parse `/api/info` → `latest_room` diambil benar.

## 3. Integration Test (WebSocket)
Script observer (`~/.hermes/scripts/range_observer_test.py`):
- Connect `ws://host:8095/ws/tv/{room}` → terima `ROOM_READY`.
- Simulasi HP: kirim `aim` + `fire` → TV menerima `AIM_UPDATE`/`TRIGGER_FIRE`.
- **Peringatan**: observer = klien TV kedua → HANYA untuk uji, matikan sebelum main (mencuri slot TV!).

## 4. Manual / Hardware Test (wajib untuk input & rendering)
| Skenario | Langkah | Lulus jika |
|---|---|---|
| **Kalibrasi** | APK → KALIBRASI → tembak 5 titik (tengah + 4 pojok) | Semua titik terlihat utuh; "KALIBRASI SELESAI" |
| **Inversi** | Gerakkan HP atas-bawah, kiri-kanan | Crosshair ikut arah yang BENAR (tidak terbalik) |
| **Grip vertikal** | HP vertikal, layar kiri | Mapping tetap benar (affine menyerap) |
| **Latensi** | Gerak cepat HP, amati crosshair | Tidak terasa lag (>15 ms) |
| **Reload** | Tembak habis amunisi → reload | Amunisi terisi; animasi reload di TV |
| **Skor/combo** | Hit beruntun + miss | Combo naik/turun sesuai aturan PRD |
| **Cache** | Restart TV app | Badge versi = terbaru (bukan versi lama) |
| **Resolusi** | TV 720p & laptop 1080p | Layout penuh, tidak terpotong, target di pojok benar |

## 5. Performance
- TV 720p: 60 FPS stabil saat partikel ledakan (Pantau via DevTools/`performance` jika memungkinkan).
- RAM: tidak ada kebocoran partikel pool (cap 500 partikel aktif).

## 6. Rekomendasi Alur
1. Unit/integration test hijau di server.
2. Build APK sukses (`build.sh`).
3. Deploy ke laptop/TV → manual test.
4. Catat hasil di AUDIT_LOG.md bila ada temuan.
