class ControllerApp {
    constructor() {
        this.roomCode = new URLSearchParams(window.location.search).get('room') || '';
        this.ws = null;
        this.playerId = 'P1';
        this.ammo = 6;
        this.maxAmmo = 6;

        // Calibration offsets
        this.originPitch = 0.0;
        this.originRoll = 0.0;
        this.isCalibrated = false;

        // Camera stream
        this.videoStream = null;
        this.isScanning = false;

        this.initDOM();
        this.autoDiscoverRoom();
    }

    async autoDiscoverRoom() {
        // Check URL parameter first
        const urlParam = new URLSearchParams(window.location.search).get('room');
        if (urlParam) {
            this.roomCode = urlParam.toUpperCase();
            document.getElementById('input-room-code').value = this.roomCode;
            this.startController();
            return;
        }

        try {
            const res = await fetch('/api/info');
            const info = await res.json();
            this.roomCode = info.latest_room || 'TG88';
        } catch (e) {
            this.roomCode = 'TG88';
        }
        document.getElementById('input-room-code').value = this.roomCode;
    }

    initDOM() {
        document.getElementById('btn-start-scanner').addEventListener('click', () => {
            this.toggleCameraScanner();
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

    async toggleCameraScanner() {
        const video = document.getElementById('qr-video');
        const container = document.getElementById('scanner-container');
        const placeholder = document.getElementById('scanner-placeholder');
        const btn = document.getElementById('btn-start-scanner');

        if (this.isScanning) {
            this.stopCamera();
            if (container) container.style.display = 'none';
            btn.textContent = '📷 Pindai QR Barcode TV (Opsional)';
            return;
        }

        try {
            btn.textContent = '⏳ Membuka Kamera...';
            if (container) container.style.display = 'block';
            
            // Try environment back camera first, fallback to user/any camera
            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false
                });
            } catch (e1) {
                console.warn('[Camera] Fallback to simple video constraint:', e1);
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }

            this.videoStream = stream;
            video.srcObject = this.videoStream;
            video.setAttribute('playsinline', 'true');
            video.setAttribute('autoplay', 'true');
            video.muted = true;
            await video.play();

            video.style.display = 'block';
            placeholder.style.display = 'none';
            btn.textContent = '❌ TUTUP KAMERA';
            this.isScanning = true;

            requestAnimationFrame(() => this.scanQRCodeLoop());
        } catch (err) {
            console.error('[Camera Error]', err);
            if (container) container.style.display = 'none';
            btn.textContent = '📷 Pindai QR Barcode TV (Opsional)';
            alert(`Kamera tidak dapat diakses pada protokol HTTP internal (Standar Keamanan Browser Chrome/Android). Silakan langsung tekan tombol 'GABUNG KE TV SEKARANG' di atas.`);
        }
    }

    scanQRCodeLoop() {
        if (!this.isScanning) return;
        const video = document.getElementById('qr-video');
        const canvas = document.getElementById('qr-canvas');
        const ctx = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (window.jsQR) {
                const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });

                if (code && code.data) {
                    this.doVibrate(60);
                    // Extract room code from URL or text
                    let detectedRoom = code.data;
                    if (code.data.includes('room=')) {
                        detectedRoom = code.data.split('room=')[1].split('&')[0];
                    }
                    this.roomCode = detectedRoom.toUpperCase();
                    document.getElementById('input-room-code').value = this.roomCode;
                    this.stopCamera();
                    this.startController();
                    return;
                }
            }
        }
        requestAnimationFrame(() => this.scanQRCodeLoop());
    }

    stopCamera() {
        this.isScanning = false;
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        document.getElementById('qr-video').style.display = 'none';
        document.getElementById('scanner-placeholder').style.display = 'block';
    }

    startController() {
        this.stopCamera();
        const manualCode = document.getElementById('input-room-code').value.trim().toUpperCase();
        if (manualCode) {
            this.roomCode = manualCode;
        }

        document.getElementById('permission-screen').style.display = 'none';
        document.getElementById('controller-app').style.display = 'flex';
        
        this.startSensorLoop();
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
            document.getElementById('player-name-tag').style.color = '#38bdf8';
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

        this.ws.onerror = () => {
            document.getElementById('player-name-tag').textContent = `Koneksi Error (${this.roomCode})`;
            document.getElementById('player-name-tag').style.color = '#ef4444';
        };
    }

    startSensorLoop() {
        setInterval(() => {
            let pitch = 0;
            let roll = 0;
            let yaw = 0;
            let hasData = false;

            if (window.AndroidNative && window.AndroidNative.isSensorActive && window.AndroidNative.isSensorActive()) {
                pitch = window.AndroidNative.getPitch();
                roll = window.AndroidNative.getRoll();
                yaw = window.AndroidNative.getYaw();
                hasData = true;
            }

            if (hasData) {
                if (!this.isCalibrated) {
                    this.originPitch = pitch;
                    this.originRoll = roll;
                    this.isCalibrated = true;
                }

                const deltaPitch = -(pitch - this.originPitch);
                const deltaYaw = -(roll - this.originRoll);

                this.sendAim(deltaPitch, deltaYaw, pitch, roll);
            }
        }, 16);

        window.addEventListener('deviceorientation', (e) => {
            if (window.AndroidNative) return;
            if (e.beta === null || e.gamma === null) return;

            if (!this.isCalibrated) {
                this.originPitch = e.beta;
                this.originRoll = e.gamma;
                this.isCalibrated = true;
            }

            const deltaPitch = e.beta - this.originPitch;
            const deltaYaw = e.gamma - this.originRoll;

            this.sendAim(deltaPitch, deltaYaw, e.beta, e.gamma);
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
