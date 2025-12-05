
import { useEffect, useState, useRef } from 'react';
import { Mic, ShoppingBag, Activity, History, CheckCircle, MicOff, Terminal, X } from 'lucide-react';
import { useKioskStore } from './store/useKioskStore';
import CartItem from './components/CartItem';
import OrderHistory from './components/OrderHistory';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import PubNub from 'pubnub';
import { PubNubProvider } from 'pubnub-react';

// Initialize PubNub
const pubnub = new PubNub({
  publishKey: 'pub-c-66db00ec-1f64-4643-b623-25139e551754',
  subscribeKey: 'sub-c-0109266f-d33c-4e94-8f8b-c5c3062b2876',
  userId: 'kiosk-frontend'
});

const CHANNELS = {
  TRIGGER: 'distane_trigger_channel',
  PAYMENT: 'order_payment_confirmation_channel'
};

const WS_AUDIO_URL = 'ws://localhost:8000/ws/audio';

function AppContent() {
  const {
    isAwake, setAwake,
    connectionStatus, setConnectionStatus,
    isListening, setIsListening,
    isProcessing, setIsProcessing,
    setTranscript,
    messages, addMessage,
    cart, addToCart, removeFromCart, clearCart,
    orderHistory, completeOrder
  } = useKioskStore();

  const [audioSocket, setAudioSocket] = useState<WebSocket | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Text-to-Speech Hook
  const { speak, stop: stopTTS, isSpeaking } = useSpeechSynthesis();

  // PubNub Integration
  useEffect(() => {
    const listener = {
      status: (statusEvent: any) => {
        if (statusEvent.category === "PNConnectedCategory") {
          console.log("PubNub Connected");
        }
      },
      message: (msg: any) => {
        const channel = msg.channel;
        const payload = msg.message;
        console.log(`[PubNub] Received on ${channel}:`, payload);

        if (channel === CHANNELS.TRIGGER) {
          console.log("Processing Trigger...", payload);
          if (payload.Trigger === 'ON') {
            console.log("Trigger is ON. Current state:", { hasInteracted, isAwake });
            
            // Only wake if user has interacted (audio unlocked)
            if (hasInteracted && !isAwake) {
              console.log("Waking up Kiosk...");
              
              // Clear previous session (messages, cart, AI memory)
              clearCart();
              // Clear messages by calling the store's internal reset
              useKioskStore.getState().messages = [];
              
              // Reset AI conversation on backend
              fetch('http://localhost:8000/reset_conversation', { method: 'POST' })
                .then(() => console.log("AI conversation reset"))
                .catch(err => console.error("Failed to reset conversation:", err));
              
              setAwake(true);
              // Trigger greeting
              const welcomeMessage = "Welcome to Tim Hortons! How can I help you today?";
              addMessage({ role: 'assistant', text: welcomeMessage, type: 'normal' });
              setIsListening(false);
              speak(welcomeMessage, () => {
                 if (isAwake) setIsListening(true);
              });
            } else if (!hasInteracted) {
              console.warn("Ignored Trigger ON because user has not interacted yet.");
            }
          } else if (payload.Trigger === 'OFF') {
            if (cart.length > 0) {
              console.log("Trigger is OFF, but Cart has items. Ignoring sleep to keep session active.");
            } else {
              console.log("Trigger is OFF and Cart is empty. Sleeping...");
              setAwake(false);
              setIsListening(false);
              stopTTS();
            }
          }
        }
      }
    };

    pubnub.addListener(listener);
    pubnub.subscribe({ channels: [CHANNELS.TRIGGER] });

    return () => {
      pubnub.removeListener(listener);
      pubnub.unsubscribeAll();
    };
  }, [hasInteracted, isAwake, setAwake, setIsListening, speak, stopTTS, addMessage, cart]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch config from backend on mount
  useEffect(() => {
    fetch('http://localhost:8000/config')
      .then(res => res.json())
      .then(config => {
        if (config.mode === 'test' || config.mode === 'dev') {
          setIsDevMode(true);
          console.log(`Running in ${config.mode} mode`);
        }
      })
      .catch(err => console.error('Failed to fetch config:', err));
  }, []);

  // Speech Recognition Hook - Real voice transcription
  const {
    transcript,
    startListening: startSpeech,
    stopListening: stopSpeech
  } = useSpeechRecognition({
    isListening,
    onSpeechEnd: (text) => {
      // STRICT GUARD: If not awake, ignore EVERYTHING.
      if (!isAwake) {
        console.warn("Ignored speech because Kiosk is asleep:", text);
        return;
      }

      if (!text.trim()) return;
      
      // Send to backend
      if (audioSocket && audioSocket.readyState === WebSocket.OPEN) {
        console.log("Sending user speech:", text);
        
        // Optimistic UI update
        addMessage({ role: 'user', text: text, type: 'normal' });
        setIsProcessing(true);
        
        audioSocket.send(JSON.stringify({
          type: 'user_speech',
          text: text,
          cart: useKioskStore.getState().cart // Send current cart context
        }));
      }
    }
  });

  // Sync transcript to store
  useEffect(() => {
    setTranscript(transcript);
  }, [transcript, setTranscript]);

  // Force Mic OFF when not awake (Safety Net)
  useEffect(() => {
    if (!isAwake && isListening) {
      console.log("Safety Net: Forcing Mic OFF because Kiosk is asleep");
      setIsListening(false);
    }
  }, [isAwake, isListening, setIsListening]);

  // Initialize Audio WebSocket
  useEffect(() => {
    // Audio WebSocket
    const aSocket = new WebSocket(WS_AUDIO_URL);
    aSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ai_response') {
          setIsProcessing(false);
          addMessage({ role: 'assistant', text: data.text, type: 'normal' });
          
          // Speak the response
          setIsListening(false); // Stop listening while speaking
          speak(data.text, () => {
             // When done speaking, resume listening
             if (isAwake) setIsListening(true);
          });
        } else if (data.type === 'cart_update') {
          addToCart(data.item);
        } else if (data.type === 'clear_cart') {
          clearCart();
        } else if (data.type === 'remove_item') {
          removeFromCart(data.item_id);
        } else if (data.type === 'finalize_order') {
          // AI detected completion - auto finalize
          console.log("AI triggered finalize_order");
          
          // Get fresh cart state directly from store to avoid stale closure
          const currentCart = useKioskStore.getState().cart;
          const subtotal = currentCart.reduce((sum, item) => sum + item.finalPrice, 0);
          const tax = subtotal * 0.13;
          const total = subtotal + tax;
          const total_str = total.toFixed(2);

          // Publish to PubNub for Pi (non-blocking)
          pubnub.publish({
            channel: CHANNELS.PAYMENT,
            message: {
              ORDER_COMPLETED: true,
              PAYMENT_AMOUNT: total_str
            }
          }, (status) => {
            if (status.error) {
              console.error("PubNub Publish Failed:");
              console.error("Error:", status.error);
              console.error("ErrorData:", status.errorData);
              console.error("Category:", status.category);
              // Don't block the kiosk - Pi might be offline
            } else {
              console.log("✅ Payment sent to Pi:", total_str);
            }
          });

          // Speak the total to the user (Ensures sync with PubNub)
          speak(`Your total comes to $${total_str}. Please tap your card to pay.`, () => {
             // Wait 3 seconds after speech finishes before resetting
             console.log("Speech finished. Waiting 3s before standby...");
             setTimeout(() => {
               setAwake(false);
               setIsListening(false);
               stopTTS();
               console.log("Kiosk going to standby.");
             }, 3000);
          });

          // Complete order locally regardless of PubNub status
          completeOrder();
        }
      } catch (e) {
        console.error("Audio socket parse error", e);
      }
    };
    setAudioSocket(aSocket);
    setConnectionStatus('connected');

    return () => {
      aSocket.close();
    };
  }, [setConnectionStatus]);



  // Mic Watchdog: Force mic on if awake and idle
  useEffect(() => {
    if (!hasInteracted) return; // Don't run watchdog until interacted

    const interval = setInterval(() => {
      if (isAwake && !isSpeaking && !isProcessing && !isListening) {
        console.log("Watchdog: Force starting mic");
        startSpeech();
        setIsListening(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isAwake, isSpeaking, isProcessing, isListening, startSpeech, setIsListening]);

  // Handle Recording State
  const toggleRecording = () => {
    // Can't toggle if processing or speaking
    if (isProcessing || isSpeaking) return;
    
    if (isListening) {
      stopSpeech();
      setIsListening(false);
    } else {
      startSpeech();
      setIsListening(true);
    }
  };

  // Handle Complete Order
  const handleCompleteOrder = () => {
    if (cart.length > 0) {
      completeOrder();
      addMessage({ role: 'assistant', text: 'Order completed! Thank you!', type: 'normal' });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 relative">
      {/* Start Overlay */}
      {!hasInteracted && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center text-white">
          <h1 className="text-4xl font-bold mb-4">Tim Hortons Kiosk</h1>
          <p className="mb-8 text-gray-300">Click to start and enable audio</p>
          <button 
            onClick={() => {
              setHasInteracted(true);
              // Play silent sound or just start mic to unlock
              startSpeech();
              setIsListening(true);
            }}
            className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-full text-xl font-bold transition-all transform hover:scale-105"
          >
            Start Kiosk
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
        {/* Left: Logo and Status */}
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-gray-900">Cognitive Access</h1>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isAwake 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-gray-100 text-gray-600 border border-gray-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isAwake ? 'bg-green-600' : 'bg-gray-400'}`}></div>
            <span>{isAwake ? 'Awake' : 'Sleep'}</span>
          </div>
          
          {isDevMode && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse">
              <span>🛠 DEV MODE</span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-6">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            connectionStatus === 'connected' 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {connectionStatus === 'connected' ? '✓' : '✗'}
            <span>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Order History Button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200"
          >
            <History size={20} />
            <span className="text-sm font-medium">History</span>
          </button>
        </div>
      </div>

      {/* Main Content - Full height minus topbar */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        
        {/* Left Panel: Conversation */}
        <div className="flex-1 bg-white rounded-2xl shadow-md p-8 flex flex-col overflow-hidden">
          
          {/* Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-4">
            {messages.length === 0 && isAwake && (
              <div className="flex justify-start">
                <div className="bg-blue-50 text-gray-700 px-4 py-3 rounded-2xl rounded-tl-none max-w-md">
                  <span className="text-blue-600 font-medium">Welcome!</span> How can I help you today?
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-3 rounded-2xl max-w-md ${
                  msg.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-tr-none' 
                    : 'bg-blue-50 text-gray-700 rounded-tl-none'
                }`}>
                  {msg.role === 'assistant' && msg.text.includes('heard you say') && (
                    <span className="text-blue-600 font-medium">I heard you say: </span>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="relative flex-shrink-0">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 pr-16 min-h-[80px] flex items-center">
              {isProcessing ? (
                <span className="text-blue-500 animate-pulse">Processing...</span>
              ) : isSpeaking ? (
                <span className="text-green-600 animate-pulse">Speaking...</span>
              ) : (
                <span className="text-gray-400">{transcript || ''}</span>
              )}
            </div>
            <button
              onClick={toggleRecording}
              disabled={!isAwake || isProcessing || isSpeaking}
              className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all ${
                isProcessing || isSpeaking
                  ? 'bg-gray-300 cursor-not-allowed'
                  : isListening 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-gray-400 hover:bg-gray-500'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {isProcessing || isSpeaking ? (
                <MicOff className="text-white" size={24} />
              ) : (
                <Mic className="text-white" size={24} />
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Order */}
        <div className="w-[400px] bg-white rounded-2xl shadow-md p-8 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 flex-shrink-0">
            <ShoppingBag className="text-gray-700" size={24} />
            <h2 className="text-2xl font-normal text-gray-900">Your Order</h2>
          </div>

          {/* Cart Items - Scrollable */}
          <div className="flex-1 overflow-y-auto mb-6">
            {cart.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-20 flex items-center justify-center">
                <p className="text-gray-400 text-sm">Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => <CartItem key={item.id} item={item} />)}
              </div>
            )}
          </div>

          {/* Totals - Fixed at bottom */}
          <div className="border-t border-gray-200 pt-4 space-y-3 flex-shrink-0">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${cart.reduce((sum, item) => sum + item.finalPrice, 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (HST 13%)</span>
              <span>${(cart.reduce((sum, item) => sum + item.finalPrice, 0) * 0.13).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-medium text-gray-900 pt-2">
              <span>Total</span>
              <span>${(cart.reduce((sum, item) => sum + item.finalPrice, 0) * 1.13).toFixed(2)}</span>
            </div>
            
            {/* Complete Order Button */}
            {cart.length > 0 && (
              <button
                onClick={handleCompleteOrder}
                className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle size={20} />
                Complete Order
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Sleep Mode Overlay */}
      {!isAwake && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-40 flex flex-col items-center justify-center">
          <div className="text-center space-y-6">
            <Activity size={80} className="text-gray-400 mx-auto animate-pulse" />
            <h2 className="text-4xl font-light text-gray-600">System Standby</h2>
            <p className="text-gray-500">Approach kiosk to activate</p>
          </div>
        </div>
      )}

      {/* Order History Slider */}
      <OrderHistory 
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        orders={orderHistory}
      />
      {/* Debug Panel - Temporary */}
      {/* Debug Panel Toggle / Content */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsDebugOpen(!isDebugOpen)}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all"
        >
          {isDebugOpen ? <X size={20} /> : <Terminal size={20} />}
        </button>

        {/* Panel Content */}
        {isDebugOpen && (
          <div className="mt-2 bg-black/90 text-white p-4 rounded-xl text-xs font-mono w-64 shadow-2xl backdrop-blur-md border border-gray-700">
            <h3 className="font-bold mb-2 border-b border-gray-600 pb-1 flex justify-between items-center">
              Debug Info
              <span className="text-[10px] text-gray-400">v1.0</span>
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
              <span>isAwake:</span> <span className={isAwake ? "text-green-400" : "text-red-400"}>{String(isAwake)}</span>
              <span>isListening:</span> <span className={isListening ? "text-green-400" : "text-red-400"}>{String(isListening)}</span>
              <span>isProcessing:</span> <span className={isProcessing ? "text-yellow-400" : "text-gray-400"}>{String(isProcessing)}</span>
              <span>isSpeaking:</span> <span className={isSpeaking ? "text-blue-400" : "text-gray-400"}>{String(isSpeaking)}</span>
            </div>
            <button 
              onClick={() => {
                console.log("Manual TTS Test Triggered");
                setIsListening(false);
                speak("This is a test of the voice system.", () => setIsListening(true));
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded mb-2 transition-colors"
            >
              Test Voice
            </button>
            
            {isDevMode && (
              <button 
                onClick={() => {
                  console.log("Simulating PubNub Trigger ON");
                  if (hasInteracted && !isAwake) {
                    setAwake(true);
                    const welcomeMessage = "Welcome to Tim Hortons! How can I help you today?";
                    addMessage({ role: 'assistant', text: welcomeMessage, type: 'normal' });
                    setIsListening(false);
                    speak(welcomeMessage, () => {
                       if (isAwake) setIsListening(true);
                    });
                  } else {
                    console.warn("Cannot simulate trigger: User has not interacted or already awake");
                  }
                }}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 px-2 rounded mb-2 transition-colors"
              >
                Simulate Trigger
              </button>
            )}
            <div className="text-gray-500 text-[10px] text-center mt-1">
              Cognitive Access System
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



function App() {
  return (
    <PubNubProvider client={pubnub}>
      <AppContent />
    </PubNubProvider>
  );
}

export default App;
