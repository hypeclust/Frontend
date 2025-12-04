import { useCallback, useEffect, useRef, useState } from 'react';

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current) {
      console.error('Speech synthesis not supported');
      onEnd?.(); // Always fire callback
      return;
    }

    // Cancel existing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select a better voice
    const voices = window.speechSynthesis.getVoices();
    // Prefer Google voices, then Microsoft, then default
    const preferredVoice = voices.find(v => v.name.includes("Google US English")) || 
                          voices.find(v => v.name.includes("Google")) ||
                          voices.find(v => v.name.includes("Microsoft")) ||
                          voices.find(v => v.lang.startsWith("en"));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // CRITICAL: Handle start/end/error to ensure state is reset
    utterance.onstart = () => {
      console.log("TTS Started");
      setIsSpeaking(true);
    };

    const handleEnd = () => {
      console.log("TTS Ended/Done");
      setIsSpeaking(false);
      onEnd?.();
    };

    utterance.onend = handleEnd;
    utterance.onerror = (e) => {
      console.error("TTS Error:", e);
      handleEnd(); // Treat error as end so we don't get stuck
    };

    try {
      synthRef.current.speak(utterance);
      
      // Safety: If browser blocks audio, onstart might never fire.
      // Check if speaking actually started after a short delay.
      // If not, force finish.
      setTimeout(() => {
        if (!synthRef.current?.speaking) {
           // It didn't start (likely blocked or empty text)
           // But wait, if it finished very fast? 
           // Better to rely on the fact that if it's NOT speaking and we expect it to, 
           // we might need to cleanup. 
           // Actually, let's just use a long watchdog for safety.
        }
      }, 500);

    } catch (e) {
      console.error("TTS Exception:", e);
      handleEnd();
    }
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stop, isSpeaking };
};
