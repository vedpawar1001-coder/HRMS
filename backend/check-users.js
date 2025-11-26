const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hr-system');
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}).select('email role isActive employeeId');
    console.log(`📊 Total users in database: ${users.length}\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found in database.');
      console.log('💡 You need to register users first.\n');
    } else {
      console.log('📋 Users in database:');
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive !== undefined ? user.isActive : 'true (default)'}`);
        console.log(`   Employee ID: ${user.employeeId || 'Not linked'}`);
      });
    }

    // Check for the specific email
    const targetEmail = 'vedpawar292001@gmail.com';
    const normalizedEmail = targetEmail.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    
    console.log(`\n🔍 Checking for: ${normalizedEmail}`);
    if (user) {
      console.log('✅ User exists');
    } else {
      console.log('❌ User does not exist');
      console.log('\n💡 Solutions:');
      console.log('   1. Register this email using the sign-up form');
      console.log('   2. Or create the user manually using the register endpoint');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();

