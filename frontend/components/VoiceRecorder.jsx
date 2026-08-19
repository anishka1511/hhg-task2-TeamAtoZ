'use client';

import { useState, useRef } from 'react';

function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

async function toWav(blob) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(await blob.arrayBuffer());
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  ac.close();
  return encodeWav(out.getChannelData(0), rate);
}

export default function VoiceRecorder({ onTranscribe, isTranscribing, disabled, isMock, setHint }) {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const meterRAFRef = useRef(0);

  const meter = () => {
    if (!analyserRef.current) return;
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
    if (window.__field) window.__field.target = Math.min(1.4, peak * 3.2);
    meterRAFRef.current = requestAnimationFrame(meter);
  };

  const startRecording = async () => {
    if (disabled || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      audioCtxRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      meter();

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (meterRAFRef.current) cancelAnimationFrame(meterRAFRef.current);
        analyserRef.current = null;
        if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
        setIsRecording(false);
        if (setHint) setHint('transcribing speech with Sarvam STT…');

        try {
          const rawBlob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
          let wavBlob = rawBlob;
          try {
            wavBlob = await toWav(rawBlob);
          } catch (e) {
            // fallback rawBlob
          }
          if (onTranscribe) {
            onTranscribe(wavBlob);
          }
        } catch (err) {
          if (setHint) setHint(`audio processing failed — ${err.message}`);
        }
      };

      recorder.start();
      setIsRecording(true);
      if (setHint) setHint('listening — click again to stop (30s max)');
    } catch (err) {
      console.warn('Microphone error:', err);
      if (isMock) {
        setIsRecording(true);
        if (setHint) setHint('listening — click again to stop (mock mode)');
        if (window.__field) window.__field.target = 0.8;
      } else {
        if (setHint) setHint(`microphone blocked — ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else if (isMock && onTranscribe) {
      const dummyBlob = new Blob(['mock audio'], { type: 'audio/wav' });
      onTranscribe(dummyBlob);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <button
      id="micBtn"
      type="button"
      className={`mic ${isRecording ? 'rec' : ''}`}
      onClick={toggleRecording}
      disabled={disabled || isTranscribing}
      aria-label="Ask by voice"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mic-icon">
        <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Z" />
        <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22" />
      </svg>
      <span className="mic-ring" aria-hidden="true"></span>
    </button>
  );
}
