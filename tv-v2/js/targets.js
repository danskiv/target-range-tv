/* ==========================================================================
   Range Shooter v2 — Target Taxonomy (Neon Cyber Arena)
   --------------------------------------------------------------------------
   Types (PRD-v2 §3.2):
     STATIC_NODE    10/25/100  bullseye rings, despawns 3s if untouched
     DRONE_PATROL   50         horizontal / zigzag, speed scales with wave
     POPUP_CORE     80         pops up 1.5s then hides
     HAZARD_SHIELD  -100       shooting it = penalty + combo reset
     ENERGY_CELL    50         blast radius 200px (scaled to viewport)
     MEGA_BOT       1000       final wave, 500 HP health bar

   All coordinates are NORMALIZED (0..1) — the renderer maps them to the
   live viewport. No hardcoded resolution (AUDIT_LOG #8).
   ========================================================================== */

class TargetManager {
    constructor() {
        this.targets = [];
        this.width = 1;
        this.height = 1;
        this.maxConcurrent = 7;
        this.spawnTimer = 0;
        this.wave = 1;
        this.maxWaves = 3;
        this.lastSpawn = 0;
        this.callbacks = {
            onTargetHit: null,   // (hitInfo) => {}
            onWaveStart: null,   // (wave) => {}
            onWaveCleared: null  // () => {}
        };
        // Cache per-target Pixi containers so re-spawn is cheap.
        this.pool = [];
        // The Pixi stage that owns target sprites.
        this.stage = null;
    }

    setStage(stage) {
        this.stage = stage;
    }

    setViewport(width, height) {
        this.width = width;
        this.height = height;
    }

    reset() {
        this.targets.forEach((t) => this.release(t));
        this.targets = [];
        this.spawnTimer = 0;
        this.wave = 1;
    }

    /* ---------------- Wave management ---------------- */

    isWaveCleared() {
        return this.targets.length === 0;
    }

    getWaveDuration() {
        // Drone count per wave scales: 4, 6, 8
        return [4, 6, 8][this.wave - 1] || 8;
    }

    getSpawnInterval() {
        // Faster cadence as waves progress (seconds).
        const base = Math.max(0.55, 1.15 - (this.wave - 1) * 0.2);
        return base;
    }

    getSpeedScale() {
        // Drones speed up each wave.
        return 1 + (this.wave - 1) * 0.35;
    }

    getCompositionForWave(wave) {
        const comp = [
            { type: 'STATIC_NODE', weight: 44 },
            { type: 'DRONE_PATROL', weight: 34 },
            { type: 'POPUP_CORE', weight: 14 },
            { type: 'HAZARD_SHIELD', weight: 5 },
            { type: 'ENERGY_CELL', weight: 3 }
        ];
        // Later waves favour drones + hazards.
        if (wave >= 2) {
            comp[1].weight = 40;
            comp[3].weight = 9;
        }
        if (wave >= 3) {
            comp[1].weight = 44;
            comp[3].weight = 12;
        }
        return comp;
    }

    /* ---------------- Spawning ---------------- */

    spawnWave(wave) {
        this.wave = wave;
        const count = this.getWaveDuration();
        for (let i = 0; i < count; i++) {
            this.scheduleSpawn(wave, i * this.getSpawnInterval());
        }
        if (this.callbacks.onWaveStart) {
            this.callbacks.onWaveStart(wave);
        }
    }

    scheduleSpawn(wave, delaySec) {
        // Queue of {time, wave} — engine pops them on its tick.
        if (!this.queue) this.queue = [];
        this.queue.push({ time: performance.now() + delaySec * 1000, wave });
    }

    processQueue(now) {
        if (!this.queue) return;
        while (this.queue.length && this.queue[0].time <= now) {
            const item = this.queue.shift();
            this.spawnRandom(item.wave);
        }
    }

    spawnRandom(wave) {
        if (this.targets.length >= this.maxConcurrent) return;
        const comp = this.getCompositionForWave(wave);
        const total = comp.reduce((s, c) => s + c.weight, 0);
        let roll = Math.random() * total;
        let type = comp[0].type;
        for (const c of comp) {
            roll -= c.weight;
            if (roll <= 0) { type = c.type; break; }
        }
        this.spawn(type, wave);
    }

    spawn(type, wave = this.wave) {
        const id = Math.random().toString(36).slice(2, 9);
        let t = this.acquire(id, type, wave);
        this.targets.push(t);
        if (this.stage) this.stage.addChild(t.view);
        return t;
    }

    acquire(id, type, wave) {
        let t = this.pool.pop();
        if (!t) {
            t = this._createTargetObject();
        }
        t.id = id;
        t.type = type;
        t.wave = wave;
        t.active = true;
        t.visible = true;
        t.alive = true;
        t.life = 0;
        t.age = 0;
        t.phase = Math.random() * Math.PI * 2;
        t.speedScale = this.getSpeedScale();
        t.hp = 1;
        t.maxHp = 1;
        t.hitCount = 0;

        switch (type) {
            case 'STATIC_NODE': this._initStaticNode(t); break;
            case 'DRONE_PATROL': this._initDrone(t); break;
            case 'POPUP_CORE': this._initPopup(t); break;
            case 'HAZARD_SHIELD': this._initHazard(t); break;
            case 'ENERGY_CELL': this._initEnergyCell(t); break;
            case 'MEGA_BOT': this._initMegaBot(t); break;
        }
        this._applyView(t);
        return t;
    }

    _initStaticNode(t) {
        t.points = 10;
        t.bullseyePoints = 100;
        t.ringPoints = 25;
        // Normalized position, away from HUD gutters.
        t.nx = 0.08 + Math.random() * 0.84;
        t.ny = 0.12 + Math.random() * 0.70;
        t.radius = 0.045;           // normalized radius
        t.maxLife = 3.0;            // 3s despawn if untouched (PRD)
        t.vx = 0; t.vy = 0;
    }

    _initDrone(t) {
        t.points = 50;
        const fromLeft = Math.random() > 0.5;
        t.nx = fromLeft ? -0.08 : 1.08;
        t.ny = 0.10 + Math.random() * 0.75;
        t.radius = 0.036;
        t.baseSpeed = (0.10 + Math.random() * 0.09) * t.speedScale; // norm/s
        t.vx = fromLeft ? t.baseSpeed : -t.baseSpeed;
        t.pattern = Math.random() < 0.5 ? 'horizontal' : 'zigzag';
        t.zigPhase = Math.random() * Math.PI * 2;
        t.zigAmp = 0.05 + Math.random() * 0.05;
        t.zigFreq = 1.5 + Math.random() * 1.5;
        t.maxLife = 14;
    }

    _initPopup(t) {
        t.points = 80;
        t.nx = 0.08 + Math.random() * 0.84;
        t.ny = 0.10 + Math.random() * 0.75;
        t.radius = 0.040;
        t.popDuration = 1.5;   // visible window (PRD)
        t.hiddenDuration = 1.2 + Math.random() * 1.2;
        t.popTimer = 0;
        t.isUp = false;
        t.maxLife = 20;        // absolute cap so stale popups recycle
    }

    _initHazard(t) {
        t.points = -100;
        t.nx = 0.08 + Math.random() * 0.84;
        t.ny = 0.10 + Math.random() * 0.75;
        t.radius = 0.042;
        t.maxLife = 5.0;
        t.vx = (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.02);
        t.vy = 0;
        t.bobPhase = Math.random() * Math.PI * 2;
        t.bobAmp = 0.012;
    }

    _initEnergyCell(t) {
        t.points = 50;
        t.nx = 0.08 + Math.random() * 0.84;
        t.ny = 0.10 + Math.random() * 0.75;
        t.radius = 0.034;
        t.blastRadiusNorm = 0.20;  // 200px @1080p ≈ 0.185; use 0.20 safe
        t.maxLife = 6.0;
        t.pulsePhase = Math.random() * Math.PI * 2;
    }

    _initMegaBot(t) {
        t.points = 1000;
        t.hp = 500;
        t.maxHp = 500;
        t.radius = 0.075;
        t.nx = 0.5;
        t.ny = 0.32;
        t.baseSpeed = 0.045 * t.speedScale;
        t.vx = t.baseSpeed;
        t.vy = 0;
        t.maxLife = 40;
        t.bobPhase = Math.random() * Math.PI * 2;
        t.bobAmp = 0.02;
    }

    /* ---------------- Per-frame update ---------------- */

    update(dt) {
        const now = performance.now();
        this.processQueue(now);

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            t.age += dt;
            if (t.type === 'POPUP_CORE') {
                this._updatePopup(t, dt);
            }
            this._move(t, dt);
            this._expire(t, i);
        }
    }

    _updatePopup(t, dt) {
        t.popTimer += dt;
        if (!t.isUp && t.popTimer >= t.hiddenDuration) {
            t.isUp = true;
            t.popTimer = 0;
            t.visible = true;
        } else if (t.isUp && t.popTimer >= t.popDuration) {
            t.isUp = false;
            t.popTimer = 0;
            t.visible = false;
        }
    }

    _move(t, dt) {
        switch (t.type) {
            case 'DRONE_PATROL':
                t.nx += t.vx * dt;
                if (t.pattern === 'zigzag') {
                    t.zigPhase += dt * t.zigFreq;
                    t.ny = t.baseY !== undefined
                        ? t.baseY + Math.sin(t.zigPhase) * t.zigAmp
                        : t.ny + Math.sin(t.zigPhase) * t.zigAmp * dt;
                }
                // bounce at edges for horizontal pattern
                if (t.pattern === 'horizontal') {
                    if (t.nx < 0.02 || t.nx > 0.98) { t.vx *= -1; }
                }
                break;
            case 'HAZARD_SHIELD':
                t.nx += t.vx * dt;
                t.bobPhase += dt * 2.2;
                t.ny = t.baseY !== undefined ? t.baseY : t.ny + Math.sin(t.bobPhase) * t.bobAmp * dt * 0.5;
                if (t.nx < 0.03 || t.nx > 0.97) t.vx *= -1;
                break;
            case 'MEGA_BOT':
                t.nx += t.vx * dt;
                t.bobPhase += dt * 1.8;
                t.ny = (t.baseY !== undefined ? t.baseY : t.ny) + Math.sin(t.bobPhase) * t.bobAmp;
                if (t.nx < 0.12 || t.nx > 0.88) t.vx *= -1;
                break;
        }
        // store baseY once for smooth bobbing
        if (t.baseY === undefined && (t.type === 'DRONE_PATROL' || t.type === 'HAZARD_SHIELD' || t.type === 'MEGA_BOT')) {
            t.baseY = t.ny;
        }
        // clamp inside arena
        t.ny = Math.max(0.04, Math.min(0.94, t.ny));
    }

    _expire(t, index) {
        let dead = false;
        if (t.type === 'DRONE_PATROL' && (t.nx < -0.12 || t.nx > 1.12)) dead = true;
        if (t.age >= t.maxLife) dead = true;
        if (dead) {
            this.release(t);
            this.targets.splice(index, 1);
        }
    }

    /* ---------------- Hit detection ---------------- */

    checkHit(x, y) {
        // Topmost target first (reverse order).
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            if (!t.visible || !t.alive) continue;
            if (t.type === 'POPUP_CORE' && !t.isUp) continue;

            const tx = t.nx * this.width;
            const ty = t.ny * this.height;
            const tr = t.radius * Math.min(this.width, this.height);
            const dist = Math.hypot(x - tx, y - ty);

            if (dist <= tr) {
                if (t.type === 'HAZARD_SHIELD') {
                    this.release(t);
                    this.targets.splice(i, 1);
                    return {
                        target: t,
                        type: 'HAZARD_SHIELD',
                        points: -100,
                        isCenter: false,
                        x: tx, y: ty
                    };
                }
                if (t.type === 'ENERGY_CELL') {
                    // Blast radius destroys neighbours (200px scaled).
                    const blastR = t.blastRadiusNorm * Math.min(this.width, this.height);
                    const victims = [];
                    for (let j = this.targets.length - 1; j >= 0; j--) {
                        const o = this.targets[j];
                        if (o === t || !o.alive || !o.visible) continue;
                        const ox = o.nx * this.width;
                        const oy = o.ny * this.height;
                        if (Math.hypot(ox - tx, oy - ty) <= blastR) {
                            victims.push({ x: ox, y: oy, type: o.type, points: o.points });
                            this.release(o);
                            this.targets.splice(j, 1);
                        }
                    }
                    this.release(t);
                    this.targets.splice(i, 1);
                    return {
                        target: t,
                        type: 'ENERGY_CELL',
                        points: 50,
                        isCenter: false,
                        x: tx, y: ty,
                        blastRadius: blastR,
                        victims
                    };
                }
                if (t.type === 'MEGA_BOT') {
                    t.hitCount++;
                    const isKill = t.hp <= 1; // 500 HP needs 500 shots? No — see engine: each shot -1 HP
                    t.hp--;
                    if (t.hp <= 0) {
                        this.release(t);
                        this.targets.splice(i, 1);
                        return {
                            target: t,
                            type: 'MEGA_BOT',
                            points: 1000,
                            isCenter: false,
                            x: tx, y: ty,
                            isKill: true
                        };
                    }
                    return {
                        target: t,
                        type: 'MEGA_BOT',
                        points: 0,
                        isCenter: false,
                        x: tx, y: ty,
                        isKill: false
                    };
                }
                // STATIC_NODE / DRONE_PATROL / POPUP_CORE: ring scoring
                let pts = t.points;
                let isCenter = false;
                if (t.type === 'STATIC_NODE') {
                    if (dist <= tr * 0.25) { pts = 100; isCenter = true; }
                    else if (dist <= tr * 0.6) { pts = 25; }
                    else { pts = 10; }
                }
                this.release(t);
                this.targets.splice(i, 1);
                return {
                    target: t,
                    type: t.type,
                    points: pts,
                    isCenter,
                    x: tx, y: ty
                };
            }
        }
        return null;
    }

    /* ---------------- Pixi view management ---------------- */

    _createTargetObject() {
        const view = new PIXI.Container();
        const g = new PIXI.Graphics();
        const label = new PIXI.Text('', {
            fontFamily: 'Segoe UI, Roboto, sans-serif',
            fontSize: 18,
            fontWeight: '800',
            fill: '#ffffff',
            stroke: { color: '#0a0f1e', width: 4 },
            align: 'center'
        });
        label.anchor.set(0.5);
        label.y = 0; // set per frame
        view.addChild(g);
        view.addChild(label);
        view._g = g;
        view._label = label;
        view.visible = false;
        return {
            id: null, type: null, wave: 1,
            active: false, visible: false, alive: false,
            life: 0, age: 0, phase: 0, speedScale: 1,
            hp: 1, maxHp: 1, hitCount: 0,
            nx: 0.5, ny: 0.5, vx: 0, vy: 0, radius: 0.04,
            points: 10, bullseyePoints: 100, ringPoints: 25,
            maxLife: 5, baseSpeed: 0, pattern: 'horizontal',
            zigPhase: 0, zigAmp: 0, zigFreq: 1, baseY: undefined,
            popDuration: 1.5, hiddenDuration: 1.2, popTimer: 0, isUp: true,
            bobPhase: 0, bobAmp: 0, blastRadiusNorm: 0.20,
            view
        };
    }

    release(t) {
        if (t.view) {
            t.view.visible = false;
            if (this.stage && t.view.parent === this.stage) {
                this.stage.removeChild(t.view);
            }
        }
        t.active = false;
        t.alive = false;
        this.pool.push(t);
    }

    _applyView(t) {
        const v = t.view;
        v.visible = t.visible;
        const scale = Math.min(this.width, this.height) / 1080;
        v.scale.set(scale);
        v._t = t;
    }

    /* ---------------- Rendering (called by engine each frame) ---------------- */

    render(dt, now) {
        const minDim = Math.min(this.width, this.height);
        for (const t of this.targets) {
            const v = t.view;
            if (!v) continue;
            v.visible = t.visible;
            if (!t.visible) continue;
            v.position.set(t.nx * this.width, t.ny * this.height);
            const r = t.radius * minDim;
            const g = v._g;
            g.clear();
            switch (t.type) {
                case 'STATIC_NODE': this._drawStaticNode(g, t, r, now); break;
                case 'DRONE_PATROL': this._drawDrone(g, t, r, now); break;
                case 'POPUP_CORE': this._drawPopup(g, t, r, now); break;
                case 'HAZARD_SHIELD': this._drawHazard(g, t, r, now); break;
                case 'ENERGY_CELL': this._drawEnergyCell(g, t, r, now); break;
                case 'MEGA_BOT': this._drawMegaBot(g, t, r, now); break;
            }
            this._drawLabel(v, t, r);
        }
    }

    _drawLabel(v, t, r) {
        const label = v._label;
        if (!label) return;
        if (t.type === 'MEGA_BOT') {
            label.text = `MEGA BOT ${Math.max(0, t.hp)}`;
            label.style.fontSize = Math.max(16, r * 0.28);
            label.y = -r * 0.9;
        } else {
            label.text = '';
        }
    }

    _drawStaticNode(g, t, r, now) {
        // Outer ring (cyan)
        g.circle(0, 0, r);
        g.fill({ color: 0x0a0f1e, alpha: 0.55 });
        g.stroke({ color: 0x22d3ee, width: 3, alpha: 0.9 });
        // Mid ring (magenta)
        g.circle(0, 0, r * 0.6);
        g.fill({ color: 0x1e1030, alpha: 0.8 });
        g.stroke({ color: 0xe879f9, width: 2, alpha: 0.75 });
        // Core (cyan glow dot)
        g.circle(0, 0, r * 0.25);
        g.fill({ color: 0x22d3ee, alpha: 0.95 });
        // Tick ring for alive-while-visible effect
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + t.phase);
        g.circle(0, 0, r * (1 + pulse * 0.12));
        g.stroke({ color: 0x22d3ee, width: 1.5, alpha: 0.25 + pulse * 0.25 });
    }

    _drawDrone(g, t, r, now) {
        // Body
        g.ellipse(0, 0, r * 1.1, r * 0.8);
        g.fill({ color: 0x0e1526, alpha: 0.9 });
        g.stroke({ color: 0x22d3ee, width: 2.5, alpha: 0.95 });
        // Rotor glow
        const spin = now * 0.02 + t.phase;
        const rx = Math.cos(spin) * r * 0.75;
        const ry = Math.sin(spin) * r * 0.55;
        g.moveTo(0, 0);
        g.lineTo(rx, ry);
        g.stroke({ color: 0x22d3ee, width: 2, alpha: 0.7 });
        g.circle(rx, ry, r * 0.18);
        g.fill({ color: 0x22d3ee, alpha: 0.8 });
        // Core
        g.circle(0, 0, r * 0.28);
        g.fill({ color: 0xe879f9, alpha: 0.9 });
    }

    _drawPopup(g, t, r, now) {
        // Triangle / core that pops up
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.008 + t.phase);
        g.circle(0, 0, r * (0.85 + pulse * 0.15));
        g.fill({ color: 0x3b1d5e, alpha: 0.8 });
        g.stroke({ color: 0xe879f9, width: 3, alpha: 0.95 });
        g.poly([0, -r * 0.5, r * 0.42, r * 0.3, -r * 0.42, r * 0.3]);
        g.fill({ color: 0xe879f9, alpha: 0.9 });
    }

    _drawHazard(g, t, r, now) {
        // Shield drone — red/magenta warning, X cross
        g.circle(0, 0, r);
        g.fill({ color: 0x2a0e1e, alpha: 0.85 });
        g.stroke({ color: 0xf87171, width: 3.5, alpha: 0.95 });
        // Cross X
        const s = r * 0.55;
        g.moveTo(-s, -s); g.lineTo(s, s);
        g.moveTo(s, -s); g.lineTo(-s, s);
        g.stroke({ color: 0xf87171, width: 4, alpha: 0.9 });
        // Warning ring
        g.circle(0, 0, r * 1.15);
        g.stroke({ color: 0xfbbf24, width: 2, alpha: 0.5 + 0.4 * Math.sin(now * 0.006 + t.phase) });
    }

    _drawEnergyCell(g, t, r, now) {
        // Pulsing green cell
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.01 + t.pulsePhase);
        g.circle(0, 0, r * (0.9 + pulse * 0.2));
        g.fill({ color: 0x052e1e, alpha: 0.8 });
        g.stroke({ color: 0x34d399, width: 3, alpha: 0.95 });
        // Core + charge ticks
        g.circle(0, 0, r * 0.32);
        g.fill({ color: 0x34d399, alpha: 0.9 });
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + now * 0.002;
            g.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
            g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
            g.stroke({ color: 0x34d399, width: 2.5, alpha: 0.8 });
        }
    }

    _drawMegaBot(g, t, r, now) {
        // Big hexagonal bot
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.003 + t.phase);
        // Hexagon body
        const hex = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            hex.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        g.poly(hex);
        g.fill({ color: 0x1a1030, alpha: 0.9 });
        g.stroke({ color: 0xe879f9, width: 3.5, alpha: 0.95 });
        // Core eye
        g.circle(0, 0, r * 0.3);
        g.fill({ color: 0xfbbf24, alpha: 0.85 + pulse * 0.15 });
        // Arm cannons
        g.circle(-r * 0.85, r * 0.25, r * 0.16);
        g.fill({ color: 0x22d3ee, alpha: 0.9 });
        g.circle(r * 0.85, r * 0.25, r * 0.16);
        g.fill({ color: 0x22d3ee, alpha: 0.9 });
        // Health bar (drawn in engine overlay? No — draw here):
        this._drawHealthBar(g, t, r);
    }

    _drawHealthBar(g, t, r) {
        const bw = r * 2.2;
        const bh = Math.max(6, r * 0.16);
        const bx = -bw / 2;
        const by = -r - bh - 10;
        // bg
        g.roundRect(bx, by, bw, bh, 3);
        g.fill({ color: 0x0a0f1e, alpha: 0.85 });
        g.stroke({ color: 0x64748b, width: 1.5, alpha: 0.8 });
        // hp fill
        const pct = Math.max(0, t.hp / t.maxHp);
        g.roundRect(bx + 2, by + 2, (bw - 4) * pct, bh - 4, 2);
        g.fill({ color: pct > 0.5 ? 0x34d399 : (pct > 0.25 ? 0xfbbf24 : 0xf87171), alpha: 0.95 });
    }
}

// Single global (CODING_STANDARD: max 1 global per file).
window.targetManager = new TargetManager();
