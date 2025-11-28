const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';
    
    console.log('Attempting to connect to MongoDB...');
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
    
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('✗ MongoDB Connection Error:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('1. Is MongoDB running? (For local: net start MongoDB)');
    console.error('2. Is the MONGODB_URI correct in backend/.env?');
    console.error('3. For MongoDB Atlas: Is your IP whitelisted?');
    console.error('');
    console.error('The server will continue to run, but database operations will fail.');
    console.error('Fix the MongoDB connection and restart the server.');
    return false;
  }
};

module.exports = connectDB;

