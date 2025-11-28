const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Leave = require('../models/Leave');
const { notifyRunningOutOfTime, notifyShortHours } = require('../utils/notifications');
const { createOrGetEmployeeProfile } = require('../utils/createEmployeeProfile');
const { getCityName } = require('../utils/geocoding');
const router = express.Router();

// Punch window constants
const PUNCH_IN_START = { hour: 10, minute: 0 }; // 10:00 AM
const PUNCH_IN_END = { hour: 10, minute: 15 }; // 10:15 AM
const LATE_ENTRY_WINDOW_START = { hour: 10, minute: 15 }; // 10:15 AM - Start of late entry window
const LATE_ENTRY_WINDOW_END = { hour: 10, minute: 35 }; // 10:35 AM - End of late entry window
const PUNCH_OUT_START = { hour: 18, minute: 55 }; // 6:55 PM
const PUNCH_OUT_END = { hour: 19, minute: 5 }; // 7:05 PM

// Helper function to check if time is within window
function isTimeInWindow(currentTime, startTime, endTime) {
  const current = new Date(currentTime);
  const start = new Date(current);
  start.setHours(startTime.hour, startTime.minute, 0, 0);
  const end = new Date(current);
  end.setHours(endTime.hour, endTime.minute, 0, 0);
  
  return current >= start && current <= end;
}

// Helper function to check if time is after window
function isAfterWindow(currentTime, windowEnd) {
  const current = new Date(currentTime);
  const end = new Date(current);
  end.setHours(windowEnd.hour, windowEnd.minute, 0, 0);
  return current > end;
}

// Helper function to check if time is before window
function isBeforeWindow(currentTime, windowStart) {
  const current = new Date(currentTime);
  const start = new Date(current);
  start.setHours(windowStart.hour, windowStart.minute, 0, 0);
  return current < start;
}

// @route   POST /api/attendance/punch
// @desc    Punch in/out with validation
// @access  Private
router.post('/punch', protect, async (req, res) => {
  try {
    // Validate user object exists
    if (!req.user) {
      console.error('[ATTENDANCE/PUNCH] No user object found in request');
      return res.status(401).json({ 
        message: 'User not authenticated. Please login again.',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Auto-create employee profile if it doesn't exist (for employees, managers, and HR)
    if (!req.user.employeeId && (req.user.role === 'employee' || req.user.role === 'manager' || req.user.role === 'hr')) {
      console.log(`[ATTENDANCE/PUNCH] Auto-creating employee profile for user: ${req.user.email}, role: ${req.user.role}`);
      try {
        // Get fresh user from database to ensure we have the latest data
        let freshUser = await User.findById(req.user._id);
        if (!freshUser) {
          return res.status(401).json({ 
            message: 'User session expired. Please login again.',
            error: 'USER_NOT_FOUND'
          });
        }
        
        // For HR users, check if they have an HR profile and use that data
        if (freshUser.role === 'hr') {
          const HR = require('../models/HR');
          const hrProfile = await HR.findOne({ userId: freshUser._id });
          
          if (hrProfile) {
            console.log(`[ATTENDANCE/PUNCH] HR profile found, creating Employee profile from HR data`);
            
            // Check if employee already exists with this email
            const normalizedEmail = freshUser.email.toLowerCase().trim();
            let employee = await Employee.findOne({ 
              'personalInfo.email': { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
            });
            
            if (!employee) {
              // Create employee profile from HR profile data
              const year = new Date().getFullYear();
              let count = await Employee.countDocuments();
              let employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
              
              // Check if employeeId already exists
              let exists = await Employee.findOne({ employeeId });
              let attempts = 0;
              while (exists && attempts < 10) {
                count++;
                employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
                exists = await Employee.findOne({ employeeId });
                attempts++;
              }
              
              employee = new Employee({
                employeeId: employeeId,
                userId: freshUser._id,
                personalInfo: {
                  fullName: hrProfile.personalInfo?.fullName || freshUser.email.split('@')[0],
                  email: hrProfile.personalInfo?.email || normalizedEmail,
                  mobile: hrProfile.personalInfo?.mobile,
                  dateOfBirth: hrProfile.personalInfo?.dateOfBirth,
                  gender: hrProfile.personalInfo?.gender,
                  bloodGroup: hrProfile.personalInfo?.bloodGroup,
                  maritalStatus: hrProfile.personalInfo?.maritalStatus,
                  address: hrProfile.personalInfo?.address
                },
                companyDetails: {
                  joiningDate: hrProfile.companyDetails?.joiningDate || new Date(),
                  department: hrProfile.companyDetails?.department || 'Human Resources',
                  designation: hrProfile.companyDetails?.designation || 'HR',
                  workType: hrProfile.companyDetails?.workType || 'WFO',
                  location: hrProfile.companyDetails?.location,
                  employmentStatus: hrProfile.companyDetails?.employmentStatus || 'Active'
                },
                bankDetails: hrProfile.bankDetails || {}
              });
              
              await employee.save();
              console.log(`[ATTENDANCE/PUNCH] Created Employee profile from HR profile: ${employee._id}`);
            }
            
            // Link employee to user
            if (!freshUser.employeeId || freshUser.employeeId.toString() !== employee._id.toString()) {
              await User.findByIdAndUpdate(freshUser._id, { employeeId: employee._id });
              console.log(`[ATTENDANCE/PUNCH] Linked Employee profile ${employee._id} to HR user ${freshUser._id}`);
            }
            
            // Refresh user to get updated employeeId
            freshUser = await User.findById(req.user._id);
            req.user = freshUser;
          } else {
            // No HR profile, use standard creation
            await createOrGetEmployeeProfile(freshUser);
            freshUser = await User.findById(req.user._id);
            req.user = freshUser;
          }
        } else {
          // For employees and managers, use standard creation
          await createOrGetEmployeeProfile(freshUser);
          
          // Refresh user object again to get updated employeeId
          freshUser = await User.findById(req.user._id);
          if (!freshUser) {
            return res.status(401).json({ 
              message: 'User session expired. Please login again.',
              error: 'USER_NOT_FOUND'
            });
          }
          
          // Update req.user with fresh data
          req.user = freshUser;
        }
        
        console.log(`[ATTENDANCE/PUNCH] Employee profile ready: ${req.user.employeeId}`);
        
        // Double-check employeeId is set
        if (!req.user.employeeId) {
          console.error('[ATTENDANCE/PUNCH] Employee profile created but employeeId not set in user');
          return res.status(500).json({ 
            message: 'Employee profile created but failed to link. Please refresh and try again.',
            error: 'EMPLOYEE_ID_NOT_SET'
          });
        }
      } catch (error) {
        console.error('[ATTENDANCE/PUNCH] Error creating employee profile:', error);
        console.error('[ATTENDANCE/PUNCH] Error stack:', error.stack);
        return res.status(500).json({ 
          message: 'Unable to create employee profile. Please contact HR.', 
          error: error.message
        });
      }
    }
    
    // Final check - ensure employeeId exists
    if (!req.user.employeeId) {
      console.error('[ATTENDANCE/PUNCH] No employeeId found for user:', req.user.email, req.user.role);
      return res.status(400).json({ 
        message: 'Employee profile not found. Please contact HR to create your profile.',
        error: 'NO_EMPLOYEE_PROFILE'
      });
    }
    
    const { punchType, location } = req.body;
    const currentTime = new Date();
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    
    // Validate location
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ message: 'Location is required for attendance' });
    }
    
    // Validate punchType
    if (!punchType || !['Punch In', 'Punch Out'].includes(punchType)) {
      return res.status(400).json({ message: 'Invalid punch type. Must be "Punch In" or "Punch Out"' });
    }
    
    // Ensure employeeId is valid ObjectId
    let employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ 
        message: 'Employee profile not found. Please contact HR to create your profile.',
        error: 'NO_EMPLOYEE_PROFILE'
      });
    }
    
    // Convert employeeId to ObjectId if it's a string
    if (typeof employeeId === 'string' && mongoose.Types.ObjectId.isValid(employeeId)) {
      employeeId = new mongoose.Types.ObjectId(employeeId);
    } else if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      console.error('[ATTENDANCE/PUNCH] Invalid employeeId format:', employeeId);
      return res.status(400).json({ 
        message: 'Invalid employee ID format. Please contact HR.',
        error: 'INVALID_EMPLOYEE_ID'
      });
    }
    
    // Verify employee exists
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        console.error(`[ATTENDANCE/PUNCH] Employee not found for employeeId: ${employeeId}`);
        return res.status(404).json({ 
          message: 'Employee profile not found. Please contact HR.',
          error: 'EMPLOYEE_NOT_FOUND'
        });
      }
      console.log(`[ATTENDANCE/PUNCH] Employee verified: ${employee.employeeId || employee._id}`);
    } catch (error) {
      console.error('[ATTENDANCE/PUNCH] Error verifying employee:', error);
      return res.status(500).json({ 
        message: 'Failed to verify employee profile. Please try again.',
        error: error.message
      });
    }
    
    // Find or create today's attendance
    let attendance;
    try {
      console.log(`[ATTENDANCE/PUNCH] Searching for attendance - employeeId: ${employeeId}, date: ${today.toISOString()}`);
      
      attendance = await Attendance.findOne({
        employeeId: employeeId,
        date: today
      });
      
      if (!attendance) {
        console.log(`[ATTENDANCE/PUNCH] No existing attendance found, creating new record...`);
        try {
          // Use findOneAndUpdate with upsert for atomic operation (prevents race conditions)
          attendance = await Attendance.findOneAndUpdate(
            {
              employeeId: employeeId,
              date: today
            },
            {
              $setOnInsert: {
                employeeId: employeeId,
                date: today,
                punches: [],
                status: 'Absent',
                totalWorkingHours: 0
              }
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true
            }
          );
          console.log(`[ATTENDANCE/PUNCH] ✅ Created/found attendance record for employee: ${employeeId}, _id: ${attendance._id}`);
        } catch (createError) {
          // Handle duplicate key error - record might have been created by another request
          if (createError.code === 11000) {
            console.log(`[ATTENDANCE/PUNCH] Duplicate key error detected, fetching existing record...`);
            // Try to find the record again (might have been created by concurrent request)
            attendance = await Attendance.findOne({
              employeeId: employeeId,
              date: today
            });
            if (attendance) {
              console.log(`[ATTENDANCE/PUNCH] ✅ Found existing attendance record after duplicate error: ${attendance._id}`);
            } else {
              // If still not found, there might be an index issue - try to find by date range
              const startOfDay = new Date(today);
              startOfDay.setHours(0, 0, 0, 0);
              const endOfDay = new Date(today);
              endOfDay.setHours(23, 59, 59, 999);
              
              attendance = await Attendance.findOne({
                employeeId: employeeId,
                date: { $gte: startOfDay, $lte: endOfDay }
              });
              
              if (attendance) {
                console.log(`[ATTENDANCE/PUNCH] ✅ Found attendance record using date range: ${attendance._id}`);
              } else {
                throw createError; // Re-throw if we still can't find it
              }
            }
          } else {
            throw createError; // Re-throw if it's not a duplicate key error
          }
        }
      } else {
        console.log(`[ATTENDANCE/PUNCH] ✅ Found existing attendance record for employee: ${employeeId}, _id: ${attendance._id}`);
      }
      
      // Verify employeeId is set correctly (fix if null)
      if (!attendance.employeeId || attendance.employeeId.toString() !== employeeId.toString()) {
        console.warn(`[ATTENDANCE/PUNCH] ⚠️ EmployeeId mismatch or null! Expected: ${employeeId}, Got: ${attendance.employeeId}`);
        console.warn(`[ATTENDANCE/PUNCH] Fixing employeeId...`);
        attendance.employeeId = employeeId;
        try {
          await attendance.save();
          console.log(`[ATTENDANCE/PUNCH] ✅ Fixed employeeId in attendance record`);
        } catch (saveError) {
          console.error(`[ATTENDANCE/PUNCH] Error fixing employeeId:`, saveError);
          // Continue anyway - the employeeId should be correct now
        }
      }
    } catch (error) {
      console.error('[ATTENDANCE/PUNCH] ❌ Error finding/creating attendance:', error);
      console.error('[ATTENDANCE/PUNCH] Error details:', {
        employeeId: employeeId,
        employeeIdType: typeof employeeId,
        date: today,
        dateType: typeof today,
        errorMessage: error.message,
        errorCode: error.code,
        errorName: error.name,
        errorStack: error.stack
      });
      return res.status(500).json({ 
        message: 'Failed to access attendance record. Please try again.',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    // Validate punch sequence
    const lastPunch = attendance.punches.length > 0 
      ? attendance.punches[attendance.punches.length - 1] 
      : null;
    
    if (punchType === 'Punch In') {
      // Validate: Can't punch in if last punch was also punch in (unless different day)
      if (lastPunch && lastPunch.punchType === 'Punch In') {
        const lastPunchDate = new Date(lastPunch.time);
        const isSameDay = lastPunchDate.toDateString() === currentTime.toDateString();
        
        if (isSameDay) {
          return res.status(400).json({ 
            message: 'You are already punched in. Please punch out first.' 
          });
        }
      }
      
      // Check first punch in window (10:00 AM - 10:15 AM)
      if (!lastPunch || attendance.punches.filter(p => p.punchType === 'Punch In').length === 0) {
        // First punch in of the day
        // Late entry warning only shows if punch in is between 10:15 AM and 10:35 AM
        const lateWindowStart = new Date(currentTime);
        lateWindowStart.setHours(LATE_ENTRY_WINDOW_START.hour, LATE_ENTRY_WINDOW_START.minute, 0, 0);
        
        const lateWindowEnd = new Date(currentTime);
        lateWindowEnd.setHours(LATE_ENTRY_WINDOW_END.hour, LATE_ENTRY_WINDOW_END.minute, 0, 0);
        
        // Only set isLateEntry if punch time is between 10:15 AM and 10:35 AM
        if (currentTime >= lateWindowStart && currentTime <= lateWindowEnd) {
          attendance.isLateEntry = true;
          console.log(`[ATTENDANCE/PUNCH] Late entry detected: ${currentTime.toLocaleTimeString()} (between 10:15 AM - 10:35 AM)`);
        } else {
          attendance.isLateEntry = false;
        }
      }
    } else if (punchType === 'Punch Out') {
      // Validate: Must have a punch in before punch out
      if (!lastPunch || lastPunch.punchType === 'Punch Out') {
        return res.status(400).json({ 
          message: 'Cannot punch out without punching in first' 
        });
      }
    }
    
    // Convert coordinates to city name using reverse geocoding
    let cityName = `Location (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
    try {
      cityName = await getCityName(location.latitude, location.longitude);
      console.log(`[ATTENDANCE] Location converted: ${location.latitude}, ${location.longitude} -> ${cityName}`);
    } catch (error) {
      console.error('[ATTENDANCE] Error converting location to city name:', error.message);
      // Continue with fallback location format
    }
    
    // Add punch record with both coordinates and city name
    attendance.punches.push({
      punchType,
      time: currentTime,
      location: cityName, // Store city name as primary location
      locationName: cityName, // Also store as locationName for clarity
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      device: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    });
    
    // Calculate working hours and status
    try {
      attendance.calculateWorkingHours();
    } catch (error) {
      console.error('[ATTENDANCE/PUNCH] Error calculating working hours:', error);
      // Continue even if calculation fails, but log the error
    }
    
    // Check if notifications need to be sent (wrap in try-catch to prevent breaking the flow)
    const hoursWorked = attendance.totalWorkingHours || 0;
    const lastPunchAfterAdd = attendance.punches[attendance.punches.length - 1];
    const isDayEnded = lastPunchAfterAdd && lastPunchAfterAdd.punchType === 'Punch Out';
    
    // Notify if running out of time (less than 9 hours and day not ended)
    if (!isDayEnded && hoursWorked > 0 && hoursWorked < 9 && !attendance.notificationsSent.runningOutOfTime) {
      try {
        await notifyRunningOutOfTime(attendance);
        attendance.notificationsSent.runningOutOfTime = true;
      } catch (error) {
        console.error('[ATTENDANCE/PUNCH] Error sending running out of time notification:', error);
        // Continue even if notification fails
      }
    }
    
    // Notify if short hours at end of day
    if (isDayEnded && hoursWorked < 9 && !attendance.notificationsSent.shortHours) {
      try {
        await notifyShortHours(attendance);
        attendance.notificationsSent.shortHours = true;
      } catch (error) {
        console.error('[ATTENDANCE/PUNCH] Error sending short hours notification:', error);
        // Continue even if notification fails
      }
    }
    
    // Save attendance record
    try {
      console.log(`[ATTENDANCE/PUNCH] Saving attendance record with ${attendance.punches.length} punches...`);
      await attendance.save();
      console.log(`[ATTENDANCE/PUNCH] ✅ Attendance saved successfully for employee: ${employeeId}, record ID: ${attendance._id}`);
      console.log(`[ATTENDANCE/PUNCH] Punch details:`, {
        punchType: punchType,
        time: currentTime,
        location: cityName,
        coordinates: { lat: location.latitude, lng: location.longitude }
      });
    } catch (error) {
      console.error('[ATTENDANCE/PUNCH] ❌ Error saving attendance:', error);
      console.error('[ATTENDANCE/PUNCH] Save error details:', {
        errorMessage: error.message,
        errorCode: error.code,
        errorName: error.name,
        errorStack: error.stack,
        attendanceId: attendance._id,
        employeeId: employeeId
      });
      return res.status(500).json({ 
        message: 'Failed to save attendance record. Please try again.',
        error: error.message
      });
    }
    
    // Ensure attendance exists before processing
    if (!attendance) {
      console.error('[ATTENDANCE/PUNCH] Attendance record is null after save');
      return res.status(500).json({ 
        message: 'Failed to retrieve attendance record after saving.',
        error: 'ATTENDANCE_NULL'
      });
    }
    
    // Sort punches to determine last punch correctly for response
    const punches = attendance.punches || [];
    const sortedPunchesForResponse = punches.length > 0
      ? [...punches].sort((a, b) => new Date(a.time) - new Date(b.time))
      : []
    const lastPunchForResponse = sortedPunchesForResponse.length > 0 
      ? sortedPunchesForResponse[sortedPunchesForResponse.length - 1] 
      : null
    
    // Prepare response with status info
    // Only return flags if they are relevant to the current punch state
    // Reuse hoursWorked from above (already declared for notifications)
    const hoursRemaining = Math.max(0, 9 - hoursWorked).toFixed(2);
    
    // Safely convert attendance to object
    let attendanceObject;
    try {
      attendanceObject = attendance.toObject ? attendance.toObject() : attendance;
    } catch (error) {
      console.error('[ATTENDANCE/PUNCH] Error converting attendance to object:', error);
      attendanceObject = {
        _id: attendance._id,
        employeeId: attendance.employeeId,
        date: attendance.date,
        punches: punches,
        status: attendance.status || 'Absent',
        totalWorkingHours: hoursWorked,
        isLateEntry: attendance.isLateEntry || false,
        isEarlyExit: attendance.isEarlyExit || false
      };
    }
    
    const response = {
      ...attendanceObject,
      message: punchType === 'Punch In' ? 'Punched in successfully' : 'Punched out successfully',
      currentStatus: attendance.status || 'Absent',
      hoursWorked: hoursWorked,
      hoursRemaining: hoursRemaining,
      // Only return isLateEntry if first punch is Punch In
      isLateEntry: attendance.isLateEntry && sortedPunchesForResponse.length > 0 && 
                   sortedPunchesForResponse[0].punchType === 'Punch In',
      // Only return isEarlyExit if last punch is Punch Out AND time is between 6:00 PM - 6:55 PM
      isEarlyExit: attendance.isEarlyExit && lastPunchForResponse && 
                   lastPunchForResponse.punchType === 'Punch Out'
    };
    
    console.log(`[ATTENDANCE/PUNCH] Response prepared:`, {
      punchType,
      lastPunchType: lastPunchForResponse?.punchType,
      isEarlyExitFromDB: attendance.isEarlyExit,
      isEarlyExitInResponse: response.isEarlyExit,
      status: attendance.status
    });
    
    res.json(response);
  } catch (error) {
    console.error('[ATTENDANCE/PUNCH] Punch error:', error);
    console.error('[ATTENDANCE/PUNCH] Error stack:', error.stack);
    console.error('[ATTENDANCE/PUNCH] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    res.status(500).json({ 
      message: 'Server error occurred while processing attendance. Please try again.',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// @route   GET /api/attendance/today
// @desc    Get today's attendance for current employee or specified employee (for managers)
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    // Validate user object exists
    if (!req.user) {
      console.error('[ATTENDANCE/TODAY] No user object found in request');
      return res.status(401).json({ 
        message: 'User not authenticated. Please login again.',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Auto-create employee profile if it doesn't exist (for employees and managers)
    if (!req.user.employeeId && (req.user.role === 'employee' || req.user.role === 'manager')) {
      console.log(`[ATTENDANCE/TODAY] Auto-creating employee profile for user: ${req.user.email}, role: ${req.user.role}`);
      try {
        // Get fresh user from database to ensure we have the latest data
        let freshUser = await User.findById(req.user._id);
        if (!freshUser) {
          return res.status(401).json({ 
            message: 'User session expired. Please login again.',
            error: 'USER_NOT_FOUND'
          });
        }
        
        // Create or get employee profile
        await createOrGetEmployeeProfile(freshUser);
        
        // Refresh user object again to get updated employeeId
        freshUser = await User.findById(req.user._id);
        if (!freshUser) {
          return res.status(401).json({ 
            message: 'User session expired. Please login again.',
            error: 'USER_NOT_FOUND'
          });
        }
        
        // Update req.user with fresh data
        req.user = freshUser;
        
        console.log(`[ATTENDANCE/TODAY] Employee profile ready: ${req.user.employeeId}`);
        
        // Double-check employeeId is set
        if (!req.user.employeeId) {
          console.error('[ATTENDANCE/TODAY] Employee profile created but employeeId not set in user');
          return res.status(500).json({ 
            message: 'Employee profile created but failed to link. Please refresh and try again.',
            error: 'EMPLOYEE_ID_NOT_SET'
          });
        }
      } catch (error) {
        console.error('[ATTENDANCE/TODAY] Error creating employee profile:', error);
        console.error('[ATTENDANCE/TODAY] Error stack:', error.stack);
        return res.status(500).json({ 
          message: 'Unable to create employee profile. Please contact HR.', 
          error: error.message
        });
      }
    }
    
    // Final check - ensure employeeId exists
    if (!req.user.employeeId) {
      console.error('[ATTENDANCE/TODAY] No employeeId found for user:', req.user.email, req.user.role);
      return res.status(400).json({ 
        message: 'Employee profile not found. Please contact HR.',
        error: 'NO_EMPLOYEE_PROFILE'
      });
    }
    
    // Determine which employee's attendance to fetch
    let targetEmployeeId = req.user.employeeId;
    
    // If manager is requesting a specific employee's attendance
    if (req.user.role === 'manager' && req.query.employeeId) {
      const requestedEmployeeId = req.query.employeeId;
      
      try {
        // Verify the employee is in the manager's team
        const manager = await Employee.findById(req.user.employeeId);
        if (!manager) {
          console.error('[ATTENDANCE/TODAY] Manager profile not found for employeeId:', req.user.employeeId);
          return res.status(404).json({ 
            message: 'Manager profile not found. Please contact HR.',
            error: 'MANAGER_NOT_FOUND'
          });
        }
        
        const teamMember = await Employee.findById(requestedEmployeeId);
        if (!teamMember) {
          return res.status(404).json({ message: 'Employee not found' });
        }
        
        // Check if it's the manager's own profile or a team member
        const isOwnProfile = manager._id.toString() === requestedEmployeeId.toString();
        const isTeamMember = teamMember.companyDetails?.reportingManager?.toString() === manager._id.toString();
        
        if (!isOwnProfile && !isTeamMember) {
          return res.status(403).json({ 
            message: 'Access denied. You can only view your team members\' attendance.',
            error: 'FORBIDDEN'
          });
        }
        
        targetEmployeeId = requestedEmployeeId;
      } catch (error) {
        console.error('[ATTENDANCE/TODAY] Error verifying manager/team member:', error);
        return res.status(500).json({ 
          message: 'Failed to verify access. Please try again.',
          error: error.message
        });
      }
    } else if (req.user.role === 'hr' || req.user.role === 'admin') {
      // HR/Admin can view any employee's today attendance
      if (req.query.employeeId) {
        targetEmployeeId = req.query.employeeId;
        console.log(`[ATTENDANCE/TODAY] HR ${req.user.email} viewing today's attendance for employee: ${targetEmployeeId}`);
      } else {
        // If no employeeId specified, HR should view their own (if they have employeeId)
        // For now, return error or handle appropriately
        if (!req.user.employeeId) {
          return res.status(400).json({ 
            message: 'Please specify an employeeId to view attendance, or contact admin to link your employee profile.',
            error: 'NO_EMPLOYEE_ID'
          });
        }
        targetEmployeeId = req.user.employeeId;
      }
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attendance;
    try {
      attendance = await Attendance.findOne({
        employeeId: targetEmployeeId,
        date: today
      });
      
      if (!attendance) {
        // Create empty attendance record only for own attendance
        const isOwnAttendance = targetEmployeeId && req.user.employeeId && 
                                targetEmployeeId.toString() === req.user.employeeId.toString();
        
        if (isOwnAttendance) {
          try {
            // Use findOneAndUpdate with upsert for atomic operation (prevents race conditions)
            attendance = await Attendance.findOneAndUpdate(
              {
                employeeId: targetEmployeeId,
                date: today
              },
              {
                $setOnInsert: {
                  employeeId: targetEmployeeId,
                  date: today,
                  punches: [],
                  status: 'Absent',
                  totalWorkingHours: 0
                }
              },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
              }
            );
            console.log(`[ATTENDANCE/TODAY] Created/found attendance record for employee: ${targetEmployeeId}`);
          } catch (createError) {
            // Handle duplicate key error - record might have been created by another request
            if (createError.code === 11000) {
              console.log(`[ATTENDANCE/TODAY] Duplicate key error, attempting to find existing record...`);
              // Try to find the record again (might have been created by concurrent request)
              attendance = await Attendance.findOne({
                employeeId: targetEmployeeId,
                date: today
              });
              
              if (!attendance) {
                // If still not found, try to find by date range
                const startOfDay = new Date(today);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(today);
                endOfDay.setHours(23, 59, 59, 999);
                
                attendance = await Attendance.findOne({
                  employeeId: targetEmployeeId,
                  date: { $gte: startOfDay, $lte: endOfDay }
                });
              }
              
              if (attendance) {
                console.log(`[ATTENDANCE/TODAY] Found existing attendance record after duplicate error: ${attendance._id}`);
              } else {
                console.error('[ATTENDANCE/TODAY] Error creating attendance record:', createError);
                return res.status(500).json({ 
                  message: 'Failed to create attendance record. Please try again.',
                  error: createError.message
                });
              }
            } else {
              console.error('[ATTENDANCE/TODAY] Error creating attendance record:', createError);
              return res.status(500).json({ 
                message: 'Failed to create attendance record. Please try again.',
                error: createError.message
              });
            }
          }
        } else {
          // For team members, don't create empty record - just return null data
          return res.json({
            date: today,
            punches: [],
            status: 'Absent',
            hoursWorked: 0,
            hoursRemaining: 9,
            canPunchIn: false,
            canPunchOut: false,
            isEarlyExit: false,
            isLateEntry: false
          });
        }
      }
      
      // Recalculate if needed (this will reset flags based on current punch state)
      if (attendance && attendance.punches.length > 0) {
        try {
          attendance.calculateWorkingHours();
          await attendance.save();
        } catch (calcError) {
          console.error('[ATTENDANCE/TODAY] Error calculating working hours:', calcError);
          // Continue even if calculation fails
        }
      }
    } catch (error) {
      console.error('[ATTENDANCE/TODAY] Error finding/creating attendance:', error);
      return res.status(500).json({ 
        message: 'Failed to access attendance record. Please try again.',
        error: error.message
      });
    }
    
    // Ensure attendance exists before processing
    if (!attendance) {
      return res.status(500).json({ 
        message: 'Failed to retrieve attendance record.',
        error: 'ATTENDANCE_NOT_FOUND'
      });
    }
    
    // Sort punches to determine last punch correctly
    const sortedPunches = attendance.punches && attendance.punches.length > 0
      ? [...attendance.punches].sort((a, b) => new Date(a.time) - new Date(b.time))
      : []
    const lastPunch = sortedPunches.length > 0 ? sortedPunches[sortedPunches.length - 1] : null
    
    // Only allow punch in/out for own attendance
    const canPunch = targetEmployeeId && req.user.employeeId && 
                     targetEmployeeId.toString() === req.user.employeeId.toString();
    
    const totalWorkingHours = attendance.totalWorkingHours || 0;
    const hoursRemaining = Math.max(0, 9 - totalWorkingHours).toFixed(2);
    
    // Safely convert attendance to object
    let attendanceObject;
    try {
      attendanceObject = attendance.toObject ? attendance.toObject() : attendance;
    } catch (error) {
      console.error('[ATTENDANCE/TODAY] Error converting attendance to object:', error);
      attendanceObject = {
        _id: attendance._id,
        employeeId: attendance.employeeId,
        date: attendance.date,
        punches: attendance.punches || [],
        status: attendance.status || 'Absent',
        totalWorkingHours: totalWorkingHours,
        isLateEntry: attendance.isLateEntry || false,
        isEarlyExit: attendance.isEarlyExit || false
      };
    }
    
    res.json({
      ...attendanceObject,
      hoursWorked: totalWorkingHours,
      hoursRemaining: hoursRemaining,
      canPunchIn: canPunch && (attendance.punches.length === 0 || 
                  (lastPunch && lastPunch.punchType === 'Punch Out')),
      canPunchOut: canPunch && attendance.punches.length > 0 && 
                   (lastPunch && lastPunch.punchType === 'Punch In'),
      // Only return isEarlyExit if last punch is actually Punch Out
      isEarlyExit: attendance.isEarlyExit && lastPunch && lastPunch.punchType === 'Punch Out',
      // Only return isLateEntry if last punch is actually Punch In (first punch)
      isLateEntry: attendance.isLateEntry && sortedPunches.length > 0 && 
                   sortedPunches[0].punchType === 'Punch In'
    });
  } catch (error) {
    console.error('[ATTENDANCE/TODAY] Get today attendance error:', error);
    console.error('[ATTENDANCE/TODAY] Error stack:', error.stack);
    console.error('[ATTENDANCE/TODAY] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      userRole: req.user?.role,
      userEmployeeId: req.user?.employeeId
    });
    res.status(500).json({ 
      message: 'Server error occurred while fetching attendance. Please try again.',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// @route   GET /api/attendance/daily-stats
// @desc    Get daily attendance statistics for all employees (Admin and HR only)
// @access  Private (Admin, HR)
router.get('/daily-stats', protect, authorize('admin', 'hr'), async (req, res) => {
  try {
    const { date } = req.query;
    console.log('[DAILY-STATS] Request received with date:', date);
    
    // Default to today if no date provided
    let targetDate;
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        console.error('[DAILY-STATS] Invalid date format:', date);
        return res.status(400).json({ message: 'Invalid date format', error: 'INVALID_DATE' });
      }
    } else {
      targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    console.log('[DAILY-STATS] Querying for date range:', targetDate, 'to', nextDay);
    
    // Get all employees
    const allEmployees = await Employee.find({});
    const totalEmployees = allEmployees.length;
    console.log('[DAILY-STATS] Total employees found:', totalEmployees);
    
    if (totalEmployees === 0) {
      console.log('[DAILY-STATS] No employees found, returning empty stats');
      return res.json({
        stats: {
          date: targetDate.toISOString().split('T')[0],
          totalEmployees: 0,
          present: 0,
          absent: 0,
          onLeave: 0,
          notMarked: 0,
          lateEntry: 0,
          earlyExit: 0,
          shortHours: 0,
          attendancePercentage: 0
        },
        dailyAttendance: []
      });
    }
    
    // Get attendance records for the date - use date range query
    // Convert dates to ensure proper comparison
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).populate('employeeId', 'personalInfo companyDetails employeeId');
    
    console.log('[DAILY-STATS] Attendance records found:', attendanceRecords.length);
    
    // Get employees on leave for this date
    const leavesOnDate = await Leave.find({
      startDate: { $lte: nextDay },
      endDate: { $gte: targetDate },
      status: { $in: ['Manager Approved', 'HR Approved'] }
    }).populate('employeeId', 'personalInfo companyDetails employeeId');
    
    const employeesOnLeave = new Set();
    leavesOnDate.forEach(leave => {
      if (leave.employeeId && leave.employeeId._id) {
        employeesOnLeave.add(leave.employeeId._id.toString());
      }
    });
    
    console.log('[DAILY-STATS] Employees on leave:', employeesOnLeave.size);
    
    // Create a map of employee attendance
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      if (record.employeeId && record.employeeId._id) {
        const empId = record.employeeId._id.toString();
        attendanceMap.set(empId, record);
      }
    });
    
    // Calculate statistics
    let present = 0;
    let absent = 0;
    let onLeave = 0;
    let notMarked = 0;
    let lateEntry = 0;
    let earlyExit = 0;
    let shortHours = 0;
    
    const dailyAttendance = [];
    
    allEmployees.forEach(employee => {
      const empId = employee._id.toString();
      const attendance = attendanceMap.get(empId);
      const isOnLeave = employeesOnLeave.has(empId);
      
      let status = 'Not Marked';
      let workingHours = 0;
      let punches = [];
      
      if (attendance) {
        status = attendance.status;
        workingHours = attendance.totalWorkingHours || 0;
        punches = attendance.punches || [];
        
        if (status === 'Present' || status === 'Complete') {
          present++;
        } else if (status === 'Absent') {
          absent++;
        } else if (status === 'Late Entry') {
          present++;
          lateEntry++;
        } else if (status === 'Early Exit') {
          present++;
          earlyExit++;
        } else if (status === 'Short Hours' || status === 'Running Out of Time') {
          present++;
          shortHours++;
        } else {
          present++;
        }
      } else if (isOnLeave) {
        status = 'On Leave';
        onLeave++;
      } else {
        notMarked++;
      }
      
      dailyAttendance.push({
        employeeId: employee._id.toString(),
        employeeName: employee.personalInfo?.fullName || employee.employeeId || 'Unknown',
        employeeCode: employee.employeeId || employee._id.toString(),
        department: employee.companyDetails?.department || 'N/A',
        designation: employee.companyDetails?.designation || 'N/A',
        status,
        workingHours: workingHours || 0,
        punches: punches || [],
        punchIn: attendance?.firstPunchIn || null,
        punchOut: attendance?.lastPunchOut || null,
        isLateEntry: attendance?.isLateEntry || false,
        isEarlyExit: attendance?.isEarlyExit || false
      });
    });
    
    // Sort by employee name
    dailyAttendance.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    
    const stats = {
      date: targetDate.toISOString().split('T')[0],
      totalEmployees,
      present,
      absent,
      onLeave,
      notMarked,
      lateEntry,
      earlyExit,
      shortHours,
      attendancePercentage: totalEmployees > 0 
        ? ((present / totalEmployees) * 100).toFixed(1) 
        : 0
    };
    
    res.json({
      stats,
      dailyAttendance
    });
  } catch (error) {
    console.error('Get daily stats error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/attendance/monthly/my-attendance
// @desc    Get monthly attendance for current employee (Employee only)
// @access  Private (Employee)
router.get('/monthly/my-attendance', protect, authorize('employee'), async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ message: 'Employee profile not found' });
    }
    
    const { month, year } = req.query;
    
    // Get month and year from query or use current month/year
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    if (targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be between 1 and 12' });
    }
    
    // Calculate month start and end dates
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    monthStart.setHours(0, 0, 0, 0);
    
    // Get employee details
    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Get attendance records for the month
    const attendanceRecords = await Attendance.find({
      employeeId: req.user.employeeId,
      date: {
        $gte: monthStart,
        $lte: monthEnd
      }
    }).sort({ date: 1 });
    
    // Get leaves for the month
    const leaves = await Leave.find({
      employeeId: req.user.employeeId,
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
      status: { $in: ['Manager Approved', 'HR Approved'] }
    });
    
    // Create a map of leaves by date
    const leaveMap = new Map();
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        leaveMap.set(dateKey, leave);
      }
    });
    
    // Create calendar data
    const totalDays = monthEnd.getDate();
    const calendarData = [];
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(targetYear, targetMonth - 1, day);
      const dateKey = date.toISOString().split('T')[0];
      
      const attendance = attendanceRecords.find(a => {
        const aDate = new Date(a.date);
        return aDate.getDate() === day;
      });
      
      const leave = leaveMap.get(dateKey);
      
      let status = 'Not Marked';
      let workingHours = 0;
      let punches = [];
      
      if (leave) {
        status = 'On Leave';
      } else if (attendance) {
        status = attendance.status;
        workingHours = attendance.totalWorkingHours || 0;
        punches = attendance.punches || [];
      }
      
      calendarData.push({
        day,
        date: dateKey,
        status,
        workingHours,
        punches,
        isLateEntry: attendance?.isLateEntry || false,
        isEarlyExit: attendance?.isEarlyExit || false
      });
    }
    
    // Calculate monthly statistics
    const stats = {
      totalDays,
      present: calendarData.filter(d => d.status === 'Present' || d.status === 'Complete').length,
      absent: calendarData.filter(d => d.status === 'Absent').length,
      onLeave: calendarData.filter(d => d.status === 'On Leave').length,
      notMarked: calendarData.filter(d => d.status === 'Not Marked').length,
      lateEntry: calendarData.filter(d => d.isLateEntry).length,
      earlyExit: calendarData.filter(d => d.isEarlyExit).length,
      totalWorkingHours: calendarData.reduce((sum, d) => sum + d.workingHours, 0),
      averageWorkingHours: calendarData.filter(d => d.workingHours > 0).length > 0
        ? (calendarData.reduce((sum, d) => sum + d.workingHours, 0) / calendarData.filter(d => d.workingHours > 0).length).toFixed(2)
        : 0
    };
    
    stats.attendancePercentage = totalDays > 0 
      ? ((stats.present / totalDays) * 100).toFixed(1) 
      : 0;
    
    res.json({
      employee: {
        id: employee._id,
        name: employee.personalInfo?.fullName || employee.employeeId || 'Unknown',
        employeeId: employee.employeeId || employee._id.toString(),
        department: employee.companyDetails?.department || 'N/A',
        designation: employee.companyDetails?.designation || 'N/A'
      },
      month: targetMonth,
      year: targetYear,
      monthName: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      stats,
      calendarData
    });
  } catch (error) {
    console.error('Get employee monthly attendance error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance/monthly/:employeeId
// @desc    Get monthly attendance for a specific employee (Admin, HR, and Manager only)
// @access  Private (Admin, HR, Manager)
router.get('/monthly/:employeeId', protect, authorize('admin', 'hr', 'manager'), async (req, res) => {
  try {
    console.log('[MONTHLY-ATTENDANCE] Route hit - employeeId:', req.params.employeeId);
    console.log('[MONTHLY-ATTENDANCE] User role:', req.user?.role);
    console.log('[MONTHLY-ATTENDANCE] Query params:', req.query);
    const { employeeId } = req.params;
    const { month, year } = req.query;
    
    // Validate employeeId
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }
    
    // Get month and year from query or use current month/year
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    if (targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be between 1 and 12' });
    }
    
    // Calculate month start and end dates
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    monthStart.setHours(0, 0, 0, 0);
    
    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Get attendance records for the month
    const attendanceRecords = await Attendance.find({
      employeeId: employeeId,
      date: {
        $gte: monthStart,
        $lte: monthEnd
      }
    }).sort({ date: 1 });
    
    // Get leaves for the month
    const leaves = await Leave.find({
      employeeId: employeeId,
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
      status: { $in: ['Manager Approved', 'HR Approved'] }
    });
    
    // Create a map of leaves by date
    const leaveMap = new Map();
    leaves.forEach(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        if (d >= monthStart && d <= monthEnd) {
          leaveMap.set(dateKey, leave);
        }
      }
    });
    
    // Create a map of attendance by date
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      attendanceMap.set(dateKey, record);
    });
    
    // Generate calendar data for the month
    const calendarData = [];
    const totalDays = monthEnd.getDate();
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(targetYear, targetMonth - 1, day);
      const dateKey = date.toISOString().split('T')[0];
      const attendance = attendanceMap.get(dateKey);
      const leave = leaveMap.get(dateKey);
      
      let status = 'Not Marked';
      let workingHours = 0;
      let punches = [];
      let punchIn = null;
      let punchOut = null;
      
      if (attendance) {
        status = attendance.status;
        workingHours = attendance.totalWorkingHours || 0;
        punches = attendance.punches || [];
        punchIn = attendance.firstPunchIn || null;
        punchOut = attendance.lastPunchOut || null;
      } else if (leave) {
        status = 'On Leave';
      }
      
      calendarData.push({
        date: dateKey,
        day: day,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        status,
        workingHours,
        punches,
        punchIn,
        punchOut,
        isLateEntry: attendance?.isLateEntry || false,
        isEarlyExit: attendance?.isEarlyExit || false
      });
    }
    
    // Calculate monthly statistics
    const stats = {
      totalDays,
      present: calendarData.filter(d => d.status === 'Present' || d.status === 'Complete').length,
      absent: calendarData.filter(d => d.status === 'Absent').length,
      onLeave: calendarData.filter(d => d.status === 'On Leave').length,
      notMarked: calendarData.filter(d => d.status === 'Not Marked').length,
      lateEntry: calendarData.filter(d => d.isLateEntry).length,
      earlyExit: calendarData.filter(d => d.isEarlyExit).length,
      totalWorkingHours: calendarData.reduce((sum, d) => sum + d.workingHours, 0),
      averageWorkingHours: calendarData.filter(d => d.workingHours > 0).length > 0
        ? (calendarData.reduce((sum, d) => sum + d.workingHours, 0) / calendarData.filter(d => d.workingHours > 0).length).toFixed(2)
        : 0
    };
    
    stats.attendancePercentage = totalDays > 0 
      ? ((stats.present / totalDays) * 100).toFixed(1) 
      : 0;
    
    res.json({
      employee: {
        id: employee._id,
        name: employee.personalInfo?.fullName || employee.employeeId || 'Unknown',
        employeeId: employee.employeeId || employee._id.toString(),
        department: employee.companyDetails?.department || 'N/A',
        designation: employee.companyDetails?.designation || 'N/A'
      },
      month: targetMonth,
      year: targetYear,
      monthName: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      stats,
      calendarData
    });
  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance
// @desc    Get attendance records
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'employee') {
      filter.employeeId = req.user.employeeId;
    } else if (req.user.role === 'manager') {
      // Manager can view any employee's attendance (similar to HR/Admin)
      if (req.query.employeeId) {
        // View specific employee's attendance
        filter.employeeId = req.query.employeeId;
        console.log(`[ATTENDANCE] Manager ${req.user.email} viewing attendance for employee: ${req.query.employeeId}`);
      } else {
        // Default: Show ONLY manager's own attendance (when viewing "My Attendance")
        // IMPORTANT: Use req.user.employeeId directly - this is the manager's employeeId
        if (!req.user.employeeId) {
          return res.status(400).json({ 
            message: 'Manager profile not found. Please contact HR to link your employee profile.',
            error: 'NO_EMPLOYEE_PROFILE'
          });
        }
        
        filter.employeeId = req.user.employeeId;
        console.log(`[ATTENDANCE] Manager ${req.user.email} viewing own attendance (employeeId: ${req.user.employeeId})`);
      }
    } else if (req.user.role === 'hr' || req.user.role === 'admin') {
      // HR/Admin can view employees' attendance
      if (req.query.employeeId) {
        // View specific employee's attendance
        filter.employeeId = req.query.employeeId;
        console.log(`[ATTENDANCE] ${req.user.role === 'admin' ? 'Admin' : 'HR'} ${req.user.email} viewing attendance for employee: ${req.query.employeeId}`);
      } else {
        // Admin: If no employeeId specified, show ALL employees' attendance (including HR and managers)
        // HR: If no employeeId specified, default to HR's own attendance (when viewing "My Attendance")
        if (req.user.role === 'admin') {
          // Admin can see all employees' attendance - don't filter by employeeId
          // This will return attendance for all employees
          console.log(`[ATTENDANCE] Admin ${req.user.email} viewing ALL employees' attendance`);
        } else {
          // HR: default to HR's own attendance
          if (req.user.employeeId) {
            filter.employeeId = req.user.employeeId;
            console.log(`[ATTENDANCE] HR ${req.user.email} viewing own attendance (employeeId: ${req.user.employeeId})`);
          } else {
            // If HR doesn't have employeeId, return empty array (they can't view attendance without employeeId)
            return res.json([]);
          }
        }
      }
    }
    
    if (req.query.startDate && req.query.endDate) {
      filter.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    // Log the filter being used for debugging
    if (req.user.role === 'manager' || req.user.role === 'hr' || req.user.role === 'admin') {
      console.log(`[ATTENDANCE] ${req.user.role} attendance filter:`, {
        userEmail: req.user.email,
        userEmployeeId: req.user.employeeId,
        filterEmployeeId: filter.employeeId || 'ALL_EMPLOYEES',
        requestedEmployeeId: req.query.employeeId || (req.user.role === 'admin' ? 'ALL_EMPLOYEES' : 'OWN_ATTENDANCE'),
        hasFilter: !!filter.employeeId
      });
    }
    
    const attendance = await Attendance.find(filter)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email companyDetails.department companyDetails.designation')
      .sort({ date: -1 });
    
    // Additional safety check: ensure we only return records for the requested employeeId
    // This is especially important for managers viewing their own attendance
    // For admin viewing all employees, skip this filtering
    let filteredAttendance = attendance;
    
    // Only filter by employeeId if it's specified (not for admin viewing all)
    if (filter.employeeId) {
      if (typeof filter.employeeId === 'object' && filter.employeeId.toString) {
        // Filter is using ObjectId comparison
        filteredAttendance = attendance.filter(record => {
          if (!record.employeeId) return false;
          
          // Handle populated employeeId (object with _id) or direct ObjectId
          const recordEmployeeId = record.employeeId._id 
            ? record.employeeId._id.toString() 
            : record.employeeId.toString();
          
          return recordEmployeeId === filter.employeeId.toString();
        });
      } else if (typeof filter.employeeId === 'string') {
        // Filter is using string comparison
        filteredAttendance = attendance.filter(record => {
          if (!record.employeeId) return false;
          
          const recordEmployeeId = record.employeeId._id 
            ? record.employeeId._id.toString() 
            : record.employeeId.toString();
          
          return recordEmployeeId === filter.employeeId;
        });
      }
    }
    
    if (req.user.role === 'manager' || req.user.role === 'hr' || req.user.role === 'admin') {
      console.log(`[ATTENDANCE] ${req.user.role} ${req.user.email}: Returning ${filteredAttendance.length} attendance records`);
      if (filteredAttendance.length > 0) {
        filteredAttendance.slice(0, 2).forEach((rec, idx) => {
          const employeeName = rec.employeeId?.personalInfo?.fullName || rec.employeeId?.employeeId || rec.employeeId?._id || 'Unknown';
          console.log(`  Record ${idx + 1}: Employee=${employeeName}, Date=${rec.date?.toLocaleDateString()}`);
        });
      }
    }
    
    res.json(filteredAttendance);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
