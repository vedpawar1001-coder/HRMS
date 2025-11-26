const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function diagnoseLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.log('Usage: node diagnose-login.js <email>');
      console.log('Example: node diagnose-login.js manager123@gmail.com\n');
      process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 Checking login for: ${normalizedEmail}\n`);

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      console.log('❌ User not found in database');
      console.log('\n📋 Available users:');
      const allUsers = await User.find().select('email role isActive employeeId').lean();
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (Role: ${u.role}, Active: ${u.isActive || 'true (default)'}, EmployeeID: ${u.employeeId || 'None'})`);
      });
      process.exit(1);
    }

    console.log('✅ User found!');
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive !== undefined ? user.isActive : 'true (default)'}`);
    console.log(`  Employee ID: ${user.employeeId || 'None'}`);
    console.log(`  Has Password: ${user.password ? 'Yes' : 'No'}`);
    console.log(`  Password Length: ${user.password ? user.password.length : 0}`);
    
    // Test password matching
    const testPassword = process.argv[3];
    if (testPassword) {
      console.log(`\n🔐 Testing password match...`);
      try {
        const isMatch = await user.matchPassword(testPassword);
        console.log(`  Password Match: ${isMatch ? '✅ Yes' : '❌ No'}`);
        if (!isMatch) {
          console.log(`  ⚠️  Password does not match!`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking password: ${error.message}`);
      }
    } else {
      console.log(`\n💡 Tip: Add password as second argument to test password matching`);
      console.log(`  Example: node diagnose-login.js ${email} yourpassword`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseLogin();

