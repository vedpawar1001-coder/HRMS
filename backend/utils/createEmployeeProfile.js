const Employee = require('../models/Employee');
const User = require('../models/User');

/**
 * Create or get employee profile for a user
 */
async function createOrGetEmployeeProfile(user) {
  try {
    console.log(`[CREATE_PROFILE] Starting for user: ${user.email}, employeeId: ${user.employeeId}`);
    
    // Check if user already has employee profile
    if (user.employeeId) {
      const existingEmployee = await Employee.findById(user.employeeId);
      if (existingEmployee) {
        console.log(`[CREATE_PROFILE] Employee profile already exists: ${existingEmployee._id}`);
        return existingEmployee;
      } else {
        console.log(`[CREATE_PROFILE] User has employeeId ${user.employeeId} but employee not found, will create new`);
      }
    }

    // Check if employee exists with this email (case-insensitive)
    const normalizedEmail = user.email.toLowerCase().trim();
    let employee = await Employee.findOne({ 
      'personalInfo.email': { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });
    
    if (employee) {
      console.log(`[CREATE_PROFILE] Found existing employee with email: ${employee._id}`);
      // Link to user if not already linked
      if (!user.employeeId || user.employeeId.toString() !== employee._id.toString()) {
        await User.findByIdAndUpdate(user._id, { employeeId: employee._id });
        console.log(`[CREATE_PROFILE] Linked existing employee ${employee._id} to user ${user._id}`);
      }
      // Also link user to employee
      if (!employee.userId || employee.userId.toString() !== user._id.toString()) {
        employee.userId = user._id;
        await employee.save();
      }
      return employee;
    }

    // Create new employee profile
    // Try to preserve any existing name if profile was created during registration
    // But since this is auto-creation, generate from email (fallback)
    const emailPrefix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) || 'Employee';
    
    console.log(`[CREATE_PROFILE] Creating new employee profile for: ${normalizedEmail} with name: ${fullName}`);
    
    try {
      // Generate employeeId manually before creating
      const year = new Date().getFullYear();
      let count = await Employee.countDocuments();
      let employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
      
      // Check if employeeId already exists and increment if needed
      let exists = await Employee.findOne({ employeeId });
      let attempts = 0;
      while (exists && attempts < 10) {
        count++;
        employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
        exists = await Employee.findOne({ employeeId });
        attempts++;
      }
      
      // Create employee with employeeId set
      employee = new Employee({
        employeeId: employeeId, // Set manually to satisfy required constraint
        userId: user._id, // Set userId first to avoid unique constraint issues
        personalInfo: {
          fullName: fullName,
          email: normalizedEmail
        },
        companyDetails: {
          joiningDate: new Date(),
          department: 'General',
          designation: user.role === 'manager' ? 'Manager' : 'Employee',
          employmentStatus: 'Active'
        }
      });
      
      // Save employee
      await employee.save();
      console.log(`[CREATE_PROFILE] Created new employee profile: ${employee._id}, employeeId: ${employee.employeeId}`);

      // Link employee to user
      await User.findByIdAndUpdate(user._id, { employeeId: employee._id });
      console.log(`[CREATE_PROFILE] Linked employee ${employee._id} to user ${user._id}`);

      // Calculate profile completion
      employee.calculateProfileCompletion();
      await employee.save();

      return employee;
    } catch (createError) {
      console.error('[CREATE_PROFILE] Error during Employee.create:', createError);
      
      // If duplicate error, try to find and link existing employee
      if (createError.code === 11000) {
        console.log('[CREATE_PROFILE] Duplicate key error detected, searching for existing employee...');
        console.log('[CREATE_PROFILE] Duplicate field:', createError.keyPattern ? Object.keys(createError.keyPattern).join(', ') : 'unknown');
        
        // Try to find by email first
        let existing = await Employee.findOne({ 'personalInfo.email': normalizedEmail });
        
        // If not found by email, try by userId
        if (!existing && user._id) {
          existing = await Employee.findOne({ userId: user._id });
        }
        
        // If still not found, try by employeeId if provided in error
        if (!existing && createError.keyValue?.employeeId) {
          existing = await Employee.findOne({ employeeId: createError.keyValue.employeeId });
        }
        
        if (existing) {
          console.log(`[CREATE_PROFILE] Found existing employee: ${existing._id}, linking...`);
          await User.findByIdAndUpdate(user._id, { employeeId: existing._id });
          if (!existing.userId || existing.userId.toString() !== user._id.toString()) {
            existing.userId = user._id;
            await existing.save();
          }
          console.log(`[CREATE_PROFILE] Successfully linked to existing employee: ${existing._id}`);
          return existing;
        } else {
          console.error('[CREATE_PROFILE] Duplicate error but could not find existing employee');
          // If it's an employeeCode error, it might be a database index issue
          if (createError.keyPattern?.employeeCode) {
            console.error('[CREATE_PROFILE] employeeCode duplicate - this should not happen, checking database...');
            // Employee profile might exist but query failed, try one more time
            const allEmployees = await Employee.find({ 'personalInfo.email': { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } });
            if (allEmployees.length > 0) {
              existing = allEmployees[0];
              await User.findByIdAndUpdate(user._id, { employeeId: existing._id });
              existing.userId = user._id;
              await existing.save();
              console.log(`[CREATE_PROFILE] Found and linked employee after retry: ${existing._id}`);
              return existing;
            }
          }
        }
      }
      throw createError;
    }
  } catch (error) {
    console.error('[CREATE_PROFILE] Error creating/getting employee profile:', error);
    console.error('[CREATE_PROFILE] Error details:', {
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    throw error;
  }
}

module.exports = { createOrGetEmployeeProfile };

