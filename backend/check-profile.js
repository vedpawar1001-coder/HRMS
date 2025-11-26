const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Employee = require('./models/Employee');

async function checkProfile() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrmssystem');
    console.log('Connected to MongoDB\n');

    const email = process.argv[2] || 'vedpawar292001@gmail.com';
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`Checking profile for: ${normalizedEmail}\n`);

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.error(`❌ User not found: ${normalizedEmail}`);
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   EmployeeId: ${user.employeeId || 'NOT SET'}\n`);

    // Check if employee exists
    if (user.employeeId) {
      const employee = await Employee.findById(user.employeeId);
      if (employee) {
        console.log('✅ Employee profile found:');
        console.log(`   ID: ${employee._id}`);
        console.log(`   EmployeeId: ${employee.employeeId}`);
        console.log(`   Name: ${employee.personalInfo?.fullName || 'N/A'}`);
        console.log(`   Email: ${employee.personalInfo?.email || 'N/A'}`);
        console.log(`   UserId linked: ${employee.userId || 'NOT SET'}\n`);
      } else {
        console.log('❌ Employee ID exists but profile not found in database\n');
      }
    } else {
      console.log('⚠️  No employeeId linked to user\n');
      
      // Check if employee exists with email
      const employee = await Employee.findOne({ 'personalInfo.email': normalizedEmail });
      if (employee) {
        console.log('✅ Employee profile found with email but not linked:');
        console.log(`   ID: ${employee._id}`);
        console.log(`   EmployeeId: ${employee.employeeId}`);
        console.log(`   Will link now...\n`);
        
        user.employeeId = employee._id;
        await user.save();
        employee.userId = user._id;
        await employee.save();
        console.log('✅ Linked user and employee!\n');
      } else {
        console.log('❌ No employee profile found. Need to create one.\n');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProfile();

