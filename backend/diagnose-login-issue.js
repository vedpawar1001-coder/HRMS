const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

async function diagnoseLogin(email) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hr-system');
    console.log('✅ Connected to MongoDB\n');

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 Diagnosing login issue for: ${normalizedEmail}\n`);

    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      console.log('❌ USER NOT FOUND');
      console.log('   The email does not exist in the database.');
      console.log('\n💡 Solution: Register this email first or check for typos.');
      process.exit(1);
    }

    console.log('✅ USER FOUND');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive !== undefined ? user.isActive : 'true (default)'}`);
    console.log(`   Employee ID: ${user.employeeId || 'Not linked'}`);
    console.log(`   Password exists: ${user.password ? 'Yes' : 'No'}`);
    console.log(`   Password length: ${user.password ? user.password.length : 0}`);

    // Check password format
    if (!user.password) {
      console.log('\n❌ PASSWORD ISSUE: Password is null or undefined');
      console.log('💡 Solution: Reset the password using the reset-password endpoint');
      process.exit(1);
    }

    if (user.password.length < 20) {
      console.log('\n⚠️  WARNING: Password seems too short (might not be hashed)');
    }

    // Check if password starts with bcrypt hash format ($2a$, $2b$, etc.)
    if (!user.password.startsWith('$2')) {
      console.log('\n❌ PASSWORD ISSUE: Password is not properly hashed');
      console.log('💡 Solution: Reset the password using the reset-password endpoint');
      process.exit(1);
    }

    // Check employee link
    if (user.employeeId) {
      const employee = await Employee.findById(user.employeeId);
      if (!employee) {
        console.log('\n⚠️  WARNING: Employee ID is set but employee record not found');
      } else {
        console.log(`\n✅ EMPLOYEE LINKED`);
        console.log(`   Employee ID: ${employee._id}`);
        console.log(`   Name: ${employee.personalInfo?.fullName || 'N/A'}`);
        console.log(`   Employee Code: ${employee.employeeId || 'N/A'}`);
      }
    }

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.log('\n⚠️  WARNING: JWT_SECRET is not set in environment variables');
      console.log('   This might cause token generation to fail');
    } else {
      console.log('\n✅ JWT_SECRET is configured');
    }

    // Test password matching (with a dummy password to see if method works)
    try {
      const testResult = await user.matchPassword('test');
      console.log('\n✅ Password matching method works');
    } catch (error) {
      console.log('\n❌ PASSWORD MATCHING ERROR:');
      console.log(`   ${error.message}`);
      process.exit(1);
    }

    console.log('\n✅ DIAGNOSIS COMPLETE');
    console.log('   The user account looks valid.');
    console.log('   If login still fails, check:');
    console.log('   1. The password you are entering');
    console.log('   2. Backend console logs for specific error messages');
    console.log('   3. Network tab in browser for the exact error response');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ DIAGNOSIS ERROR:');
    console.error(error);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: node diagnose-login-issue.js <email>');
  process.exit(1);
}

diagnoseLogin(email);

