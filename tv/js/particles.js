// Object Pooling for Particles to prevent GC stutters on Android TV
class ParticlePool {
    constructor(maxSize = 120) {
        this.maxSize = maxSize;
        this.particles = [];
        for (let i = 0; i < maxSize; i++) {
            this.particles.push({
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                color: '#fff',
                size: 3,
                alpha: 1.0,
                life: 0,
                maxLife: 30,
                type: 'spark' // 'spark', 'debris', 'smoke', 'text'
            });
        }
        this.floatingTexts = [];
    }

    spawnSpark(x, y, color = '#fbbf24', count = 8) {
        for (let c = 0; c < count; c++) {
            const p = this.particles.find(item => !item.active);
            if (!p) break;
            p.active = true;
            p.x = x;
            p.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.color = color;
            p.size = Math.random() * 3 + 2;
            p.alpha = 1.0;
            p.life = 0;
            p.maxLife = Math.floor(Math.random() * 15 + 15);
            p.type = 'spark';
        }
    }

    spawnDebris(x, y, color = '#60a5fa', count = 12) {
        for (let c = 0; c < count; c++) {
            const p = this.particles.find(item => !item.active);
            if (!p) break;
            p.active = true;
            p.x = x;
            p.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed - 2; // Upward burst
            p.color = color;
            p.size = Math.random() * 6 + 3;
            p.alpha = 1.0;
            p.life = 0;
            p.maxLife = Math.floor(Math.random() * 25 + 20);
            p.type = 'debris';
        }
    }

    addFloatingText(text, x, y, color = '#fef08a', size = 28) {
        this.floatingTexts.push({
            text,
            x,
            y,
            color,
            size,
            alpha: 1.0,
            life: 0,
            maxLife: 45
        });
    }

    update() {
        // Update particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.x += p.vx;
            p.y += p.vy;
            p.life++;

            if (p.type === 'debris') {
                p.vy += 0.35; // Gravity
            } else if (p.type === 'spark') {
                p.vx *= 0.92;
                p.vy *= 0.92;
            }

            p.alpha = 1.0 - (p.life / p.maxLife);

            if (p.life >= p.maxLife) {
                p.active = false;
            }
        }

        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 1.2;
            t.life++;
            t.alpha = 1.0 - (t.life / t.maxLife);
            if (t.life >= t.maxLife) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    render(ctx) {
        ctx.save();
        // Render particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;

            if (p.type === 'debris') {
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Render Floating Texts
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const t = this.floatingTexts[i];
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.font = `bold ${t.size}px "Plus Jakarta Sans", sans-serif`;
            ctx.fillStyle = '#000';
            ctx.fillText(t.text, t.x + 2, t.y + 2); // Shadow
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
    }
}

window.particlePool = new ParticlePool();
