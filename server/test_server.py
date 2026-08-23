import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from server.main import app
from server.room_manager import manager

@pytest.mark.asyncio
async def test_get_info():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/info")
        assert response.status_code == 200
        data = response.json()
        assert "server_ip" in data
        assert "default_port" in data
        assert data["default_port"] == 8095
        assert "latest_room" in data

@pytest.mark.asyncio
async def test_get_v2_page():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/v2")
        assert response.status_code == 200
        assert "Range Shooter" in response.text
        assert "tv_v2_static" in response.text

@pytest.mark.asyncio
async def test_room_manager_lifecycle():
    room_code = "TEST99"
    room = manager.create_room(room_code)
    assert room.room_code == "TEST99"
    
    player = room.add_player("P1", None, "Pilot 1")
    assert player.player_id == "P1"
    assert "P1" in room.players
    assert len(room.players) == 1
    
    room.remove_player("P1")
    assert "P1" not in room.players
    assert len(room.players) == 0

@pytest.mark.asyncio
async def test_rest_api_aim_and_action():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Aim update
        res_aim = await ac.post("/api/controller/aim", json={
            "room_code": "TEST99",
            "player_id": "P1",
            "x": 0.5,
            "y": 0.5
        })
        assert res_aim.status_code == 200
        assert res_aim.json() == {"status": "ok"}
        
        # Action update
        res_act = await ac.post("/api/controller/action", json={
            "room_code": "TEST99",
            "player_id": "P1",
            "action": "shoot"
        })
        assert res_act.status_code == 200
        assert res_act.json() == {"status": "ok"}
