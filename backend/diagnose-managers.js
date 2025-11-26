const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./models/Employee');

async function diagnoseManagers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all employees
    const allEmployees = await Employee.find().select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department companyDetails.employmentStatus').lean();
    
    console.log(`📊 Total employees in database: ${allEmployees.length}\n`);
    
    if (allEmployees.length === 0) {
      console.log('❌ No employees found in database!');
      process.exit(1);
    }

    console.log('─'.repeat(80));
    console.log('ALL EMPLOYEES:');
    console.log('─'.repeat(80));
    allEmployees.forEach((emp, idx) => {
      console.log(`${idx + 1}. ${emp.personalInfo?.fullName || 'Unknown'}`);
      console.log(`   Employee ID: ${emp.employeeId || 'N/A'}`);
      console.log(`   Email: ${emp.personalInfo?.email || 'N/A'}`);
      console.log(`   Designation: ${emp.companyDetails?.designation || 'NOT SET'}`);
      console.log(`   Department: ${emp.companyDetails?.department || 'NOT SET'}`);
      console.log(`   Status: ${emp.companyDetails?.employmentStatus || 'NOT SET'}`);
      console.log('');
    });

    // Check for managers using the same logic as the endpoint
    const managers = await Employee.find({
      'companyDetails.designation': { $regex: /manager/i },
      'companyDetails.employmentStatus': 'Active'
    })
    .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department companyDetails.employmentStatus')
    .lean()
    .sort({ 'personalInfo.fullName': 1 });

    console.log('─'.repeat(80));
    console.log(`🔍 MANAGERS FOUND (designation contains "manager"): ${managers.length}`);
    console.log('─'.repeat(80));
    
    if (managers.length === 0) {
      console.log('❌ No managers found with designation containing "manager"!\n');
      console.log('💡 SOLUTIONS:');
      console.log('   1. Update employee designations to include "manager"');
      console.log('   2. Run: node backend/ensure-aarti-manager.js');
      console.log('   3. Manually set designation in profile to contain "Manager"');
    } else {
      managers.forEach((manager, idx) => {
        console.log(`${idx + 1}. ${manager.personalInfo?.fullName || 'Unknown'}`);
        console.log(`   Employee ID: ${manager.employeeId || 'N/A'}`);
        console.log(`   Email: ${manager.personalInfo?.email || 'N/A'}`);
        console.log(`   Designation: ${manager.companyDetails?.designation || 'NOT SET'}`);
        console.log(`   Department: ${manager.companyDetails?.department || 'NOT SET'}`);
        console.log('');
      });
    }

    // Also check for employees with "aarti" in name
    const aartiEmployees = await Employee.find({
      'personalInfo.fullName': { $regex: /aarti/i }
    }).select('_id employeeId personalInfo.fullName companyDetails.designation').lean();
    
    if (aartiEmployees.length > 0) {
      console.log('─'.repeat(80));
      console.log('👤 AARTI EMPLOYEE(S) FOUND:');
      console.log('─'.repeat(80));
      aartiEmployees.forEach((emp, idx) => {
        console.log(`${idx + 1}. ${emp.personalInfo?.fullName || 'Unknown'}`);
        console.log(`   Employee ID: ${emp.employeeId || 'N/A'}`);
        console.log(`   Current Designation: ${emp.companyDetails?.designation || 'NOT SET'}`);
        const isManager = emp.companyDetails?.designation?.toLowerCase().includes('manager');
        console.log(`   Is Manager: ${isManager ? '✅ YES' : '❌ NO'}`);
        if (!isManager) {
          console.log(`   ⚠️  To make them a manager, update designation to contain "Manager"`);
        }
        console.log('');
      });
    }

    console.log('─'.repeat(80));
    console.log('✅ Diagnosis Complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseManagers();

