const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Leave = require('./models/Leave');
require('dotenv').config();

async function checkManagerLeaves() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('✅ Connected to MongoDB\n');

    // Find manager user
    const managerEmail = 'manager123@gmail.com';
    const managerUser = await User.findOne({ email: managerEmail });
    
    if (!managerUser) {
      console.log(`❌ Manager user not found: ${managerEmail}`);
      return;
    }

    console.log(`📋 Manager User Details:`);
    console.log(`   Email: ${managerUser.email}`);
    console.log(`   Role: ${managerUser.role}`);
    console.log(`   EmployeeId (in User): ${managerUser.employeeId || 'NOT SET'}`);
    console.log(`   User ID: ${managerUser._id}\n`);

    // Get manager's employee profile
    if (!managerUser.employeeId) {
      console.log(`❌ Manager has no employeeId linked\n`);
      return;
    }

    const managerEmployee = await Employee.findById(managerUser.employeeId);
    if (!managerEmployee) {
      console.log(`❌ Employee profile not found for employeeId: ${managerUser.employeeId}\n`);
      return;
    }

    console.log(`✅ Manager Employee Profile:`);
    console.log(`   Employee ID: ${managerEmployee._id}`);
    console.log(`   Employee Number: ${managerEmployee.employeeId || 'NOT SET'}`);
    console.log(`   Full Name: ${managerEmployee.personalInfo?.fullName || 'NOT SET'}\n`);

    // Get ALL leaves in database
    const allLeaves = await Leave.find({}).populate('employeeId', 'employeeId personalInfo.fullName');
    console.log(`📊 Total leaves in database: ${allLeaves.length}\n`);

    // Find leaves that belong to manager
    const managerLeaves = allLeaves.filter(leave => {
      if (!leave.employeeId) return false;
      const leaveEmpId = leave.employeeId._id?.toString() || leave.employeeId.toString();
      const managerEmpId = managerEmployee._id.toString();
      return leaveEmpId === managerEmpId;
    });

    console.log(`👤 Manager's Own Leaves: ${managerLeaves.length}\n`);
    if (managerLeaves.length > 0) {
      managerLeaves.forEach((leave, idx) => {
        console.log(`   ${idx + 1}. Leave ID: ${leave._id}`);
        console.log(`      Type: ${leave.leaveType}`);
        console.log(`      Status: ${leave.status}`);
        console.log(`      Dates: ${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`);
        console.log(`      Employee: ${leave.employeeId?.personalInfo?.fullName || leave.employeeId?.employeeId}`);
        console.log(`      EmployeeId in DB: ${leave.employeeId?._id || leave.employeeId}`);
        console.log('');
      });
    }

    // Find leaves that DON'T belong to manager
    const otherLeaves = allLeaves.filter(leave => {
      if (!leave.employeeId) return true;
      const leaveEmpId = leave.employeeId._id?.toString() || leave.employeeId.toString();
      const managerEmpId = managerEmployee._id.toString();
      return leaveEmpId !== managerEmpId;
    });

    console.log(`⚠️  Other Leaves (NOT manager's): ${otherLeaves.length}\n`);
    if (otherLeaves.length > 0) {
      console.log(`These are the leaves that should NOT appear in manager's 'My Leaves' view:\n`);
      otherLeaves.slice(0, 5).forEach((leave, idx) => {
        console.log(`   ${idx + 1}. Leave ID: ${leave._id}`);
        console.log(`      Type: ${leave.leaveType}`);
        console.log(`      Status: ${leave.status}`);
        console.log(`      Employee: ${leave.employeeId?.personalInfo?.fullName || leave.employeeId?.employeeId || 'Unknown'}`);
        console.log(`      EmployeeId in DB: ${leave.employeeId?._id || leave.employeeId}`);
        console.log(`      ⚠️  This should NOT show in manager's 'My Leaves'!`);
        console.log('');
      });
    }

    // Test the query that should be used
    console.log(`\n🔍 Testing Query Filter:`);
    const testFilter = { employeeId: managerUser.employeeId };
    console.log(`   Filter:`, JSON.stringify(testFilter, null, 2));
    
    const testLeaves = await Leave.find(testFilter).populate('employeeId', 'employeeId personalInfo.fullName');
    console.log(`   Leaves found with this filter: ${testLeaves.length}`);
    
    if (testLeaves.length > 0) {
      testLeaves.forEach((leave, idx) => {
        const empId = leave.employeeId?._id?.toString() || leave.employeeId?.toString() || 'Unknown';
        console.log(`   ${idx + 1}. Leave ${leave._id}: EmployeeId=${empId}, Type=${leave.leaveType}`);
      });
    }

    console.log(`\n✅ Check complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkManagerLeaves();




