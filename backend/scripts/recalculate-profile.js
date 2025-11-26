const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('../models/Employee');

async function recalculateProfiles() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Get email from command line args or recalculate all
    const email = process.argv[2];
    
    let employees;
    if (email) {
      employees = await Employee.find({ 'personalInfo.email': email });
      if (employees.length === 0) {
        console.log(`No employee found with email: ${email}`);
        process.exit(1);
      }
    } else {
      employees = await Employee.find({});
      console.log(`Found ${employees.length} employees to recalculate`);
    }

    for (const employee of employees) {
      console.log(`\n=== Employee: ${employee.personalInfo?.email || employee.employeeId} ===`);
      
      // Show current completion
      console.log(`Current completion: ${employee.profileCompletion || 0}%`);
      
      // Show what fields are filled
      const fields = {
        'Full Name': employee.personalInfo?.fullName,
        'Email': employee.personalInfo?.email,
        'Mobile': employee.personalInfo?.mobile,
        'Date of Birth': employee.personalInfo?.dateOfBirth,
        'Gender': employee.personalInfo?.gender,
        'Blood Group': employee.personalInfo?.bloodGroup,
        'Marital Status': employee.personalInfo?.maritalStatus,
        'Emergency Contact Name': employee.personalInfo?.emergencyContact?.name,
        'Emergency Contact Number': employee.personalInfo?.emergencyContact?.number,
        'Address (Permanent or Present)': employee.personalInfo?.address?.permanent?.city || employee.personalInfo?.address?.present?.city,
        'Aadhaar': employee.idProofs?.aadhaar ? 'Yes (encrypted)' : null,
        'PAN': employee.idProofs?.pan ? 'Yes (encrypted)' : null,
        'Department': employee.companyDetails?.department,
        'Designation': employee.companyDetails?.designation,
        'Work Type': employee.companyDetails?.workType,
        'Location': employee.companyDetails?.location,
        'Aadhaar Document': employee.documents?.some(d => d.type === 'Aadhaar'),
        'PAN Document': employee.documents?.some(d => d.type === 'PAN'),
        'Photo Document': employee.documents?.some(d => d.type === 'Photo'),
        'Bank Account': employee.bankDetails?.accountNumber ? 'Yes (encrypted)' : null,
        'IFSC Code': employee.bankDetails?.ifscCode,
        'Bank Name': employee.bankDetails?.bankName,
        'Branch Name': employee.bankDetails?.branchName,
        'Account Holder Name': employee.bankDetails?.accountHolderName
      };
      
      console.log('\nFields status:');
      Object.entries(fields).forEach(([key, value]) => {
        console.log(`  ${key}: ${value ? '✓ Filled' : '✗ Missing'}`);
      });
      
      // Recalculate
      const oldCompletion = employee.profileCompletion || 0;
      employee.calculateProfileCompletion();
      const newCompletion = employee.profileCompletion;
      
      await employee.save();
      
      console.log(`\nCompletion updated: ${oldCompletion}% → ${newCompletion}%`);
      console.log(`Fields completed: ${Math.round((newCompletion / 100) * 24)}/24`);
    }

    console.log('\n✅ Profile recalculation complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

recalculateProfiles();

