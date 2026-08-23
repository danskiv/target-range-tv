# 05-GAME-LOOP-AND-STATES — Diagram State Machine & Alur Permainan
**Target Range TV: Siklus Hidup Permainan & Transisi Status**
*Version: v1.0.0*

---

## 1. Diagram State Machine Global

```
  ┌─────────────────────────────────────────────────────────────┐
  │                           [ LOBBY ]                         │
  │       (TV menampilkan Room Code, QR Code, Daftar Pemain)     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                 Pemain menekan "MULAI" di HP / TV
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                        [ COUNTDOWN ]                        │
  │             (Aba-aba 3.. 2.. 1.. FIRE! di Layar TV)         │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                            Timer = 0
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                         [ PLAYING ]                         │
  │  - Spawning Target (Statis, Bergerak, Pop-Up, Bom)         │
  │  - Hit Detection & Combo Counter                            │
  │  - Real-time Score Tracking                                 │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                      Waktu Ronde Habis (60s)
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                       [ ROUND_OVER ]                        │
  │     (Animasi Tembakan Terakhir, Freeze Frame & Efek Lonceng)│
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                             Otomatis
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                      [ LEADERBOARD ]                        │
  │ - Skor Akhir, Akurasi (%), Gelar Ketangkasan, Rekor Baru   │
  │ - Opsi: "Main Lagi" (Restart) atau "Kembali ke Lobby"       │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Alur Spawn Sasaran (Target Wave Progression)

Ronde 60 Detik dibagi menjadi 4 Fase Dinamis:

1. **Detik 0 – 15 (Fase Pemanasan / Warm-Up)**:
   - 3 Target Statis (Papan Lingkaran) + 2 Botol Kaca.
   - Menguji kebiasaan kalibrasi tangan pemain.
2. **Detik 16 – 35 (Fase Gerak & Refleks)**:
   - Sasaran Rel Horizontal bergerak melintas kiri-ke-kanan.
   - Muncul sasaran Pop-Up dari balik barikade selama 2 detik.
3. **Detik 36 – 50 (Fase Bahaya & Piring Terbang)**:
   - Target Clay Pigeon melayang cepat di udara.
   - Muncul **Target Sandera (Warga Sipil)** di samping target poin. Pemain harus berhati-hati agar tidak terkena penalti.
   - Barel Peledak muncul di tengah kerumunan target.
4. **Detik 51 – 60 (Fase Frenzy & Bonus Rush)**:
   - Hujan target muncul serentak di seluruh layar.
   - Poin berlipat ganda (*Double Points Frenzy*).
