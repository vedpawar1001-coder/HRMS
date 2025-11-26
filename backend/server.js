const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/hr-profile', require('./routes/hr-profile'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/grievances', require('./routes/grievances'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/recruitment', require('./routes/recruitment'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'HRMS API is running' });
});

// Global error handler - MUST be after all routes
app.use((err, req, res, next) => {
  console.error('===== GLOBAL ERROR HANDLER =====');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('================================');
  
  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    message: err.message || 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

