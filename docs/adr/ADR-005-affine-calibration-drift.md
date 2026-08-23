# ADR-005 — Kalibrasi 5-Titik Affine + Drift-Damping Otomatis

## Status
**ACCEPTED** (v2.0.0-draft — 2026-08-23) · **SUPERSEDES** desain kalibrasi titik-nol v1 (sebagian)

## Konteks
Umpan balik pengguna (2026-08-23): "atas bawahnya inverte ya, dan saya mau pegang HP-nya vertikal, layar menghadap ke kiri. untuk di awal kalibrasinya nembak titik-titik di pojokan dan tengah". Kalibrasi titik-nol tunggal (v1) tidak dapat menyerap: (a) inversi sumbu akibat grip, (b) offset orientasi acak, (c) sensitivitas yang berbeda per sumbu.

## Keputusan
1. **Kalibrasi 5 titik affine**: pemain menembak 5 titik berurutan (tengah → kiri-atas → kanan-atas → kanan-bawah → kiri-bawah) pada koordinat normalized `0.05/0.50/0.95`. Transformasi affine 6 parameter dihitung di APK dan disimpan di `SharedPreferences("range_calib")`.
2. **Guard kualitas**: transform ditolak jika residual fit >30% (meleset) atau semua-koefisien nol (degenerate) → tombol "KALIBRASI GAGAL — ulangi dari awal". Kalibrasi rusak yang tersimpan **dinetralkan** saat load (crosshair kembali ke mapping dasar, tidak mentok pojok).
3. **Titik konsisten di kedua sisi**: koordinat titik identik di TV (engine.js `calibPoints`) dan APK (MainActivity `CALIB_POINTS`) — ketidakcocokan = mapping meleset.
4. **Drift-damping otomatis (v2, baru)**: deteksi drift statis (HP diam tetapi crosshair bergeser) → koreksi halus bertahap; deadzone sudut `<0.10°` untuk kestabilan bullseye.
5. **Kurva sensitivitas (v2, opsional)**: kurva non-linear untuk mikro-aim presisi.

## Konsekuensi
- **Positif**: menyerap inversi sumbu, grip bebas (vertikal/layar-kiri), perbedaan skala sumbu; kalibrasi ulang kapan saja; profil per HP.
- **Negatif**: 5 tembakan wajib (bukan 1); titik pojok harus terlihat penuh — radius dot dibatasi (≤32 px) dan label pintar agar tidak terpotong.
- **Pelajaran v1**: titik kalibrasi `0.12` terasa "mengambang"; `0.05/0.95` = pojok sejati; canvas **harus responsif** (hardcode 1920x1080 di layar 720p menggeser semua koordinat).
