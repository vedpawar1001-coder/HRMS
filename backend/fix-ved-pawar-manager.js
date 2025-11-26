const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./models/Employee');
const User = require('./models/User');

async function fixVedPawarManager() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrmssystem');
    console.log('Connected to MongoDB\n');

    // Find Ved Pawar
    const vedPawar = await Employee.findOne({
      'personalInfo.fullName': { $regex: /ved pawar/i }
    });

    if (!vedPawar) {
      console.log('❌ Ved Pawar employee not found in database');
      console.log('Searching for similar names...');
      const similar = await Employee.find({
        'personalInfo.fullName': { $regex: /ved|pawar/i }
      }).select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.reportingManager');
      
      if (similar.length > 0) {
        console.log('\nFound similar employees:');
        similar.forEach(emp => {
          console.log(`  - ${emp.employeeId || 'NO ID'} - ${emp.personalInfo?.fullName || 'N/A'}`);
        });
      }
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found Ved Pawar:`);
    console.log(`   Employee ID: ${vedPawar.employeeId || 'NOT SET'}`);
    console.log(`   Name: ${vedPawar.personalInfo?.fullName || 'N/A'}`);
    console.log(`   Email: ${vedPawar.personalInfo?.email || 'N/A'}`);
    console.log(`   Current Reporting Manager: ${vedPawar.companyDetails?.reportingManager || 'NOT SET'}\n`);

    // Get current user (manager) - you'll need to provide the manager's email
    const managerEmail = process.argv[2] || 'manager@example.com';
    console.log(`Looking for manager: ${managerEmail}`);

    const managerUser = await User.findOne({ email: managerEmail.toLowerCase() });
    if (!managerUser) {
      console.log(`❌ Manager user not found: ${managerEmail}`);
      console.log('\nAvailable managers:');
      const allManagers = await User.find({ role: 'manager' }).select('email employeeId');
      allManagers.forEach(m => {
        console.log(`  - ${m.email} (employeeId: ${m.employeeId || 'NOT SET'})`);
      });
      await mongoose.disconnect();
      return;
    }

    if (!managerUser.employeeId) {
      console.log(`❌ Manager user has no employeeId linked`);
      await mongoose.disconnect();
      return;
    }

    const manager = await Employee.findById(managerUser.employeeId);
    if (!manager) {
      console.log(`❌ Manager employee profile not found`);
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found Manager:`);
    console.log(`   Manager ID: ${manager.employeeId || manager._id}`);
    console.log(`   Manager Name: ${manager.personalInfo?.fullName || 'N/A'}\n`);

    // Check if already assigned
    if (vedPawar.companyDetails?.reportingManager?.toString() === manager._id.toString()) {
      console.log('✅ Ved Pawar is already assigned to this manager!');
      await mongoose.disconnect();
      return;
    }

    // Assign Ved Pawar to manager
    console.log('Assigning Ved Pawar to manager...');
    vedPawar.companyDetails.reportingManager = manager._id;
    await vedPawar.save();

    console.log('✅ Successfully assigned Ved Pawar to manager!');
    console.log(`   Ved Pawar Employee ID: ${vedPawar.employeeId}`);
    console.log(`   Reporting Manager: ${manager.employeeId || manager._id} (${manager.personalInfo?.fullName})\n`);

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

// Usage: node backend/fix-ved-pawar-manager.js manager@example.com
fixVedPawarManager();

