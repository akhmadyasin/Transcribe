# 🔧 Debug "Failed to fetch" Error - Share Feature

## 🎯 Langkah Debugging

### 1. **Buka Browser Console**
1. Tekan `F12` atau klik kanan → "Inspect"
2. Pilih tab **Console**
3. Coba klik tombol "Create Share Link"
4. Lihat error message yang muncul

### 2. **Cek Network Tab**
1. Di Developer Tools, pilih tab **Network**
2. Coba klik "Create Share Link" lagi
3. Lihat apakah ada request ke `http://localhost:5001/api/share/create`
4. Jika ada, klik request tersebut dan lihat status code

### 3. **Test Backend Manual**
Buka browser console dan jalankan:
```javascript
fetch('http://localhost:5001/api/share/test')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**Expected output:**
```json
{
  "status": "success",
  "message": "Share endpoint is working",
  "supabase_configured": true
}
```

### 4. **Cek Status Backend**
Di terminal, pastikan backend berjalan:
```bash
# Should show: [SUPABASE] Client initialized successfully
# Should show: * Running on http://127.0.0.1:5001
```

## 🐛 Kemungkinan Masalah & Solusi

### **Masalah 1: Backend tidak berjalan**
**Gejala:** Console error "Failed to fetch" atau "ERR_CONNECTION_REFUSED"
**Solusi:**
```bash
# Restart backend
python backend/api.py
```

### **Masalah 2: Port conflict**
**Gejala:** Backend tidak bisa start atau error port already in use
**Solusi:**
```bash
# Kill semua proses Python
taskkill /F /IM python.exe
# Restart backend
python backend/api.py
```

### **Masalah 3: CORS Error**
**Gejala:** Console error tentang CORS policy
**Solusi:** Backend sudah dikonfigurasi CORS, restart backend

### **Masalah 4: Supabase tidak configured**
**Gejala:** Error "supabase_not_configured"
**Solusi:**
1. Cek file `backend/.env`
2. Pastikan `SUPABASE_SERVICE_KEY` sudah di-set
3. Restart backend

### **Masalah 5: User tidak login**
**Gejala:** Error "You must be logged in"
**Solusi:**
1. Login ke aplikasi dulu
2. Pastikan session masih valid

## 🔍 Debug Commands

### Test Backend Status
```bash
# Test basic endpoint
curl http://localhost:5001/test

# Test share endpoint
curl http://localhost:5001/api/share/test
```

### Test dari Browser Console
```javascript
// Test basic connectivity
fetch('http://localhost:5001/test')
  .then(r => r.json())
  .then(console.log);

// Test share endpoint
fetch('http://localhost:5001/api/share/test')
  .then(r => r.json())
  .then(console.log);
```

## 📋 Checklist Debugging

- [ ] Backend berjalan di port 5001
- [ ] Frontend bisa akses `http://localhost:5001/test`
- [ ] Console tidak ada error JavaScript
- [ ] Network tab tidak ada failed requests
- [ ] User sudah login
- [ ] SUPABASE_SERVICE_KEY sudah di-set

## 🚨 Quick Fix

Jika semua gagal, coba ini:

1. **Restart semua:**
   ```bash
   # Kill semua proses
   taskkill /F /IM python.exe
   taskkill /F /IM node.exe
   
   # Restart backend
   python backend/api.py
   
   # Restart frontend (di terminal lain)
   npm run dev
   ```

2. **Clear browser cache:**
   - Tekan `Ctrl+Shift+R` untuk hard refresh
   - Atau buka incognito mode

3. **Check firewall:**
   - Pastikan Windows Firewall tidak block port 5001

## 📞 Next Steps

Jika masih error:
1. Screenshot error di console
2. Screenshot Network tab
3. Copy error message yang muncul
4. Cek apakah ada error di terminal backend

**Error yang paling umum:**
- "Failed to fetch" = Backend tidak berjalan
- "CORS error" = Backend tidak bisa diakses
- "supabase_not_configured" = Environment variable salah
- "invalid_token" = User tidak login atau token expired
