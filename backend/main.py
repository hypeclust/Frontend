import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Menu
menu_path = os.path.join(os.path.dirname(__file__), "menu.json")
with open(menu_path, "r") as f:
    MENU_DATA = json.load(f)

# Get mode from environment
MODE = os.getenv("MODE", "production")

# Config endpoint
@app.get("/config")
async def get_config():
    return {
        "mode": MODE,
        "initial_distance": 50 if MODE == "test" else 200
    }

@app.get("/inventory")
async def get_inventory():
    return MENU_DATA

@app.post("/reset_conversation")
async def reset_conversation():
    """Reset AI conversation for a new customer"""
    from .ai_service import get_ai_service
    ai = get_ai_service()
    ai.reset_conversation()
    return {"status": "reset"}


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive messages from frontend
            data = await websocket.receive()
            
            if "text" in data:
                # Parse the message
                try:
                    message = json.loads(data['text'])
                    
                    if message.get('type') == 'user_speech':
                        # User has finished speaking - process with AI
                        user_text = message.get('text', '').strip()
                        current_cart = message.get('cart', [])
                        print(f"User said: '{user_text}'")
                        
                        # Skip empty messages
                        if not user_text:
                            print("Empty message, skipping AI processing")
                            continue
                        
                        try:
                            # Get AI service
                            from .ai_service import get_ai_service
                            ai = get_ai_service()
                            
                            # Process with Gemini
                            print(f"Processing with AI...")
                            ai_result = await ai.process_user_message(user_text, current_cart)
                            print(f"AI Response: {ai_result['text']}")
                            
                            # Send AI response
                            await websocket.send_json({
                                "type": "ai_response", 
                                "text": ai_result["text"]
                            })
                            
                            # Handle cart actions
                            actions = ai_result.get("actions", [])
                            
                            # If legacy single action exists (fallback), add it
                            if ai_result.get("action"):
                                actions.append(ai_result.get("data"))
                            
                            for action_data in actions:
                                action_type = action_data.get("action")
                                
                                if action_type == "add_to_cart":
                                    await websocket.send_json({
                                        "type": "cart_update",
                                        "item": {
                                            "id": action_data.get("item_id"),
                                            "name": action_data.get("name"),
                                            "basePrice": action_data.get("price", 0.0),
                                            "modifiers": action_data.get("modifiers", []),
                                            "finalPrice": action_data.get("price", 0.0)
                                        }
                                    })
                                elif action_type == "clear_cart":
                                    await websocket.send_json({"type": "clear_cart"})
                                elif action_type == "remove_item":
                                    await websocket.send_json({
                                        "type": "remove_item",
                                        "item_id": action_data.get("item_id")
                                    })
                                elif action_type == "finalize_order":
                                    print("Sending finalize_order to frontend")
                                    await websocket.send_json({
                                        "type": "finalize_order"
                                    })
                        except Exception as ai_error:
                            print(f"AI Processing Error: {ai_error}")
                            import traceback
                            traceback.print_exc()
                            # Send error message to client
                            await websocket.send_json({
                                "type": "ai_response",
                                "text": "I'm sorry, I'm having trouble processing that. Could you try again?"
                            })
                        
                except json.JSONDecodeError:
                    print(f"Received non-JSON text: {data['text']}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected")
    except RuntimeError:
        # Handle "Cannot call 'receive' once a disconnect message has been received"
        manager.disconnect(websocket)
        print("Client disconnected (RuntimeError)")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

@app.websocket("/ws/sensor")
async def sensor_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast sensor data to all clients (or specific ones)
            # In a real scenario, the sensor script might connect here as a client
            # or this endpoint might be used by the frontend to listen to sensor events
            # pushed by the backend's internal sensor loop.
            
            # For this architecture, let's assume the sensor script connects here
            # and sends data, which we broadcast to the frontend.
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
