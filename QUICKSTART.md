# Cognitive Access Kiosk - Quick Start

## Current Status
✅ Frontend: Running on http://localhost:5173
✅ Backend: Ready to start
✅ Gemini API: Configured with your API key
✅ Distance Slider: Visible in top-right corner of UI

## How to Use

### 1. Start Backend
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Test with Distance Slider
- The **distance slider** is in the top-right corner of the UI
- Drag it left (< 100cm) to **wake up** the system
- Drag it right (> 150cm) to put it to **sleep**
- You don't need the physical sensor for testing!

### 3. Voice Ordering
1. System wakes up automatically when distance < 100cm
2. Click the microphone button (or it starts automatically)
3. Speak your order: "I want a grande oat milk latte"
4. AI will ask clarifying questions if needed
5. Items automatically add to cart

## AI Features
- ✅ Natural conversation
- ✅ Clarifying questions ("What size?", "Hot or iced?")
- ✅ Auto-add to cart when order is clear
- ✅ Order modifications ("cancel that", "make it large")
- ✅ Clear cart ("start over")

## Troubleshooting

### "No module named 'google'" Error
If you see this error, the backend was running before the package was installed.
**Solution**: Just restart the backend server (Ctrl+C then start again)

### Distance Slider Location
Top-right corner, shows: `Distance: XXcm` with a slider control
