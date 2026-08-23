/* ==========================================================================
   Range Shooter v2 — Neon Particle System (PixiJS)
   --------------------------------------------------------------------------
   Additive-blended particles (muzzle flash, sparks, laser trails, hit sparks,
   explosions) + floating combat text. Uses Pixi Graphics with additive
   blend mode and an object pool to avoid GC stutter on low-end TV.
   Falls back to a Canvas-2D renderer if PIXI is unavailable.
   ========================================================================== */

class ParticleSystem {
    constructor() {
        this.stage = null;
        this.container = null;
        this.particles = [];
        this.texts = [];
        this.maxParticles = 240;
        this.usePixi = typeof window.PIXI !== 'undefined';
        // Canvas-2D fallback path
        this.ctx = null;
        this.canvas = null;
    }

    /* ---------------- Setup ---------------- */

    initPixi(stage, layerName = 'particles') {
        this.usePixi = true;
        this.stage = stage;
        this.container = new PIXI.Container();
        this.container.name = layerName;
        this.container.blendMode = 'additive';
        // Pool of Graphics objects, one per particle slot.
        for (let i = 0; i < this.maxParticles; i++) {
            const g = new PIXI.Graphics();
            g.visible = false;
            g.blendMode = 'additive';
            this.container.addChild(g);
            this.particles.push({
                active: false,
                g,
                x: 0, y: 0, vx: 0, vy: 0,
                life: 0, maxLife: 30,
                size: 3, color: 0x22d3ee,
                kind: 'spark', // spark | debris | flash | trail | ring
                gravity: 0, drag: 1,
                rotation: 0, vr: 0
            });
        }
        this.textContainer = new PIXI.Container();
        this.textContainer.name = 'floating-text';
        this.textContainer.blendMode = 'normal';
        stage.addChild(this.textContainer);
        stage.addChild(this.container);
    }

    initCanvas(canvas, ctx) {
        this.usePixi = false;
        this.canvas = canvas;
        this.ctx = ctx;
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                active: false,
                x: 0, y: 0, vx: 0, vy: 0,
                life: 0, maxLife: 30,
                size: 3, color: '#22d3ee',
                kind: 'spark',
                gravity: 0, drag: 1,
                rotation: 0, vr: 0
            });
        }
    }

    /* ---------------- Emitters ---------------- */

    muzzleFlash(x, y, angle = -Math.PI / 2, color = 0xfbbf24) {
        this._spawn(x, y, {
            kind: 'flash',
            color,
            size: 14 + Math.random() * 10,
            maxLife: 5 + Math.random() * 3,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            drag: 0.8
        });
        // A few fast sparks fanning forward
        for (let i = 0; i < 5; i++) {
            const a = angle + (Math.random() - 0.5) * 0.9;
            this._spawn(x, y, {
                kind: 'spark',
                color: 0xfde68a,
                size: 2 + Math.random() * 2,
                maxLife: 8 + Math.random() * 8,
                vx: Math.cos(a) * (4 + Math.random() * 5),
                vy: Math.sin(a) * (4 + Math.random() * 5),
                drag: 0.9
            });
        }
    }

    sparkExplosion(x, y, color = 0x22d3ee, count = 14) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 7;
            this._spawn(x, y, {
                kind: 'spark',
                color,
                size: 2 + Math.random() * 3,
                maxLife: 14 + Math.random() * 16,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed,
                drag: 0.92,
                gravity: 0.05
            });
        }
        // central flash
        this._spawn(x, y, {
            kind: 'flash',
            color,
            size: 20 + Math.random() * 14,
            maxLife: 8,
            vx: 0, vy: 0, drag: 1
        });
    }

    laserTrail(x, y, color = 0x22d3ee) {
        // Continuous trail spawned each frame while firing.
        this._spawn(x, y, {
            kind: 'trail',
            color,
            size: 3 + Math.random() * 2.5,
            maxLife: 10 + Math.random() * 6,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            drag: 0.94
        });
    }

    hitSparks(x, y, color = 0xe879f9, count = 10) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 6;
            this._spawn(x, y, {
                kind: 'spark',
                color,
                size: 2 + Math.random() * 3,
                maxLife: 10 + Math.random() * 12,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed,
                drag: 0.9,
                gravity: 0.12
            });
        }
    }

    explosionRing(x, y, color = 0xfbbf24, radius = 60) {
        this._spawn(x, y, {
            kind: 'ring',
            color,
            size: radius,
            maxLife: 18,
            vx: 0, vy: 0, drag: 1
        });
    }

    shockwave(x, y, radius = 200, color = 0x34d399) {
        // Energy cell blast — expanding ring + debris
        for (let i = 0; i < 24; i++) {
            const a = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 8;
            this._spawn(x, y, {
                kind: 'spark',
                color,
                size: 2 + Math.random() * 3.5,
                maxLife: 20 + Math.random() * 18,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed,
                drag: 0.9,
                gravity: 0.08
            });
        }
        this._spawn(x, y, {
            kind: 'ring',
            color,
            size: radius,
            maxLife: 22,
            vx: 0, vy: 0, drag: 1
        });
    }

    floatingText(text, x, y, color = '#fbbf24', size = 28) {
        if (this.usePixi) {
            const t = new PIXI.Text(text, {
                fontFamily: 'Segoe UI, Roboto, sans-serif',
                fontSize: size,
                fontWeight: '900',
                fill: color,
                stroke: { color: '#0a0f1e', width: 5 },
                align: 'center'
            });
            t.anchor.set(0.5);
            t.position.set(x, y);
            this.textContainer.addChild(t);
            this.texts.push({ t, x, y, life: 0, maxLife: 55, vy: -1.4 });
        } else if (this.ctx) {
            this.texts.push({ text, x, y, color, size, life: 0, maxLife: 55, vy: -1.4 });
        }
    }

    /* ---------------- Core ---------------- */

    _spawn(x, y, opts) {
        const p = this.particles.find((q) => !q.active);
        if (!p) return;
        p.active = true;
        p.x = x; p.y = y;
        p.vx = opts.vx || 0;
        p.vy = opts.vy || 0;
        p.life = 0;
        p.maxLife = opts.maxLife || 30;
        p.size = opts.size || 3;
        p.color = opts.color || 0x22d3ee;
        p.kind = opts.kind || 'spark';
        p.gravity = opts.gravity || 0;
        p.drag = opts.drag || 1;
        p.rotation = opts.rotation || 0;
        p.vr = opts.vr || 0;
        if (this.usePixi) {
            p.g.visible = true;
            p.g.clear();
            p.g.rotation = p.rotation;
            p.g.position.set(x, y);
        }
    }

    update(dt) {
        for (const p of this.particles) {
            if (!p.active) continue;
            p.life += dt;
            if (p.life >= p.maxLife) {
                p.active = false;
                if (this.usePixi) p.g.visible = false;
                continue;
            }
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vx *= Math.pow(p.drag, dt * 60);
            p.vy *= Math.pow(p.drag, dt * 60);
            p.vy += p.gravity * dt * 60;
            p.rotation += p.vr * dt;
            if (this.usePixi) {
                p.g.position.set(p.x, p.y);
                p.g.rotation = p.rotation;
            }
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const ft = this.texts[i];
            ft.life += dt;
            ft.y += ft.vy * dt * 60;
            if (ft.life >= ft.maxLife) {
                if (this.usePixi) {
                    this.textContainer.removeChild(ft.t);
                    ft.t.destroy({ children: true });
                }
                this.texts.splice(i, 1);
            }
        }
    }

    renderPixi() {
        // Redraw graphics each frame for cheap animation (no filter cost).
        for (const p of this.particles) {
            if (!p.active || !p.g.visible) continue;
            const g = p.g;
            g.clear();
            const t = p.life / p.maxLife;
            const alpha = Math.max(0, 1 - t);
            const color = p.color;
            switch (p.kind) {
                case 'spark':
                case 'debris':
                    g.circle(0, 0, Math.max(0.5, p.size * (1 - t * 0.5)));
                    g.fill({ color, alpha });
                    break;
                case 'flash':
                    g.circle(0, 0, p.size * (1 - t * 0.7));
                    g.fill({ color, alpha });
                    g.circle(0, 0, p.size * 1.6 * (1 - t * 0.7));
                    g.fill({ color, alpha: alpha * 0.3 });
                    break;
                case 'trail':
                    g.circle(0, 0, Math.max(0.5, p.size * (1 - t)));
                    g.fill({ color, alpha: alpha * 0.8 });
                    break;
                case 'ring':
                    g.circle(0, 0, p.size * (0.4 + t * 1.6));
                    g.stroke({ color, width: Math.max(1, 6 * (1 - t)), alpha });
                    break;
            }
        }
    }

    renderCanvas(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.particles) {
            if (!p.active) continue;
            const t = p.life / p.maxLife;
            const alpha = Math.max(0, 1 - t);
            const col = typeof p.color === 'number'
                ? '#' + p.color.toString(16).padStart(6, '0')
                : p.color;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = col;
            if (p.kind === 'ring') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (0.4 + t * 1.6), 0, Math.PI * 2);
                ctx.strokeStyle = col;
                ctx.lineWidth = Math.max(1, 6 * (1 - t));
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size * (1 - t * 0.5)), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        // floating text (normal blend)
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const ft of this.texts) {
            const t = ft.life / ft.maxLife;
            ctx.globalAlpha = Math.max(0, 1 - t);
            ctx.font = `900 ${ft.size}px 'Segoe UI', Roboto, sans-serif`;
            ctx.fillStyle = '#0a0f1e';
            ctx.fillText(ft.text, ft.x + 2, ft.y + 2);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.restore();
    }

    render(ctx) {
        if (this.usePixi) this.renderPixi();
        else if (ctx) this.renderCanvas(ctx);
    }

    clear() {
        for (const p of this.particles) {
            p.active = false;
            if (this.usePixi && p.g) p.g.visible = false;
        }
        for (const ft of this.texts) {
            if (this.usePixi) {
                this.textContainer.removeChild(ft.t);
                ft.t.destroy({ children: true });
            }
        }
        this.texts = [];
    }
}

window.particleSystem = new ParticleSystem();
