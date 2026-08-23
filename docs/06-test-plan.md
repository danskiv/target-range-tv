# 06-TEST-PLAN — Rencana Pengujian Komprehensif
**Target Range TV: Uji Fungsional, Kalibrasi Sensor, Latensi, & Kestabilan TV**
*Version: v1.0.0*

---

## 1. Matriks Pengujian Fungsional

| ID Tes | Modul | Skenario Pengujian | Hasil yang Diharapkan |
|---|---|---|---|
| **TC-01** | Pairing | Scan QR Code TV menggunakan HP | HP langsung membuka URL controller dan status TV berubah menjadi "Pemain 1 Terhubung". |
| **TC-02** | Kalibrasi | Tekan tombol "KALIBRASI" saat HP mengarah ke tengah TV | Koordinat crosshair di TV langsung berada di $(X=960, Y=540)$ [Titik Tengah 1080p]. |
| **TC-03** | Deadzone | HP diletakkan diam di atas meja datar | Titik bidik di TV tetap diam kokoh tanpa getaran mikro (jitter). |
| **TC-04** | Tembakan | Tekan layar HP (Pelatuk) | TV menampilkan kilatan tembakan (*Muzzle Flash*), memutar suara tembakan, amunisi berkurang 1, dan HP bergetar (haptic recoil). |
| **TC-05** | Amunisi Kosong | Tekan pelatuk saat amunisi 0 | TV memutar suara *Click/Dry Fire*, tidak ada tembakan yang keluar, HP menampilkan indikator "RELOAD!". |
| **TC-06** | Reload | Goyangkan HP ke atas (*Flick Up*) atau tekan tombol reload | Amunisi terisi kembali menjadi 6 butir, terdengar efek suara kokang senjata. |
| **TC-07** | Hit Detection (Bullseye) | Menembak tepat di titik merah tengah lingkaran | Poin bertambah $+100$, combo bertambah $+1$, teks "BULLSEYE!" muncul di TV. |
| **TC-08** | Hit Detection (Meleset) | Menembak ke area kosong tanpa target | Combo multiplier direset kembali ke $1\times$, terdengar suara peluru memantul tembok (*Ricochet*). |
| **TC-09** | Target Sandera | Menembak sasaran warga sipil | Skor berkurang $-100$ poin, layar TV berkedip merah penalti, combo direset ke $1\times$. |
| **TC-10** | Barel Peledak | Menembak barel bom dinamit | Terjadi ledakan area, semua target dalam radius 200px ikut hancur dan poin dihitung kumulatif. |

---

## 2. Pengujian Latensi Jaringan & Stabilitas Hardware TV

| ID Tes | Fokus Uji | Parameter Uji | Ambang Batas Lulus (*Pass Threshold*) |
|---|---|---|---|
| **TC-11** | Latensi WebSocket | RTT Paket data gerak dari HP $\rightarrow$ TV di jaringan Wi-Fi 5 GHz | Latensi rata-rata $< 15$ ms, tidak ada stutter visual. |
| **TC-12** | Frame Rate TV | Performa render Canvas 2D di TV selama 60 detik match | Konsisten pada $\ge 55$ FPS tanpa frame drop parah. |
| **TC-13** | TV Memory Leak | Menjalankan 10 match berturut-turut di browser TV | Penggunaan RAM stabil $< 60$ MB (Object Pooling berhasil mencegah leak). |
| **TC-14** | Disconnect Graceful | HP mematikan layar / menutup browser saat match berlangsung | TV menampilkan status "Pemain Terputus", kursor pemain dihapus dari layar, game tidak crash. |
| **TC-15** | Reconnect | HP membuka kembali halaman controller dalam waktu 30 detik | Controller otomatis bergabung kembali ke match yang sedang berjalan tanpa merusak skor. |
