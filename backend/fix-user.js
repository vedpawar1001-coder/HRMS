const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

const args = process.argv.slice(2);
const email = args[0];
const newPassword = args[1];

if (!email) {
  console.error('Usage: node fix-user.js <email> [newPassword]');
  console.error('Example: node fix-user.js vedpawar292001@gmail.com 123456789');
  process.exit(1);
}

async function fixUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.log(`User with email ${email} not found. Creating new user...`);
      
      // Create new user
      const newUser = await User.create({
        email: normalizedEmail,
        password: newPassword || '123456789',
        role: 'employee'
      });
      
      console.log(`✓ User created successfully!`);
      console.log(`Email: ${newUser.email}`);
      console.log(`Role: ${newUser.role}`);
      console.log(`ID: ${newUser._id}`);
    } else {
      console.log(`Found user: ${user.email}`);
      
      if (newPassword) {
        // Reset password
        user.password = newPassword;
        await user.save();
        console.log(`✓ Password reset successfully!`);
      } else {
        // Delete user
        if (user.employeeId) {
          await Employee.findByIdAndDelete(user.employeeId);
          console.log(`✓ Deleted associated employee record`);
        }
        
        await User.findByIdAndDelete(user._id);
        console.log(`✓ User deleted successfully!`);
        console.log(`You can now register again with the same email.`);
      }
    }

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixUser();

