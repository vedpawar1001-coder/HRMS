const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Employee = require('./models/Employee');

async function fixDuplicateIssue() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hrmssystem');
    console.log('Connected to MongoDB\n');

    const email = process.argv[2] || 'vedpawar292001@gmail.com';
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`Checking for duplicates for: ${normalizedEmail}\n`);

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.error(`❌ User not found: ${normalizedEmail}`);
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   EmployeeId: ${user.employeeId || 'NOT SET'}\n`);

    // Check for employees with this email
    const employees = await Employee.find({ 
      'personalInfo.email': { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });
    
    console.log(`Found ${employees.length} employee(s) with this email:\n`);
    employees.forEach((emp, idx) => {
      console.log(`${idx + 1}. Employee ID: ${emp._id}`);
      console.log(`   EmployeeId: ${emp.employeeId || 'N/A'}`);
      console.log(`   UserId: ${emp.userId || 'NOT SET'}`);
      console.log(`   Email: ${emp.personalInfo?.email || 'N/A'}\n`);
    });

    // Check if user has employeeId but employee doesn't exist
    if (user.employeeId) {
      const linkedEmployee = await Employee.findById(user.employeeId);
      if (!linkedEmployee) {
        console.log('⚠️  User has employeeId but employee not found. Clearing it...\n');
        user.employeeId = null;
        await user.save();
        console.log('✅ Cleared invalid employeeId from user\n');
      } else {
        console.log('✅ User is linked to valid employee\n');
      }
    }

    // If multiple employees exist, keep the one linked to user, delete others
    if (employees.length > 1) {
      console.log('⚠️  Multiple employees found! Cleaning up...\n');
      const linkedEmployee = employees.find(emp => emp.userId && emp.userId.toString() === user._id.toString());
      
      if (linkedEmployee) {
        console.log(`✅ Keeping employee: ${linkedEmployee._id}`);
        // Delete others
        for (const emp of employees) {
          if (emp._id.toString() !== linkedEmployee._id.toString()) {
            await Employee.findByIdAndDelete(emp._id);
            console.log(`   Deleted duplicate employee: ${emp._id}`);
          }
        }
      } else {
        // Keep the first one and link it
        const keepEmployee = employees[0];
        console.log(`✅ Keeping first employee: ${keepEmployee._id}`);
        keepEmployee.userId = user._id;
        user.employeeId = keepEmployee._id;
        await keepEmployee.save();
        await user.save();
        
        // Delete others
        for (let i = 1; i < employees.length; i++) {
          await Employee.findByIdAndDelete(employees[i]._id);
          console.log(`   Deleted duplicate employee: ${employees[i]._id}`);
        }
      }
      console.log('\n✅ Cleanup complete!\n');
    } else if (employees.length === 1) {
      // Link if not linked
      const employee = employees[0];
      if (!employee.userId || employee.userId.toString() !== user._id.toString()) {
        console.log('🔗 Linking employee to user...\n');
        employee.userId = user._id;
        await employee.save();
      }
      if (!user.employeeId || user.employeeId.toString() !== employee._id.toString()) {
        user.employeeId = employee._id;
        await user.save();
      }
      console.log('✅ Employee linked to user!\n');
    } else {
      console.log('⚠️  No employee found. Profile creation should work now.\n');
    }

    // Check database indexes
    console.log('Checking database indexes...\n');
    const indexes = await Employee.collection.getIndexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Check if employeeCode index exists (old/incorrect index)
    if (indexes.employeeCode_1) {
      console.log('\n⚠️  Found old employeeCode index. Dropping it...\n');
      try {
        await Employee.collection.dropIndex('employeeCode_1');
        console.log('✅ Dropped employeeCode index\n');
      } catch (err) {
        console.log('⚠️  Could not drop index:', err.message);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    process.exit(1);
  }
}

fixDuplicateIssue();

