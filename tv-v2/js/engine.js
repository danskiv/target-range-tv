/* ==========================================================================
   Range Shooter v2 — Main Game Engine (PixiJS WebGL2 + Fallback)
   --------------------------------------------------------------------------
   Neon Cyber Arena (120s round, 5-point affine calibration 0.05/0.50/0.95,
   PixiJS WebGL2 responsive rendering, hybrid Web Audio/Announcer, LocalStorage HS).
   ========================================================================== */

class GameEngine {
    constructor() {
        this.container = document.getElementById('game-container');
        this.stageElem = document.getElementById('pixi-stage');

        this.width = window.innerWidth || 1280;
        this.height = window.innerHeight || 720;

        this.roomCode = 'RS88';
        this.ws = null;
        this.state = 'LOBBY'; // LOBBY, COUNTDOWN, PLAYING, ROUND_OVER

        // PixiJS components
        this.app = null;
        this.usePixi = typeof window.PIXI !== 'undefined';
        this.bgGraphics = null;
        this.calibGraphics = null;
        this.crosshairContainer = null;
        this.gridOffset = 0;

        // Subsystems
        this.audio = window.audioEngine || new AudioEngine();
        this.particles = new ParticleSystem();
        this.targets = new TargetManager();

        // Players map: { id: { name, color, currentX, currentY, targetX, targetY, score, combo, streak, ammo, maxAmmo, shotsFired, shotsHit, maxCombo, lastAimTime } }
        this.players = {};

        // 5-point calibration points (normalized 0..1, true corners 0.05/0.95)
        this.calibPoints = [
            { x: 0.50, y: 0.50, label: 'CENTER (1/5)' },
            { x: 0.05, y: 0.05, label: 'TOP-LEFT (2/5)' },
            { x: 0.95, y: 0.05, label: 'TOP-RIGHT (3/5)' },
            { x: 0.95, y: 0.95, label: 'BOTTOM-RIGHT (4/5)' },
            { x: 0.05, y: 0.95, label: 'BOTTOM-LEFT (5/5)' }
        ];
        this.calibDot = null; // { x, y, index, time }

        // Game loop & timers
        this.timeLeft = 120;
        this.timerInterval = null;
        this.lastFrameTime = performance.now();
        this.roundScore = 0;
        this.roundCombo = 1;
        this.totalShotsFired = 0;
        this.totalShotsHit = 0;
        this.highestCombo = 1;

        // Local Storage High Scores Key
        this.HS_KEY = 'RANGE_SHOOTER_V2_HIGHSCORES';

        this.init();
    }

    async init() {
        this.initDOM();
        this.loadHighScores();
        await this.initPixi();
        this.initNetworking();
        this.bindEvents();
        this.startGameLoop();
    }

    initDOM() {
        // Cache UI elements
        this.ui = {
            hud: document.getElementById('hud-layer'),
            hudRoom: document.getElementById('hud-room-code'),
            hudTimer: document.getElementById('hud-timer'),
            hudCombo: document.getElementById('hud-combo'),
            hudScore: document.getElementById('hud-score'),
            hudAmmo: document.getElementById('hud-ammo'),
            centerAnnounce: document.getElementById('center-announcement'),
            lobby: document.getElementById('lobby-screen'),
            lobbyRoom: document.getElementById('lobby-room-code'),
            lobbyPlayers: document.getElementById('lobby-players'),
            connStatus: document.getElementById('conn-status'),
            connText: document.getElementById('conn-text'),
            hsPreview: document.getElementById('hs-preview'),
            gameOver: document.getElementById('game-over-screen'),
            gsScore: document.getElementById('gs-score'),
            gsAccuracy: document.getElementById('gs-accuracy'),
            gsCombo: document.getElementById('gs-combo'),
            gsRank: document.getElementById('gs-rank'),
            gsBonus: document.getElementById('gs-bonus'),
            hsList: document.getElementById('hs-list'),
            calibHint: document.getElementById('calib-hint')
        };
    }

    async initPixi() {
        try {
            if (this.usePixi) {
                this.app = new PIXI.Application();
                await this.app.init({
                    width: this.width,
                    height: this.height,
                    backgroundColor: 0x0a0f1e,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true,
                    powerPreference: 'high-performance'
                });
                this.stageElem.appendChild(this.app.canvas);

                // Background layer
                this.bgGraphics = new PIXI.Graphics();
                this.app.stage.addChild(this.bgGraphics);

                // Target layer
                const targetContainer = new PIXI.Container();
                this.app.stage.addChild(targetContainer);
                this.targets.setStage(targetContainer);
                this.targets.setViewport(this.width, this.height);

                // Particles layer
                this.particles.initPixi(this.app.stage);

                // Calibration layer
                this.calibGraphics = new PIXI.Graphics();
                this.calibGraphics.zIndex = 100;
                this.app.stage.addChild(this.calibGraphics);

                // Crosshairs container
                this.crosshairContainer = new PIXI.Container();
                this.crosshairContainer.zIndex = 110;
                this.app.stage.addChild(this.crosshairContainer);
            }
        } catch (e) {
            console.warn('[PixiJS Init Failed, falling back to Canvas 2D]', e);
            this.usePixi = false;
            this.setupCanvasFallback();
        }

        window.addEventListener('resize', () => this.handleResize());
    }

    setupCanvasFallback() {
        this.fallbackCanvas = document.createElement('canvas');
        this.fallbackCanvas.width = this.width;
        this.fallbackCanvas.height = this.height;
        this.stageElem.appendChild(this.fallbackCanvas);
        this.fallbackCtx = this.fallbackCanvas.getContext('2d');
        this.particles.initCanvas(this.fallbackCanvas, this.fallbackCtx);
        this.targets.setViewport(this.width, this.height);
    }

    handleResize() {
        this.width = window.innerWidth || document.documentElement.clientWidth || 1280;
        this.height = window.innerHeight || document.documentElement.clientHeight || 720;

        if (this.app && this.app.renderer) {
            this.app.renderer.resize(this.width, this.height);
        }
        if (this.fallbackCanvas) {
            this.fallbackCanvas.width = this.width;
            this.fallbackCanvas.height = this.height;
        }
        this.targets.setViewport(this.width, this.height);
    }

    // ==================== NETWORKING ====================

    async initNetworking() {
        try {
            const res = await fetch('/api/info');
            const info = await res.json();
            const rooms = info.active_rooms || [];
            this.roomCode = rooms.length > 0 ? rooms[rooms.length - 1] : ('RS' + Math.floor(Math.random() * 89 + 10));
        } catch (e) {
            this.roomCode = 'RS' + Math.floor(Math.random() * 89 + 10);
        }

        if (this.ui.lobbyRoom) this.ui.lobbyRoom.textContent = this.roomCode;
        if (this.ui.hudRoom) this.ui.hudRoom.textContent = `ROOM: ${this.roomCode}`;

        this.connectSocket();
    }

    connectSocket() {
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
        }
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/ws/tv/${this.roomCode}`;

        this.setConnState('connecting', 'Connecting…');
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.setConnState('connected', 'Ready');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleSocketMessage(data);
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.setConnState('disconnected', 'Reconnecting…');
            this.ws = null;
            setTimeout(() => this.connectSocket(), 2000);
        };

        this.ws.onerror = () => {
            try { this.ws.close(); } catch (e) {}
        };
    }

    setConnState(state, text) {
        if (this.ui.connStatus) this.ui.connStatus.setAttribute('data-state', state);
        if (this.ui.connText) this.ui.connText.textContent = text;
    }

    handleSocketMessage(data) {
        // Safe audio unlock on first live payload
        if (this.audio) this.audio.init();

        switch (data.type) {
            case 'ROOM_READY':
                (data.players || []).forEach(p => this.registerPlayer(p.id, p.name, p.color));
                this.updateLobbyPlayersUI();
                break;

            case 'PLAYER_JOINED':
                this.registerPlayer(data.player_id, data.player_name, data.color);
                this.updateLobbyPlayersUI();
                if (this.audio) this.audio.playCountdownTick();
                // Auto-start match when first pilot connects so TV never stays stuck on lobby
                if (this.state === 'LOBBY') {
                    this.startCountdown();
                }
                break;

            case 'PLAYER_LEFT':
                delete this.players[data.player_id];
                this.updateLobbyPlayersUI();
                break;

            case 'AIM_UPDATE': {
                const p = this.players[data.player_id];
                if (p) {
                    if (data.x !== undefined && data.y !== undefined) {
                        // Normalized 0..1 coordinates (calibrated affine from APK)
                        p.targetX = Math.max(10, Math.min(this.width - 10, data.x * this.width));
                        p.targetY = Math.max(10, Math.min(this.height - 10, data.y * this.height));
                    } else if (data.yaw !== undefined && data.pitch !== undefined) {
                        // Relative gyro angular fallback
                        const sensX = 45;
                        const sensY = 35;
                        const rawX = (this.width / 2) + (data.yaw * sensX);
                        const rawY = (this.height / 2) + (data.pitch * sensY);
                        p.targetX = Math.max(10, Math.min(this.width - 10, rawX));
                        p.targetY = Math.max(10, Math.min(this.height - 10, rawY));
                    }
                    p.lastAimTime = performance.now();
                }
                break;
            }

            case 'TRIGGER_FIRE':
                this.handleFire(data.player_id);
                break;

            case 'RELOAD_ACTION':
                this.handleReload(data.player_id);
                break;

            case 'START_GAME_REQ':
                if (this.state === 'LOBBY' || this.state === 'ROUND_OVER') {
                    this.startCountdown();
                }
                break;

            case 'CALIB_START':
                this.showCalibration(0);
                break;

            case 'CALIB_DOT':
                this.showCalibration(data.index !== undefined ? data.index : 0);
                break;

            case 'CALIB_DONE':
                this.hideCalibration();
                break;
        }
    }

    registerPlayer(id, name, color) {
        if (!this.players[id]) {
            this.players[id] = {
                id,
                name: name || `Pilot ${Object.keys(this.players).length + 1}`,
                color: color || '#22d3ee',
                currentX: this.width / 2,
                currentY: this.height / 2,
                targetX: this.width / 2,
                targetY: this.height / 2,
                score: 0,
                combo: 1,
                streak: 0,
                ammo: 6,
                maxAmmo: 6,
                shotsFired: 0,
                shotsHit: 0,
                maxCombo: 1,
                lastAimTime: performance.now()
            };
        }
    }

    updateLobbyPlayersUI() {
        if (!this.ui.lobbyPlayers) return;
        const pKeys = Object.keys(this.players);
        if (pKeys.length === 0) {
            this.ui.lobbyPlayers.innerHTML = '<li>Waiting for controller…</li>';
        } else {
            this.ui.lobbyPlayers.innerHTML = pKeys.map(k => {
                const p = this.players[k];
                return `<li style="color:${p.color}">🟢 ${p.name} (CONNECTED)</li>`;
            }).join('');
        }
    }

    // ==================== CALIBRATION OVERLAY ====================

    showCalibration(index) {
        const idx = Math.max(0, Math.min(index, this.calibPoints.length - 1));
        const pt = this.calibPoints[idx];
        this.calibDot = {
            index: idx,
            x: pt.x,
            y: pt.y,
            label: pt.label,
            time: performance.now()
        };

        if (this.ui.lobby) this.ui.lobby.classList.add('hidden');
        if (this.ui.hud) this.ui.hud.classList.add('hidden');
        if (this.ui.gameOver) this.ui.gameOver.classList.add('hidden');
        if (this.ui.calibHint) {
            this.ui.calibHint.classList.remove('hidden');
            this.ui.calibHint.textContent = `AIM & ALIGN — POINT ${idx + 1}/5 (${pt.label})`;
        }
        if (this.audio) this.audio.playTick(600 + idx * 80);
    }

    hideCalibration() {
        this.calibDot = null;
        if (this.ui.calibHint) this.ui.calibHint.classList.add('hidden');
        if (this.state === 'LOBBY') {
            if (this.ui.lobby) this.ui.lobby.classList.remove('hidden');
        } else if (this.state === 'PLAYING') {
            if (this.ui.hud) this.ui.hud.classList.remove('hidden');
        } else if (this.state === 'ROUND_OVER') {
            if (this.ui.gameOver) this.ui.gameOver.classList.remove('hidden');
        }
    }

    // ==================== GAMEPLAY & ACTIONS ====================

    handleFire(playerId) {
        if (this.state !== 'PLAYING') {
            if (this.state === 'LOBBY' || this.state === 'ROUND_OVER') {
                this.startCountdown();
            }
            return;
        }

        const p = this.players[playerId] || Object.values(this.players)[0];
        if (!p) return;

        if (p.ammo <= 0) {
            if (this.audio) this.audio.playDryFire();
            this.particles.floatingText('EMPTY! RELOAD', p.currentX, p.currentY - 30, 0xef4444);
            return;
        }

        p.ammo--;
        p.shotsFired++;
        this.totalShotsFired++;
        this.updateHUD();

        const hitX = p.currentX;
        const hitY = p.currentY;

        // Audio & Visual Muzzle Flash
        if (this.audio) this.audio.playFire();
        this.particles.muzzleFlash(hitX, hitY, -Math.PI / 2, 0x22d3ee);

        // Check target collision
        const hitResult = this.targets.checkHit(hitX, hitY);

        if (hitResult && hitResult.hit) {
            p.shotsHit++;
            this.totalShotsHit++;
            p.streak++;

            // Combo multiplier computation (PRD-v2 §3.3)
            if (p.streak >= 20) p.combo = 5;
            else if (p.streak >= 10) p.combo = 3;
            else if (p.streak >= 5) p.combo = 2;
            else p.combo = 1;

            if (p.combo > p.maxCombo) p.maxCombo = p.combo;
            if (p.combo > this.highestCombo) this.highestCombo = p.combo;

            const basePoints = hitResult.points || 50;
            const awardedPoints = basePoints * p.combo;
            p.score += awardedPoints;
            this.roundScore += awardedPoints;

            // SFX & Particles based on target type
            if (hitResult.isHazard) {
                p.score = Math.max(0, p.score - 100);
                this.roundScore = Math.max(0, this.roundScore - 100);
                p.combo = 1;
                p.streak = 0;
                if (this.audio) this.audio.playPenalty();
                this.particles.floatingText('-100 HAZARD!', hitX, hitY - 40, 0xef4444);
                this.particles.sparkExplosion(hitX, hitY, 0xef4444, 16);
            } else if (hitResult.isBullseye) {
                if (this.audio) {
                    this.audio.playBullseye();
                    this.audio.announce('BULLSEYE!');
                }
                this.particles.floatingText(`BULLSEYE! +${awardedPoints}`, hitX, hitY - 40, 0xfbbf24);
                this.particles.sparkExplosion(hitX, hitY, 0xfbbf24, 24);
            } else {
                if (this.audio) this.audio.playHit();
                this.particles.floatingText(`+${awardedPoints}`, hitX, hitY - 30, 0x22d3ee);
                this.particles.sparkExplosion(hitX, hitY, 0x22d3ee, 12);
            }

            // Milestone announcer callouts
            if (p.combo === 3 && p.streak === 10 && this.audio) {
                this.audio.announce('COMBO X3!');
            } else if (p.combo === 5 && p.streak === 20 && this.audio) {
                this.audio.announce('COMBO X5!');
            }
        } else {
            // Missed shot resets combo
            p.combo = 1;
            p.streak = 0;
            if (this.audio) this.audio.playMiss();
            this.particles.floatingText('MISS', hitX, hitY - 20, 0x64748b);
            this.particles.sparkExplosion(hitX, hitY, 0x64748b, 6);
        }

        this.updateHUD();
    }

    handleReload(playerId) {
        const p = this.players[playerId] || Object.values(this.players)[0];
        if (p) {
            p.ammo = p.maxAmmo;
            if (this.audio) this.audio.playReload();
            this.particles.floatingText('RELOADED', p.currentX, p.currentY - 35, 0x38bdf8);
            this.updateHUD();
        }
    }

    // ==================== ROUND LIFECYCLE ====================

    startCountdown() {
        this.state = 'COUNTDOWN';
        if (this.ui.lobby) this.ui.lobby.classList.add('hidden');
        if (this.ui.gameOver) this.ui.gameOver.classList.add('hidden');
        if (this.ui.hud) this.ui.hud.classList.remove('hidden');

        // Reset player round stats
        Object.values(this.players).forEach(p => {
            p.score = 0;
            p.combo = 1;
            p.streak = 0;
            p.ammo = 6;
            p.shotsFired = 0;
            p.shotsHit = 0;
            p.maxCombo = 1;
        });
        this.roundScore = 0;
        this.roundCombo = 1;
        this.totalShotsFired = 0;
        this.totalShotsHit = 0;
        this.highestCombo = 1;
        this.timeLeft = 120;
        this.targets.reset();
        this.updateHUD();

        let count = 3;
        const announceElem = this.ui.centerAnnounce;
        announceElem.style.display = 'block';
        announceElem.textContent = `${count}`;

        if (this.audio) {
            this.audio.playCountdownTick();
            this.audio.announce('Three');
        }

        const cdInterval = setInterval(() => {
            count--;
            if (count > 0) {
                announceElem.textContent = `${count}`;
                if (this.audio) {
                    this.audio.playCountdownTick();
                    this.audio.announce(count === 2 ? 'Two' : 'One');
                }
            } else if (count === 0) {
                announceElem.textContent = 'FIRE!';
                if (this.audio) {
                    this.audio.playStartHorn();
                    this.audio.announce('FIRE!');
                }
            } else {
                clearInterval(cdInterval);
                announceElem.style.display = 'none';
                this.startRound();
            }
        }, 1000);
    }

    startRound() {
        this.state = 'PLAYING';
        this.timeLeft = 120;
        this.targets.spawnWave(1);
        this.updateHUD();

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.state !== 'PLAYING') {
                clearInterval(this.timerInterval);
                return;
            }
            this.timeLeft--;
            this.updateHUD();

            if (this.timeLeft === 10 && this.audio) {
                this.audio.announce('Time is running out!');
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.endRound();
            }
        }, 1000);
    }

    endRound() {
        this.state = 'ROUND_OVER';
        if (this.timerInterval) clearInterval(this.timerInterval);

        if (this.audio) {
            this.audio.playGameOver();
            this.audio.announce("Time's up!");
        }

        const announceElem = this.ui.centerAnnounce;
        announceElem.style.display = 'block';
        announceElem.textContent = 'ROUND OVER';

        setTimeout(() => {
            announceElem.style.display = 'none';
            this.showRoundSummary();
        }, 2200);
    }

    showRoundSummary() {
        const accuracy = Math.round((this.totalShotsHit / Math.max(1, this.totalShotsFired)) * 100);
        let finalScore = this.roundScore;

        let hasAccuracyBonus = false;
        if (accuracy >= 85 && this.totalShotsFired >= 10) {
            finalScore += 500;
            hasAccuracyBonus = true;
        }

        // Determine Rank
        let rank = 'RECRUIT';
        if (finalScore >= 3500) rank = 'CYBER ACE';
        else if (finalScore >= 2000) rank = 'SHARPSHOOTER';
        else if (finalScore >= 1000) rank = 'MARKSMAN';

        // Update Game Over UI
        if (this.ui.gsScore) this.ui.gsScore.textContent = finalScore.toLocaleString();
        if (this.ui.gsAccuracy) this.ui.gsAccuracy.textContent = `${accuracy}%`;
        if (this.ui.gsCombo) this.ui.gsCombo.textContent = `x${this.highestCombo}`;
        if (this.ui.gsRank) this.ui.gsRank.textContent = rank;

        if (this.ui.gsBonus) {
            if (hasAccuracyBonus) this.ui.gsBonus.classList.remove('hidden');
            else this.ui.gsBonus.classList.add('hidden');
        }

        this.saveHighScore(finalScore, rank, accuracy);
        this.renderHighScores();

        if (this.ui.hud) this.ui.hud.classList.add('hidden');
        if (this.ui.gameOver) this.ui.gameOver.classList.remove('hidden');
    }

    // ==================== HIGH SCORES (LOCAL STORAGE) ====================

    loadHighScores() {
        try {
            const raw = localStorage.getItem(this.HS_KEY);
            this.highScores = raw ? JSON.parse(raw) : [];
        } catch (e) {
            this.highScores = [];
        }
        this.renderHighScores();
    }

    saveHighScore(score, rank, accuracy) {
        if (score <= 0) return;
        const entry = {
            score,
            rank,
            accuracy,
            date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
        };
        this.highScores.push(entry);
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 5);
        try {
            localStorage.setItem(this.HS_KEY, JSON.stringify(this.highScores));
        } catch (e) {}
    }

    renderHighScores() {
        const renderList = (elem) => {
            if (!elem) return;
            if (this.highScores.length === 0) {
                elem.innerHTML = '<li>No scores recorded yet</li>';
            } else {
                elem.innerHTML = this.highScores.map((h, i) =>
                    `<li><span>#${i + 1} ${h.score.toLocaleString()}</span> <small style="color:#94a3b8">${h.rank} (${h.accuracy}%)</small></li>`
                ).join('');
            }
        };
        renderList(this.ui.hsPreview);
        renderList(this.ui.hsList);
    }

    updateHUD() {
        if (this.ui.hudTimer) this.ui.hudTimer.textContent = `${this.timeLeft}s`;
        if (this.ui.hudScore) this.ui.hudScore.textContent = this.roundScore.toLocaleString();

        const p = Object.values(this.players)[0];
        const currentCombo = p ? p.combo : 1;
        const currentAmmo = p ? p.ammo : 6;

        if (this.ui.hudCombo) {
            this.ui.hudCombo.textContent = `x${currentCombo}`;
            this.ui.hudCombo.style.color = currentCombo >= 5 ? '#f59e0b' : (currentCombo >= 3 ? '#e879f9' : '#22d3ee');
        }
        if (this.ui.hudAmmo) {
            this.ui.hudAmmo.textContent = `AMMO ${currentAmmo}/6`;
            this.ui.hudAmmo.style.color = currentAmmo <= 1 ? '#ef4444' : '#22d3ee';
        }
    }

    // ==================== RENDERING & GAME LOOP ====================

    startGameLoop() {
        const loop = () => {
            const now = performance.now();
            const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
            this.lastFrameTime = now;

            this.update(dt);
            this.render();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update(dt) {
        // Interpolate crosshairs
        Object.values(this.players).forEach(p => {
            p.currentX += (p.targetX - p.currentX) * 0.40;
            p.currentY += (p.targetY - p.currentY) * 0.40;
        });

        // Update targets & particles
        if (this.state === 'PLAYING') {
            this.targets.update(dt);
        }
        this.particles.update(dt);
        this.gridOffset = (this.gridOffset + dt * 18) % 40;
    }

    render() {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);

        if (this.usePixi && this.app) {
            this.renderPixi(dt, now);
        } else if (this.fallbackCtx) {
            this.renderCanvasFallback(dt, now);
        }
    }

    renderPixi(dt, now) {
        // 1. Draw Neon Cyber Grid Background
        if (this.bgGraphics) {
            this.bgGraphics.clear();
            this.bgGraphics.rect(0, 0, this.width, this.height);
            this.bgGraphics.fill({ color: 0x0a0f1e });

            // Cyber perspective grid
            const horizonY = this.height * 0.35;
            this.bgGraphics.setStrokeStyle({ width: 1, color: 0x22d3ee, alpha: 0.12 });

            for (let y = horizonY; y <= this.height; y += 30) {
                this.bgGraphics.moveTo(0, y);
                this.bgGraphics.lineTo(this.width, y);
                this.bgGraphics.stroke();
            }

            const vanishingX = this.width / 2;
            for (let x = -this.width; x <= this.width * 2; x += 100) {
                this.bgGraphics.moveTo(vanishingX, horizonY);
                this.bgGraphics.lineTo(x + this.gridOffset, this.height);
                this.bgGraphics.stroke();
            }
        }

        // 2. Render Targets via Pixi TargetManager
        if (this.targets && this.state === 'PLAYING') {
            this.targets.render(dt, now);
        }

        // 3. Render Particles
        if (this.particles) {
            this.particles.render(null);
        }

        // 4. Calibration Target Render
        if (this.calibGraphics) {
            this.calibGraphics.clear();
            if (this.calibDot) {
                const cx = this.calibDot.x * this.width;
                const cy = this.calibDot.y * this.height;
                const pulse = Math.sin((performance.now() - this.calibDot.time) * 0.008) * 4;

                // Pulsing yellow bullseye
                this.calibGraphics.circle(cx, cy, 32 + pulse);
                this.calibGraphics.fill({ color: 0xfbbf24, alpha: 0.25 });
                this.calibGraphics.stroke({ color: 0xfbbf24, width: 3 });

                this.calibGraphics.circle(cx, cy, 14);
                this.calibGraphics.fill({ color: 0xfbbf24, alpha: 0.85 });

                this.calibGraphics.circle(cx, cy, 4);
                this.calibGraphics.fill({ color: 0xffffff });

                // Cross lines
                this.calibGraphics.moveTo(cx - 45, cy);
                this.calibGraphics.lineTo(cx + 45, cy);
                this.calibGraphics.moveTo(cx, cy - 45);
                this.calibGraphics.lineTo(cx, cy + 45);
                this.calibGraphics.stroke({ color: 0xfbbf24, width: 2, alpha: 0.8 });
            }
        }

        // 5. Player Crosshairs
        if (this.crosshairContainer) {
            this.crosshairContainer.removeChildren();
            const g = new PIXI.Graphics();
            this.crosshairContainer.addChild(g);

            Object.values(this.players).forEach(p => {
                const cx = p.currentX;
                const cy = p.currentY;
                const col = parseInt(p.color.replace('#', '0x'), 16) || 0x22d3ee;

                // Outer ring
                g.circle(cx, cy, 18);
                g.stroke({ color: col, width: 2, alpha: 0.9 });

                // Inner dot
                g.circle(cx, cy, 3);
                g.fill({ color: 0xffffff });

                // Reticle hash marks
                g.moveTo(cx - 28, cy); g.lineTo(cx - 10, cy);
                g.moveTo(cx + 10, cy); g.lineTo(cx + 28, cy);
                g.moveTo(cx, cy - 28); g.lineTo(cx, cy - 10);
                g.moveTo(cx, cy + 10); g.lineTo(cx, cy + 28);
                g.stroke({ color: col, width: 2, alpha: 0.8 });
            });
        }
    }

    renderCanvasFallback() {
        const ctx = this.fallbackCtx;
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, this.width, this.height);

        // Fallback target rendering
        if (this.targets && this.targets.targets) {
            this.targets.targets.forEach(t => {
                const tx = t.x * this.width;
                const ty = t.y * this.height;
                ctx.beginPath();
                ctx.arc(tx, ty, t.radius || 24, 0, Math.PI * 2);
                ctx.fillStyle = t.isHazard ? '#ef4444' : '#22d3ee';
                ctx.fill();
            });
        }

        // Crosshairs
        Object.values(this.players).forEach(p => {
            ctx.beginPath();
            ctx.arc(p.currentX, p.currentY, 18, 0, Math.PI * 2);
            ctx.strokeStyle = p.color || '#22d3ee';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    // ==================== BIND EVENTS ====================

    bindEvents() {
        // Desktop / Laptop mouse testing controls
        window.addEventListener('mousemove', (e) => {
            const p = Object.values(this.players)[0];
            if (p) {
                p.targetX = e.clientX;
                p.targetY = e.clientY;
            }
        });

        window.addEventListener('click', (e) => {
            if (this.audio) this.audio.init();
            const p = Object.values(this.players)[0];
            const pId = p ? p.id : 'P1';
            this.handleFire(pId);
        });

        window.addEventListener('keydown', (e) => {
            if (this.audio) this.audio.init();
            if (e.code === 'Space') {
                if (this.state === 'LOBBY' || this.state === 'ROUND_OVER') {
                    this.startCountdown();
                } else if (this.state === 'PLAYING') {
                    const p = Object.values(this.players)[0];
                    if (p) this.handleReload(p.id);
                }
            } else if (e.key === 'c' || e.key === 'C') {
                // Test calibration cycling
                const curIdx = this.calibDot ? (this.calibDot.index + 1) % 6 : 0;
                if (curIdx < 5) this.showCalibration(curIdx);
                else this.hideCalibration();
            }
        });
    }
}

// Auto-boot on page load
window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new GameEngine();
});
