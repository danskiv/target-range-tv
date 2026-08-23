# CONTRIBUTING — Range Shooter

Terima kasih ingin berkontribusi! Proyek ini dikelola dengan disiplin dokumentasi-konsisten. Ikuti alur ini.

## Sebelum Mulai
1. **Baca [`PRD-v2.md`](PRD-v2.md)** — sumber kebenaran. Fitur yang bertentangan dengan PRD akan ditolak.
2. Baca [`CONVENTIONS.md`](docs/CONVENTIONS.md) — versioning & dependency map.
3. Baca [`CODING_STANDARD.md`](CODING_STANDARD.md) — gaya kode.
4. Cek [`CHANGELOG.md`](CHANGELOG.md) & [`AUDIT_LOG.md`](AUDIT_LOG.md) — status terkini.

## Alur Kontribusi
1. **Diskusikan dulu** (issue/chat): fitur besar WAJIB disetujui sebelum coding — PRD harus diubah DULU, baru kode.
2. **Fork / branch**: `feat/<nama-fitur>` atau `fix/<nama-bug>`.
3. **TDD**: tulis test gagal → implementasi → test hijau (lihat TESTING.md).
4. **Konsistensi**: setiap perubahan kode = perbarui dokumen terkait (PRD/API/CHANGELOG) dalam SATU commit.
5. **Commit**: `type(scope): subject` (English), satu perubahan logis per commit.
6. **Push & PR**: target `main`; sertakan ringkasan + hasil test.

## Checklist Sebelum Commit
- [ ] Test unit/integration hijau
- [ ] Uji manual di TV/HP (jika menyentuh input/rendering)
- [ ] CHANGELOG diperbarui
- [ ] Dokumen terkait sinkron (PRD/API/ADR bila perlu)
- [ ] Cache-bust dinaikkan bila asset statis berubah
- [ ] Tidak ada hardcode resolusi; layout responsif
- [ ] Skor integer; payload throttle ≤60 Hz

## Area yang Peka (hati-hati!)
- **Race condition kuota/aksi** — jangan rombak executor/loop aim tanpa uji.
- **Slot TV tunggal** — jangan tambah koneksi TV kedua ke room yang sama.
- **Kalibrasi** — koordinat titik WAJIB sinkron TV ↔ APK.
- **Cache WebView TV** — selalu bump `?v=` + verifikasi badge versi di layar.

## Pelaporan Bug
Sertakan: versi (badge TV), langkah reproduksi, screenshot/log, kondisi jaringan (WLAN/WG).
