import asyncio
import json
import time
import websockets
import subprocess

TV_ADB = "10.10.10.5:5555"

def capture_tv(filename: str):
    subprocess.run(["adb", "-s", TV_ADB, "shell", "screencap", "-p", f"/sdcard/{filename}"], check=True)
    subprocess.run(["adb", "-s", TV_ADB, "pull", f"/sdcard/{filename}", f"/tmp/{filename}"], check=True)
    print(f"📸 Captured TV screencap: /tmp/{filename}")

async def run_full_suite():
    uri = "ws://127.0.0.1:8095/ws/controller/TG88"
    print(f"🚀 Connecting controller simulation to {uri}...")
    
    async with websockets.connect(uri) as ws:
        ack = await ws.recv()
        print("✅ [TC-01 Pairing] Controller Joined ACK:", ack)
        await asyncio.sleep(1)

        # =========================================================================
        # SKENARIO 1: KALIBRASI 5-TITIK AFFINE (TC-02)
        # =========================================================================
        print("\n--- SKENARIO 1: Pengujian Kalibrasi 5-Titik Affine ---")
        # 1. Start calib
        await ws.send(json.dumps({"type": "CALIB_START"}))
        print("-> Sent CALIB_START (Point 1/5 Center)")
        await asyncio.sleep(0.8)
        capture_tv("tc02_calib_pt0.png")

        # 2. Point 2 (Top-Left 0.05, 0.05)
        await ws.send(json.dumps({"type": "CALIB_DOT", "index": 1}))
        print("-> Sent CALIB_DOT index 1 (Top-Left)")
        await asyncio.sleep(0.5)

        # 3. Point 3 (Top-Right 0.95, 0.05)
        await ws.send(json.dumps({"type": "CALIB_DOT", "index": 2}))
        print("-> Sent CALIB_DOT index 2 (Top-Right)")
        await asyncio.sleep(0.5)

        # 4. Point 4 (Bottom-Right 0.95, 0.95)
        await ws.send(json.dumps({"type": "CALIB_DOT", "index": 3}))
        print("-> Sent CALIB_DOT index 3 (Bottom-Right)")
        await asyncio.sleep(0.5)

        # 5. Point 5 (Bottom-Left 0.05, 0.95)
        await ws.send(json.dumps({"type": "CALIB_DOT", "index": 4}))
        print("-> Sent CALIB_DOT index 4 (Bottom-Left)")
        await asyncio.sleep(0.5)

        # 6. Calib Done
        await ws.send(json.dumps({"type": "CALIB_DONE"}))
        print("-> Sent CALIB_DONE")
        await asyncio.sleep(0.8)
        capture_tv("tc02_calib_done.png")

        # =========================================================================
        # SKENARIO 2: START GAME & COUNTDOWN (TC-01, TC-04)
        # =========================================================================
        print("\n--- SKENARIO 2: Start Game & Countdown ---")
        await ws.send(json.dumps({"type": "START_GAME_REQ"}))
        print("-> Sent START_GAME_REQ")
        await asyncio.sleep(1.0)
        capture_tv("tc_countdown_2.png")
        await asyncio.sleep(2.2) # Tunggu sampai FIRE! dan wave mulai
        capture_tv("tc_gameplay_wave1.png")

        # =========================================================================
        # SKENARIO 3: AIMING & CROSSHAIR MOTION (TC-03)
        # =========================================================================
        print("\n--- SKENARIO 3: Aiming & Gerak Crosshair ---")
        for pos in [(0.2, 0.3), (0.8, 0.3), (0.5, 0.5), (0.3, 0.7), (0.7, 0.7)]:
            await ws.send(json.dumps({
                "type": "AIM_UPDATE",
                "x": pos[0],
                "y": pos[1]
            }))
            await asyncio.sleep(0.15)
        print("-> Aim motion sequence executed smoothly.")

        # =========================================================================
        # SKENARIO 4: TEMBAKAN, HIT DETECTION, DAN COMBO (TC-04, TC-07, TC-08)
        # =========================================================================
        print("\n--- SKENARIO 4: Tembakan, Hit Detection & Combo ---")
        # Bidik ke tengah dan tembak berulang kali
        for i in range(4):
            await ws.send(json.dumps({"type": "AIM_UPDATE", "x": 0.5, "y": 0.5}))
            await ws.send(json.dumps({"type": "TRIGGER_FIRE"}))
            print(f"-> Shot {i+1} fired at (0.5, 0.5)")
            await asyncio.sleep(0.3)
        capture_tv("tc_shooting_hits.png")

        # =========================================================================
        # SKENARIO 5: AMMO DEPLETION & DRY FIRE (TC-05)
        # =========================================================================
        print("\n--- SKENARIO 5: Amunisi Habis & Dry Fire ---")
        # Habiskan 2 sisa peluru (total 6)
        await ws.send(json.dumps({"type": "TRIGGER_FIRE"}))
        await asyncio.sleep(0.2)
        await ws.send(json.dumps({"type": "TRIGGER_FIRE"}))
        await asyncio.sleep(0.2)
        # Tembakan ke-7 saat amunisi 0 (Dry Fire)
        await ws.send(json.dumps({"type": "TRIGGER_FIRE"}))
        print("-> Dry fire triggered at 0 ammo.")
        await asyncio.sleep(0.4)
        capture_tv("tc05_dry_fire.png")

        # =========================================================================
        # SKENARIO 6: RELOAD AMMO (TC-06)
        # =========================================================================
        print("\n--- SKENARIO 6: Reload Senjata ---")
        await ws.send(json.dumps({"type": "RELOAD_ACTION"}))
        print("-> Sent RELOAD_ACTION (Ammo should restore to 6/6)")
        await asyncio.sleep(0.5)
        capture_tv("tc06_reloaded.png")

        # =========================================================================
        # SKENARIO 7: PLAY TO COMBO & FINISH ROUND (TC-07..TC-10)
        # =========================================================================
        print("\n--- SKENARIO 7: Continuous Gameplay & Combo Burst ---")
        for wave_step in range(6):
            await ws.send(json.dumps({"type": "AIM_UPDATE", "x": 0.3 + (wave_step % 3)*0.2, "y": 0.4 + (wave_step % 2)*0.2}))
            await ws.send(json.dumps({"type": "TRIGGER_FIRE"}))
            await asyncio.sleep(0.25)
            if wave_step == 3:
                await ws.send(json.dumps({"type": "RELOAD_ACTION"}))
                await asyncio.sleep(0.2)

        capture_tv("tc_mid_gameplay.png")
        print("\n✅ All active scenarios executed successfully.")

if __name__ == "__main__":
    asyncio.run(run_full_suite())
