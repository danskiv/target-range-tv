# 03-WEBSOCKET-PROTOCOL — Protokol Komunikasi & Event Contracts
**Target Range TV: Skema Data Real-time WebSocket**
*Version: v1.0.0*

---

## 1. Format Pesan Standar (Message Envelope)

Semua komunikasi antar entitas menggunakan format JSON ringkas dengan struktur standar:
```json
{
  "type": "EVENT_TYPE_NAME",
  "room_code": "TG88",
  "player_id": "P1",
  "payload": {},
  "timestamp": 1724398200123
}
```

---

## 2. Katalog Event

### A. Siklus Sesi (Lobby & Pairing)
1. `ROOM_CREATED` (TV $\rightarrow$ Server):
   - Dikirim saat TV membuka aplikasi dan meminta room baru.
   - Payload: `{"room_code": "TG88"}`
2. `CONTROLLER_JOIN` (HP $\rightarrow$ Server $\rightarrow$ TV):
   - Dikirim saat pemain membuka web controller dan memasukkan/scan Room Code.
   - Payload: `{"player_name": "Pendekar 1", "color": "#3B82F6"}`
3. `CONTROLLER_JOINED_ACK` (Server $\rightarrow$ HP):
   - Konfirmasi bahwa controller berhasil terhubung.
   - Payload: `{"player_id": "P1", "assigned_color": "#3B82F6", "status": "CONNECTED"}`

---

### B. Aliran Data Permainan (Gameplay Streams)
1. `AIM_UPDATE` (HP $\rightarrow$ Server $\rightarrow$ TV) *(Throttled 30-60 Hz)*:
   - Mengirim koordinat bidikan ternormalisasi dari HP ke TV.
   - Payload: 
     ```json
     {
       "pitch": 4.25,
       "yaw": -12.80,
       "raw_beta": 88.4,
       "raw_gamma": 3.1
     }
     ```
2. `TRIGGER_FIRE` (HP $\rightarrow$ Server $\rightarrow$ TV):
   - Dikirim saat pemain menekan pelatuk tembakan di HP.
   - Payload: 
     ```json
     {
       "ammo_left": 5,
       "fire_id": 104
     }
     ```
3. `RELOAD_ACTION` (HP $\rightarrow$ Server $\rightarrow$ TV):
   - Dikirim saat pemain melakukan gerakan flick up atau tombol reload.
   - Payload: `{"ammo_refilled": 6}`
4. `CALIBRATE_ZERO` (HP $\rightarrow$ Server $\rightarrow$ TV):
   - Memberitahu TV bahwa pemain baru saja mengkalibrasi ulang titik tengah $(0,0)$.

---

### C. Feedback & Status Game (TV $\rightarrow$ Controller)
1. `HIT_CONFIRMATION` (TV $\rightarrow$ Server $\rightarrow$ HP):
   - Memberitahu controller bahwa tembakan mengenai sasaran tertentu untuk memicu getaran haptic khusus (misal: getaran panjang jika *Bullseye*).
   - Payload: 
     ```json
     {
       "target_type": "BULLSEYE",
       "points_earned": 100,
       "current_combo": 4
     }
     ```
2. `GAME_STATE_CHANGE` (TV $\rightarrow$ Server $\rightarrow$ HP):
   - Status: `LOBBY` | `COUNTDOWN` | `PLAYING` | `ROUND_OVER` | `LEADERBOARD`
