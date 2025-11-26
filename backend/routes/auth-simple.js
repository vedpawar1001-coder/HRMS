const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/login
// @desc    Login user - SIMPLIFIED VERSION
// @access  Public
router.post('/login', async (req, res) => {
  console.log('[LOGIN] Request received');
  
  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    console.log('[LOGIN] Processing login for:', normalizedEmail);

    // Find user
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      console.log('[LOGIN] User not found');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('[LOGIN] User found');

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('[LOGIN] Password mismatch');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('[LOGIN] Password verified');

    // Generate token
    const token = generateToken(user._id);

    // Build minimal response first
    const response = {
      _id: String(user._id),
      email: user.email,
      role: user.role,
      token: token
    };

    // Try to add employee data (optional)
    if (user.employeeId) {
      try {
        const employeeDoc = await Employee.findById(user.employeeId).lean();
        if (employeeDoc) {
          response.employeeId = String(user.employeeId);
          response.employee = {
            _id: String(employeeDoc._id),
            employeeId: employeeDoc.employeeId,
            personalInfo: {
              fullName: employeeDoc.personalInfo?.fullName || null,
              email: employeeDoc.personalInfo?.email || null
            }
          };
        }
      } catch (empErr) {
        console.error('[LOGIN] Error fetching employee (non-critical):', empErr.message);
        // Continue without employee data
      }
    }

    console.log('[LOGIN] Sending success response');
    res.json(response);
    
  } catch (error) {
    console.error('[LOGIN] ERROR:', error.message);
    console.error('[LOGIN] STACK:', error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Server error during login',
        error: error.message 
      });
    }
  }
});

module.exports = router;

