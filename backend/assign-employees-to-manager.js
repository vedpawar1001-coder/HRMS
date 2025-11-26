const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./models/Employee');
const User = require('./models/User');

/**
 * Script to assign employees to a manager
 * Usage: node assign-employees-to-manager.js <manager-email> <employee-email1> <employee-email2> ...
 * OR: node assign-employees-to-manager.js <manager-email> --all (assigns all employees without a reporting manager)
 */

async function assignEmployeesToManager() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('❌ Usage: node assign-employees-to-manager.js <manager-email> <employee-email1> [employee-email2] ...');
      console.log('   OR: node assign-employees-to-manager.js <manager-email> --all');
      process.exit(1);
    }

    const managerEmail = args[0].toLowerCase().trim();
    const assignAll = args[1] === '--all';
    const employeeEmails = assignAll ? [] : args.slice(1).map(e => e.toLowerCase().trim());

    // Find manager
    const managerUser = await User.findOne({ email: managerEmail, role: 'manager' });
    if (!managerUser) {
      console.log(`❌ Manager with email "${managerEmail}" not found!`);
      process.exit(1);
    }

    if (!managerUser.employeeId) {
      console.log(`❌ Manager user has no employeeId linked!`);
      process.exit(1);
    }

    const managerEmployee = await Employee.findById(managerUser.employeeId);
    if (!managerEmployee) {
      console.log(`❌ Manager employee profile not found!`);
      process.exit(1);
    }

    console.log(`📋 Manager: ${managerEmployee.personalInfo?.fullName || managerEmail}`);
    console.log(`   ID: ${managerEmployee._id}`);
    console.log(`   Employee ID: ${managerEmployee.employeeId}\n`);

    let employeesToAssign = [];

    if (assignAll) {
      // Get all employees without a reporting manager
      employeesToAssign = await Employee.find({
        'companyDetails.reportingManager': { $exists: false },
        'companyDetails.employmentStatus': 'Active',
        _id: { $ne: managerEmployee._id }
      });
      console.log(`📊 Found ${employeesToAssign.length} employees without a reporting manager\n`);
    } else {
      // Get specific employees
      for (const email of employeeEmails) {
        const employee = await Employee.findOne({ 'personalInfo.email': email });
        if (!employee) {
          console.log(`⚠️  Employee with email "${email}" not found, skipping...`);
          continue;
        }
        if (employee._id.toString() === managerEmployee._id.toString()) {
          console.log(`⚠️  Cannot assign manager to themselves, skipping "${email}"...`);
          continue;
        }
        employeesToAssign.push(employee);
      }
      console.log(`📊 Found ${employeesToAssign.length} employee(s) to assign\n`);
    }

    if (employeesToAssign.length === 0) {
      console.log('❌ No employees to assign!');
      process.exit(0);
    }

    // Assign employees to manager
    let assigned = 0;
    let skipped = 0;

    for (const employee of employeesToAssign) {
      if (employee.companyDetails?.reportingManager?.toString() === managerEmployee._id.toString()) {
        console.log(`⏭️  ${employee.personalInfo?.fullName || employee.employeeId}: Already assigned to this manager`);
        skipped++;
        continue;
      }

      employee.companyDetails = employee.companyDetails || {};
      employee.companyDetails.reportingManager = managerEmployee._id;
      await employee.save();
      
      console.log(`✅ ${employee.personalInfo?.fullName || employee.employeeId}: Assigned to manager`);
      assigned++;
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`\n✅ Assignment Complete!`);
    console.log(`   Assigned: ${assigned}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`\n📊 Manager can now see ${assigned + (await Employee.countDocuments({
      'companyDetails.reportingManager': managerEmployee._id,
      'companyDetails.employmentStatus': 'Active',
      _id: { $ne: managerEmployee._id }
    }))} team member(s) in their profile dropdown\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignEmployeesToManager();

