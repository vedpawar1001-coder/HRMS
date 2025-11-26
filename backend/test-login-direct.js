const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLoginDirect() {
  try {
    console.log('🔍 Testing login directly...\n');

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected:', conn.connection.host, '\n');

    const email = 'vedpawar292001@gmail.com';
    const password = 'password123';
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`📧 Testing login for: ${normalizedEmail}\n`);

    // Find user
    console.log('1. Finding user...');
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }
    console.log('✅ User found:', user.email, user.role);

    // Check password
    console.log('\n2. Checking password...');
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.error('❌ Password mismatch!');
      process.exit(1);
    }
    console.log('✅ Password correct');

    // Find employee
    console.log('\n3. Finding employee...');
    let employee = null;
    if (user.employeeId) {
      try {
        const employeeDoc = await Employee.findById(user.employeeId).lean();
        if (employeeDoc) {
          console.log('✅ Employee found:', employeeDoc.employeeId);
          employee = {
            _id: employeeDoc._id.toString(),
            employeeId: employeeDoc.employeeId,
            personalInfo: employeeDoc.personalInfo ? {
              fullName: employeeDoc.personalInfo.fullName || null,
              email: employeeDoc.personalInfo.email || null
            } : null,
            companyDetails: employeeDoc.companyDetails ? {
              department: employeeDoc.companyDetails.department || null,
              designation: employeeDoc.companyDetails.designation || null,
              employmentStatus: employeeDoc.companyDetails.employmentStatus || null
            } : null
          };
          console.log('✅ Employee data prepared');
        } else {
          console.log('⚠️  Employee ID set but employee not found');
        }
      } catch (empError) {
        console.error('❌ Error fetching employee:', empError.message);
        console.error('Stack:', empError.stack);
      }
    } else {
      console.log('⚠️  No employee ID linked to user');
    }

    // Prepare response
    console.log('\n4. Preparing response...');
    const responseData = {
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ? user.employeeId.toString() : null,
      token: 'test-token',
      employee
    };

    console.log('✅ Response data:', JSON.stringify(responseData, null, 2));

    // Try to stringify
    console.log('\n5. Testing JSON serialization...');
    const jsonString = JSON.stringify(responseData);
    console.log('✅ JSON serialization successful');
    console.log('JSON length:', jsonString.length, 'characters');

    console.log('\n✅ All tests passed! Login should work.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

testLoginDirect();

