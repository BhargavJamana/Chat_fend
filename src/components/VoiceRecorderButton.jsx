import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import toast from 'react-hot-toast';

const formatSeconds = (value) => {
  const mins = String(Math.floor(value / 60)).padStart(2, '0');
  const secs = String(value % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

export default function VoiceRecorderButton({ onRecorded, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (!isRecording) return undefined;
    const interval = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice recording is not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        toast.error('Voice recording failed');
        setIsRecording(false);
        cleanup();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          setIsProcessing(true);
          const extension = blob.type.includes('ogg')
            ? 'ogg'
            : blob.type.includes('mp4') || blob.type.includes('m4a')
              ? 'm4a'
              : 'webm';
          const file = new File([blob], `voice-note-${Date.now()}.${extension}`, {
            type: blob.type || 'audio/webm',
          });
          Promise.resolve(onRecorded?.(file)).finally(() => {
            setIsProcessing(false);
          });
        } else {
          setIsProcessing(false);
        }
        setIsRecording(false);
        cleanup();
      };

      recorder.start();
      setSeconds(0);
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access error:', error);
      toast.error('Microphone permission is required for voice notes');
      cleanup();
    }
  };

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
        isRecording
          ? theme === 'dark'
            ? 'bg-red-500/15 text-red-200 hover:bg-red-500/20'
            : 'bg-white/20 text-white hover:bg-white/25'
          : theme === 'dark'
            ? 'border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/8 hover:text-white'
            : 'border border-white/25 bg-white/12 text-white hover:bg-white/18'
      }`}
      title={isRecording ? 'Stop voice recording' : 'Record voice note'}
    >
      {isRecording ? <Square className="h-4 w-4" /> : isProcessing ? <Send className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <span>{isRecording ? `Recording ${formatSeconds(seconds)}` : isProcessing ? 'Sending voice...' : 'Voice message'}</span>
    </button>
  );
}
