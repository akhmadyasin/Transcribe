"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { diffWords } from "diff";
import "@/app/styles/voice.css"; // Pastikan file CSS ini ada dan sesuai

type ToastType = "success" | "error" | "info";
type Maybe<T> = T | null;

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:5001";

const LS_LAST_SUMMARY_KEY = "vt2_last_summary";
const AUTO_CLEAR_HL_MS = 8000;

function mdToHtml(text: string) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function renderDiff(prev: string, next: string, el: HTMLElement, clearTimerRef: React.MutableRefObject<any>) {
  if (!el) return;
  if ((prev || "") === (next || "")) {
    el.innerHTML = mdToHtml(next || "");
    return;
  }
  // Find unchanged prefix/suffix, highlight only new part
  let start = 0;
  while (start < prev.length && prev[start] === next[start]) start++;
  let endPrev = prev.length - 1;
  let endNext = next.length - 1;
  while (endPrev >= start && endNext >= start && prev[endPrev] === next[endNext]) {
    endPrev--;
    endNext--;
  }
  const prefix = next.slice(0, start);
  const mid = next.slice(start, endNext + 1);
  const suffix = next.slice(endNext + 1);

  // If previous highlight exists, keep it until its timer ends
  // Allow multiple highlights if updates arrive before previous fades
  let html = mdToHtml(prefix);
  if (mid) html += `<span class="hl-add">${mdToHtml(mid)}</span>`;
  html += mdToHtml(suffix);
  el.innerHTML = html;

  // Do NOT clear previous highlights, let CSS animation handle fade
  // No timer to reset innerHTML, so multiple highlights can overlap
}

function replaceSpokenPunctuation(text: string) {
  return (text || "")
    .replace(/\btitik\b/gi, ".")
    .replace(/\bkoma\b/gi, ",")
    .replace(/\btanda tanya\b/gi, "?")
    .replace(/\btanda seru\b/gi, "!")
    .replace(/\btitik dua\b/gi, ":")
    .replace(/\btitik koma\b/gi, ";");
}

export default function VoicePanel() {
  const socketRef = useRef<Maybe<Socket>>(null);
  const recognitionRef = useRef<any>(null);
  const summaryEditorRef = useRef<HTMLDivElement>(null);
  const fullTranscriptRef = useRef<string>("");
  const lastFinalSummaryRef = useRef<string>("");
  const clearHlTimerRef = useRef<any>(null);
  const autoSummarizeTimerRef = useRef<any>(null);
  const summarizeInFlightRef = useRef<boolean>(false);
  const currentModeRef = useRef<string>("patologi");

  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Menyambungkan...");
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  
  const showToast = (msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const scheduleAutoSummarize = (text: string) => {
    if (autoSummarizeTimerRef.current) clearTimeout(autoSummarizeTimerRef.current);
    autoSummarizeTimerRef.current = setTimeout(() => {
      const currentTranscript = text.trim();
      if (currentTranscript.length > 50 && !summarizeInFlightRef.current) {
        requestSummarize(currentTranscript, false);
      }
    }, 1000);
  };
  
  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/get_summary_mode`)
      .then((r) => r.json())
      .then((data) => { if (data.mode) currentModeRef.current = data.mode; })
      .catch((err) => console.error("Gagal mengambil mode:", err));

    const socket = io(BACKEND_ORIGIN, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnectionStatus("🟢 Terhubung"));
    socket.on("disconnect", () => setConnectionStatus("🔴 Terputus"));
    socket.on("connect_error", () => setConnectionStatus("🟡 Gagal"));

    socket.on("summary_stream", (data: any) => {
      const editor = summaryEditorRef.current;
      if (!editor) return;
      
      if (data.error) {
        showToast(`Error: ${data.error}`, "error");
        summarizeInFlightRef.current = false;
        return;
      }

      let nextSummary = lastFinalSummaryRef.current;
      if (data.token) nextSummary += data.token;
      if (data.final) nextSummary = data.final.trim();
      
      renderDiff(lastFinalSummaryRef.current, nextSummary, editor, clearHlTimerRef);
      lastFinalSummaryRef.current = nextSummary;
      
      if (data.end) {
        summarizeInFlightRef.current = false;
        localStorage.setItem(LS_LAST_SUMMARY_KEY, nextSummary.trim());
      }
    });
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript || "";
          if (event.results[i].isFinal) {
            fullTranscriptRef.current += replaceSpokenPunctuation(chunk) + " ";
          } else {
            interim += chunk;
          }
        }
        const currentTranscript = fullTranscriptRef.current + interim;
        setTranscript(currentTranscript);
        scheduleAutoSummarize(currentTranscript);
      };
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        if (recognitionRef.current && !recognitionRef.current.isManuallyStopped) {
          try { recognition.start(); } catch {}
        }
      };
      recognition.onerror = (e: any) => {
        console.error("SpeechRecognition error:", e.error);
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    } else {
      alert("Browser Anda tidak mendukung Web Speech API. Coba gunakan Google Chrome.");
    }
    
    return () => { socket.disconnect(); };
  }, []);

  const handleStartListening = () => {
    if (recognitionRef.current) {
      fullTranscriptRef.current = "";
      lastFinalSummaryRef.current = "";
      setTranscript("");
      if (summaryEditorRef.current) summaryEditorRef.current.innerHTML = "";
      
      try {
        recognitionRef.current.isManuallyStopped = false;
        recognitionRef.current.start();
      } catch(e) { showToast("Gagal memulai. Coba lagi.", "error"); }
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.isManuallyStopped = true;
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const requestSummarize = (text: string, showUI: boolean = true) => {
    if (summarizeInFlightRef.current || !text || !socketRef.current?.connected) return;

    summarizeInFlightRef.current = true;
    
    if (showUI && summaryEditorRef.current) {
        summaryEditorRef.current.innerHTML = "<i>Memproses ringkasan...</i>";
    }
    
    socketRef.current.emit("summarize_stream", { text, mode: currentModeRef.current });
  };

  return (
    <>
      <div className="vtt-flex-container">
        {/* Kolom Kiri */}
        <div className="column transcript-col">
          {/* TAMBAHKAN DIV KOSONG INI SEBAGAI SPACER */}
          <div className="summary-header">&nbsp;</div>

          <div
            className="editor"
            style={{ minHeight: 120, flexGrow: 1, marginBottom: 0, overflow: 'hidden' }}
          >
            <textarea
              value={transcript}
              placeholder="Transkrip suara akan muncul di sini..."
              readOnly
              id="transcript"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                resize: 'none',
                fontSize: '16px',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                padding: 0,
                overflow: 'hidden',
                scrollbarWidth: 'none', // Firefox
              }}
            />
            <style>{`
              #transcript::-webkit-scrollbar { display: none; }
            `}</style>
          </div>
          <div className="btn-group">
            {!isListening ? (
              <button
                id="startBtn"
                onClick={handleStartListening}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#f4f6fa',
                  color: '#2d3748',
                  fontWeight: 500,
                  border: '1px solid #d1d9e6',
                  borderRadius: 24,
                  padding: '8px 22px',
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'background 0.2s, border 0.2s',
                  boxShadow: 'none',
                  outline: 'none',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#e6eaf3';
                  e.currentTarget.style.border = '1.5px solid #bfc9d9';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = '#f4f6fa';
                  e.currentTarget.style.border = '1px solid #d1d9e6';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: 6}}>
                  <circle cx="10" cy="10" r="10" fill="#b2f5ea"/>
                  <polygon points="8,6 15,10 8,14" fill="#319795"/>
                </svg>
                Mulai
              </button>
            ) : (
              <button
                id="stopBtn"
                onClick={handleStopListening}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#fff5f5',
                  color: '#c53030',
                  fontWeight: 500,
                  border: '1px solid #feb2b2',
                  borderRadius: 24,
                  padding: '8px 22px',
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'background 0.2s, border 0.2s',
                  boxShadow: 'none',
                  outline: 'none',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#ffe3e3';
                  e.currentTarget.style.border = '1.5px solid #fc8181';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = '#fff5f5';
                  e.currentTarget.style.border = '1px solid #feb2b2';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: 6}}>
                  <circle cx="10" cy="10" r="10" fill="#feb2b2"/>
                  <rect x="7" y="7" width="6" height="6" rx="2" fill="#c53030"/>
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Kolom Kanan */}
        <div className="column summary-col">
          <div className="summary-header">
            <span className="connection-status">{connectionStatus}</span>
          </div>
          <div
            ref={summaryEditorRef}
            id="summaryEditor"
            className="editor"
            contentEditable
            data-placeholder="Ringkasan akan muncul di sini..."
            style={{ minHeight: 120, flexGrow: 1, marginBottom: 0, overflow: 'hidden' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              id="saveBtn"
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f4f6fa',
                color: '#2d3748',
                fontWeight: 500,
                border: '1px solid #d1d9e6',
                borderRadius: 24,
                padding: '8px 22px',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'background 0.2s, border 0.2s',
                boxShadow: 'none',
                outline: 'none',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#e6eaf3';
                e.currentTarget.style.border = '1.5px solid #bfc9d9';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = '#f4f6fa';
                e.currentTarget.style.border = '1px solid #d1d9e6';
              }}
              onClick={() => alert('Dummy save!')}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: 6}}>
                <circle cx="10" cy="10" r="10" fill="#bee3f8"/>
                <path d="M7 10.5L9.5 13L13 7" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>
      {toast && (
        <div className={`toast show ${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}