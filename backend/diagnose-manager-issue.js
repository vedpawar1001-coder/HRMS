const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./models/Employee');
const User = require('./models/User');

async function diagnoseManagerIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all managers
    const managers = await User.find({ role: 'manager' }).lean();
    console.log(`📊 Found ${managers.length} manager(s) in database:\n`);

    for (const managerUser of managers) {
      console.log('─'.repeat(60));
      console.log(`Manager User: ${managerUser.email}`);
      console.log(`User ID: ${managerUser._id}`);
      console.log(`Employee ID (linked): ${managerUser.employeeId || 'NOT LINKED'}\n`);

      if (!managerUser.employeeId) {
        console.log('❌ PROBLEM: Manager user has no employeeId linked!\n');
        continue;
      }

      // Get manager's employee profile
      const managerEmployee = await Employee.findById(managerUser.employeeId).lean();
      if (!managerEmployee) {
        console.log('❌ PROBLEM: Manager employee profile not found!\n');
        continue;
      }

      console.log(`Manager Employee Profile:`);
      console.log(`  - ID: ${managerEmployee._id}`);
      console.log(`  - Employee ID: ${managerEmployee.employeeId}`);
      console.log(`  - Name: ${managerEmployee.personalInfo?.fullName || 'N/A'}\n`);

      // Find all employees where reportingManager matches this manager
      const teamMembers = await Employee.find({
        'companyDetails.reportingManager': managerEmployee._id,
        'companyDetails.employmentStatus': 'Active',
        _id: { $ne: managerEmployee._id }
      }).lean();

      console.log(`👥 Team Members Found: ${teamMembers.length}\n`);

      if (teamMembers.length === 0) {
        console.log('❌ PROBLEM: No team members found!');
        
        // Check if there are any employees at all
        const allEmployees = await Employee.find({
          'companyDetails.employmentStatus': 'Active',
          _id: { $ne: managerEmployee._id }
        }).select('_id employeeId personalInfo.fullName companyDetails.reportingManager').lean();

        console.log(`\n📋 Total Active Employees (excluding manager): ${allEmployees.length}`);
        
        if (allEmployees.length > 0) {
          console.log('\n🔍 Checking why employees are not showing:');
          allEmployees.forEach(emp => {
            const hasReportingManager = emp.companyDetails?.reportingManager ? 'YES' : 'NO';
            const reportingManagerId = emp.companyDetails?.reportingManager || 'NOT SET';
            console.log(`  - ${emp.personalInfo?.fullName || 'Unknown'} (${emp.employeeId}):`);
            console.log(`    reportingManager: ${hasReportingManager} (${reportingManagerId})`);
          });
          console.log('\n💡 SOLUTION: Employees need to have reportingManager set to manager\'s _id');
          console.log(`   Manager's _id is: ${managerEmployee._id}`);
        }
      } else {
        console.log('✅ Team members found:');
        teamMembers.forEach(emp => {
          console.log(`  - ${emp.personalInfo?.fullName || 'Unknown'} (${emp.employeeId})`);
        });
      }
      console.log('\n');
    }

    console.log('─'.repeat(60));
    console.log('\n✅ Diagnostic Complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseManagerIssue();

