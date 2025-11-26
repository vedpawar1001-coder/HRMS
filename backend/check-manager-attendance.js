const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
require('dotenv').config();

async function checkManagerAttendance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('✅ Connected to MongoDB\n');

    // Find manager user
    const managerEmail = 'manager123@gmail.com';
    const manager = await User.findOne({ email: managerEmail });
    
    if (!manager) {
      console.log(`❌ Manager user not found: ${managerEmail}`);
      return;
    }

    console.log(`📋 Manager User Details:`);
    console.log(`   Email: ${manager.email}`);
    console.log(`   Role: ${manager.role}`);
    console.log(`   EmployeeId (in User): ${manager.employeeId || 'NOT SET'}`);
    console.log(`   User ID: ${manager._id}\n`);

    // Check if manager has employee profile
    if (manager.employeeId) {
      const managerEmployee = await Employee.findById(manager.employeeId);
      
      if (managerEmployee) {
        console.log(`✅ Manager Employee Profile Found:`);
        console.log(`   Employee ID: ${managerEmployee._id}`);
        console.log(`   Employee Number: ${managerEmployee.employeeId || 'NOT SET'}`);
        console.log(`   Full Name: ${managerEmployee.personalInfo?.fullName || 'NOT SET'}`);
        console.log(`   Email: ${managerEmployee.personalInfo?.email || 'NOT SET'}`);
        console.log(`   Designation: ${managerEmployee.companyDetails?.designation || 'NOT SET'}\n`);
      } else {
        console.log(`❌ Employee profile not found for employeeId: ${manager.employeeId}\n`);
      }
    } else {
      console.log(`❌ Manager has no employeeId linked. Creating one...\n`);
      
      // Create employee profile for manager
      const year = new Date().getFullYear();
      const count = await Employee.countDocuments();
      const employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
      
      const newEmployee = new Employee({
        employeeId: employeeId,
        userId: manager._id,
        personalInfo: {
          fullName: 'Manager',
          email: managerEmail
        },
        companyDetails: {
          joiningDate: new Date(),
          department: 'Management',
          designation: 'Manager',
          employmentStatus: 'Active'
        }
      });
      
      await newEmployee.save();
      console.log(`✅ Created employee profile: ${newEmployee._id}`);
      
      // Link to user
      manager.employeeId = newEmployee._id;
      await manager.save();
      console.log(`✅ Linked employee to manager user\n`);
    }

    // Check manager's attendance records
    const managerEmployeeId = manager.employeeId || (await User.findOne({ email: managerEmail })).employeeId;
    if (managerEmployeeId) {
      const managerAttendance = await Attendance.find({ employeeId: managerEmployeeId }).sort({ date: -1 });
      
      console.log(`📊 Manager's Attendance Records: ${managerAttendance.length} records found\n`);
      
      if (managerAttendance.length > 0) {
        console.log(`Recent attendance records:`);
        managerAttendance.slice(0, 5).forEach((att, idx) => {
          console.log(`   ${idx + 1}. Date: ${att.date.toLocaleDateString()}, Status: ${att.status}, Hours: ${att.totalWorkingHours || 0}`);
        });
      } else {
        console.log(`⚠️  No attendance records found for manager. This is normal if manager hasn't punched in/out yet.\n`);
      }
    }

    // Check for any attendance records that might be incorrectly linked
    console.log(`\n🔍 Checking for attendance records with wrong employeeId...`);
    const allAttendance = await Attendance.find({}).populate('employeeId', 'employeeId personalInfo.fullName');
    
    console.log(`Total attendance records in database: ${allAttendance.length}`);
    
    // Find attendance for Ved Pawar
    const vedPawarEmployee = await Employee.findOne({ 'personalInfo.fullName': /Ved Pawar/i });
    if (vedPawarEmployee) {
      console.log(`\n👤 Found Ved Pawar employee: ${vedPawarEmployee._id}`);
      const vedAttendance = await Attendance.find({ employeeId: vedPawarEmployee._id });
      console.log(`   Ved Pawar's attendance records: ${vedAttendance.length}`);
      
      if (vedAttendance.length > 0) {
        console.log(`   Recent records:`);
        vedAttendance.slice(0, 3).forEach((att, idx) => {
          console.log(`     ${idx + 1}. Date: ${att.date.toLocaleDateString()}, Status: ${att.status}`);
        });
      }
    }

    console.log(`\n✅ Check complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkManagerAttendance();

