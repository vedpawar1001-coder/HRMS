const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./models/Employee');

async function checkManagers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check all employees
    const allEmployees = await Employee.find().select('personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.employmentStatus employeeId').lean();
    
    console.log(`📋 Total employees in database: ${allEmployees.length}\n`);
    
    // Find employees with manager in designation
    const managers = allEmployees.filter(emp => {
      const designation = emp.companyDetails?.designation?.toLowerCase() || '';
      return designation.includes('manager');
    });
    
    console.log(`👔 Employees with 'manager' in designation: ${managers.length}\n`);
    
    if (managers.length === 0) {
      console.log('❌ No managers found!\n');
      console.log('📋 All employees and their designations:');
      allEmployees.forEach(emp => {
        console.log(`  - ${emp.personalInfo?.fullName || 'Unknown'}: "${emp.companyDetails?.designation || 'NO DESIGNATION'}" (${emp.employeeId || emp._id})`);
      });
    } else {
      console.log('✅ Managers found:');
      managers.forEach(manager => {
        console.log(`  - ${manager.personalInfo?.fullName || 'Unknown'}: "${manager.companyDetails?.designation}" (Status: ${manager.companyDetails?.employmentStatus || 'Unknown'})`);
      });
    }
    
    // Check Aarti specifically
    console.log('\n🔍 Searching for Aarti:');
    const aarti = allEmployees.find(emp => 
      (emp.personalInfo?.fullName || '').toLowerCase().includes('aarti')
    );
    
    if (aarti) {
      console.log(`  ✅ Found: ${aarti.personalInfo?.fullName}`);
      console.log(`     Designation: "${aarti.companyDetails?.designation || 'NO DESIGNATION'}"`);
      console.log(`     Status: ${aarti.companyDetails?.employmentStatus || 'Unknown'}`);
      console.log(`     Employee ID: ${aarti.employeeId || aarti._id}`);
    } else {
      console.log('  ❌ Aarti not found in database');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkManagers();

