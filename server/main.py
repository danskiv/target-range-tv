import io
import json
import socket
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
import qrcode
from server.room_manager import manager

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Target Range TV Hub", version="1.0.0")

# Mount static directories
app.mount("/tv_static", StaticFiles(directory=str(BASE_DIR / "tv")), name="tv_static")
app.mount("/ctrl_static", StaticFiles(directory=str(BASE_DIR / "controller")), name="ctrl_static")

def get_server_ip() -> str:
    # Prefer VPN IP 10.10.10.1 if available
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.10.10.5", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "10.10.10.1"

@app.get("/", response_class=HTMLResponse)
async def index_redirect():
    return """
    <html>
        <head><title>Target Range TV</title></head>
        <body style="background:#0f172a; color:#f8fafc; font-family:sans-serif; text-align:center; padding-top:50px;">
            <h1>🎯 Target Range TV Hub</h1>
            <p>Pilih mode perangkat:</p>
            <div style="margin-top:20px;">
                <a href="/tv" style="display:inline-block; padding:12px 24px; background:#3b82f6; color:#fff; text-decoration:none; border-radius:8px; margin:10px;">📺 Buka Layar TV / Laptop (/tv)</a>
                <a href="/controller" style="display:inline-block; padding:12px 24px; background:#10b981; color:#fff; text-decoration:none; border-radius:8px; margin:10px;">📱 Buka Controller HP (/controller)</a>
            </div>
        </body>
    </html>
    """

@app.get("/tv", response_class=HTMLResponse)
async def tv_page():
    html_file = BASE_DIR / "tv" / "index.html"
    return HTMLResponse(content=html_file.read_text())

@app.get("/controller", response_class=HTMLResponse)
async def controller_page(room: str = ""):
    html_file = BASE_DIR / "controller" / "index.html"
    return HTMLResponse(content=html_file.read_text())

@app.get("/api/qr")
async def generate_qr(url: str):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#000000", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")

@app.get("/api/info")
async def get_info():
    ip = get_server_ip()
    # Find latest active room if any
    active_rooms = list(manager.rooms.keys())
    latest_room = active_rooms[-1] if active_rooms else "TG88"
    return {
        "server_ip": ip,
        "default_port": 8095,
        "active_rooms": active_rooms,
        "latest_room": latest_room
    }

# ==================== NATIVE HTTP REST API (FALLBACK & ZERO-WS) ====================

@app.post("/api/controller/aim")
async def api_controller_aim(request: Request):
    try:
        data = await request.json()
        room_code = data.get("room_code", "TG88").upper()
        room = manager.get_room(room_code)
        if room and room.tv_socket:
            await room.broadcast_to_tv({
                "type": "AIM_UPDATE",
                "player_id": data.get("player_id", "P1"),
                "x": data.get("x", 0.5),
                "y": data.get("y", 0.5),
                "pitch": data.get("pitch", 0.0),
                "roll": data.get("roll", 0.0),
                "yaw": data.get("yaw", 0.0)
            })
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/controller/action")
async def api_controller_action(request: Request):
    try:
        data = await request.json()
        room_code = data.get("room_code", "TG88").upper()
        action_type = data.get("action") # "shoot", "reload", "start_game", "calibrate"
        room = manager.get_room(room_code)
        if room and room.tv_socket:
            if action_type == "shoot":
                await room.broadcast_to_tv({"type": "TRIGGER_FIRE", "player_id": data.get("player_id", "P1")})
            elif action_type == "reload":
                await room.broadcast_to_tv({"type": "RELOAD_ACTION", "player_id": data.get("player_id", "P1")})
            elif action_type == "start_game":
                await room.broadcast_to_tv({"type": "START_GAME_REQ", "player_id": data.get("player_id", "P1")})
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==================== WEBSOCKET ENDPOINTS ====================

@app.websocket("/ws/tv/{room_code}")
async def ws_tv_endpoint(websocket: WebSocket, room_code: str):
    await websocket.accept()
    room_code = room_code.upper()
    room = manager.get_room(room_code)
    if not room:
        room = manager.create_room(room_code)
    room.tv_socket = websocket
    
    # Notify TV of successful room creation/binding
    await websocket.send_json({
        "type": "ROOM_READY",
        "room_code": room_code,
        "players": [{"id": p.player_id, "name": p.name, "color": p.color} for p in room.players.values()]
    })

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "GAME_STATE_SYNC":
                room.state = data.get("state", room.state)
                await room.broadcast_to_controllers(data)
                
            elif event_type == "HIT_CONFIRMATION":
                target_pid = data.get("player_id")
                if target_pid:
                    await room.send_to_player(target_pid, data)
                    
            elif event_type == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        room.tv_socket = None
    except Exception as e:
        print(f"[TV WS Error] {e}")
        room.tv_socket = None

@app.websocket("/ws/controller/{room_code}")
async def ws_controller_endpoint(websocket: WebSocket, room_code: str):
    await websocket.accept()
    room_code = room_code.upper()
    room = manager.get_room(room_code)
    if not room:
        # If room does not exist, auto-create it so controller never fails to connect
        room = manager.create_room(room_code)

    player_id = f"P{len(room.players) + 1}"
    player = room.add_player(player_id, websocket, f"Pendekar {len(room.players)+1}")

    # Acknowledge controller
    await websocket.send_json({
        "type": "CONTROLLER_JOINED_ACK",
        "player_id": player.player_id,
        "player_name": player.name,
        "assigned_color": player.color,
        "room_code": room_code,
        "game_state": room.state
    })

    # Broadcast player joined to TV
    await room.broadcast_to_tv({
        "type": "PLAYER_JOINED",
        "player_id": player.player_id,
        "player_name": player.name,
        "color": player.color
    })

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            data["player_id"] = player.player_id
            data["room_code"] = room_code

            if event_type == "AIM_UPDATE":
                await room.broadcast_to_tv(data)

            elif event_type == "TRIGGER_FIRE":
                await room.broadcast_to_tv(data)

            elif event_type == "RELOAD_ACTION":
                player.ammo = player.max_ammo
                await room.broadcast_to_tv(data)

            elif event_type == "CALIBRATE_ZERO":
                await room.broadcast_to_tv(data)

            elif event_type == "START_GAME_REQ":
                await room.broadcast_to_tv(data)

            elif event_type == "PING":
                await websocket.send_json({"type": "PONG"})

    except WebSocketDisconnect:
        room.remove_player(player.player_id)
        await room.broadcast_to_tv({
            "type": "PLAYER_LEFT",
            "player_id": player.player_id
        })
    except Exception as e:
        print(f"[Controller WS Error] {e}")
        room.remove_player(player.player_id)
        await room.broadcast_to_tv({
            "type": "PLAYER_LEFT",
            "player_id": player.player_id
        })
