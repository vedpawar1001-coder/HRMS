const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./models/Employee');
const User = require('./models/User');

async function ensureAartiManager() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Aarti by name (case-insensitive)
    const aartiEmployees = await Employee.find({
      'personalInfo.fullName': { $regex: /aarti/i }
    }).lean();

    if (aartiEmployees.length === 0) {
      console.log('❌ No employee found with name containing "Aarti"');
      console.log('\n📋 Searching for all employees...\n');
      const allEmployees = await Employee.find().select('personalInfo.fullName companyDetails.designation employeeId').lean();
      allEmployees.forEach(emp => {
        console.log(`  - ${emp.personalInfo?.fullName || 'Unknown'}: ${emp.companyDetails?.designation || 'No designation'} (${emp.employeeId})`);
      });
      process.exit(1);
    }

    console.log(`📋 Found ${aartiEmployees.length} employee(s) matching "Aarti":\n`);

    for (const employee of aartiEmployees) {
      console.log('─'.repeat(60));
      console.log(`Employee: ${employee.personalInfo?.fullName || 'Unknown'}`);
      console.log(`Employee ID: ${employee.employeeId}`);
      console.log(`Current Designation: ${employee.companyDetails?.designation || 'NOT SET'}`);
      console.log(`Email: ${employee.personalInfo?.email || 'NOT SET'}`);
      
      // Check if user exists and their role
      const user = await User.findOne({ employeeId: employee._id }).lean();
      if (user) {
        console.log(`User Role: ${user.role}`);
      } else {
        console.log(`User: NOT FOUND`);
      }
      console.log('');

      // Update designation to include "Manager" if it doesn't
      let needsUpdate = false;
      const currentDesignation = employee.companyDetails?.designation || '';
      const designationLower = currentDesignation.toLowerCase();
      
      if (!designationLower.includes('manager')) {
        console.log('⚠️  Designation does not contain "manager" - updating...');
        needsUpdate = true;
        
        // Set designation to "Manager" if empty, or add "Manager" prefix/suffix
        const newDesignation = currentDesignation ? `Manager - ${currentDesignation}` : 'Manager';
        
        await Employee.findByIdAndUpdate(employee._id, {
          'companyDetails.designation': newDesignation
        });
        
        console.log(`✅ Updated designation: "${currentDesignation}" → "${newDesignation}"`);
      } else {
        console.log('✅ Designation already contains "manager" - no update needed');
      }

      // Update user role to "manager" if not already
      if (user && user.role !== 'manager') {
        console.log(`⚠️  User role is "${user.role}" - updating to "manager"...`);
        await User.findByIdAndUpdate(user._id, { role: 'manager' });
        console.log(`✅ Updated user role: "${user.role}" → "manager"`);
      } else if (!user) {
        console.log('⚠️  No user found linked to this employee');
        console.log('   You may need to create a user account or link it manually');
      } else {
        console.log('✅ User role is already "manager"');
      }
      
      console.log('');
    }

    console.log('─'.repeat(60));
    console.log('\n✅ Process Complete!\n');
    console.log('📌 Aarti should now appear in the Reporting Manager dropdown if:');
    console.log('   1. Designation contains "manager" ✅');
    console.log('   2. User role is "manager" ✅');
    console.log('\n🔄 Refresh the profile page to see the changes.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

ensureAartiManager();

