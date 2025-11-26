const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, personalInfo, companyDetails } = req.body;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists. Please login or use a different email.' });
    }

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Create employee profile (always create for employees/managers)
    let employee = null;
    const userRole = role || 'employee';
    
    // Always create employee profile for employees/managers
    if (userRole === 'employee' || userRole === 'manager') {
      try {
        // IMPORTANT: Use name from sign-up form (personalInfo.fullName)
        let fullName = 'Employee';
        if (personalInfo && personalInfo.fullName && personalInfo.fullName.trim()) {
          fullName = personalInfo.fullName.trim();
          console.log(`[REGISTER] ✅ Using fullName from sign-up form: "${fullName}"`);
        } else {
          // Fallback: generate from email (should rarely happen if sign-up form is correct)
          const emailPrefix = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
          fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) || 'Employee';
          console.log(`[REGISTER] ⚠️ WARNING: No fullName provided, generated from email: "${fullName}"`);
        }
        
        // Generate unique employee ID before creating employee
        const year = new Date().getFullYear();
        const employeesWithId = await Employee.find({
          employeeId: { $regex: new RegExp(`^EMP-${year}-`) }
        }).select('employeeId').sort({ employeeId: -1 }).limit(1);
        
        let count = 0;
        if (employeesWithId.length > 0 && employeesWithId[0].employeeId) {
          const match = employeesWithId[0].employeeId.match(/-(\d+)$/);
          if (match) {
            count = parseInt(match[1], 10);
          }
        } else {
          count = await Employee.countDocuments();
        }
        
        // Generate unique employee ID
        let generatedEmployeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
        
        // Ensure uniqueness
        let exists = await Employee.findOne({ employeeId: generatedEmployeeId });
        let attempts = 0;
        while (exists && attempts < 100) {
          count++;
          generatedEmployeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
          exists = await Employee.findOne({ employeeId: generatedEmployeeId });
          attempts++;
        }
        
        console.log(`[REGISTER] Generated unique employeeId: ${generatedEmployeeId}`);
        
        // Create employee profile with the name from sign-up form
        // Extract fullName from personalInfo to ensure it's used
        const { fullName: _, ...otherPersonalInfo } = personalInfo || {};
        employee = await Employee.create({
          employeeId: generatedEmployeeId, // Explicitly set employeeId to ensure it's generated
          personalInfo: {
            fullName: fullName, // This is the name from sign-up form "Full Name" field
            email: normalizedEmail,
            ...otherPersonalInfo // Include any other personalInfo fields (excluding fullName to avoid conflicts)
          },
          companyDetails: {
            joiningDate: new Date(),
            department: companyDetails?.department || 'General',
            designation: companyDetails?.designation || (userRole === 'manager' ? 'Manager' : 'Employee'),
            employmentStatus: companyDetails?.employmentStatus || 'Active',
            ...(companyDetails || {}) // Include any other companyDetails provided
          }
        });
        
        // Verify employeeId was set
        if (!employee.employeeId) {
          console.error('[REGISTER] ⚠️ WARNING: Employee created but employeeId is missing!');
          // Try to generate and set it
          const year = new Date().getFullYear();
          const timestamp = Date.now().toString().slice(-6);
          employee.employeeId = `EMP-${year}-${timestamp}`;
          await employee.save();
        }
        
        console.log(`[REGISTER] ✅ Created employee profile - fullName: "${employee.personalInfo.fullName}", employeeId: ${employee.employeeId}`);
      } catch (error) {
        console.error('[REGISTER] Error creating employee profile:', error);
        // Employee profile will be created on first attendance punch
      }
    }
    
    // Calculate profile completion if employee created
    if (employee) {
      employee.calculateProfileCompletion();
      await employee.save();
    }

    // Create user
    const user = await User.create({
      email: normalizedEmail,
      password,
      role: userRole,
      employeeId: employee ? employee._id : null
    });

    // Link user to employee
    if (employee) {
      employee.userId = user._id;
      await employee.save();
    }

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      employeeId: employee?._id,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  // Log the request to help debug
  console.log('[LOGIN] ===== LOGIN REQUEST RECEIVED =====');
  
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Normalize email to lowercase for consistency
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[LOGIN] Attempting login for: ${normalizedEmail}`);

    // Check for user (email is already lowercase in schema, but ensure consistency)
    let user;
    try {
      user = await User.findOne({ email: normalizedEmail }).select('+password');
    } catch (dbError) {
      console.error('[LOGIN] Database error finding user:', dbError);
      return res.status(500).json({ message: 'Database error. Please try again.', error: dbError.message });
    }

    if (!user) {
      console.log(`[LOGIN] User not found: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[LOGIN] User found: ${user.email}, Role: ${user.role}, Active: ${user.isActive !== undefined ? user.isActive : 'true (default)'}`);

    // Check if user is active
    if (user.isActive === false) {
      console.log(`[LOGIN] Account is deactivated for: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Account is deactivated. Please contact HR.' });
    }

    // Check if password exists and is valid
    if (!user.password) {
      console.error(`[LOGIN] Password is null/undefined for: ${normalizedEmail}`);
      return res.status(500).json({ message: 'Account error. Please reset your password.' });
    }

    // Check password
    let isMatch;
    try {
      isMatch = await user.matchPassword(password);
    } catch (passwordError) {
      console.error('[LOGIN] Password matching error:', passwordError);
      return res.status(500).json({ message: 'Password verification failed. Please try again or reset your password.', error: passwordError.message });
    }

    if (!isMatch) {
      console.log(`[LOGIN] Password mismatch for: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[LOGIN] ✅ Password verified for: ${normalizedEmail}`);

    // Update last login
    try {
      user.lastLogin = new Date();
      await user.save();
    } catch (saveError) {
      console.error('[LOGIN] Error saving last login:', saveError);
      // Continue even if this fails
    }

    // Generate token
    let token;
    try {
      token = generateToken(user._id);
    } catch (tokenError) {
      console.error('[LOGIN] Token generation error:', tokenError);
      return res.status(500).json({ message: 'Token generation failed. Please check server configuration.', error: tokenError.message });
    }

    // Fetch employee data if exists (limit fields to avoid serialization issues)
    // NOTE: Making this optional - if it fails, we still proceed with login
    let employee = null;
    if (user.employeeId) {
      try {
        console.log('[LOGIN] Attempting to fetch employee:', user.employeeId.toString());
        const employeeDoc = await Employee.findById(user.employeeId).lean();
        if (employeeDoc) {
          console.log('[LOGIN] Employee document found, preparing data...');
          // Return only essential employee fields to avoid serialization issues
          try {
            employee = {
              _id: employeeDoc._id ? employeeDoc._id.toString() : null,
              employeeId: employeeDoc.employeeId || null,
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
            console.log('[LOGIN] Employee data prepared successfully');
          } catch (dataError) {
            console.error('[LOGIN] Error preparing employee data:', dataError);
            employee = null; // Set to null if there's an error
          }
        } else {
          console.log('[LOGIN] Employee ID exists but employee not found in database');
        }
      } catch (empError) {
        console.error('[LOGIN] Error fetching employee:', empError);
        console.error('[LOGIN] Employee error details:', {
          message: empError.message,
          name: empError.name,
          stack: empError.stack
        });
        // Continue without employee data - this is not critical for login
        employee = null;
      }
    } else {
      console.log('[LOGIN] No employee ID linked to user');
    }

    console.log(`[LOGIN] ✅ Login successful for: ${normalizedEmail}`);

    // Prepare response object with properly serialized IDs
    let responseData;
    try {
      responseData = {
        _id: user._id ? user._id.toString() : null,
        email: user.email || normalizedEmail,
        role: user.role || 'employee',
        employeeId: user.employeeId ? user.employeeId.toString() : null,
        token: token || null
      };

      // Only include employee if it was successfully fetched
      if (employee && typeof employee === 'object') {
        responseData.employee = employee;
      }

      console.log('[LOGIN] Response data prepared:', {
        _id: responseData._id,
        email: responseData.email,
        role: responseData.role,
        hasEmployee: !!responseData.employee,
        hasToken: !!responseData.token
      });

      // Validate response can be stringified
      JSON.stringify(responseData);
      console.log('[LOGIN] Response data validated (JSON.stringify successful)');
    } catch (prepError) {
      console.error('[LOGIN] Error preparing response data:', prepError);
      // Fallback to minimal response
      responseData = {
        _id: user._id ? user._id.toString() : null,
        email: user.email || normalizedEmail,
        role: user.role || 'employee',
        employeeId: user.employeeId ? user.employeeId.toString() : null,
        token: token || null
      };
    }

    // Send response
    if (!res.headersSent) {
      res.json(responseData);
      console.log('[LOGIN] ✅ Response sent successfully');
    }
  } catch (error) {
    console.error('[LOGIN] ===== UNEXPECTED ERROR =====');
    console.error('[LOGIN] Error type:', error.constructor.name);
    console.error('[LOGIN] Error message:', error.message);
    console.error('[LOGIN] Error stack:', error.stack);
    console.error('[LOGIN] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    });
    console.error('[LOGIN] ============================');
    
    // Ensure we always send a response, even if there's an error
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Server error during login', 
        error: error.message || 'Unknown error'
      });
    }
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset user password (for fixing corrupted passwords)
// @access  Public (should be protected in production)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Please provide email and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/auth/delete-user
// @desc    Delete user (for testing/fixing issues)
// @access  Public (should be protected in production)
router.delete('/delete-user', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide email' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated employee if exists
    if (user.employeeId) {
      await Employee.findByIdAndDelete(user.employeeId);
    }

    // Delete user
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let employee = null;
    
    if (user && user.employeeId) {
      try {
        const employeeDoc = await Employee.findById(user.employeeId).lean();
        if (employeeDoc) {
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
        }
      } catch (empError) {
        console.error('[AUTH/ME] Error fetching employee:', empError);
        // Continue without employee data
      }
    }

    res.json({
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ? user.employeeId.toString() : null,
      employee
    });
  } catch (error) {
    console.error('[AUTH/ME] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
