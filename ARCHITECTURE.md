# ARCHITECTURE — Range Shooter

Ringkasan arsitektur v2. Detail lengkap: [`docs/01-architecture-spec.md`](docs/01-architecture-spec.md) dan ADR di [`docs/adr/`](docs/adr/).

```
┌──────────────────┐        WebSocket / REST         ┌──────────────────┐
│  LAYAR TV        │ ◄──────────────────────────────► │  SERVER HUB      │
│  (WebView APK)   │      ws://:8095/ws/tv/{room}     │  FastAPI+Uvicorn │
│  PixiJS WebGL2   │                                  │  :8095           │
│  Neon Arena      │                                  │  room_manager    │
└──────────────────┘                                  │  static /v2      │
                                                      └────────▲─────────┘
                          WebSocket (v2)                       │ REST (uji)
┌──────────────────┐        /ws/ctrl/{room}                    │
│  HP CONTROLLER   │ ◄─────────────────────────────────────────┘
│  APK native      │
│  SensorManager   │
│  rotation vector │
└──────────────────┘
```

## Alur Data (Input)

1. **HP**: `TYPE_ROTATION_VECTOR` → quaternion → pitch/roll/yaw → transformasi **affine kalibrasi 5-titik** (tersimpan `SharedPreferences "range_calib"`) → koordinat normalized `{x, y}`.
2. **HP → Server**: WebSocket `{type:"aim", x, y, player_id}` (throttle 30–60 Hz) atau `{type:"action", action:"fire"|"reload"|"start_game"|"calib_*"}`.
3. **Server → TV**: relay + event game (`TRIGGER_FIRE`, `CALIB_START`, `START_GAME_REQ`, dll).
4. **TV**: PixiJS render → target, partikel, HUD; deteksi hit via bounding box.

## Prinsip Wajib (terbukti dari v1 — jangan dilanggar)

1. **Satu slot TV per room** (`room.tv_socket`) — observer/klien kedua membuat TV tuli.
2. **Responsive canvas** — dilarang hardcode resolusi (1920x1080 menyalahi TV 720p).
3. **Cache-bust `?v=` + no-cache headers + badge versi** — melawan cache WebView TV.
4. **Kalibrasi berkualitas** — tolak transform degenerate; koordinat 0.05/0.95 konsisten TV↔APK.
5. **Action executor terpisah dari aim loop** di APK (monopoli = aksi kelaparan).
6. **Server-side rooms** — satu room per sesi, TV join room terbaru dari `/api/info`.
7. **Skor integer murni** — tidak ada float untuk poin.

## Keputusan Arsitektur (ADR)

| ADR | Keputusan | Status |
|---|---|---|
| 001 | Web controller zero-install | **SUPERSEDED** (gagal di HTTP LAN — secure context) |
| 002 | LERP smoothing + deadzone client-side | Active (v1, diteruskan) |
| 003 | **Input = APK native WebSocket** | ACCEPTED (v2) |
| 004 | **Renderer PixiJS WebGL2** + fallback Canvas | ACCEPTED (v2) |
| 005 | **Kalibrasi 5-titik affine + drift-damping** | ACCEPTED (v2) |

## Dependensi Teknis

- Server: `fastapi`, `uvicorn`, `websockets`, `qrcode`
- TV v2: `pixi.js` (CDN lokal, cache-bust)
- APK: Android SDK (aapt/dx/apksigner via `build.sh`), tanpa Gradle
