# 🚀 START HERE - HRMS Application

## Quick Start (3 Steps)

### Step 1: Setup Environment
**Run this file first:** `SETUP_ENV.bat`
- This creates the required `.env` file for the backend

### Step 2: Install Dependencies (if not already done)
```bash
# Backend
cd backend
npm install

# Frontend (new terminal)
cd frontend
npm install
```

### Step 3: Start Application

**Option A: Easy Way (Windows)**
- Double-click: `START.bat`

**Option B: Manual Way**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 4: Open Browser
- Go to: **http://localhost:3000**

---

## ⚠️ IMPORTANT: MongoDB Required!

**You MUST have MongoDB running before starting!**

### Quick MongoDB Setup:

**Option 1: MongoDB Atlas (Cloud - Easiest)**
1. Sign up free: https://www.mongodb.com/cloud/atlas
2. Create a cluster (free tier)
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Update `backend\.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hrms
   ```
   Replace `username:password` with your credentials

**Option 2: Local MongoDB**
1. Install: https://www.mongodb.com/try/download/community
2. Start service:
   ```bash
   net start MongoDB
   ```

---

## ❌ Not Working?

### Check These:

1. **Backend .env file exists?**
   - Location: `backend\.env`
   - Run `SETUP_ENV.bat` if missing

2. **Both servers running?**
   - Backend: http://localhost:5000/api/health
   - Frontend: http://localhost:3000

3. **MongoDB connected?**
   - Check backend terminal for connection errors
   - Verify MongoDB is running or Atlas connection string is correct

4. **Dependencies installed?**
   - Check if `node_modules` folders exist in both `backend` and `frontend`
   - If not: run `npm install` in each folder

### Common Errors:

**"Cannot connect to MongoDB"**
→ Start MongoDB or update `.env` with Atlas connection string

**"Port already in use"**
→ Close other programs using ports 3000 or 5000

**"Module not found"**
→ Run `npm install` in the folder showing the error

**Blank page in browser**
→ Check if frontend server is running (should see "Local: http://localhost:3000" in terminal)

---

## 📋 Detailed Guides

- **Full Setup**: See `SETUP.md`
- **Troubleshooting**: See `TROUBLESHOOTING.md`
- **Quick Start**: See `QUICK_START.md`

---

## ✅ Success Checklist

When everything works, you should see:
- ✓ Backend terminal: "Server running on port 5000"
- ✓ Frontend terminal: "Local: http://localhost:3000"
- ✓ Browser: Login page at http://localhost:3000
- ✓ Backend health check: http://localhost:5000/api/health returns JSON

---

## 🎯 First Login

1. Go to http://localhost:3000
2. Click "Sign up"
3. Choose a role (Employee, Manager, HR, or Admin)
4. Register with email and password
5. Login and explore!

---

**Still stuck?** Check the error messages in:
- Backend terminal
- Frontend terminal  
- Browser console (Press F12)

