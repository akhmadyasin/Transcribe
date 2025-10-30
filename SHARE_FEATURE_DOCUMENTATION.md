# Fitur Share - Dokumentasi Lengkap

## 🎯 Overview
Fitur share memungkinkan pengguna untuk membuat link publik yang dapat diakses tanpa login untuk melihat transkripsi dan ringkasan AI mereka.

## 🏗️ Arsitektur

### Backend (Flask)
- **Endpoint**: `/api/share/create` (POST) - Membuat share token
- **Endpoint**: `/api/share/<token>` (GET) - Mengambil konten yang dibagikan
- **Database**: Tabel `share_tokens` di Supabase

### Frontend (Next.js)
- **Komponen**: `SharePopup` - Modal untuk membuat share link
- **Halaman**: `/share/[token]` - Halaman publik untuk melihat konten yang dibagikan
- **Integrasi**: Tombol Share di detail page

## 📋 Fitur

### ✅ Yang Sudah Diimplementasi
1. **Tombol Share** di detail page
2. **SharePopup** untuk membuat link
3. **Halaman publik** untuk melihat konten yang dibagikan
4. **API endpoints** untuk backend
5. **Validasi token** dan keamanan
6. **View counter** untuk tracking
7. **Expiration** (30 hari)
8. **Copy to clipboard** functionality

### 🔒 Keamanan
- Token verification menggunakan Supabase Auth
- Validasi ownership history item
- Expiration date (30 hari)
- View count tracking
- RLS policies di Supabase

## 🚀 Cara Penggunaan

### 1. Membuat Share Link
1. Buka detail page transkripsi
2. Klik tombol "Share"
3. Klik "Create Share Link"
4. Copy link yang dihasilkan

### 2. Mengakses Shared Content
1. Buka link yang dibagikan
2. Konten akan ditampilkan tanpa perlu login
3. View count akan bertambah otomatis

## 🛠️ Setup Database

### Tabel share_tokens
```sql
CREATE TABLE public.share_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(32) UNIQUE NOT NULL,
    history_id UUID REFERENCES public.histories(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_views INTEGER,
    view_count INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### RLS Policies
```sql
-- Enable RLS
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- Policy untuk creator
CREATE POLICY "Creator can manage their own share tokens"
ON public.share_tokens FOR ALL
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);
```

## 🔧 Environment Variables

### Backend (.env)
```
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key
PORT=5001
```

**PENTING**: `SUPABASE_SERVICE_KEY` harus menggunakan **service_role** key, bukan anon key!

## 📁 File Structure

```
frontend/src/app/
├── components/
│   └── SharePopup.tsx          # Modal untuk membuat share link
├── share/
│   └── [token]/
│       └── page.tsx             # Halaman publik untuk shared content
└── detail/
    └── [id]/
        └── page.tsx             # Detail page dengan tombol share

backend/
├── api.py                       # API endpoints untuk share
└── .env                         # Environment variables
```

## 🐛 Troubleshooting

### Error: "supabase_not_configured"
- Pastikan `SUPABASE_SERVICE_KEY` sudah di-set di backend/.env
- Pastikan menggunakan **service_role** key, bukan anon key

### Error: "invalid_token"
- Pastikan user sudah login
- Pastikan `SUPABASE_SERVICE_KEY` adalah service_role key yang benar

### Error: "share_not_found"
- Token mungkin sudah expired atau tidak valid
- Cek apakah share token masih aktif di database

## 🎨 UI/UX Features

### SharePopup
- Modal dengan design yang clean
- Loading state saat membuat link
- Error handling yang informatif
- Copy to clipboard functionality
- Success feedback

### Public Share Page
- Design yang konsisten dengan aplikasi utama
- Header dengan branding
- Meta information (date, duration, view count)
- Copy buttons untuk transcript dan summary
- Error states yang informatif

## 🔄 API Flow

### 1. Create Share Token
```
POST /api/share/create
Headers: Authorization: Bearer <user_token>
Body: { "history_id": "uuid" }

Response: {
  "status": "success",
  "share_token": "abc123...",
  "share_url": "/share/abc123...",
  "expires_at": "2025-11-23T18:13:14Z"
}
```

### 2. Get Shared Content
```
GET /api/share/<token>

Response: {
  "id": "uuid",
  "date": "2025-10-23T18:13:14Z",
  "duration": "2:30",
  "transcript": "...",
  "summary": "...",
  "shared_at": "2025-10-23T18:13:14Z",
  "view_count": 5
}
```

## 🎯 Next Steps (Optional)

1. **Share Management**: Halaman untuk mengelola semua share links
2. **Custom Expiration**: Allow users to set custom expiration dates
3. **Password Protection**: Add password protection for sensitive shares
4. **Analytics**: More detailed analytics for shared content
5. **Bulk Share**: Share multiple transcriptions at once

## ✅ Status: COMPLETED

Semua fitur share sudah diimplementasi dan siap digunakan! 🎉
