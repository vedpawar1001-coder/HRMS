const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Employee = require('./models/Employee');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrmssystem');
    console.log('Connected to MongoDB\n');

    const users = await User.find({}).select('email role employeeId');
    console.log(`Found ${users.length} users:\n`);
    
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   EmployeeId: ${user.employeeId || 'NOT SET'}`);
      console.log(`   ID: ${user._id}`);
      console.log('');
    });

    const employees = await Employee.find({}).select('personalInfo.email employeeId userId');
    console.log(`\nFound ${employees.length} employees:\n`);
    
    employees.forEach((emp, idx) => {
      console.log(`${idx + 1}. Email: ${emp.personalInfo?.email || 'N/A'}`);
      console.log(`   EmployeeId: ${emp.employeeId || 'N/A'}`);
      console.log(`   UserId: ${emp.userId || 'NOT SET'}`);
      console.log(`   ID: ${emp._id}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listUsers();

