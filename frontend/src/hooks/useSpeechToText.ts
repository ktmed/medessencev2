import { useState, useRef, useEffect, useCallback } from 'react';

interface SpeechToTextOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
}

interface Transcript {
  interim: string;
  final: string;
}

const getSpeechRecognition = (): any => {
  if (typeof window !== 'undefined') {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  return null;
};

export const useSpeechToText = (options: SpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Transcript>({ interim: '', final: '' });
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const SpeechRecognition = getSpeechRecognition();
  const hasRecognitionSupport = !!SpeechRecognition;

  useEffect(() => {
    if (!hasRecognitionSupport) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = options.lang || 'en-US';
    recognition.interimResults = options.interimResults || false;
    recognition.continuous = options.continuous || false;

    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript({
        interim: interimTranscript,
        final: finalTranscript,
      });
    };

    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      setTranscript(t => ({...t, interim: ''}));
    };

    return () => {
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRecognitionSupport, options.lang, options.interimResults, options.continuous]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        setTranscript({ interim: '', final: '' }); // Reset on start
        recognitionRef.current.start();
        setIsListening(true);
        setError(null);
      } catch (err) {
        console.error("Could not start recognition:", err);
        setError("Could not start recognition.");
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, transcript, startListening, stopListening, hasRecognitionSupport, error };
};