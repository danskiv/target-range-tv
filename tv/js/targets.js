class TargetManager {
    constructor(canvasWidth = 1920, canvasHeight = 1080) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.targets = [];
        this.maxConcurrentTargets = 8;
        this.spawnTimer = 0;
        this.currentWave = 1;
    }

    reset() {
        this.targets = [];
        this.spawnTimer = 0;
        this.currentWave = 1;
    }

    spawnTarget(type = 'BULLSEYE') {
        const id = Math.random().toString(36).substring(2, 9);
        let target = null;

        if (type === 'BULLSEYE') {
            const radius = 45;
            target = {
                id,
                type: 'BULLSEYE',
                x: Math.random() * (this.width - 300) + 150,
                y: Math.random() * (this.height - 350) + 120,
                radius: radius,
                vx: 0,
                vy: 0,
                points: 100,
                life: 0,
                maxLife: 240, // 4 seconds at 60fps
                active: true
            };
        } else if (type === 'BOTTLE') {
            target = {
                id,
                type: 'BOTTLE',
                x: Math.random() * (this.width - 250) + 120,
                y: Math.random() * 200 + (this.height - 320), // Bottom shelves
                width: 36,
                height: 70,
                vx: 0,
                vy: 0,
                points: 30,
                life: 0,
                maxLife: 300,
                active: true
            };
        } else if (type === 'MOVING_RAIL') {
            const fromLeft = Math.random() > 0.5;
            const speed = (Math.random() * 3 + 2.5) * (fromLeft ? 1 : -1);
            target = {
                id,
                type: 'MOVING_RAIL',
                x: fromLeft ? -60 : this.width + 60,
                y: Math.random() * 250 + 200,
                radius: 40,
                vx: speed,
                vy: 0,
                points: 50,
                life: 0,
                maxLife: 600,
                active: true
            };
        } else if (type === 'HAZARD_CIVILIAN') {
            target = {
                id,
                type: 'HAZARD_CIVILIAN',
                x: Math.random() * (this.width - 300) + 150,
                y: Math.random() * (this.height - 350) + 150,
                radius: 45,
                vx: 0,
                vy: 0,
                points: -100,
                life: 0,
                maxLife: 200,
                active: true
            };
        }

        if (target) {
            this.targets.push(target);
        }
    }

    update() {
        this.spawnTimer++;

        // Spawning cadence
        if (this.spawnTimer % 90 === 0 && this.targets.length < this.maxConcurrentTargets) {
            const roll = Math.random();
            if (roll < 0.40) {
                this.spawnTarget('BULLSEYE');
            } else if (roll < 0.70) {
                this.spawnTarget('MOVING_RAIL');
            } else if (roll < 0.90) {
                this.spawnTarget('BOTTLE');
            } else {
                this.spawnTarget('HAZARD_CIVILIAN');
            }
        }

        // Update target positions & life
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            t.x += t.vx;
            t.y += t.vy;
            t.life++;

            // Out of bounds or expired
            if (t.life >= t.maxLife || t.x < -100 || t.x > this.width + 100) {
                this.targets.splice(i, 1);
            }
        }
    }

    checkHit(shotX, shotY) {
        let hitResult = null;

        // Check in reverse order (topmost first)
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            
            if (t.type === 'BULLSEYE' || t.type === 'MOVING_RAIL' || t.type === 'HAZARD_CIVILIAN') {
                const dist = Math.hypot(shotX - t.x, shotY - t.y);
                if (dist <= t.radius) {
                    let score = t.points;
                    let isCenter = false;

                    if (t.type !== 'HAZARD_CIVILIAN') {
                        if (dist <= t.radius * 0.25) {
                            score = 100; // Perfect Bullseye
                            isCenter = true;
                        } else if (dist <= t.radius * 0.6) {
                            score = 50;
                        } else {
                            score = 25;
                        }
                    }

                    hitResult = {
                        target: t,
                        points: score,
                        isCenter,
                        type: t.type
                    };
                    this.targets.splice(i, 1);
                    break;
                }
            } else if (t.type === 'BOTTLE') {
                if (shotX >= t.x - t.width/2 && shotX <= t.x + t.width/2 &&
                    shotY >= t.y - t.height && shotY <= t.y) {
                    hitResult = {
                        target: t,
                        points: t.points,
                        isCenter: false,
                        type: 'BOTTLE'
                    };
                    this.targets.splice(i, 1);
                    break;
                }
            }
        }
        return hitResult;
    }

    render(ctx) {
        ctx.save();
        for (let i = 0; i < this.targets.length; i++) {
            const t = this.targets[i];

            if (t.type === 'BULLSEYE' || t.type === 'MOVING_RAIL') {
                // Outer ring
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#1e293b';
                ctx.stroke();

                // Middle Ring
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius * 0.65, 0, Math.PI * 2);
                ctx.fillStyle = '#3b82f6';
                ctx.fill();

                // Inner Bullseye Red
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.fill();
            } else if (t.type === 'BOTTLE') {
                // Glass Bottle
                ctx.fillStyle = '#10b981';
                ctx.fillRect(t.x - t.width/2, t.y - t.height * 0.7, t.width, t.height * 0.7);
                // Neck
                ctx.fillRect(t.x - t.width * 0.25, t.y - t.height, t.width * 0.5, t.height * 0.35);
                ctx.strokeStyle = '#059669';
                ctx.strokeRect(t.x - t.width/2, t.y - t.height * 0.7, t.width, t.height * 0.7);
            } else if (t.type === 'HAZARD_CIVILIAN') {
                // Civilian Warning Target
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#eab308'; // Yellow
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#dc2626';
                ctx.stroke();

                // Cross X Warning
                ctx.font = 'bold 36px sans-serif';
                ctx.fillStyle = '#dc2626';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚠️', t.x, t.y);
            }
        }
        ctx.restore();
    }
}

window.targetManager = new TargetManager();
