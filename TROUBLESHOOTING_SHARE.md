# Troubleshooting Share Feature - "Failed to fetch" Error

## 🔍 Debug Steps

### 1. Check Backend Status
```bash
# Test if backend is running
curl http://localhost:5001/test
# Should return: {"message": "Backend is running", "status": "connected"}
```

### 2. Check Share Endpoint
```bash
# Test share endpoint
curl -X POST http://localhost:5001/api/share/create \
  -H "Content-Type: application/json" \
  -d '{"history_id":"test"}'
# Should return error about missing auth token (this is expected)
```

### 3. Check Environment Variables
```bash
# Check backend/.env file
cat backend/.env
# Make sure SUPABASE_SERVICE_KEY is set and is a service_role key
```

### 4. Check Browser Console
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Try to create share link
4. Look for error messages

### 5. Check Network Tab
1. Open browser Developer Tools (F12)
2. Go to Network tab
3. Try to create share link
4. Look for failed requests to `http://localhost:5001/api/share/create`

## 🐛 Common Issues & Solutions

### Issue 1: "Failed to fetch"
**Cause**: Network connectivity issue or CORS problem
**Solution**: 
- Check if backend is running on port 5001
- Check if frontend is trying to connect to correct URL
- Verify CORS is enabled in backend

### Issue 2: "supabase_not_configured"
**Cause**: SUPABASE_SERVICE_KEY not set or incorrect
**Solution**:
- Check backend/.env file
- Make sure SUPABASE_SERVICE_KEY is a service_role key, not anon key
- Restart backend after changing .env

### Issue 3: "invalid_token"
**Cause**: User not logged in or token expired
**Solution**:
- Make sure user is logged in
- Check if session is valid
- Try logging out and logging in again

### Issue 4: "history_not_found"
**Cause**: History ID doesn't exist or doesn't belong to user
**Solution**:
- Check if history ID is correct
- Make sure user owns the history item
- Check if history exists in database

## 🔧 Manual Testing

### Test Backend Directly
```bash
# Test with valid auth token (replace YOUR_TOKEN)
curl -X POST http://localhost:5001/api/share/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"history_id":"YOUR_HISTORY_ID"}'
```

### Test Frontend Console
```javascript
// Run this in browser console
fetch('http://localhost:5001/api/share/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    history_id: 'YOUR_HISTORY_ID'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error(error));
```

## 📋 Checklist

- [ ] Backend is running on port 5001
- [ ] Frontend can access backend (no CORS issues)
- [ ] SUPABASE_SERVICE_KEY is set correctly
- [ ] User is logged in
- [ ] History ID exists and belongs to user
- [ ] Network connection is stable
- [ ] No firewall blocking localhost:5001

## 🚨 Emergency Fix

If nothing works, try this:

1. **Restart everything**:
   ```bash
   # Kill all processes
   taskkill /F /IM python.exe
   taskkill /F /IM node.exe
   
   # Restart backend
   python backend/api.py
   
   # Restart frontend
   npm run dev
   ```

2. **Check logs**:
   - Backend console for error messages
   - Browser console for JavaScript errors
   - Network tab for failed requests

3. **Verify environment**:
   ```bash
   # Check if all required packages are installed
   pip list | grep supabase
   pip list | grep flask
   ```

## 📞 Support

If issue persists:
1. Check browser console logs
2. Check backend console logs
3. Verify all environment variables
4. Test with a fresh browser session
5. Try incognito/private browsing mode
