# ADR-002 — Client-Side LERP Pointer Smoothing

## Status
**ACCEPTED** (v1.0.0 — 2026-08-23)

## Konteks
Sensor Gyroscope pada smartphone komersial memiliki getaran mikro alami (*natural hand tremor*) dan fluktuasi sinyal frekuensi tinggi. Jika koordinat mentah dari HP langsung diplot ke layar TV, titik bidik (*crosshair*) akan bergetar kasar (*jittering*), merusak pengalaman membidik pemain. Di sisi lain, jika penghalusan terlalu berat, pemain akan merasakan lag (*sluggishness*).

## Keputusan
Menerapkan formula **Linear Interpolation (LERP)** di sisi render client (Layar TV):
$$X_{\text{render}} = X_{\text{prev}} + (X_{\text{target}} - X_{\text{prev}}) \times \alpha$$
dengan koefisien bobot $\alpha = 0.30$.

Ditambah dengan **Deadzone Filter**:
Jika pergeseran sudut fisik $< 0.10^\circ$, pembaruan posisi diabaikan untuk menjaga bidikan tetap stabil kokoh saat pemain menahan nafas membidik Bullseye.

## Konsekuensi
- **Positif**:
  - Titik bidik terlihat sangat mulus layaknya kursor laser arcade profesional.
  - Beban komputasi LERP sangat rendah (hanya 2 operasi aritmatika per frame di TV).
- **Negatif**:
  - Menimbulkan jeda persepsi visual mikro sekitar 1–2 frame (16–32 ms), namun sangat dapat ditoleransi dan justru terasa lebih realistis sebagai bobot senjata.
