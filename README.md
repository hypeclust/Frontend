# Cognitive Access Kiosk

A voice-activated, proximity-sensing kiosk application designed for accessibility. It uses ultrasonic sensors to detect user presence, Google Gemini for natural language interaction, and a touch-free interface.

## System Architecture
- **Frontend**: React (Vite) + Tailwind CSS. Handles UI, animations, TTS, and microphone input.
- **Backend**: Python (FastAPI). Bridges the frontend and AI services.
- **AI**: Google Gemini API. Handles conversation, intent recognition, and order processing.
- **Hardware**: Raspberry Pi (or simulation) with Ultrasonic Sensor (HC-SR04), LCD, and Keypad.

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- Google Gemini API Key

### 2. Setup
**Backend**
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```
Create a `.env` file in `backend/` with:
```env
GOOGLE_API_KEY=your_api_key_here
```

**Frontend**
```bash
cd frontend
npm install
```

### 3. Running the Application
**Start Backend**
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Start Frontend**
```bash
cd frontend
npm run dev
```
Open http://localhost:5173

## Usage Guide

### Distance Simulation
- The **distance slider** in the top-right corner simulates the ultrasonic sensor.
- **Wake Up**: Drag < 100cm.
- **Sleep**: Drag > 150cm.

### Voice Ordering
1. System wakes up automatically when user is close.
2. Click microphone (or auto-start if enabled).
3. Speak normally (e.g., "I want a coffee").
4. AI asks clarifying questions and manages the cart.

### Hardware Code
The hardware logic for Raspberry Pi is located in `backend/pi_controller.py`. It manages:
- Ultrasonic distance measurement.
- LCD display updates.
- Keypad input for PIN entry.
