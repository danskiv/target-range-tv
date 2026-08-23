# 02-SENSOR-GYRO-MATH — Formula Matematika Sensor & Pointer Smoothing
**Target Range TV: Absolute Orientation, Clamping, Deadzone, & Interpolasi LERP**
*Version: v1.0.0*

---

## 1. Sistem Koordinat & Pembacaan Sensor HP

Browser mobile menyediakan event `deviceorientation` yang menghasilkan tiga sudut rotasi Euler:
1. $\alpha$ (**Alpha / Yaw**): Rotasi horizontal mengelilingi sumbu Z ($0^\circ$ s.d. $360^\circ$).
2. $\beta$ (**Beta / Pitch**): Kemiringan depan-ke-belakang mengelilingi sumbu X ($-180^\circ$ s.d. $180^\circ$). Saat HP dipegang tegak lurus mengarah ke TV, nilai $\beta \approx 90^\circ$.
3. $\gamma$ (**Gamma / Roll**): Kemiringan kiri-ke-kanan mengelilingi sumbu Y ($-90^\circ$ s.d. $90^\circ$).

---

## 2. Mekanisme Kalibrasi Titik Nol (Zero-Point Calibration)

Saat pemain mengarahkan HP ke tengah layar TV dan menekan tombol **"KALIBRASI"**, controller menyimpan sudut acuan netral:
$$\beta_{\text{origin}} = \beta_{\text{saat\_ini}}$$
$$\gamma_{\text{origin}} = \gamma_{\text{saat\_ini}}$$

Setiap pembaruan sensor berikutnya dihitung secara **relatif murni** terhadap titik acuan tersebut:
$$\Delta \text{Pitch} = \beta - \beta_{\text{origin}}$$
$$\Delta \text{Yaw/Roll} = \gamma - \gamma_{\text{origin}}$$

---

## 3. Pemetaan ke Resolusi Layar TV ($1920 \times 1080$)

Untuk mengubah selisih sudut fisik tangan menjadi koordinat piksel layar TV $(X, Y)$:

$$X_{\text{target}} = \frac{W_{\text{screen}}}{2} + (\Delta \text{Yaw} \times S_x)$$
$$Y_{\text{target}} = \frac{H_{\text{screen}}}{2} + (\Delta \text{Pitch} \times S_y)$$

Di mana:
- $W_{\text{screen}} = 1920$, $H_{\text{screen}} = 1080$
- $S_x$ (Horizontal Sensitivity) $\approx 45 \text{ px/derajat}$
- $S_y$ (Vertical Sensitivity) $\approx 35 \text{ px/derajat}$

### Batas Tepi Layar (Clamping Guard):
Agar kursor tidak hilang keluar dari batas pandang layar TV:
$$X = \max(0, \min(W_{\text{screen}}, X_{\text{target}}))$$
$$Y = \max(0, \min(H_{\text{screen}}, Y_{\text{target}}))$$

---

## 4. Penghalusan Gerakan Bidikan (Linear Interpolation / LERP)

Jika koordinat mentah langsung digambar ke layar TV, getaran mikro (*tremor*) dari tangan manusia akan membuat titik bidik (*crosshair*) bergetar kasar (*jittering*).

Untuk menghasilkan gerakan bidikan yang mulus (*smooth aim*) pada 60 FPS:

$$X_{\text{render}} = X_{\text{prev}} + (X_{\text{target}} - X_{\text{prev}}) \times \alpha_{\text{lerp}}$$
$$Y_{\text{render}} = Y_{\text{prev}} + (Y_{\text{target}} - Y_{\text{prev}}) \times \alpha_{\text{lerp}}$$

- Nilai ideal $\alpha_{\text{lerp}} = \mathbf{0.25 \dots 0.35}$
- *Analogi*: $\alpha = 1.0$ berarti gerakan instan tanpa filter (kasar), sedangkan $\alpha = 0.05$ berarti sangat halus tetapi terasa ada jeda (*sluggish input lag*). Nilai $0.3$ memberikan keseimbangan sempurna antara keakuratan instan dan kehalusan visual.

---

## 5. Deadzone Filter (Penyaring Getaran Mikro)

Untuk menjaga kestabilan saat pemain berusaha menahan nafas membidik sasaran kecil (Bullseye):
Jika $|\Delta \text{Pitch}| < 0.1^\circ$ dan $|\Delta \text{Yaw}| < 0.1^\circ$, abaikan pembaruan posisi (*Deadzone Activated*) sehingga titik bidik tetap diam kokoh.
