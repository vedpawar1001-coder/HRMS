/**
 * Script to fix the attendance collection index issue
 * This script will:
 * 1. Drop the old incorrect index (employee_1_date_1)
 * 2. Ensure the correct index (employeeId_1_date_1) exists
 * 
 * Run this script once to fix the database index issue:
 * node fix-attendance-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixAttendanceIndex() {
  try {
    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Get the attendance collection
    const db = mongoose.connection.db;
    const attendanceCollection = db.collection('attendances');

    // List all indexes
    const indexes = await attendanceCollection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach((index, idx) => {
      console.log(`   ${idx + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Check for old incorrect index
    const oldIndex = indexes.find(idx => idx.name === 'employee_1_date_1');
    if (oldIndex) {
      console.log('\n⚠️  Found old incorrect index: employee_1_date_1');
      console.log('   Dropping old index...');
      await attendanceCollection.dropIndex('employee_1_date_1');
      console.log('   ✅ Old index dropped');
    } else {
      console.log('\n✅ No old incorrect index found');
    }

    // Check for correct index
    const correctIndex = indexes.find(idx => idx.name === 'employeeId_1_date_1');
    if (!correctIndex) {
      console.log('\n📝 Creating correct index: employeeId_1_date_1');
      await attendanceCollection.createIndex(
        { employeeId: 1, date: 1 },
        { unique: true, name: 'employeeId_1_date_1' }
      );
      console.log('   ✅ Correct index created');
    } else {
      console.log('\n✅ Correct index already exists');
    }

    // Verify final indexes
    const finalIndexes = await attendanceCollection.indexes();
    console.log('\n📋 Final indexes:');
    finalIndexes.forEach((index, idx) => {
      console.log(`   ${idx + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ Index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing index:', error);
    process.exit(1);
  }
}

// Run the fix
fixAttendanceIndex();

