# Troubleshooting Guide - HRMS Not Running

## Common Issues and Solutions

### Issue 1: "Cannot GET /" or Blank Page

**Possible Causes:**
- Dependencies not installed
- Backend server not running
- Frontend server not running
- Port conflicts

**Solution:**
1. **Install Dependencies** (if not done):
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend (in a new terminal)
   cd frontend
   npm install
   ```

2. **Check Backend Server**:
   ```bash
   cd backend
   npm run dev
   ```
   You should see: `Server running on port 5000`

3. **Check Frontend Server** (in a new terminal):
   ```bash
   cd frontend
   npm run dev
   ```
   You should see: `Local: http://localhost:3000`

4. **Open Browser**: Go to `http://localhost:3000`

---

### Issue 2: MongoDB Connection Error

**Error Message:** 
- "MongoServerError" or "connect ECONNREFUSED"
- "MongoNetworkError"

**Solution:**

**Option A: Using Local MongoDB**
1. Make sure MongoDB service is running:
   ```bash
   # Windows (PowerShell as Administrator)
   net start MongoDB
   
   # Check if running
   mongo --version
   ```

2. Check `.env` file in `backend` folder:
   ```env
   MONGODB_URI=mongodb://localhost:27017/hrms
   ```

**Option B: Using MongoDB Atlas (Cloud - Recommended)**
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create a cluster (free tier)
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Update `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hrms?retryWrites=true&w=majority
   ```
   Replace `username` and `password` with your credentials

---

### Issue 3: Missing .env File

**Error:** Backend fails to start or can't connect to database

**Solution:**
1. Go to `backend` folder
2. Create a file named `.env` (no extension)
3. Add this content:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/hrms
   JWT_SECRET=your_jwt_secret_key_change_in_production_12345
   JWT_EXPIRE=7d
   NODE_ENV=development
   ```
4. Save the file
5. Restart backend server

---

### Issue 4: Port Already in Use

**Error:** 
- "Port 5000 is already in use"
- "Port 3000 is already in use"

**Solution:**

**For Backend (Port 5000):**
1. Find what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   
   # Kill the process (replace PID with actual process ID)
   taskkill /PID <PID> /F
   ```

2. Or change port in `backend/.env`:
   ```env
   PORT=5001
   ```
   Then update `frontend/vite.config.js`:
   ```js
   proxy: {
     '/api': {
       target: 'http://localhost:5001',  // Changed from 5000
       changeOrigin: true
     }
   }
   ```

**For Frontend (Port 3000):**
1. Change port in `frontend/vite.config.js`:
   ```js
   server: {
     port: 3001,  // Changed from 3000
   }
   ```

---

### Issue 5: Module Not Found Errors

**Error:** 
- "Cannot find module 'express'"
- "Cannot find module 'react'"

**Solution:**
1. Delete `node_modules` folder:
   ```bash
   # Backend
   cd backend
   rmdir /s /q node_modules
   del package-lock.json
   
   # Frontend
   cd frontend
   rmdir /s /q node_modules
   del package-lock.json
   ```

2. Reinstall:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd frontend
   npm install
   ```

---

### Issue 6: CORS Errors

**Error:** 
- "Access to XMLHttpRequest blocked by CORS policy"
- "No 'Access-Control-Allow-Origin' header"

**Solution:**
1. Make sure backend is running on port 5000
2. Check `frontend/vite.config.js` has proxy configured:
   ```js
   proxy: {
     '/api': {
       target: 'http://localhost:5000',
       changeOrigin: true
     }
   }
   ```
3. Restart both servers

---

### Issue 7: Browser Shows "ERR_CONNECTION_REFUSED"

**Solution:**
1. Check if frontend server is running
2. Look at terminal - it should show the URL
3. Make sure you're using the correct URL (usually `http://localhost:3000`)
4. Check Windows Firewall isn't blocking Node.js

---

### Issue 8: "npm is not recognized"

**Solution:**
1. Install Node.js from https://nodejs.org/
2. Restart your terminal/command prompt
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

---

### Issue 9: Vite Server Not Starting

**Error:** Vite crashes or won't start

**Solution:**
1. Check Node.js version (should be v16+):
   ```bash
   node --version
   ```

2. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

3. Delete node_modules and reinstall:
   ```bash
   cd frontend
   rmdir /s /q node_modules
   npm install
   ```

---

## Step-by-Step Quick Fix

If nothing is working, follow these steps in order:

### Step 1: Verify Installation
```bash
node --version  # Should be v16 or higher
npm --version
mongo --version  # Only if using local MongoDB
```

### Step 2: Setup Backend
```bash
cd backend

# Check if .env exists, if not create it
if not exist .env (
    echo PORT=5000 > .env
    echo MONGODB_URI=mongodb://localhost:27017/hrms >> .env
    echo JWT_SECRET=your_secret_key_12345 >> .env
    echo JWT_EXPIRE=7d >> .env
    echo NODE_ENV=development >> .env
)

# Install dependencies
npm install

# Start server
npm run dev
```

### Step 3: Setup Frontend (New Terminal)
```bash
cd frontend

# Install dependencies
npm install

# Start server
npm run dev
```

### Step 4: Open Browser
- Go to: `http://localhost:3000`
- You should see the login page

---

## Still Not Working?

1. **Check Console Logs:**
   - Backend terminal for errors
   - Frontend terminal for errors
   - Browser console (F12) for errors

2. **Common Terminal Errors:**
   - MongoDB connection: Setup MongoDB or use Atlas
   - Module errors: Run `npm install`
   - Port errors: Change ports or kill process

3. **Check Files Exist:**
   - `backend/.env` ✓
   - `backend/package.json` ✓
   - `frontend/package.json` ✓
   - `frontend/vite.config.js` ✓
   - `frontend/index.html` ✓

4. **Verify Server Status:**
   - Backend: `http://localhost:5000/api/health` should return JSON
   - Frontend: `http://localhost:3000` should show login page

---

## Getting Help

If you're still stuck:
1. Check the error message in terminal/browser console
2. Check which step failed (backend/frontend/database)
3. Verify all prerequisites are installed
4. Make sure both servers are running simultaneously

