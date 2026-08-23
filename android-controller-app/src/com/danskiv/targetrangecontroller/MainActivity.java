package com.danskiv.targetrangecontroller;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ConsoleMessage;
import android.util.Log;

public class MainActivity extends Activity implements SensorEventListener {
    private static final String TAG = "TargetRangeController";
    private static final int CAMERA_REQ_CODE = 200;

    private WebView webView;
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
    private volatile boolean sensorActive = false;

    private PermissionRequest currentWebPermissionRequest;
    private static final String CONTROLLER_URL = "http://10.10.10.1:8095/controller";

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
        initWebView();
        requestNativeCameraPermission();
    }

    private void requestNativeCameraPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.CAMERA}, CAMERA_REQ_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_REQ_CODE && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (currentWebPermissionRequest != null) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        currentWebPermissionRequest.grant(currentWebPermissionRequest.getResources());
                        currentWebPermissionRequest = null;
                    }
                });
            }
        }
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

    private void initWebView() {
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.addJavascriptInterface(new NativeSensorBridge(), "AndroidNative");

        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                currentWebPermissionRequest = request;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            request.grant(request.getResources());
                        } catch (Exception e) {
                            Log.e(TAG, "Error granting web permission: " + e.getMessage());
                        }
                    }
                });
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, "[WebView Console] " + cm.message());
                return true;
            }
        });

        webView.loadUrl(CONTROLLER_URL);
    }

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
            sensorActive = false;
        }
    }

    private void registerSensors() {
        if (sensorManager != null) {
            boolean registered = false;
            if (rotationSensor != null) {
                registered = sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
            }
            if (!registered) {
                if (accelSensor != null) {
                    sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME);
                }
                if (magneticSensor != null) {
                    sensorManager.registerListener(this, magneticSensor, SensorManager.SENSOR_DELAY_GAME);
                }
            }
            sensorActive = true;
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float pitch = 0;
        float roll = 0;
        float yaw = 0;
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

    public class NativeSensorBridge {
        @JavascriptInterface
        public float getPitch() {
            return currentPitch;
        }

        @JavascriptInterface
        public float getRoll() {
            return currentRoll;
        }

        @JavascriptInterface
        public float getYaw() {
            return currentYaw;
        }

        @JavascriptInterface
        public boolean isSensorActive() {
            return sensorActive;
        }

        @JavascriptInterface
        public void vibrate(int milliseconds) {
            if (vibrator != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(milliseconds);
                }
            }
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
