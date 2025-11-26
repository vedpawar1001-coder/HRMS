# HRMS Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **MongoDB** - [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier available)
3. **npm** or **yarn** (comes with Node.js)

## Quick Start

### 1. Database Setup

#### Option A: Local MongoDB
- Install MongoDB locally
- Start MongoDB service:
  ```bash
  # Windows (run as administrator)
  net start MongoDB

  # macOS/Linux
  sudo systemctl start mongod
  ```

#### Option B: MongoDB Atlas (Cloud)
- Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Create a cluster and get your connection string
- Use the connection string in your `.env` file

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env

# Edit .env file and update MongoDB URI if needed
# For MongoDB Atlas, use:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hrms

# Start the backend server
npm run dev
```

The backend server will start on **http://localhost:5000**

### 3. Frontend Setup

Open a **new terminal window**:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the frontend development server
npm run dev
```

The frontend will start on **http://localhost:3000**

### 4. Access the Application

1. Open your browser and go to: **http://localhost:3000**
2. Register a new account:
   - Choose your role (Employee, Manager, HR, or Admin)
   - Fill in your email and password
   - Click "Sign Up"
3. Login with your credentials

## Default Roles & Permissions

### Employee
- View own attendance, leaves, payroll, performance
- Apply for leaves
- Raise grievances
- View announcements and polls
- Punch in/out

### Manager
- All Employee permissions
- View team members' data
- Approve/reject team leaves
- View team attendance and performance

### HR
- View all employees' data
- Manage recruitment
- Process payroll
- Approve leaves
- Manage announcements and events
- View all grievances

### Admin
- Full system access
- Manage all modules
- Configure system settings
- View audit logs

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running (if using local)
- Check your `.env` file has the correct `MONGODB_URI`
- For MongoDB Atlas, ensure your IP is whitelisted in the network access settings

### Port Already in Use
- Backend (5000): Change `PORT` in `backend/.env`
- Frontend (3000): Update `vite.config.js` port setting

### npm install Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- If issues persist, try `npm cache clean --force`

### CORS Errors
- Ensure backend is running on port 5000
- Check `frontend/vite.config.js` proxy settings

## Project Structure

```
HR/
├── backend/           # Node.js + Express backend
│   ├── config/       # Database configuration
│   ├── middleware/   # Authentication middleware
│   ├── models/       # MongoDB models
│   ├── routes/       # API routes
│   └── server.js     # Entry point
│
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── context/     # React context (Auth)
│   │   ├── pages/       # Page components
│   │   └── App.jsx      # Main app component
│   └── vite.config.js   # Vite configuration
│
└── README.md         # Main documentation
```

## Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload during development
2. **API Testing**: Use Postman or similar tools to test API endpoints
3. **Database GUI**: Use MongoDB Compass to view your database
4. **Logs**: Check console logs for debugging information

## Production Deployment

For production deployment:

1. **Backend**:
   - Set `NODE_ENV=production` in `.env`
   - Use a process manager like PM2
   - Set up proper JWT_SECRET (long random string)
   - Configure MongoDB connection with authentication

2. **Frontend**:
   - Run `npm run build`
   - Serve the `dist` folder using a web server (nginx, Apache, etc.)
   - Configure API proxy to point to your backend URL

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure MongoDB is accessible
4. Check network/firewall settings

Happy coding! 🚀

