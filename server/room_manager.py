import asyncio
import json
import random
import string
import time
from typing import Dict, List, Optional, Any
from fastapi import WebSocket

class Player:
    def __init__(self, player_id: str, websocket: WebSocket, name: str = "Player", color: str = "#3B82F6"):
        self.player_id = player_id
        self.websocket = websocket
        self.name = name
        self.color = color
        self.score = 0
        self.ammo = 6
        self.max_ammo = 6
        self.last_aim = {"pitch": 0.0, "yaw": 0.0}
        self.last_ping = time.time()

class GameRoom:
    def __init__(self, room_code: str):
        self.room_code = room_code
        self.tv_socket: Optional[WebSocket] = None
        self.players: Dict[str, Player] = {}
        self.state = "LOBBY"  # LOBBY, COUNTDOWN, PLAYING, ROUND_OVER, LEADERBOARD
        self.color_palette = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B"]  # Blue, Red, Green, Yellow
        self.created_at = time.time()

    def add_player(self, player_id: str, ws: WebSocket, name: str) -> Player:
        color = self.color_palette[len(self.players) % len(self.color_palette)]
        player = Player(player_id, ws, name, color)
        self.players[player_id] = player
        return player

    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]

    async def broadcast_to_tv(self, message: Dict[str, Any]):
        if self.tv_socket:
            try:
                await self.tv_socket.send_json(message)
            except Exception:
                self.tv_socket = None

    async def broadcast_to_controllers(self, message: Dict[str, Any]):
        disconnected = []
        for pid, player in self.players.items():
            try:
                await player.websocket.send_json(message)
            except Exception:
                disconnected.append(pid)
        for pid in disconnected:
            self.remove_player(pid)

    async def send_to_player(self, player_id: str, message: Dict[str, Any]):
        if player_id in self.players:
            try:
                await self.players[player_id].websocket.send_json(message)
            except Exception:
                self.remove_player(player_id)

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}

    def generate_room_code(self) -> str:
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Avoid confusing O/0, I/1
        while True:
            code = "".join(random.choices(chars, k=4))
            if code not in self.rooms:
                return code

    def create_room(self, code: Optional[str] = None) -> GameRoom:
        room_code = code or self.generate_room_code()
        room = GameRoom(room_code)
        self.rooms[room_code] = room
        return room

    def get_room(self, room_code: str) -> Optional[GameRoom]:
        return self.rooms.get(room_code.upper())

    def cleanup_empty_rooms(self):
        now = time.time()
        to_delete = []
        for code, room in self.rooms.items():
            if not room.tv_socket and len(room.players) == 0 and (now - room.created_at > 300):
                to_delete.append(code)
        for code in to_delete:
            del self.rooms[code]

manager = RoomManager()
