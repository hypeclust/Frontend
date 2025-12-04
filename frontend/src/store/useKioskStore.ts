import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OrderItem {
  id: string;
  name: string;
  basePrice: number;
  modifiers: string[]; // e.g., ["Oat Milk", "Extra Shot"]
  finalPrice: number;
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  type?: 'normal' | 'error' | 'suggestion';
}

export interface CompletedOrder {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  timestamp: number;
}

interface KioskState {
  // System State
  isAwake: boolean;
  connectionStatus: 'connected' | 'disconnected';
  distance: number; // For simulation

  // Conversation State
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcript: string;
  messages: Message[];

  // Cart State
  cart: OrderItem[];
  
  // Order History
  orderHistory: CompletedOrder[];
  
  // Actions
  setAwake: (awake: boolean) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected') => void;
  setDistance: (distance: number) => void;
  setIsListening: (isListening: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setTranscript: (transcript: string) => void;
  addMessage: (message: Message) => void;
  addToCart: (item: OrderItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  completeOrder: () => void;
  reset: () => void;
}

export const useKioskStore = create<KioskState>()(
  persist(
    (set, get) => ({
      // Initial State
      isAwake: false,
      connectionStatus: 'disconnected',
      distance: 150,
      isListening: false,
      isProcessing: false,
      isSpeaking: false,
      transcript: '',
      messages: [],
      cart: [],
      orderHistory: [],

      // Actions
      setAwake: (awake) => set({ isAwake: awake }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setDistance: (distance) => set({ distance }),
      setIsListening: (isListening) => set({ isListening }),
      setIsProcessing: (isProcessing) => set({ isProcessing }),
      setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
      setTranscript: (transcript) => set({ transcript }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
      removeFromCart: (itemId) => set((state) => ({
        cart: state.cart.filter(item => item.id !== itemId)
      })),
      clearCart: () => set({ cart: [] }),
      completeOrder: () => {
        const state = get();
        if (state.cart.length === 0) return;
        
        const subtotal = state.cart.reduce((sum, item) => sum + item.finalPrice, 0);
        const tax = subtotal * 0.13; // 13% HST for Canada
        const total = subtotal + tax;
        
        const newOrder: CompletedOrder = {
          id: `order-${Date.now()}`,
          items: [...state.cart],
          subtotal,
          tax,
          total,
          timestamp: Date.now()
        };
        
        set({
          orderHistory: [...state.orderHistory, newOrder],
          cart: [],
          messages: []
        });
      },
      reset: () => set({
        isAwake: false,
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        transcript: '',
        messages: [],
        cart: []
      }),
    }),
    {
      name: 'kiosk-storage',
      partialize: (state) => ({ orderHistory: state.orderHistory })
    }
  )
);
