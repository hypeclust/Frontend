import time
import json
import random
import asyncio
import websockets

# Configuration
SENSOR_PIN_TRIG = 23
SENSOR_PIN_ECHO = 24
WAKE_DISTANCE_CM = 100
SERVER_URI = "ws://localhost:8000/ws/sensor"

async def sensor_loop():
    async with websockets.connect(SERVER_URI) as websocket:
        print(f"Connected to {SERVER_URI}")
        
        while True:
            # Simulate distance reading
            # In a real scenario, we would use gpiozero or RPi.GPIO
            # distance = measure_distance()
            
            # Mock: Randomly fluctuate around 150cm (Sleep), occasionally drop to 80cm (Wake)
            # For testing, we can just send a "heartbeat" of distance.
            # The frontend simulation slider will likely override this, 
            # but this script demonstrates the "Physical Trigger" logic.
            
            # Let's simulate a user approaching every 30 seconds
            if (int(time.time()) % 30) < 10:
                distance = random.uniform(50, 90) # Awake
            else:
                distance = random.uniform(140, 200) # Sleep
                
            payload = {
                "type": "sensor_reading",
                "distance": round(distance, 2)
            }
            
            await websocket.send(json.dumps(payload))
            # print(f"Sent: {payload}")
            
            await asyncio.sleep(0.2) # 200ms interval

if __name__ == "__main__":
    try:
        asyncio.run(sensor_loop())
    except KeyboardInterrupt:
        print("Sensor script stopped")
    except Exception as e:
        print(f"Error: {e}")
        # Retry logic could go here
