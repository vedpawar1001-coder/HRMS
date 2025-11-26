const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Employee = require('../models/Employee');
const User = require('../models/User');
const router = express.Router();

// @route   GET /api/employees
// @desc    Get all employees (HR/Admin) or own profile (Employee)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let employees;
    
    if (req.user.role === 'employee') {
      // SECURITY: Employee can ONLY see their own profile - no access to other employees
      if (!req.user.employeeId) {
        return res.status(404).json({ message: 'Employee profile not found. Please contact HR.' });
      }
      // Return only their own profile as a single object (not an array for consistency)
      const ownProfile = await Employee.findById(req.user.employeeId);
      if (!ownProfile) {
        return res.status(404).json({ message: 'Employee profile not found. Please contact HR.' });
      }
      return res.json([ownProfile]); // Return as array for consistency with other roles
    } else if (req.user.role === 'manager') {
      // Manager can see team members
      if (!req.user.employeeId) {
        console.log('[EMPLOYEES] Manager has no employeeId, returning empty array');
        return res.json([]);
      }
      
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        console.log('[EMPLOYEES] Manager profile not found for employeeId:', req.user.employeeId);
        return res.json([]);
      }
      
      // Build filter for manager's team members
      let filter = {
        'companyDetails.reportingManager': manager._id,
        _id: { $ne: manager._id } // Exclude manager's own profile from team list
      };
      
      // Add optional filters
      if (req.query.department) {
        filter['companyDetails.department'] = req.query.department;
      }
      
      if (req.query.status) {
        filter['companyDetails.employmentStatus'] = req.query.status;
      } else {
        // By default, show active employees (but allow filter to show all)
        filter['companyDetails.employmentStatus'] = 'Active';
      }
      
      // Add search filter if provided
      if (req.query.search) {
        filter.$or = [
          { 'personalInfo.fullName': { $regex: req.query.search, $options: 'i' } },
          { employeeId: { $regex: req.query.search, $options: 'i' } },
          { 'personalInfo.email': { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      employees = await Employee.find(filter)
        .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.department companyDetails.designation companyDetails.employmentStatus companyDetails.reportingManager')
        .lean()
        .sort({ 'personalInfo.fullName': 1 }); // Sort alphabetically by name
      
      console.log('[EMPLOYEES] Manager query - Team members found:', employees.length);
      
      // If no employees found with reportingManager = manager._id, try with employeeId as fallback
      if (employees.length === 0 && !req.query.search) {
        console.log('[EMPLOYEES] No employees found with reportingManager = manager._id, trying with employeeId as fallback...');
        const fallbackFilter = {
          'companyDetails.reportingManager': manager.employeeId,
          _id: { $ne: manager._id }
        };
        if (req.query.department) fallbackFilter['companyDetails.department'] = req.query.department;
        if (req.query.status) {
          fallbackFilter['companyDetails.employmentStatus'] = req.query.status;
        } else {
          fallbackFilter['companyDetails.employmentStatus'] = 'Active';
        }
        
        employees = await Employee.find(fallbackFilter)
          .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.department companyDetails.designation companyDetails.employmentStatus')
          .lean()
          .sort({ 'personalInfo.fullName': 1 });
        console.log('[EMPLOYEES] Fallback query - Team members found:', employees.length);
      }
    } else {
      // HR/Admin can see all
      const query = req.query;
      let filter = {};
      
      if (query.department) filter['companyDetails.department'] = query.department;
      if (query.status) filter['companyDetails.employmentStatus'] = query.status;
      if (query.search) {
        filter.$or = [
          { 'personalInfo.fullName': { $regex: query.search, $options: 'i' } },
          { employeeId: { $regex: query.search, $options: 'i' } },
          { 'personalInfo.email': { $regex: query.search, $options: 'i' } }
        ];
      }
      
      employees = await Employee.find(filter);
    }
    
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// IMPORTANT: This route MUST come before /:id route to avoid route conflicts
// @route   GET /api/employees/managers
// @desc    Get all managers for reporting manager dropdown (accessible by all roles)
// @access  Private
router.get('/managers', protect, async (req, res) => {
  try {
    console.log('[EMPLOYEES/MANAGERS] Fetching managers for user:', req.user.email, req.user.role);
    
    // Fetch all employees with designation containing "manager" (case-insensitive)
    // Note: We don't filter by employmentStatus=Active in case some managers are inactive but still valid for selection
    const allEmployees = await Employee.find({
      'companyDetails.designation': { $regex: /manager/i }
    })
    .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department companyDetails.employmentStatus')
    .lean()
    .sort({ 'personalInfo.fullName': 1 }); // Sort by name
    
    console.log('[EMPLOYEES/MANAGERS] Found employees with manager designation:', allEmployees.length);
    
    // Filter active managers (but also include inactive if needed)
    const managers = allEmployees.filter(emp => 
      emp.companyDetails?.employmentStatus === 'Active' || !emp.companyDetails?.employmentStatus
    );
    
    console.log('[EMPLOYEES/MANAGERS] Active managers:', managers.length);
    console.log('[EMPLOYEES/MANAGERS] Manager details:', managers.map(m => ({
      name: m.personalInfo?.fullName,
      designation: m.companyDetails?.designation,
      status: m.companyDetails?.employmentStatus
    })));
    
    // If user is employee, exclude themselves from the list
    const filteredManagers = req.user.role === 'employee' && req.user.employeeId
      ? managers.filter(m => m._id.toString() !== req.user.employeeId.toString())
      : managers;
    
    console.log('[EMPLOYEES/MANAGERS] Final filtered managers (after excluding self):', filteredManagers.length);
    
    res.json(filteredManagers);
  } catch (error) {
    console.error('[EMPLOYEES/MANAGERS] Get managers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// IMPORTANT: This route MUST come before /:id route to avoid route conflicts
// @route   PUT /api/employees/:id/salary
// @desc    Update employee salary (HR/Admin only)
// @access  Private
router.put('/:id/salary', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { monthlySalary, salaryStatus, reason } = req.body;
    
    if (!monthlySalary || monthlySalary <= 0) {
      return res.status(400).json({ message: 'Valid monthly salary is required' });
    }
    
    // Get employee document (not lean) so we can modify and save
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Ensure companyDetails exists
    if (!employee.companyDetails) {
      employee.companyDetails = {};
    }
    
    const oldSalary = employee.companyDetails.monthlySalary || 0;
    const newSalary = parseFloat(monthlySalary);
    
    // Update salary fields
    employee.companyDetails.monthlySalary = newSalary;
    employee.companyDetails.salaryLastUpdated = new Date();
    employee.companyDetails.salaryUpdatedBy = req.user._id;
    
    if (salaryStatus) {
      employee.companyDetails.salaryStatus = salaryStatus;
    }
    
    // Add to salary revision history if salary changed
    if (oldSalary !== newSalary) {
      if (!employee.salaryRevisionHistory) {
        employee.salaryRevisionHistory = [];
      }
      employee.salaryRevisionHistory.push({
        effectiveDate: new Date(),
        oldSalary: oldSalary,
        newSalary: newSalary,
        reason: reason || 'Salary updated by HR',
        updatedBy: req.user._id,
        updatedAt: new Date()
      });
    }
    
    // Add activity log
    if (!employee.activityLog) {
      employee.activityLog = [];
    }
    employee.activityLog.push({
      action: 'Salary Updated',
      field: 'companyDetails.monthlySalary',
      oldValue: oldSalary,
      newValue: newSalary,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });
    // Keep only last 100 entries
    if (employee.activityLog.length > 100) {
      employee.activityLog = employee.activityLog.slice(-100);
    }
    
    // Fix data type issues before saving to avoid validation errors
    // Fix totalExperience if it's an object
    if (employee.employmentInfo?.totalExperience && typeof employee.employmentInfo.totalExperience === 'object') {
      const exp = employee.employmentInfo.totalExperience;
      if (exp.years !== undefined && exp.months !== undefined) {
        employee.employmentInfo.totalExperience = `${exp.years} years ${exp.months} months`;
      } else {
        employee.employmentInfo.totalExperience = JSON.stringify(exp);
      }
    }
    
    // Fix profileCompletion if it's an object
    if (employee.profileCompletion && typeof employee.profileCompletion === 'object') {
      employee.profileCompletion = employee.profileCompletion.percentage || 0;
    } else if (typeof employee.profileCompletion !== 'number') {
      // Recalculate if not a number
      if (typeof employee.calculateProfileCompletion === 'function') {
        employee.calculateProfileCompletion();
      } else {
        employee.profileCompletion = 0;
      }
    }
    
    // Mark modified fields
    employee.markModified('companyDetails');
    if (employee.salaryRevisionHistory && employee.salaryRevisionHistory.length > 0) {
      employee.markModified('salaryRevisionHistory');
    }
    if (employee.activityLog && employee.activityLog.length > 0) {
      employee.markModified('activityLog');
    }
    if (employee.employmentInfo) {
      employee.markModified('employmentInfo');
    }
    
    // Save the document - use direct MongoDB update to bypass validation
    const updateOps = {
      $set: {
        'companyDetails.monthlySalary': newSalary,
        'companyDetails.salaryLastUpdated': new Date(),
        'companyDetails.salaryUpdatedBy': req.user._id
      }
    };
    
    if (salaryStatus) {
      updateOps.$set['companyDetails.salaryStatus'] = salaryStatus;
    }
    
    // Use $push for arrays to add new entries
    updateOps.$push = {};
    
    if (oldSalary !== newSalary) {
      updateOps.$push.salaryRevisionHistory = {
        effectiveDate: new Date(),
        oldSalary: oldSalary,
        newSalary: newSalary,
        reason: reason || 'Salary updated by HR',
        updatedBy: req.user._id,
        updatedAt: new Date()
      };
    }
    
    updateOps.$push.activityLog = {
      action: 'Salary Updated',
      field: 'companyDetails.monthlySalary',
      oldValue: oldSalary,
      newValue: newSalary,
      updatedBy: req.user._id,
      updatedAt: new Date()
    };
    
    // Update using findByIdAndUpdate to bypass validation
    await Employee.findByIdAndUpdate(
      req.params.id,
      updateOps,
      { new: true, runValidators: false }
    );
    
    // Limit activity log to last 100 entries using a separate update
    const currentEmployee = await Employee.findById(req.params.id);
    if (currentEmployee && currentEmployee.activityLog && currentEmployee.activityLog.length > 100) {
      await Employee.findByIdAndUpdate(
        req.params.id,
        { $set: { activityLog: currentEmployee.activityLog.slice(-100) } },
        { runValidators: false }
      );
    }
    
    // Fetch updated employee to return
    const updatedEmployee = await Employee.findById(employee._id)
      .select('_id employeeId companyDetails.monthlySalary companyDetails.salaryStatus companyDetails.salaryLastUpdated');
    
    res.json({
      message: 'Employee salary updated successfully',
      employee: {
        _id: updatedEmployee._id,
        employeeId: updatedEmployee.employeeId,
        monthlySalary: updatedEmployee.companyDetails?.monthlySalary,
        salaryStatus: updatedEmployee.companyDetails?.salaryStatus,
        salaryLastUpdated: updatedEmployee.companyDetails?.salaryLastUpdated
      }
    });
  } catch (error) {
    console.error('Update employee salary error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/employees/:id
// @desc    Get single employee
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // SECURITY: Employees can ONLY view their own profile
    if (req.user.role === 'employee') {
      // Strict check - employees can only access their own profile
      if (!req.user.employeeId || employee._id.toString() !== req.user.employeeId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view your own profile.',
          error: 'FORBIDDEN'
        });
      }
      // Return only their own profile (no masking needed since it's their own)
      return res.json(employee);
    }
    
    // Managers can see their team members
    if (req.user.role === 'manager') {
      const manager = await Employee.findById(req.user.employeeId);
      const isTeamMember = employee.companyDetails?.reportingManager?.toString() === manager?._id?.toString();
      const isOwnProfile = employee._id.toString() === req.user.employeeId?.toString();
      
      if (!isTeamMember && !isOwnProfile) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view your team members\' profiles.',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // HR/Admin can view all employees
    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Check permissions
    if (req.user.role === 'employee' && employee._id.toString() !== req.user.employeeId?.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Employees can only update specific fields
    if (req.user.role === 'employee') {
      const allowedFields = ['personalInfo.address', 'personalInfo.emergencyContact', 'documents'];
      // Filter updates
    }
    
    const updated = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    // Recalculate profile completion
    updated.calculateProfileCompletion();
    await updated.save();
    
    res.json(updated);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/employees/create-profile
// @desc    Create employee profile for current user (if doesn't exist)
// @access  Private
router.post('/create-profile', protect, async (req, res) => {
  try {
    console.log(`[CREATE_PROFILE_ROUTE] User: ${req.user.email}, employeeId: ${req.user.employeeId}`);
    
    const { createOrGetEmployeeProfile } = require('../utils/createEmployeeProfile');
    
    // Refresh user from DB to get latest data
    let freshUser = await User.findById(req.user._id);
    if (!freshUser) {
      console.error(`[CREATE_PROFILE_ROUTE] User not found: ${req.user._id}, email: ${req.user.email}`);
      return res.status(401).json({ 
        message: 'User session expired or account not found. Please login again.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    console.log(`[CREATE_PROFILE_ROUTE] Fresh user data - employeeId: ${freshUser.employeeId}`);
    
    const employee = await createOrGetEmployeeProfile(freshUser);
    
    // Refresh user again to get updated employeeId
    freshUser = await User.findById(req.user._id);
    
    if (!freshUser.employeeId) {
      console.error('[CREATE_PROFILE_ROUTE] Employee created but user.employeeId not updated');
      return res.status(500).json({ 
        message: 'Profile created but failed to link. Please refresh and try again.',
        error: 'Employee profile created but user link failed'
      });
    }
    
    console.log(`[CREATE_PROFILE_ROUTE] Success - Employee: ${employee._id}, User employeeId: ${freshUser.employeeId}`);
    
    res.json({ 
      message: 'Employee profile created/retrieved successfully', 
      employee,
      user: {
        _id: freshUser._id,
        email: freshUser.email,
        employeeId: freshUser.employeeId
      }
    });
  } catch (error) {
    console.error('[CREATE_PROFILE_ROUTE] Error:', error);
    console.error('[CREATE_PROFILE_ROUTE] Error details:', {
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      stack: error.stack
    });
    
    let errorMessage = 'Failed to create employee profile';
    if (error.code === 11000) {
      const duplicateField = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'unknown';
      
      // Handle specific duplicate fields
      if (duplicateField === 'email' || duplicateField === 'personalInfo.email') {
        errorMessage = 'Employee with this email already exists. Attempting to link existing profile...';
        // Try to find and link existing employee
        try {
          const normalizedEmail = freshUser.email.toLowerCase().trim();
          const existingEmployee = await Employee.findOne({ 'personalInfo.email': normalizedEmail });
          if (existingEmployee) {
            freshUser.employeeId = existingEmployee._id;
            await freshUser.save();
            existingEmployee.userId = freshUser._id;
            await existingEmployee.save();
            return res.json({ 
              message: 'Existing employee profile linked successfully', 
              employee: existingEmployee,
              user: {
                _id: freshUser._id,
                email: freshUser.email,
                employeeId: freshUser.employeeId
              }
            });
          }
        } catch (linkError) {
          console.error('[CREATE_PROFILE_ROUTE] Error linking existing employee:', linkError);
        }
      } else if (duplicateField === 'employeeCode') {
        errorMessage = 'Profile creation conflict detected. Please try again.';
        // This might be an old index issue, try once more after a brief delay
      } else if (duplicateField === 'userId') {
        errorMessage = 'You already have an employee profile. Refreshing...';
        // Try to find employee by userId
        try {
          const existingEmployee = await Employee.findOne({ userId: freshUser._id });
          if (existingEmployee) {
            freshUser.employeeId = existingEmployee._id;
            await freshUser.save();
            return res.json({ 
              message: 'Employee profile found and linked', 
              employee: existingEmployee,
              user: {
                _id: freshUser._id,
                email: freshUser.email,
                employeeId: freshUser.employeeId
              }
            });
          }
        } catch (linkError) {
          console.error('[CREATE_PROFILE_ROUTE] Error finding employee by userId:', linkError);
        }
      } else {
        errorMessage = `Duplicate entry detected for field: ${duplicateField}. Please contact HR.`;
      }
    }
    
    res.status(500).json({ 
      message: errorMessage, 
      error: error.message,
      duplicateField: error.keyPattern ? Object.keys(error.keyPattern)[0] : undefined,
      details: error.keyPattern ? `Duplicate field: ${Object.keys(error.keyPattern).join(', ')}` : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
