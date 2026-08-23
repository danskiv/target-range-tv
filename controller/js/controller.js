class ControllerApp {
    constructor() {
        this.roomCode = new URLSearchParams(window.location.search).get('room') || 'TG88';
        this.ws = null;
        this.playerId = 'P1';
        this.ammo = 6;
        this.maxAmmo = 6;

        // Sensor calibration offsets
        this.originBeta = 90.0;
        this.originGamma = 0.0;
        this.isCalibrated = false;

        // Throttling stream
        this.lastStreamTime = 0;
        this.streamIntervalMs = 20; // 50 Hz

        this.initDOM();
    }

    initDOM() {
        document.getElementById('btn-grant-permission').addEventListener('click', () => {
            this.requestSensorPermission();
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

    async requestSensorPermission() {
        // Handle iOS 13+ permission request
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.startSensorListeners();
                } else {
                    alert('Izin sensor gerak ditolak.');
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            // Android & other modern browsers
            this.startSensorListeners();
        }

        // Hide intro, show controller
        document.getElementById('permission-screen').style.display = 'none';
        this.connectWebSocket();
    }

    connectWebSocket() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${proto}//${window.location.host}/ws/controller/${this.roomCode}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'CONTROLLER_JOINED_ACK') {
                this.playerId = data.player_id;
                document.getElementById('player-name-tag').textContent = `${data.player_name} (${this.roomCode})`;
                document.getElementById('player-name-tag').style.color = data.assigned_color;
            } else if (data.type === 'HIT_CONFIRMATION') {
                if (navigator.vibrate) {
                    if (data.is_bullseye) {
                        navigator.vibrate([60, 40, 80]); // Double strong vibration
                    } else {
                        navigator.vibrate(35);
                    }
                }
            }
        };
    }

    startSensorListeners() {
        // 1. Native Android App Bridge Hook
        window.onNativeSensorData = (pitch, roll, yaw) => {
            if (!this.isCalibrated) {
                this.originBeta = pitch;
                this.originGamma = roll;
                this.isCalibrated = true;
            }

            const now = performance.now();
            if (now - this.lastStreamTime >= this.streamIntervalMs) {
                this.lastStreamTime = now;
                
                // Invert / map correctly
                const deltaPitch = -(pitch - this.originBeta);
                const deltaYaw = -(roll - this.originGamma);

                this.sendAim(deltaPitch, deltaYaw, pitch, roll);
            }
        };

        // 2. Standard Web Browser HTML5 Listener Fallback
        window.addEventListener('deviceorientation', (e) => {
            if (e.beta === null || e.gamma === null) return;

            if (!this.isCalibrated) {
                this.originBeta = e.beta;
                this.originGamma = e.gamma;
                this.isCalibrated = true;
            }

            const now = performance.now();
            if (now - this.lastStreamTime >= this.streamIntervalMs) {
                this.lastStreamTime = now;
                
                const deltaPitch = e.beta - this.originBeta;
                const deltaYaw = e.gamma - this.originGamma;

                this.sendAim(deltaPitch, deltaYaw, e.beta, e.gamma);
            }
        }, true);
    }

    calibrateZero() {
        // Request immediate zero-point calibration
        this.isCalibrated = false;
        if (navigator.vibrate) navigator.vibrate(40);

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
            if (navigator.vibrate) navigator.vibrate([20, 20, 20]);
            return;
        }

        this.ammo--;
        this.updateAmmoUI();

        // Haptic Recoil
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

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
        if (navigator.vibrate) navigator.vibrate([40, 50, 40]);

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
