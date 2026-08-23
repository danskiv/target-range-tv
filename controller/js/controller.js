class ControllerApp {
    constructor() {
        this.roomCode = new URLSearchParams(window.location.search).get('room') || '';
        this.ws = null;
        this.playerId = 'P1';
        this.ammo = 6;
        this.maxAmmo = 6;

        // Sensor calibration offsets
        this.originPitch = 0.0;
        this.originRoll = 0.0;
        this.isCalibrated = false;

        // Throttling stream
        this.lastStreamTime = 0;
        this.streamIntervalMs = 20; // 50 Hz

        this.initDOM();
        this.autoDiscoverRoom();
    }

    async autoDiscoverRoom() {
        if (!this.roomCode) {
            try {
                const res = await fetch('/api/info');
                const info = await res.json();
                this.roomCode = info.latest_room || 'TG88';
            } catch (e) {
                this.roomCode = 'TG88';
            }
        }
        document.getElementById('input-room-code').value = this.roomCode;
    }

    initDOM() {
        document.getElementById('btn-grant-permission').addEventListener('click', () => {
            this.startController();
        });

        document.getElementById('btn-connect-room').addEventListener('click', () => {
            const manualCode = document.getElementById('input-room-code').value.trim().toUpperCase();
            if (manualCode) {
                this.roomCode = manualCode;
            }
            this.startController();
        });

        document.getElementById('btn-recenter').addEventListener('click', () => {
            this.calibrateZero();
        });

        document.getElementById('trigger-area').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.fireTrigger();
        });

        document.getElementById('btn-reload').addEventListener('click', () => {
            this.reloadAmmo();
        });

        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.startGame();
        });
    }

    onNativeReady() {
        // Automatically hide permission screen in Native APK
        document.getElementById('permission-screen').style.display = 'none';
        this.startController();
    }

    startController() {
        const manualCode = document.getElementById('input-room-code').value.trim().toUpperCase();
        if (manualCode) {
            this.roomCode = manualCode;
        }

        // Hide intro, show controller
        document.getElementById('permission-screen').style.display = 'none';
        this.startSensorListeners();
        this.connectWebSocket();
    }

    connectWebSocket() {
        if (this.ws) {
            this.ws.close();
        }

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || '10.10.10.1:8095';
        this.ws = new WebSocket(`${proto}//${host}/ws/controller/${this.roomCode}`);

        document.getElementById('player-name-tag').textContent = `Menghubungkan ke ${this.roomCode}...`;

        this.ws.onopen = () => {
            document.getElementById('player-name-tag').textContent = `Terhubung (${this.roomCode})`;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'CONTROLLER_JOINED_ACK') {
                this.playerId = data.player_id;
                document.getElementById('player-name-tag').textContent = `${data.player_name} (${this.roomCode})`;
                document.getElementById('player-name-tag').style.color = data.assigned_color;
            } else if (data.type === 'HIT_CONFIRMATION') {
                this.doVibrate(data.is_bullseye ? 80 : 35);
            }
        };

        this.ws.onerror = (e) => {
            document.getElementById('player-name-tag').textContent = `Koneksi Error (${this.roomCode})`;
            document.getElementById('player-name-tag').style.color = '#ef4444';
        };
    }

    startSensorListeners() {
        // 1. Native Android App Bridge Hook
        window.onNativeSensorData = (pitch, roll, yaw) => {
            if (!this.isCalibrated) {
                this.originPitch = pitch;
                this.originRoll = roll;
                this.isCalibrated = true;
            }

            const now = performance.now();
            if (now - this.lastStreamTime >= this.streamIntervalMs) {
                this.lastStreamTime = now;
                
                const deltaPitch = -(pitch - this.originPitch);
                const deltaYaw = -(roll - this.originRoll);

                this.sendAim(deltaPitch, deltaYaw, pitch, roll);
            }
        };

        // 2. Standard Web Browser HTML5 Listener Fallback
        window.addEventListener('deviceorientation', (e) => {
            if (e.beta === null || e.gamma === null) return;

            if (!this.isCalibrated) {
                this.originPitch = e.beta;
                this.originRoll = e.gamma;
                this.isCalibrated = true;
            }

            const now = performance.now();
            if (now - this.lastStreamTime >= this.streamIntervalMs) {
                this.lastStreamTime = now;
                
                const deltaPitch = e.beta - this.originPitch;
                const deltaYaw = e.gamma - this.originRoll;

                this.sendAim(deltaPitch, deltaYaw, e.beta, e.gamma);
            }
        }, true);
    }

    calibrateZero() {
        this.isCalibrated = false;
        this.doVibrate(40);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'CALIBRATE_ZERO'
            }));
        }
    }

    sendAim(pitch, yaw, rawBeta, rawGamma) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'AIM_UPDATE',
                pitch: parseFloat(pitch.toFixed(2)),
                yaw: parseFloat(yaw.toFixed(2)),
                raw_beta: parseFloat(rawBeta.toFixed(2)),
                raw_gamma: parseFloat(rawGamma.toFixed(2))
            }));
        }
    }

    fireTrigger() {
        if (this.ammo <= 0) {
            this.doVibrate(20);
            return;
        }

        this.ammo--;
        this.updateAmmoUI();
        this.doVibrate(50);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'TRIGGER_FIRE',
                ammo_left: this.ammo
            }));
        }
    }

    reloadAmmo() {
        this.ammo = this.maxAmmo;
        this.updateAmmoUI();
        this.doVibrate(40);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'RELOAD_ACTION'
            }));
        }
    }

    startGame() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'START_GAME_REQ'
            }));
        }
    }

    doVibrate(ms) {
        if (window.AndroidNative && window.AndroidNative.vibrate) {
            window.AndroidNative.vibrate(ms);
        } else if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    updateAmmoUI() {
        const dots = document.querySelectorAll('.bullet-dot');
        dots.forEach((dot, index) => {
            if (index < this.ammo) {
                dot.classList.remove('empty');
            } else {
                dot.classList.add('empty');
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.controllerApp = new ControllerApp();
});
