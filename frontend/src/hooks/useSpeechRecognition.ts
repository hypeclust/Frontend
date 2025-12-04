import { useEffect, useRef, useState, useCallback } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionProps {
  isListening: boolean;
  onSpeechEnd?: (text: string) => void;
  onTranscript?: (text: string) => void;
}

export const useSpeechRecognition = ({ 
  isListening, 
  onSpeechEnd, 
  onTranscript 
}: UseSpeechRecognitionProps) => {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Use refs for callbacks to avoid stale closures in the recognition instance
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
    onTranscriptRef.current = onTranscript;
  }, [onSpeechEnd, onTranscript]);

  const startListening = useCallback(() => {
    // Prevent multiple starts
    if (recognitionRef.current) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-CA';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript += t;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      setTranscript(currentText);
      if (onTranscriptRef.current) onTranscriptRef.current(currentText);

      if (finalTranscript && onSpeechEndRef.current) {
        onSpeechEndRef.current(finalTranscript.trim());
        setTranscript(''); // Clear after processing
      }
    };

    recognition.onerror = (event) => {
      // Ignore 'aborted' errors which happen on manual stop
      if ((event as any).error !== 'aborted') {
        console.error('Speech recognition error:', event);
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      
      // Auto-restart if still supposed to be listening (and not manually stopped)
      // We need to check the LATEST isListening prop here, but we can't easily access it in this closure
      // without triggering a restart loop. 
      // Instead, we rely on the useEffect below to restart it if needed.
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }, []); // No dependencies! Refs handle the callbacks.

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  // Sync with isListening prop
  useEffect(() => {
    if (isListening && !listening) {
      startListening();
    } else if (!isListening && listening) {
      stopListening();
    }
  }, [isListening, listening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return { 
    transcript, 
    resetTranscript, 
    listening, 
    startListening, 
    stopListening 
  };
};
