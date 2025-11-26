const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLogin(email, password) {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hr-system');
    console.log('✅ Connected to MongoDB\n');

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 Testing login for: ${normalizedEmail}\n`);

    // Find user
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`   Password hash exists: ${user.password ? 'Yes' : 'No'}`);
    console.log(`   Password hash length: ${user.password ? user.password.length : 0}`);
    console.log(`   Password hash starts with $2: ${user.password ? user.password.startsWith('$2') : 'No'}\n`);

    // Test password matching
    console.log(`🔐 Testing password match...`);
    try {
      const isMatch = await user.matchPassword(password);
      if (isMatch) {
        console.log('✅ Password matches!');
      } else {
        console.log('❌ Password does NOT match');
        console.log(`\n💡 The password you entered might be incorrect.`);
        console.log(`   The password set during account creation was: password123`);
        console.log(`   Please make sure you're entering: password123`);
      }
    } catch (error) {
      console.error('❌ Error during password matching:', error.message);
    }

    // Also test with bcrypt directly
    console.log(`\n🔐 Testing with bcrypt directly...`);
    try {
      const directMatch = await bcrypt.compare(password, user.password);
      if (directMatch) {
        console.log('✅ Direct bcrypt comparison: Password matches!');
      } else {
        console.log('❌ Direct bcrypt comparison: Password does NOT match');
      }
    } catch (error) {
      console.error('❌ Error with direct bcrypt comparison:', error.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const email = process.argv[2] || 'vedpawar292001@gmail.com';
const password = process.argv[3] || 'password123';

console.log(`Testing login with:\n  Email: ${email}\n  Password: ${password}\n`);
testLogin(email, password);

