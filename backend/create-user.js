const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

async function createUser(email, password, role = 'employee', fullName = null) {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hr-system');
    console.log('✅ Connected to MongoDB\n');

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 Creating user: ${normalizedEmail}\n`);

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log('⚠️  User already exists!');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Active: ${existingUser.isActive !== undefined ? existingUser.isActive : 'true (default)'}`);
      process.exit(0);
    }

    // Generate name from email if not provided
    if (!fullName) {
      const emailPrefix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) || 'Employee';
    }

    // Create employee profile
    let employee = null;
    if (role === 'employee' || role === 'manager') {
      employee = await Employee.create({
        personalInfo: {
          fullName: fullName,
          email: normalizedEmail
        },
        companyDetails: {
          joiningDate: new Date(),
          department: 'General',
          designation: role === 'manager' ? 'Manager' : 'Employee',
          employmentStatus: 'Active'
        }
      });
      console.log(`✅ Created employee profile - Name: "${employee.personalInfo.fullName}", Employee ID: ${employee.employeeId}`);
    }

    // Create user
    const user = await User.create({
      email: normalizedEmail,
      password: password,
      role: role,
      employeeId: employee ? employee._id : null
    });

    // Link user to employee
    if (employee) {
      employee.userId = user._id;
      await employee.save();
    }

    console.log(`\n✅ User created successfully!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Employee ID: ${employee ? employee._id : 'N/A'}`);
    console.log(`\n💡 You can now login with:`);
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Password: ${password}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating user:');
    console.error(error.message);
    if (error.code === 11000) {
      console.error('   Duplicate email detected. User might already exist.');
    }
    process.exit(1);
  }
}

// Get parameters from command line
const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4] || 'employee';
const fullName = process.argv[5] || null;

if (!email || !password) {
  console.error('Usage: node create-user.js <email> <password> [role] [fullName]');
  console.error('Example: node create-user.js user@example.com password123 employee "John Doe"');
  process.exit(1);
}

createUser(email, password, role, fullName);

