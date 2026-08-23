class GameEngine {
    constructor() {
        this.canvas = document.getElementById('tv-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 1920;
        this.height = 1080;
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.roomCode = 'TG' + Math.floor(Math.random() * 89 + 10);
        this.ws = null;
        this.state = 'LOBBY'; // LOBBY, COUNTDOWN, PLAYING, ROUND_OVER

        // Players: { id: { name, color, currentX, currentY, targetX, targetY, score, combo, ammo } }
        this.players = {};

        this.timeLeft = 60;
        this.matchTimerInterval = null;

        this.initNetworking();
        this.bindEvents();
        this.startLoop();
    }

    async initNetworking() {
        const infoRes = await fetch('/api/info');
        const info = await infoRes.json();
        const serverIp = info.server_ip;

        // Setup QR code
        const port = info.default_port || window.location.port || 8095;
        const controllerUrl = `http://${serverIp}:${port}/controller?room=${this.roomCode}`;
        document.getElementById('qr-image').src = `/api/qr?url=${encodeURIComponent(controllerUrl)}`;
        document.getElementById('room-code-display').textContent = this.roomCode;
        document.getElementById('hud-room-code').textContent = `ROOM: ${this.roomCode}`;

        // Connect WebSocket
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${proto}//${window.location.host}/ws/tv/${this.roomCode}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleSocketMessage(data);
        };
    }

    handleSocketMessage(data) {
        if (data.type === 'PLAYER_JOINED') {
            this.players[data.player_id] = {
                name: data.player_name,
                color: data.color,
                currentX: this.width / 2,
                currentY: this.height / 2,
                targetX: this.width / 2,
                targetY: this.height / 2,
                score: 0,
                combo: 1,
                streak: 0,
                ammo: 6
            };
            this.updatePlayerLobbyUI();
        } else if (data.type === 'PLAYER_LEFT') {
            delete this.players[data.player_id];
            this.updatePlayerLobbyUI();
        } else if (data.type === 'AIM_UPDATE') {
            const p = this.players[data.player_id];
            if (p) {
                // Map pitch & yaw to screen coords
                // Yaw/Roll (X) -> Sensitivity 45px/deg
                // Pitch (Y) -> Sensitivity 35px/deg
                const sensX = 45;
                const sensY = 35;
                
                const rawX = (this.width / 2) + (data.yaw * sensX);
                const rawY = (this.height / 2) + (data.pitch * sensY);

                // Screen clamping
                p.targetX = Math.max(20, Math.min(this.width - 20, rawX));
                p.targetY = Math.max(20, Math.min(this.height - 20, rawY));
            }
        } else if (data.type === 'TRIGGER_FIRE') {
            this.handlePlayerShot(data.player_id);
        } else if (data.type === 'RELOAD_ACTION') {
            const p = this.players[data.player_id];
            if (p) {
                p.ammo = 6;
                window.soundFx.playReload();
                window.particlePool.addFloatingText('RELOADED!', p.currentX, p.currentY - 40, '#38bdf8');
            }
        } else if (data.type === 'CALIBRATE_ZERO') {
            const p = this.players[data.player_id];
            if (p) {
                p.targetX = this.width / 2;
                p.targetY = this.height / 2;
                p.currentX = this.width / 2;
                p.currentY = this.height / 2;
                window.particlePool.addFloatingText('KALIBRASI OK', this.width / 2, this.height / 2, '#4ade80');
            }
        } else if (data.type === 'START_GAME_REQ') {
            if (this.state === 'LOBBY') {
                this.startCountdown();
            }
        }
    }

    updatePlayerLobbyUI() {
        const list = document.getElementById('lobby-players');
        const pKeys = Object.keys(this.players);
        if (pKeys.length === 0) {
            list.innerHTML = '<li>Menunggu pemain terhubung...</li>';
        } else {
            list.innerHTML = pKeys.map(k => `<li style="color:${this.players[k].color}">🟢 ${this.players[k].name} (Siap)</li>`).join('');
        }
    }

    handlePlayerShot(playerId) {
        if (this.state !== 'PLAYING') return;
        const p = this.players[playerId];
        if (!p) return;

        if (p.ammo <= 0) {
            window.soundFx.playDryFire();
            window.particlePool.addFloatingText('KOSONG! KOKANG SENJATA', p.currentX, p.currentY - 30, '#ef4444', 24);
            return;
        }

        p.ammo--;
        window.soundFx.playGunshot();
        
        // Spawn gunshot sparks on crosshair
        window.particlePool.spawnSpark(p.currentX, p.currentY, '#f59e0b', 12);

        // Hit Detection
        const hit = window.targetManager.checkHit(p.currentX, p.currentY);
        if (hit) {
            if (hit.type === 'HAZARD_CIVILIAN') {
                // Civilian penalty
                p.score = Math.max(0, p.score - 100);
                p.combo = 1;
                p.streak = 0;
                window.soundFx.playPenalty();
                window.particlePool.addFloatingText('-100 PENALTY!', p.currentX, p.currentY - 50, '#ef4444', 36);
            } else {
                // Success hit
                p.streak++;
                if (p.streak >= 15) p.combo = 5;
                else if (p.streak >= 10) p.combo = 3;
                else if (p.streak >= 5) p.combo = 2;
                else p.combo = 1;

                const earnedPoints = hit.points * p.combo;
                p.score += earnedPoints;

                if (hit.isCenter) {
                    window.soundFx.playBullseye();
                    window.particlePool.spawnDebris(hit.target.x, hit.target.y, '#ef4444', 16);
                    window.particlePool.addFloatingText(`BULLSEYE! +${earnedPoints}`, p.currentX, p.currentY - 50, '#facc15', 38);
                } else if (hit.type === 'BOTTLE') {
                    window.soundFx.playShatter();
                    window.particlePool.spawnDebris(hit.target.x, hit.target.y, '#10b981', 20);
                    window.particlePool.addFloatingText(`+${earnedPoints}`, p.currentX, p.currentY - 50, '#4ade80', 32);
                } else {
                    window.soundFx.playHit();
                    window.particlePool.spawnDebris(hit.target.x, hit.target.y, '#3b82f6', 12);
                    window.particlePool.addFloatingText(`+${earnedPoints}`, p.currentX, p.currentY - 50, '#60a5fa', 30);
                }

                // Notify controller for haptic
                this.ws.send(JSON.stringify({
                    type: 'HIT_CONFIRMATION',
                    player_id: playerId,
                    points: earnedPoints,
                    is_bullseye: hit.isCenter
                }));
            }
        } else {
            // Missed
            p.combo = 1;
            p.streak = 0;
        }

        this.updateHUD();
    }

    startCountdown() {
        this.state = 'COUNTDOWN';
        window.soundFx.init();
        document.getElementById('lobby-screen').style.display = 'none';
        const announce = document.getElementById('center-announcement');
        announce.style.display = 'block';

        let count = 3;
        announce.textContent = count;
        window.soundFx.playHit();

        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                announce.textContent = count;
                window.soundFx.playHit();
            } else if (count === 0) {
                announce.textContent = 'TEMBAK!';
                window.soundFx.playBullseye();
            } else {
                clearInterval(timer);
                announce.style.display = 'none';
                this.startMatch();
            }
        }, 1000);
    }

    startMatch() {
        this.state = 'PLAYING';
        this.timeLeft = 60;
        window.targetManager.reset();
        
        // Reset player scores
        Object.values(this.players).forEach(p => {
            p.score = 0;
            p.combo = 1;
            p.streak = 0;
            p.ammo = 6;
        });

        this.matchTimerInterval = setInterval(() => {
            this.timeLeft--;
            document.getElementById('hud-timer').textContent = `${this.timeLeft}s`;
            if (this.timeLeft <= 0) {
                clearInterval(this.matchTimerInterval);
                this.endMatch();
            }
        }, 1000);
    }

    endMatch() {
        this.state = 'ROUND_OVER';
        const announce = document.getElementById('center-announcement');
        announce.textContent = 'WAKTU HABIS!';
        announce.style.display = 'block';
        window.soundFx.playBullseye();

        setTimeout(() => {
            announce.style.display = 'none';
            document.getElementById('lobby-screen').style.display = 'flex';
            this.state = 'LOBBY';
        }, 5000);
    }

    updateHUD() {
        const primaryPlayer = Object.values(this.players)[0];
        if (primaryPlayer) {
            document.getElementById('hud-score').textContent = primaryPlayer.score;
            document.getElementById('hud-combo').textContent = `${primaryPlayer.combo}x`;
        }
    }

    bindEvents() {
        // Keyboard fallback on TV (Space to start)
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                if (this.state === 'LOBBY') {
                    this.startCountdown();
                }
            }
        });
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        if (this.state === 'PLAYING') {
            window.targetManager.update();
        }
        window.particlePool.update();

        // LERP Smooth crosshairs
        const alpha = 0.30;
        Object.values(this.players).forEach(p => {
            p.currentX += (p.targetX - p.currentX) * alpha;
            p.currentY += (p.targetY - p.currentY) * alpha;
        });
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Target Range Background Grid & Rails
        this.drawBackground();

        // Draw Active Targets
        if (this.state === 'PLAYING') {
            window.targetManager.render(this.ctx);
        }

        // Draw Particles & Floating Texts
        window.particlePool.render(this.ctx);

        // Draw Player Crosshairs
        Object.values(this.players).forEach(p => {
            this.drawCrosshair(p);
        });
    }

    drawBackground() {
        // Shelf bar at bottom for bottles
        this.ctx.fillStyle = '#334155';
        this.ctx.fillRect(80, this.height - 180, this.width - 160, 16);
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillRect(80, this.height - 164, this.width - 160, 4);

        // Rail conveyor at middle
        this.ctx.fillStyle = '#475569';
        this.ctx.fillRect(0, 280, this.width, 8);
    }

    drawCrosshair(p) {
        const x = p.currentX;
        const y = p.currentY;
        const radius = 24;

        this.ctx.save();
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 3;

        // Circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Center Dot
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.fill();

        // Cross Lines
        this.ctx.beginPath();
        this.ctx.moveTo(x - radius - 8, y);
        this.ctx.lineTo(x - 6, y);
        this.ctx.moveTo(x + 6, y);
        this.ctx.lineTo(x + radius + 8, y);
        this.ctx.moveTo(x, y - radius - 8);
        this.ctx.lineTo(x, y - 6);
        this.ctx.moveTo(x, y + 6);
        this.ctx.lineTo(x, y + radius + 8);
        this.ctx.stroke();

        // Player Tag
        this.ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
        this.ctx.fillStyle = p.color;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(p.name, x, y + radius + 22);

        this.ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new GameEngine();
});
