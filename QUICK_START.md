# Quick Start Guide

## 🚀 Fastest Way to Run the Application

### Method 1: Using the Batch Script (Windows)

1. **Double-click `START.bat`** in the root folder
2. Wait for both servers to start
3. Open browser: `http://localhost:3000`

---

### Method 2: Manual Start

#### Terminal 1 - Backend:
```bash
cd backend
npm install
npm run dev
```
Should show: `Server running on port 5000`

#### Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
```
Should show: `Local: http://localhost:3000`

#### Then:
- Open browser: `http://localhost:3000`

---

## ⚠️ Important: MongoDB Setup

**You need MongoDB running!**

### Option A: Local MongoDB
1. Install MongoDB from https://www.mongodb.com/try/download/community
2. Start MongoDB service:
   ```bash
   # Windows PowerShell (as Administrator)
   net start MongoDB
   ```

### Option B: MongoDB Atlas (Cloud - Recommended)
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up (free)
3. Create a cluster
4. Get connection string
5. Update `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hrms
   ```

---

## ✅ Checklist Before Starting

- [ ] Node.js installed (check: `node --version`)
- [ ] MongoDB running (local or Atlas)
- [ ] Backend `.env` file exists (I created it for you!)
- [ ] Both servers can start without errors

---

## 🐛 Common Issues

### "Cannot connect to MongoDB"
→ Start MongoDB or check `.env` file has correct connection string

### "Port already in use"
→ Close other applications using ports 3000 or 5000

### "Module not found"
→ Run `npm install` in both backend and frontend folders

### "Cannot GET /"
→ Make sure BOTH backend and frontend servers are running

---

## 📝 First Time Setup

1. **Install Node.js** (if not installed):
   - Download: https://nodejs.org/
   - Install it
   - Restart terminal

2. **Setup MongoDB** (choose one):
   - **Local**: Install MongoDB, start service
   - **Cloud**: Create MongoDB Atlas account (free)

3. **Install Dependencies**:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd frontend
   npm install
   ```

4. **Create Backend .env file** (already created for you!):
   - Location: `backend/.env`
   - Should contain MongoDB connection string

5. **Start Application**:
   - Run `START.bat` OR
   - Start both servers manually

6. **Access Application**:
   - Open: `http://localhost:3000`
   - Register an account
   - Login and explore!

---

## 🎯 Quick Test

Once servers are running:

1. **Test Backend**: 
   - Open: `http://localhost:5000/api/health`
   - Should show: `{"status":"OK","message":"HRMS API is running"}`

2. **Test Frontend**:
   - Open: `http://localhost:3000`
   - Should show: Login page

If both work, you're ready to go! 🎉

