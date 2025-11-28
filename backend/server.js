const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Routes
try {
  console.log('Registering routes...');
  app.use('/api/auth', require('./routes/auth'));
  console.log('✓ Auth routes registered');
  app.use('/api/profile', require('./routes/profile'));
  console.log('✓ Profile routes registered');
  app.use('/api/hr-profile', require('./routes/hr-profile'));
  console.log('✓ HR Profile routes registered');
  app.use('/api/employees', require('./routes/employees'));
  console.log('✓ Employees routes registered');
  app.use('/api/attendance', require('./routes/attendance'));
  console.log('✓ Attendance routes registered');
  app.use('/api/leaves', require('./routes/leaves'));
  console.log('✓ Leaves routes registered');
  app.use('/api/payroll', require('./routes/payroll'));
  console.log('✓ Payroll routes registered');
  app.use('/api/performance', require('./routes/performance'));
  console.log('✓ Performance routes registered');
  app.use('/api/engagement', require('./routes/engagement'));
  console.log('✓ Engagement routes registered');
  app.use('/api/grievances', require('./routes/grievances'));
  console.log('✓ Grievances routes registered');
  app.use('/api/dashboard', require('./routes/dashboard'));
  console.log('✓ Dashboard routes registered');
  app.use('/api/recruitment', require('./routes/recruitment'));
  console.log('✓ Recruitment routes registered');
  console.log('All routes registered successfully!');
} catch (error) {
  console.error('Error registering routes:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}

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

// Start server only after MongoDB connection attempt
const startServer = async () => {
  // Attempt to connect to database first
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    console.log('');
    console.log('⚠️  WARNING: MongoDB connection failed, but server will start anyway.');
    console.log('   Some features may not work until MongoDB is connected.');
    console.log('');
  }
  
  // Start the Express server
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ API available at http://localhost:${PORT}/api`);
    if (dbConnected) {
      console.log('✓ Server is ready to handle requests');
    } else {
      console.log('⚠️  Server running but MongoDB not connected');
    }
  });
};

startServer();

