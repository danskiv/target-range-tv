package com.danskiv.targetrangecontroller;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.os.Build;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONObject;

public class MainActivity extends Activity implements SensorEventListener {
    private static final String TAG = "TargetRangeNative";
    private static final String SERVER_HOST = "10.10.10.1";
    private static final int SERVER_PORT = 8095;

    // Sensors
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private Sensor accelSensor;
    private Sensor magneticSensor;
    private Vibrator vibrator;

    private float[] rotationMatrix = new float[9];
    private float[] orientationValues = new float[3];
    private float[] lastAccelerometer = new float[3];
    private float[] lastMagnetometer = new float[3];
    private boolean lastAccelerometerSet = false;
    private boolean lastMagnetometerSet = false;

    private volatile float currentPitch = 0.0f;
    private volatile float currentRoll = 0.0f;
    private volatile float currentYaw = 0.0f;
    private float originPitch = 0.0f;
    private float originRoll = 0.0f;
    private boolean isCalibrated = false;

    // Networking
    private WebSocketClient webSocketClient;
    private String currentRoom = "TG88";
    private String playerId = "P1";
    private int ammo = 6;
    private final int maxAmmo = 6;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Native UI Components
    private LinearLayout pairingView;
    private LinearLayout controllerView;
    private EditText inputRoomCode;
    private TextView txtStatus;
    private TextView txtPlayerBadge;
    private LinearLayout ammoContainer;
    private TextView[] ammoDots = new TextView[6];
    private Button btnTrigger;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on & immersive fullscreen
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        initSensors();
        buildNativeUI();
        autoDiscoverRoom();
    }

    private void initSensors() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            if (rotationSensor == null) {
                rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
            }
            accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            magneticSensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        }
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        registerSensors();
    }

    private void registerSensors() {
        if (sensorManager != null) {
            if (rotationSensor != null) {
                sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
            } else {
                if (accelSensor != null) sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME);
                if (magneticSensor != null) sensorManager.registerListener(this, magneticSensor, SensorManager.SENSOR_DELAY_GAME);
            }
        }
    }

    private void buildNativeUI() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#08090d"));
        root.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // 1. PAIRING VIEW
        pairingView = new LinearLayout(this);
        pairingView.setOrientation(LinearLayout.VERTICAL);
        pairingView.setGravity(Gravity.CENTER);
        pairingView.setPadding(40, 60, 40, 60);
        pairingView.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        TextView title = new TextView(this);
        title.setText("🎯 TARGET RANGE");
        title.setTextColor(Color.parseColor("#38bdf8"));
        title.setTextSize(24);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        pairingView.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Air Gun Controller (100% Native Edition)");
        subtitle.setTextColor(Color.parseColor("#94a3b8"));
        subtitle.setTextSize(12);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 8, 0, 40);
        pairingView.addView(subtitle);

        // Room Code Input Box
        LinearLayout codeBox = new LinearLayout(this);
        codeBox.setOrientation(LinearLayout.VERTICAL);
        codeBox.setBackgroundColor(Color.parseColor("#0f172a"));
        codeBox.setPadding(30, 30, 30, 30);
        codeBox.setGravity(Gravity.CENTER);
        
        TextView lblCode = new TextView(this);
        lblCode.setText("KODE ROOM TV AKTIF:");
        lblCode.setTextColor(Color.parseColor("#cbd5e1"));
        lblCode.setTextSize(11);
        lblCode.setTypeface(null, Typeface.BOLD);
        codeBox.addView(lblCode);

        inputRoomCode = new EditText(this);
        inputRoomCode.setText("TG88");
        inputRoomCode.setTextColor(Color.parseColor("#38bdf8"));
        inputRoomCode.setTextSize(28);
        inputRoomCode.setTypeface(null, Typeface.BOLD);
        inputRoomCode.setGravity(Gravity.CENTER);
        inputRoomCode.setBackgroundColor(Color.parseColor("#020617"));
        inputRoomCode.setPadding(20, 15, 20, 15);
        LinearLayout.LayoutParams inputLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        inputLp.setMargins(0, 15, 0, 20);
        inputRoomCode.setLayoutParams(inputLp);
        codeBox.addView(inputRoomCode);

        Button btnJoin = new Button(this);
        btnJoin.setText("⚡ GABUNG KE TV SEKARANG");
        btnJoin.setTextColor(Color.WHITE);
        btnJoin.setTextSize(15);
        btnJoin.setTypeface(null, Typeface.BOLD);
        btnJoin.setBackgroundColor(Color.parseColor("#0284c7"));
        btnJoin.setPadding(20, 25, 20, 25);
        btnJoin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String code = inputRoomCode.getText().toString().trim().toUpperCase();
                if (!code.isEmpty()) {
                    currentRoom = code;
                }
                connectWebSocket();
            }
        });
        codeBox.addView(btnJoin);
        pairingView.addView(codeBox);

        txtStatus = new TextView(this);
        txtStatus.setText("Mencari room aktif di TV...");
        txtStatus.setTextColor(Color.parseColor("#64748b"));
        txtStatus.setTextSize(11);
        txtStatus.setGravity(Gravity.CENTER);
        txtStatus.setPadding(0, 25, 0, 0);
        pairingView.addView(txtStatus);

        root.addView(pairingView);

        // 2. CONTROLLER GAMEPLAY VIEW (AIR GUN HUD)
        controllerView = new LinearLayout(this);
        controllerView.setOrientation(LinearLayout.VERTICAL);
        controllerView.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        controllerView.setVisibility(View.GONE);
        controllerView.setPadding(20, 20, 20, 30);

        // Header (Player Tag & Ammo Dots)
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(Color.parseColor("#0f172a"));
        header.setPadding(20, 15, 20, 15);

        txtPlayerBadge = new TextView(this);
        txtPlayerBadge.setText("🔴 P1 - PLAYER 1");
        txtPlayerBadge.setTextColor(Color.parseColor("#ef4444"));
        txtPlayerBadge.setTextSize(13);
        txtPlayerBadge.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        txtPlayerBadge.setLayoutParams(badgeLp);
        header.addView(txtPlayerBadge);

        ammoContainer = new LinearLayout(this);
        ammoContainer.setOrientation(LinearLayout.HORIZONTAL);
        for (int i = 0; i < 6; i++) {
            TextView dot = new TextView(this);
            dot.setText("●");
            dot.setTextColor(Color.parseColor("#38bdf8"));
            dot.setTextSize(18);
            dot.setPadding(4, 0, 4, 0);
            ammoDots[i] = dot;
            ammoContainer.addView(dot);
        }
        header.addView(ammoContainer);
        controllerView.addView(header);

        // Calibration Button
        Button btnRecenter = new Button(this);
        btnRecenter.setText("🎯 ARAHKAN KE TENGAH TV & KALIBRASI");
        btnRecenter.setTextColor(Color.BLACK);
        btnRecenter.setBackgroundColor(Color.parseColor("#eab308"));
        btnRecenter.setTextSize(12);
        btnRecenter.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams calLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        calLp.setMargins(0, 15, 0, 15);
        btnRecenter.setLayoutParams(calLp);
        btnRecenter.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                calibrateZero();
            }
        });
        controllerView.addView(btnRecenter);

        // Big Trigger Touch Pad
        btnTrigger = new Button(this);
        btnTrigger.setText("🔥 TEMBAK\n(Sentuh Di Sini)");
        btnTrigger.setTextColor(Color.WHITE);
        btnTrigger.setTextSize(26);
        btnTrigger.setTypeface(null, Typeface.BOLD);
        btnTrigger.setBackgroundColor(Color.parseColor("#b91c1c"));
        LinearLayout.LayoutParams triggerLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f);
        btnTrigger.setLayoutParams(triggerLp);
        btnTrigger.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    fireTrigger();
                    btnTrigger.setBackgroundColor(Color.parseColor("#dc2626"));
                    return true;
                } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                    btnTrigger.setBackgroundColor(Color.parseColor("#b91c1c"));
                    return true;
                }
                return false;
            }
        });
        controllerView.addView(btnTrigger);

        // Bottom Controls (Reload & Start Game)
        LinearLayout bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams botLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        botLp.setMargins(0, 15, 0, 0);
        bottomBar.setLayoutParams(botLp);

        Button btnReload = new Button(this);
        btnReload.setText("🔄 RELOAD");
        btnReload.setTextColor(Color.WHITE);
        btnReload.setBackgroundColor(Color.parseColor("#334155"));
        btnReload.setTextSize(13);
        btnReload.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams relLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        relLp.setMargins(0, 0, 8, 0);
        btnReload.setLayoutParams(relLp);
        btnReload.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                reloadAmmo();
            }
        });
        bottomBar.addView(btnReload);

        Button btnStartGame = new Button(this);
        btnStartGame.setText("▶️ MULAI GAME");
        btnStartGame.setTextColor(Color.BLACK);
        btnStartGame.setBackgroundColor(Color.parseColor("#22c55e"));
        btnStartGame.setTextSize(13);
        btnStartGame.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams startLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        btnStartGame.setLayoutParams(startLp);
        btnStartGame.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                sendStartGame();
            }
        });
        bottomBar.addView(btnStartGame);

        controllerView.addView(bottomBar);
        root.addView(controllerView);

        setContentView(root);
    }

    private void autoDiscoverRoom() {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL("http://" + SERVER_HOST + ":" + SERVER_PORT + "/api/info");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(3000);
                    conn.setReadTimeout(3000);
                    if (conn.getResponseCode() == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                        reader.close();

                        JSONObject json = new JSONObject(sb.toString());
                        final String latest = json.optString("latest_room", "TG88");
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                currentRoom = latest;
                                inputRoomCode.setText(latest);
                                txtStatus.setText("🟢 Room TV Terdeteksi: " + latest);
                            }
                        });
                    }
                } catch (Exception e) {
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            txtStatus.setText("Silakan masukkan Kode Room TV di atas.");
                        }
                    });
                }
            }
        });
    }

    private void connectWebSocket() {
        txtStatus.setText("Menghubungkan ke " + currentRoom + "...");
        try {
            URI uri = new URI("ws://" + SERVER_HOST + ":" + SERVER_PORT + "/ws/controller/" + currentRoom);
            webSocketClient = new WebSocketClient(uri) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    Log.d(TAG, "Native WebSocket Connected!");
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            pairingView.setVisibility(View.GONE);
                            controllerView.setVisibility(View.VISIBLE);
                            calibrateZero();
                            startGyroBroadcastLoop();
                        }
                    });
                }

                @Override
                public void onMessage(String message) {
                    try {
                        JSONObject json = new JSONObject(message);
                        String type = json.optString("type");
                        if ("connected".equals(type)) {
                            playerId = json.optString("player_id", "P1");
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    txtPlayerBadge.setText("🔴 " + playerId + " - AIR GUN READY");
                                }
                            });
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "JSON parse error: " + e.getMessage());
                    }
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            pairingView.setVisibility(View.VISIBLE);
                            controllerView.setVisibility(View.GONE);
                            txtStatus.setText("Terputus. Silakan gabung kembali.");
                        }
                    });
                }

                @Override
                public void onError(Exception ex) {
                    Log.e(TAG, "WS Error: " + ex.getMessage());
                }
            };
            webSocketClient.connect();
        } catch (Exception e) {
            txtStatus.setText("Gagal koneksi: " + e.getMessage());
        }
    }

    private void calibrateZero() {
        originPitch = currentPitch;
        originRoll = currentRoll;
        isCalibrated = true;
        doVibrate(50);
    }

    private void startGyroBroadcastLoop() {
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (webSocketClient != null && webSocketClient.isOpen()) {
                    float deltaPitch = currentPitch - originPitch;
                    float deltaRoll = currentRoll - originRoll;

                    // Compute normalized screen [0, 1] coordinates
                    float normX = 0.5f - (deltaRoll / 50.0f);
                    float normY = 0.5f - (deltaPitch / 40.0f);

                    normX = Math.max(0.0f, Math.min(1.0f, normX));
                    normY = Math.max(0.0f, Math.min(1.0f, normY));

                    try {
                        JSONObject msg = new JSONObject();
                        msg.put("type", "aim");
                        msg.put("x", normX);
                        msg.put("y", normY);
                        msg.put("pitch", currentPitch);
                        msg.put("roll", currentRoll);
                        msg.put("yaw", currentYaw);
                        webSocketClient.send(msg.toString());
                    } catch (Exception e) {}

                    mainHandler.postDelayed(this, 30); // ~33 FPS continuous aim sync
                }
            }
        }, 30);
    }

    private void fireTrigger() {
        if (ammo <= 0) {
            doVibrate(150);
            return;
        }
        ammo--;
        updateAmmoUI();
        doVibrate(40);

        if (webSocketClient != null && webSocketClient.isOpen()) {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", "shoot");
                webSocketClient.send(msg.toString());
            } catch (Exception e) {}
        }
    }

    private void reloadAmmo() {
        ammo = maxAmmo;
        updateAmmoUI();
        doVibrate(70);

        if (webSocketClient != null && webSocketClient.isOpen()) {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", "reload");
                webSocketClient.send(msg.toString());
            } catch (Exception e) {}
        }
    }

    private void sendStartGame() {
        doVibrate(50);
        if (webSocketClient != null && webSocketClient.isOpen()) {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", "start_game");
                webSocketClient.send(msg.toString());
            } catch (Exception e) {}
        }
    }

    private void updateAmmoUI() {
        for (int i = 0; i < 6; i++) {
            if (i < ammo) {
                ammoDots[i].setTextColor(Color.parseColor("#38bdf8"));
            } else {
                ammoDots[i].setTextColor(Color.parseColor("#334155"));
            }
        }
    }

    private void doVibrate(int ms) {
        if (vibrator != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(ms);
            }
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float pitch = 0, roll = 0, yaw = 0;
        boolean hasOrientation = false;

        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR || 
            event.sensor.getType() == Sensor.TYPE_GAME_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
            SensorManager.getOrientation(rotationMatrix, orientationValues);
            yaw = (float) Math.toDegrees(orientationValues[0]);
            pitch = (float) Math.toDegrees(orientationValues[1]);
            roll = (float) Math.toDegrees(orientationValues[2]);
            hasOrientation = true;
        } else if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            System.arraycopy(event.values, 0, lastAccelerometer, 0, event.values.length);
            lastAccelerometerSet = true;
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(event.values, 0, lastMagnetometer, 0, event.values.length);
            lastMagnetometerSet = true;
        }

        if (!hasOrientation && lastAccelerometerSet && lastMagnetometerSet) {
            if (SensorManager.getRotationMatrix(rotationMatrix, null, lastAccelerometer, lastMagnetometer)) {
                SensorManager.getOrientation(rotationMatrix, orientationValues);
                yaw = (float) Math.toDegrees(orientationValues[0]);
                pitch = (float) Math.toDegrees(orientationValues[1]);
                roll = (float) Math.toDegrees(orientationValues[2]);
                hasOrientation = true;
            }
        }

        if (hasOrientation) {
            currentPitch = pitch;
            currentRoll = roll;
            currentYaw = yaw;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    protected void onResume() {
        super.onResume();
        registerSensors();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdown();
        if (webSocketClient != null) {
            webSocketClient.close();
        }
    }
}
