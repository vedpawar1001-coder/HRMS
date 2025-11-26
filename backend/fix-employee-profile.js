const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Employee = require('./models/Employee');

async function fixEmployeeProfile() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrmssystem');
    console.log('Connected to MongoDB');

    // Get email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.error('Please provide email: node fix-employee-profile.js your@email.com');
      process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Looking for user: ${normalizedEmail}`);

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.error(`User not found: ${normalizedEmail}`);
      process.exit(1);
    }

    console.log(`Found user: ${user._id}, Role: ${user.role}, Current employeeId: ${user.employeeId}`);

    // Check if employee profile exists
    let employee = null;
    if (user.employeeId) {
      employee = await Employee.findById(user.employeeId);
      if (employee) {
        console.log(`Employee profile already exists: ${employee._id}`);
        console.log(`Employee ID: ${employee.employeeId}, Name: ${employee.personalInfo.fullName}`);
        process.exit(0);
      }
    }

    // Check if employee exists with this email
    employee = await Employee.findOne({ 'personalInfo.email': normalizedEmail });
    if (employee) {
      console.log(`Found existing employee with email: ${employee._id}`);
      // Link to user
      user.employeeId = employee._id;
      await user.save();
      console.log(`Linked employee ${employee._id} to user ${user._id}`);
      process.exit(0);
    }

    // Create new employee profile
    console.log('Creating new employee profile...');
    const emailPrefix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) || 'Employee';

    employee = await Employee.create({
      personalInfo: {
        fullName: fullName,
        email: normalizedEmail
      },
      companyDetails: {
        joiningDate: new Date(),
        department: 'General',
        designation: user.role === 'manager' ? 'Manager' : 'Employee',
        employmentStatus: 'Active'
      }
    });

    console.log(`Created employee: ${employee._id}, Employee ID: ${employee.employeeId}`);

    // Link to user
    user.employeeId = employee._id;
    await user.save();

    console.log(`Successfully linked employee ${employee._id} to user ${user._id}`);
    console.log(`Employee ID: ${employee.employeeId}`);
    console.log(`Full Name: ${employee.personalInfo.fullName}`);

    // Calculate profile completion
    employee.calculateProfileCompletion();
    await employee.save();

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixEmployeeProfile();

