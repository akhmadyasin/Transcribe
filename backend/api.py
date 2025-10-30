# backend/api.py
import os
import time
import re
import uuid
import traceback
from threading import Event
from datetime import datetime, timezone

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from groq import Groq
from dotenv import load_dotenv
from werkzeug.exceptions import HTTPException
from supabase import create_client, Client
import secrets
import string
from datetime import timedelta

# simple in-memory history store (newest first)
history_store = []

def _now_iso():
    return datetime.utcnow().isoformat() + "Z"


# =========================
# Config & Init
# =========================
load_dotenv()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Initialize Supabase client
supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY and SUPABASE_SERVICE_KEY != "PASTE_YOUR_SERVICE_ROLE_KEY_HERE":
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("[SUPABASE] Client initialized successfully")
    except Exception as e:
        print(f"[SUPABASE] Failed to initialize client: {e}")
        supabase = None
else:
    print("[SUPABASE] Not configured - share features will be disabled")

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

stop_flags = {}  # {sid: Event}


# =========================
# Helpers
# =========================
def strip_think(text: str) -> str:
    """Hapus blok <think>...</think> bila ada."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()

def build_prompt(text: str, mode: str = "patologi") -> str:
    mode = (mode or "patologi").lower()
    if mode == "dokter_hewan":
        return f"""
Anda adalah seorang dokter hewan berpengalaman.
Langsung berikan ringkasan final saja, tanpa proses berpikir.
Ikuti format:

**Ringkasan Klinis Hewan**

**Identitas Hewan:**
- ...

**Alasan Kunjungan:**
- ...

**Riwayat Medis:**
- ...

**Pemeriksaan Fisik:**
- ...

**Pemeriksaan Penunjang:**
- ...

**Diagnosis / Implikasi:**
- ...

**Rencana Penanganan:**
- ...

**Prognosis:**
- ...

**Rekomendasi / Tindak Lanjut:**
- ...

Aturan ketat:
- Hanya ekstrak fakta yang ada pada teks sumber.
- Pertahankan angka/satuan persis seperti tertulis.
- Jangan menambah atau mengubah fakta yang tidak ada di teks.

Teks sumber:
{text}

Ringkasan:
"""
    else:
        return f"""
Anda adalah seorang dokter patologi berpengalaman.
Langsung berikan ringkasan final saja, tanpa proses berpikir.
Ikuti format:

**Ringkasan Patologi Klinis**

**Jenis Pemeriksaan:**
- ...

**Jenis Spesimen:**
- ...

**Hasil Pemeriksaan Makroskopik:**
- ...

**Hasil Pemeriksaan Mikroskopik:**
- ...

**Diagnosis:**
- ...

**Rekomendasi / Tindak Lanjut:**
- ...

Aturan ketat:
- Hanya ekstrak fakta yang ada pada teks sumber.
- Pertahankan angka/satuan persis seperti tertulis.
- Jangan menambah atau mengubah fakta yang tidak ada di teks.

Teks sumber:
{text}

Ringkasan:
"""


def _parse_retry_after_seconds(message: str):
    try:
        m = re.search(r"in\s+(?:(\d+)m)?(\d+(?:\.\d+)?)s", message)
        if not m:
            return None
        minutes = float(m.group(1)) if m.group(1) else 0.0
        seconds = float(m.group(2))
        return minutes * 60.0 + seconds
    except Exception:
        return None


# =========================
# Error handler global
# =========================
@app.errorhandler(Exception)
def handle_exception(e):
    code = 500
    msg = str(e)
    if isinstance(e, HTTPException):
        code = e.code or 500
        msg = e.description
    return jsonify({"error": msg}), code


# =========================
# Routes (Pages)
# =========================
@app.route("/")
def base_page():
    # Layout utama: sidebar + iframe (default: /dashboard)
    return render_template("base.html")


@app.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


@app.route("/voice")
def voice_page():
    return render_template("index.html")


@app.route("/index")
def index_alias():
    return render_template("index.html")


@app.route("/history")
def history_page():
    return render_template("history.html", history=history_store)


@app.route("/settings")
def settings_page():
    return render_template("settings.html")

# di bagian atas file api.py (global)
current_summary_mode = "patologi"  # default


@app.route("/set_summary_mode", methods=["POST"])
def set_summary_mode():
    """Set mode ringkasan global."""
    global current_summary_mode
    try:
        data = request.get_json(force=True, silent=True) or {}
        mode = (data.get("mode") or "").strip().lower()
        # hanya izinkan mode yang memang ada prompt-nya
        allowed = ["patologi", "dokter_hewan"]
        if mode not in allowed:
            return jsonify({"error": "mode_invalid", "allowed": allowed}), 400
        current_summary_mode = mode
        print("[/set_summary_mode] set to", current_summary_mode)
        return jsonify({"status": "ok", "mode": current_summary_mode})
    except Exception as e:
        print("ERROR /set_summary_mode:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/get_summary_mode", methods=["GET"])
def get_summary_mode():
    return jsonify({"mode": current_summary_mode})


# =========================
# Routes (APIs)
# =========================
@app.route("/test", methods=["GET"])
def test():
    return jsonify({"status": "connected", "message": "Backend is running"})

# ... (di bawah fungsi def test():)

# =========================
# Rute Tes Diagnostik Baru
# =========================
@app.route("/test_groq_http", methods=["GET"])
def test_groq_http():
    print("\n--- [DIAGNOSTIK] Memulai tes via HTTP ---")
    try:
        if not client:
            print("--- [DIAGNOSTIK] Client Groq tidak terinisialisasi.")
            return jsonify({"error": "Groq client not initialized"}), 500

        print("--- [DIAGNOSTIK] Menghubungi Groq via HTTP... ---")
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": "Hello world"}],
            model=MODEL, # Menggunakan MODEL global yang sudah kita perbaiki
            temperature=0.5,
        )
        
        result = chat_completion.choices[0].message.content
        print(f"--- [DIAGNOSTIK] Berhasil! Respons: {result} ---")
        return jsonify({"status": "sukses", "response": result})

    except Exception as e:
        print(f"--- [DIAGNOSTIK] GAGAL! Error: {type(e).__name__} - {e} ---")
        return jsonify({"error": f"{type(e).__name__}: {e}"}), 500



# =========================
# Routes (APIs)
# =========================
# ... (sisa kode Anda dimulai dari sini)

# ---------- HTTP summarize ----------
@app.route("/summarize", methods=["POST"])
def summarize():
    try:
        data = request.get_json(force=True, silent=True) or {}
        text = (data.get("text") or "").strip()
        mode = (data.get("mode") or current_summary_mode).strip().lower()
        if not text:
            return jsonify({"error": "Teks kosong"}), 400

        if not client:
            return jsonify({"error": "groq_api_key_missing", "message": "GROQ_API_KEY not configured"}), 500

        prompt = build_prompt(text, mode)
        print("[/summarize] text_len=", len(text), "mode=", mode)

        max_retries = 3
        base_sleep = 3.0
        attempt = 0
        while True:
            try:
                resp = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=MODEL,
                    temperature=0.3,
                )
                summary_raw = (resp.choices[0].message.content or "").strip()
                summary = strip_think(summary_raw)
                return jsonify({"summary": summary})
            except Exception as e:
                msg = f"{type(e).__name__}: {e}"
                print("[/summarize] ERROR:", msg)
                low = str(e).lower()
                is_rate = "rate limit" in low or "rate_limit" in low
                is_conn = any(k in low for k in ["connection", "timeout", "timed out", "temporarily"])
                retry_after = _parse_retry_after_seconds(str(e)) or base_sleep
                attempt += 1

                if (is_rate or is_conn) and attempt <= max_retries:
                    sleep_for = retry_after * (2 ** (attempt - 1))
                    print(f"[/summarize] retry in {sleep_for:.1f}s (attempt {attempt}/{max_retries})")
                    time.sleep(sleep_for)
                    continue

                if is_rate:
                    return jsonify({"error": "rate_limit", "message": str(e), "retry_after": max(5, int(retry_after))}), 429
                if is_conn:
                    return jsonify({"error": "upstream_connection", "message": str(e)}), 502
                return jsonify({"error": str(e)}), 500

    except Exception as e:
        print("ERROR /summarize (outer):", f"{type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------- SAVE (history) ----------
@app.route("/save", methods=["POST"])
def save_summary():
    try:
        try:
            print("\n[/save] === request headers ===")
            for k, v in request.headers.items():
                print(f"{k}: {v}")
        except Exception:
            print("[/save] failed to print headers")

        try:
            raw = request.get_data(as_text=True)
            print("[/save] raw body (first 2000 chars):", raw[:2000])
        except Exception as e:
            print("[/save] could not read raw body:", e)

        payload = {}
        try:
            payload = request.get_json(force=True, silent=False) or {}
            print("[/save] parsed JSON keys:", list(payload.keys()))
        except Exception as e:
            print("[/save] get_json failed:", type(e).__name__, e)
            return jsonify({"error": "invalid_json", "message": str(e)}), 400

        text = (payload.get("text") or "").strip()
        meta = payload.get("meta") or {}

        if not text:
            print("[/save] empty text -> 400")
            return jsonify({"error": "empty_text"}), 400

        entry = {
            "id": str(uuid.uuid4()),
            "text": text,
            "meta": meta,
            "created_at": _now_iso()
        }

        history_store.insert(0, entry)  # newest first
        print(f"[/save] saved entry id={entry['id']} len={len(text)} created_at={entry['created_at']}")
        return jsonify({"status": "ok", "entry": entry}), 200

    except Exception as e:
        print("ERROR /save (exception):", type(e).__name__, e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/save_echo", methods=["POST"])
def save_echo():
    try:
        raw = request.get_data(as_text=True)
        print("[/save_echo] got raw:", raw[:2000])
        return jsonify({"ok": True, "echo": raw[:2000]}), 200
    except Exception as e:
        print("ERROR /save_echo:", e)
        return jsonify({"error": str(e)}), 500


def generate_share_token(length=32):
    """Generate a random share token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@app.route("/api/history", methods=["GET"])
def api_history():
    return jsonify({"history": history_store})


# ---------- SHARE functionality ----------
@app.route("/api/share/test", methods=["GET"])
def test_share_endpoint():
    """Test endpoint for share functionality"""
    return jsonify({
        "status": "success",
        "message": "Share endpoint is working",
        "supabase_configured": supabase is not None
    })


@app.route("/api/share/create", methods=["POST"])
def create_share_token():
    """Create a share token for a history item"""
    try:
        if not supabase:
            return jsonify({"error": "supabase_not_configured"}), 500
            
        # Get authorization header
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "missing_auth_token"}), 401
            
        token = auth_header.split(' ')[1]
        
        # Verify token with Supabase using REST API
        try:
            import requests
            headers = {
                'Authorization': f'Bearer {token}',
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            }
            response = requests.get(f'{SUPABASE_URL}/auth/v1/user', headers=headers)
            
            if response.status_code != 200:
                print(f"Token verification failed: {response.status_code}")
                return jsonify({"error": "invalid_token"}), 401
                
            user_data = response.json()
            if not user_data or 'id' not in user_data:
                return jsonify({"error": "invalid_token"}), 401
                
            user_id = user_data['id']
        except Exception as e:
            print(f"Token verification error: {e}")
            return jsonify({"error": "invalid_token"}), 401
        
        # Get request data
        data = request.get_json(force=True, silent=True) or {}
        history_id = data.get("history_id")
        
        if not history_id:
            return jsonify({"error": "history_id_required"}), 400
        
        # Verify the history item belongs to the user
        try:
            history_response = supabase.table('histories').select('id').eq('id', history_id).eq('user_id', user_id).execute()
            if not history_response.data or len(history_response.data) == 0:
                return jsonify({"error": "history_not_found"}), 404
        except Exception as e:
            print(f"History verification error: {e}")
            return jsonify({"error": "history_not_found"}), 404
        
        # Generate unique token
        share_token = generate_share_token()
        
        # Set expiration (optional - 30 days from now)
        expires_at = datetime.utcnow() + timedelta(days=30)
        
        # Create share token record
        try:
            share_response = supabase.table('share_tokens').insert({
                'token': share_token,
                'history_id': history_id,
                'created_by': user_id,
                'expires_at': expires_at.isoformat(),
                'max_views': None,  # No limit
                'view_count': 0,
                'is_active': True
            }).execute()
            
            if not share_response.data:
                return jsonify({"error": "failed_to_create_token"}), 500
                
            return jsonify({
                "status": "success",
                "share_token": share_token,
                "share_url": f"/share/{share_token}",
                "expires_at": expires_at.isoformat()
            })
            
        except Exception as e:
            print(f"Share token creation error: {e}")
            return jsonify({"error": "failed_to_create_token"}), 500
            
    except Exception as e:
        print(f"Create share token error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/share/<token>", methods=["GET"])
def get_shared_content(token):
    """Get shared content by token (public access)"""
    
    if not supabase:
        return jsonify({"error": "supabase_not_configured"}), 500
        
    if not token:
        return jsonify({"error": "token_required"}), 400
    
    share_data = None
    
    try:
        # --- A. Get and Validate Share Token ---
        share_response = supabase.table('share_tokens').select('*').eq('token', token).eq('is_active', True).execute()
        
        if not share_response.data or len(share_response.data) == 0:
            return jsonify({"error": "share_not_found"}), 404
            
        share_data = share_response.data[0]
        
        # Check expiration
        if share_data.get('expires_at'):
            # 1. Konversi expires_at menjadi timezone-aware
            expires_at = datetime.fromisoformat(share_data['expires_at'].replace('Z', '+00:00'))
            
            # 2. Bandingkan dengan waktu saat ini yang juga timezone-aware (UTC)
            # Perubahan di sini ⬇️
            if datetime.now(timezone.utc) > expires_at: 
                return jsonify({"error": "share_expired"}), 410
        
        # Check view limit
        max_views = share_data.get('max_views')
        view_count = share_data.get('view_count')
        if max_views and max_views > 0 and view_count >= max_views:
            return jsonify({"error": "share_limit_reached"}), 410
            
        # --- B. Get History Content ---
        # NOTE: Sisa kode di sini harus dipastikan berada di luar blok try/except 
        # validasi token agar share_data bisa diakses.
        
        history_response = supabase.table('histories').select('id, created_at, original_text, summary_result, metadata').eq('id', share_data['history_id']).execute()
        
        if not history_response.data or len(history_response.data) == 0:
            return jsonify({"error": "content_not_found", "message": "History entry deleted"}), 404
            
        history_data = history_response.data[0]
        
        # --- C. Increment View Count (Update) ---
        try:
            # Menggunakan view_count yang DIBACA dari database untuk menghindari race condition ringan
            supabase.table('share_tokens').update({
                'view_count': view_count + 1
            }).eq('token', token).execute()
        except Exception as e:
            print(f"Failed to increment view count: {e}")
            
        # --- D. Format dan Kembalikan Respon Sukses ---
        response_data = {
            "id": history_data['id'],
            "date": history_data['created_at'],
            "duration": (history_data.get('metadata') or {}).get('duration', ''),
            "transcript": history_data['original_text'],
            "summary": history_data['summary_result'],
            "shared_at": share_data['created_at'],
            "view_count": view_count + 1
        }
        
        return jsonify(response_data), 200
            
    except Exception as e:
        # Menangkap semua exception yang tidak terduga (RLS, Koneksi DB, NameError, dll.)
        print(f"FATAL: Get shared content error: {e}")
        traceback.print_exc()
        return jsonify({"error": "internal_server_error", "message": str(e)}), 500

# ---------- STREAM summarize (SocketIO) ----------
@socketio.on("summarize_stream")
def handle_summarize_stream(data):
    sid = request.sid
    text = (data.get("text") or "").strip()
    mode = (data.get("mode") or current_summary_mode).strip().lower()
    if not text:
        emit("summary_stream", {"error": "Teks kosong"})
        return

    if not client:
        emit("summary_stream", {"error": "groq_api_key_missing"})
        return

    prompt = build_prompt(text, mode)
    print(f"[stream] start SID={sid} text_len={len(text)} mode={mode}")

    stop_evt = Event()
    stop_flags[sid] = stop_evt

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL,
            temperature=0.3,
            stream=True
        )

        token_count = 0
        collected = []
        for chunk in response:
            if stop_evt.is_set():
                print(f"[stream] stopped by client SID={sid}")
                break

            try:
                choice = chunk.choices[0]
            except Exception:
                continue

            text_piece = None
            delta = getattr(choice, "delta", None)
            if delta and getattr(delta, "content", None):
                text_piece = delta.content
            if not text_piece:
                message_obj = getattr(choice, "message", None)
                if message_obj and getattr(message_obj, "content", None):
                    text_piece = message_obj.content

            if text_piece:
                token_count += len(text_piece)
                collected.append(text_piece)
                emit("summary_stream", {"token": text_piece})

        final_raw = "".join(collected).strip()
        final_fmt = strip_think(final_raw)
        emit("summary_stream", {"final": final_fmt, "end": True})
        print(f"[stream] end SID={sid} tokens={token_count}")

    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"[stream] error SID={sid}: {msg}")
        emit("summary_stream", {"error": str(e)})
    finally:
        stop_flags.pop(sid, None)


@socketio.on("stop_stream")
def handle_stop_stream():
    sid = request.sid
    if sid in stop_flags:
        stop_flags[sid].set()
    emit("stop_stream")


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    if sid in stop_flags:
        stop_flags[sid].set()
    print(f"[socket] disconnect SID={sid}")


# =========================
# Main
# =========================
if __name__ == "__main__":
    socketio.run(app, debug=True, use_reloader=False,
                 host="127.0.0.1", port=int(os.environ.get("PORT", 5001)),
                 allow_unsafe_werkzeug=True) # <-- TAMBAHKAN INI