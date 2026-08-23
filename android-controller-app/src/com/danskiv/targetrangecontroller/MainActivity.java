package com.danskiv.targetrangecontroller;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
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
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

public class MainActivity extends Activity implements SensorEventListener {
    private static final String TAG = "TargetRangePureNative";
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

    // State
    private String currentRoom = "TG88";
    private String playerId = "P1";
    private int ammo = 6;
    private final int maxAmmo = 6;
    private boolean inGame = false;

    // ---- 5-point affine calibration (center + 4 corners) ----
    private static final float[][] CALIB_POINTS = {
        {0.50f, 0.50f}, // 0 center
        {0.12f, 0.12f}, // 1 top-left
        {0.88f, 0.12f}, // 2 top-right
        {0.88f, 0.88f}, // 3 bottom-right
        {0.12f, 0.88f}  // 4 bottom-left
    };
    private boolean calibActive = false;
    private int calibIndex = 0;
    private final List<float[]> calibSamples = new ArrayList<>();
    private volatile boolean calibReady = false;
    private volatile float calibA0, calibA1, calibA2, calibA3; // x = a0 + a1*yaw + a2*pitch + a3*roll
    private volatile float calibB0, calibB1, calibB2, calibB3; // y = b0 + b1*yaw + b2*pitch + b3*roll
    private SharedPreferences prefs;
    private Button btnCalib;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    // DEDICATED executor for one-shot actions (shoot/reload/start_game/calib_*).
    // The aim loop must NEVER share this thread or actions get starved forever.
    private final ExecutorService actionExecutor = Executors.newSingleThreadExecutor();
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

        try {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        } catch (Exception e) {}

        initSensors();
        buildNativeUI();
        loadCalibration();
        autoDiscoverRoom();
    }

    private void initSensors() {
        try {
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
        } catch (Exception e) {}
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
        subtitle.setText("Air Gun Controller (Pure API Edition)");
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
                if (!code.isEmpty()) currentRoom = code;
                pairingView.setVisibility(View.GONE);
                controllerView.setVisibility(View.VISIBLE);
                inGame = true;
                calibrateZero();
                startNativeAimLoop();
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
        txtPlayerBadge.setText("🔴 P1 - AIR GUN READY");
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

        // Calibration Button (5-point affine calibration)
        btnCalib = new Button(this);
        btnCalib.setText("🎯 ARAHKAN KE TENGAH TV & KALIBRASI");
        btnCalib.setTextColor(Color.BLACK);
        btnCalib.setBackgroundColor(Color.parseColor("#eab308"));
        btnCalib.setTextSize(12);
        btnCalib.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams calLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        calLp.setMargins(0, 15, 0, 15);
        btnCalib.setLayoutParams(calLp);
        btnCalib.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startCalibration();
            }
        });
        controllerView.addView(btnCalib);

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
        startLp.setMargins(0, 8, 0, 0);
        btnStartGame.setLayoutParams(startLp);
        btnStartGame.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                sendHttpAction("start_game");
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
                    conn.setConnectTimeout(2500);
                    conn.setReadTimeout(2500);
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
                } catch (Exception e) {}
            }
        });
    }

    private void calibrateZero() {
        originPitch = currentPitch;
        originRoll = currentRoll;
        isCalibrated = true;
        doVibrate(50);
    }

    // ==================== 5-POINT AFFINE CALIBRATION ====================

    private void loadCalibration() {
        try {
            prefs = getSharedPreferences("range_calib", MODE_PRIVATE);
            if (prefs.getBoolean("ready", false)) {
                calibA0 = prefs.getFloat("a0", 0); calibA1 = prefs.getFloat("a1", 0);
                calibA2 = prefs.getFloat("a2", 0); calibA3 = prefs.getFloat("a3", 0);
                calibB0 = prefs.getFloat("b0", 0); calibB1 = prefs.getFloat("b1", 0);
                calibB2 = prefs.getFloat("b2", 0); calibB3 = prefs.getFloat("b3", 0);
                // Reject degenerate transforms (all sensor coefficients ~0): they
                // pin the crosshair to a corner. Fall back to delta mapping until
                // a proper 5-point calibration overwrites them.
                float sensorAmp = Math.abs(calibA1) + Math.abs(calibA2) + Math.abs(calibA3)
                                + Math.abs(calibB1) + Math.abs(calibB2) + Math.abs(calibB3);
                calibReady = sensorAmp > 0.001f;
                if (calibReady && btnCalib != null) {
                    btnCalib.setText("✅ KALIBRASI TERSIMPAN (Tekan untuk ulang)");
                    btnCalib.setBackgroundColor(Color.parseColor("#22c55e"));
                }
            }
        } catch (Exception e) {}
    }

    private void startCalibration() {
        calibActive = true;
        calibIndex = 0;
        calibSamples.clear();
        doVibrate(50);
        updateCalibUI();
        sendHttpAction("calib_start");
        sendCalibDot(0);
    }

    private void updateCalibUI() {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (btnCalib != null) {
                    btnCalib.setText(String.format(Locale.US,
                        "🎯 TITIK %d/5: ARAHKAN KE TITIK KUNING & TEMBAK! (%s)",
                        calibIndex + 1, calibPointName(calibIndex)));
                    btnCalib.setBackgroundColor(Color.parseColor("#eab308"));
                }
            }
        });
    }

    private String calibPointName(int i) {
        switch (i) {
            case 0: return "TENGAH";
            case 1: return "KIRI-ATAS";
            case 2: return "KANAN-ATAS";
            case 3: return "KANAN-BAWAH";
            default: return "KIRI-BAWAH";
        }
    }

    private void recordCalibSample() {
        float[] pt = CALIB_POINTS[calibIndex];
        calibSamples.add(new float[]{ currentYaw, currentPitch, currentRoll, pt[0], pt[1] });
        calibIndex++;
        if (calibIndex < CALIB_POINTS.length) {
            doVibrate(60);
            updateCalibUI();
            sendCalibDot(calibIndex);
        } else {
            computeAffine();
            if (isTransformGood()) {
                calibActive = false;
                calibReady = true;
                saveCalibration();
                doVibrate(150);
                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (btnCalib != null) {
                            btnCalib.setText("✅ KALIBRASI SELESAI! (Tekan untuk ulang)");
                            btnCalib.setBackgroundColor(Color.parseColor("#22c55e"));
                        }
                    }
                });
                sendHttpAction("calib_done");
            } else {
                // Bad fit (e.g. shots fired at random positions while the dots
                // were not visible) — reject it, keep the previous transform and
                // restart the sequence instead of saving a degenerate mapping.
                calibIndex = 0;
                calibSamples.clear();
                doVibrate(new int[]{80, 80});
                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (btnCalib != null) {
                            btnCalib.setText("❌ KALIBRASI GAGAL — arahkan TEPAT ke titik kuning lalu tembak. Ulangi dari awal!");
                            btnCalib.setBackgroundColor(Color.parseColor("#ef4444"));
                        }
                    }
                });
                updateCalibUI();
                sendCalibDot(0);
            }
        }
    }

    private boolean isTransformGood() {
        // Re-apply the fitted transform to the calibration samples; if it misses
        // any target by more than 30% of the screen, the fit is garbage.
        for (float[] s : calibSamples) {
            float ex = calibA0 + calibA1 * s[0] + calibA2 * s[1] + calibA3 * s[2];
            float ey = calibB0 + calibB1 * s[0] + calibB2 * s[1] + calibB3 * s[2];
            if (Math.abs(ex - s[3]) > 0.30f || Math.abs(ey - s[4]) > 0.30f) return false;
        }
        return true;
    }

    private void computeAffine() {
        int n = calibSamples.size();
        if (n < 4) return;
        double[][] N = new double[4][4];
        double[] rx = new double[4], ry = new double[4];
        for (float[] s : calibSamples) {
            double yaw = s[0], pitch = s[1], roll = s[2], sx = s[3], sy = s[4];
            double[] row = {1, yaw, pitch, roll};
            for (int i = 0; i < 4; i++) {
                for (int j = 0; j < 4; j++) N[i][j] += row[i] * row[j];
                rx[i] += row[i] * sx;
                ry[i] += row[i] * sy;
            }
        }
        double[] ax = solve4(N, rx);
        double[] ay = solve4(N, ry);
        calibA0 = (float) ax[0]; calibA1 = (float) ax[1]; calibA2 = (float) ax[2]; calibA3 = (float) ax[3];
        calibB0 = (float) ay[0]; calibB1 = (float) ay[1]; calibB2 = (float) ay[2]; calibB3 = (float) ay[3];
    }

    private double[] solve4(double[][] A, double[] b) {
        double[][] M = new double[4][5];
        for (int i = 0; i < 4; i++) {
            System.arraycopy(A[i], 0, M[i], 0, 4);
            M[i][4] = b[i];
        }
        for (int col = 0; col < 4; col++) {
            int piv = col;
            for (int r = col + 1; r < 4; r++) {
                if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
            }
            double[] tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
            for (int r = 0; r < 4; r++) {
                if (r == col) continue;
                double f = M[r][col] / M[col][col];
                for (int c = col; c < 5; c++) M[r][c] -= f * M[col][c];
            }
        }
        double[] x = new double[4];
        for (int i = 0; i < 4; i++) x[i] = M[i][4] / M[i][i];
        return x;
    }

    private void saveCalibration() {
        try {
            if (prefs == null) prefs = getSharedPreferences("range_calib", MODE_PRIVATE);
            SharedPreferences.Editor ed = prefs.edit();
            ed.putBoolean("ready", true);
            ed.putFloat("a0", calibA0); ed.putFloat("a1", calibA1); ed.putFloat("a2", calibA2); ed.putFloat("a3", calibA3);
            ed.putFloat("b0", calibB0); ed.putFloat("b1", calibB1); ed.putFloat("b2", calibB2); ed.putFloat("b3", calibB3);
            ed.apply();
        } catch (Exception e) {}
    }

    private void sendCalibDot(final int index) {
        actionExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("room_code", currentRoom);
                    payload.put("player_id", playerId);
                    payload.put("action", "calib_dot");
                    payload.put("index", index);
                    URL url = new URL("http://" + SERVER_HOST + ":" + SERVER_PORT + "/api/controller/action");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setConnectTimeout(500);
                    conn.setReadTimeout(500);
                    conn.setDoOutput(true);
                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    conn.getResponseCode();
                    conn.disconnect();
                } catch (Exception e) {}
            }
        });
    }

    private void startNativeAimLoop() {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                while (inGame) {
                    try {
                        float normX, normY;
                        if (calibReady) {
                            // Affine transform from 5-point calibration:
                            // maps absolute sensor orientation -> normalized screen coords.
                            normX = calibA0 + calibA1 * currentYaw + calibA2 * currentPitch + calibA3 * currentRoll;
                            normY = calibB0 + calibB1 * currentYaw + calibB2 * currentPitch + calibB3 * currentRoll;
                        } else {
                            float deltaPitch = currentPitch - originPitch;
                            float deltaRoll = currentRoll - originRoll;
                            normX = 0.5f - (deltaRoll / 50.0f);
                            normY = 0.5f - (deltaPitch / 40.0f);
                        }
                        normX = Math.max(0.0f, Math.min(1.0f, normX));
                        normY = Math.max(0.0f, Math.min(1.0f, normY));

                        JSONObject payload = new JSONObject();
                        payload.put("room_code", currentRoom);
                        payload.put("player_id", playerId);
                        payload.put("x", normX);
                        payload.put("y", normY);
                        payload.put("pitch", currentPitch);
                        payload.put("roll", currentRoll);
                        payload.put("yaw", currentYaw);

                        URL url = new URL("http://" + SERVER_HOST + ":" + SERVER_PORT + "/api/controller/aim");
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setConnectTimeout(100);
                        conn.setReadTimeout(100);
                        conn.setDoOutput(true);
                        OutputStream os = conn.getOutputStream();
                        os.write(payload.toString().getBytes("UTF-8"));
                        os.close();
                        conn.getResponseCode();
                        conn.disconnect();

                        Thread.sleep(30); // ~33 FPS continuous aim sync
                    } catch (Exception e) {
                        try { Thread.sleep(50); } catch (Exception ex) {}
                    }
                }
            }
        });
    }

    private void fireTrigger() {
        if (calibActive) {
            recordCalibSample();  // shooting during calibration = record sample
            return;
        }
        if (ammo <= 0) {
            doVibrate(150);
            return;
        }
        ammo--;
        updateAmmoUI();
        doVibrate(40);
        sendHttpAction("shoot");
    }

    private void reloadAmmo() {
        ammo = maxAmmo;
        updateAmmoUI();
        doVibrate(70);
        sendHttpAction("reload");
    }

    private void sendHttpAction(final String action) {
        actionExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("room_code", currentRoom);
                    payload.put("player_id", playerId);
                    payload.put("action", action);

                    URL url = new URL("http://" + SERVER_HOST + ":" + SERVER_PORT + "/api/controller/action");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setConnectTimeout(500);
                    conn.setReadTimeout(500);
                    conn.setDoOutput(true);
                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    conn.getResponseCode();
                    conn.disconnect();
                } catch (Exception e) {}
            }
        });
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
        try {
            if (vibrator != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(ms);
                }
            }
        } catch (Exception e) {}
    }

    private void doVibrate(int[] pattern) {
        try {
            if (vibrator != null) {
                long[] p = new long[pattern.length];
                for (int i = 0; i < pattern.length; i++) p[i] = pattern[i];
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(p, -1));
                } else {
                    vibrator.vibrate(p, -1);
                }
            }
        } catch (Exception e) {}
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        try {
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
        } catch (Exception e) {}
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
        inGame = false;
        executor.shutdown();
        actionExecutor.shutdown();
    }

    @Override
    public void onBackPressed() {
        if (inGame) {
            inGame = false;
            controllerView.setVisibility(View.GONE);
            pairingView.setVisibility(View.VISIBLE);
        } else {
            super.onBackPressed();
        }
    }
}
