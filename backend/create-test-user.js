const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Employee = require('./models/Employee');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrmssystem');
    console.log('Connected to MongoDB\n');

    const email = 'vedpawar292001@gmail.com';
    const password = '123456789';
    
    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      console.log(`User already exists: ${email}`);
      console.log(`User ID: ${user._id}`);
      console.log(`EmployeeId: ${user.employeeId || 'NOT SET'}\n`);
      
      // Create employee if doesn't exist
      if (!user.employeeId) {
        console.log('Creating employee profile...');
        // Generate employeeId manually
        const year = new Date().getFullYear();
        const count = await Employee.countDocuments();
        const employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
        
        const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) || 'Employee';
        
        const employee = new Employee({
          employeeId: employeeId, // Set manually to satisfy required constraint
          userId: user._id,
          personalInfo: {
            fullName: fullName,
            email: email.toLowerCase()
          },
          companyDetails: {
            joiningDate: new Date(),
            department: 'General',
            designation: 'Employee',
            employmentStatus: 'Active'
          }
        });
        
        await employee.save();
        console.log(`Created employee: ${employee._id}, employeeId: ${employee.employeeId}`);
        
        user.employeeId = employee._id;
        employee.userId = user._id;
        await user.save();
        await employee.save();
        
        console.log('✅ Employee profile created and linked!\n');
      } else {
        console.log('✅ Employee profile already exists!\n');
      }
    } else {
      console.log('Creating new user and employee profile...\n');
      
      // Create employee first - generate employeeId manually
      const year = new Date().getFullYear();
      const count = await Employee.countDocuments();
      const employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
      
      const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) || 'Employee';
      
      const employee = new Employee({
        employeeId: employeeId, // Set manually to satisfy required constraint
        personalInfo: {
          fullName: fullName,
          email: email.toLowerCase()
        },
        companyDetails: {
          joiningDate: new Date(),
          department: 'General',
          designation: 'Employee',
          employmentStatus: 'Active'
        }
      });
      
      await employee.save();
      console.log(`Created employee: ${employee._id}, employeeId: ${employee.employeeId}`);
      
      // Create user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      user = await User.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'employee',
        employeeId: employee._id
      });
      
      employee.userId = user._id;
      await employee.save();
      
      console.log(`Created user: ${user._id}`);
      console.log('✅ User and employee profile created successfully!\n');
    }
    
    console.log('Final status:');
    console.log(`  User: ${user.email}`);
    console.log(`  User ID: ${user._id}`);
    console.log(`  EmployeeId: ${user.employeeId}`);
    console.log(`  Role: ${user.role}\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    process.exit(1);
  }
}

createTestUser();

