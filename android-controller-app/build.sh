#!/bin/bash
set -e

APP_DIR="/home/ubuntu/Github/target-range-tv/android-controller-app"
ANDROID_JAR="/home/ubuntu/android-31.jar"
R8_JAR="/home/ubuntu/r8.jar"
OUT_DIR="$APP_DIR/bin"
OBJ_DIR="$APP_DIR/obj"

echo "=== 1. Cleaning old build artifacts ==="
rm -rf "$OUT_DIR" "$OBJ_DIR"
mkdir -p "$OUT_DIR" "$OBJ_DIR"

echo "=== 2. Packaging resources with aapt ==="
aapt package -f -m \
    -J "$APP_DIR/src" \
    -M "$APP_DIR/AndroidManifest.xml" \
    -S "$APP_DIR/res" \
    -I "$ANDROID_JAR"

WS_JAR="$APP_DIR/libs/java-websocket.jar"
SLF4J_JAR="$APP_DIR/libs/slf4j-api-1.7.30.jar"
if [ ! -f "$WS_JAR" ]; then
    echo "ERROR: $WS_JAR missing — required for v2 WebSocket client" >&2
    exit 1
fi
if [ ! -f "$SLF4J_JAR" ]; then
    echo "ERROR: $SLF4J_JAR missing — java-websocket 1.5.6 requires slf4j-api at runtime (NoClassDefFoundError otherwise)" >&2
    exit 1
fi

echo "=== 3. Compiling Java classes (classpath: android.jar + java-websocket.jar + slf4j-api) ==="
javac -source 1.8 -target 1.8 -d "$OBJ_DIR" -cp "$ANDROID_JAR:$WS_JAR:$SLF4J_JAR" \
    "$APP_DIR/src/com/danskiv/targetrangecontroller/"*.java

echo "=== 4. Dexing classes with D8/R8 (bundling java-websocket.jar + slf4j-api) ==="
# Extract java-websocket + slf4j classes so D8 can dex them alongside the app classes
WS_EXTRACT="$OBJ_DIR/ws"
mkdir -p "$WS_EXTRACT"
cd "$WS_EXTRACT"
jar xf "$WS_JAR"
jar xf "$SLF4J_JAR"
cd - >/dev/null

java -cp "$R8_JAR" com.android.tools.r8.D8 \
    --output "$OUT_DIR/" \
    --lib "$ANDROID_JAR" \
    $(find "$OBJ_DIR" -name '*.class' ! -name 'module-info.class' ! -path '*/META-INF/*' | sort)

echo "=== 5. Packaging APK ==="
aapt package -f \
    -M "$APP_DIR/AndroidManifest.xml" \
    -S "$APP_DIR/res" \
    -I "$ANDROID_JAR" \
    -F "$OUT_DIR/unsigned.apk"

cd "$OUT_DIR"
aapt add unsigned.apk classes.dex

echo "=== 6. Zipalign APK ==="
zipalign -f -p 4 unsigned.apk aligned.apk

echo "=== 7. Signing APK with debug keystore ==="
if [ ! -f "$APP_DIR/debug.keystore" ]; then
    keytool -genkeypair -keystore "$APP_DIR/debug.keystore" -storepass android \
        -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 \
        -validity 10000 -dname "CN=Danas, OU=Gaming, O=Danskiv, L=Surabaya, ST=JawaTimur, C=ID"
fi

apksigner sign --ks "$APP_DIR/debug.keystore" --ks-pass pass:android \
    --out "$OUT_DIR/TargetRangeController-v2.0.0.apk" aligned.apk

echo "=== ✅ BUILD SUCCESS: $OUT_DIR/TargetRangeController-v2.0.0.apk ==="
mkdir -p /home/ubuntu/apk-delivery
cp "$OUT_DIR/TargetRangeController-v2.0.0.apk" /home/ubuntu/apk-delivery/TargetRangeController-v2.0.0.apk
