const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Grievance = require('../models/Grievance');
const router = express.Router();

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`[GRIEVANCES] ${req.method} ${req.path}`);
  next();
});

// @route   POST /api/grievances
// @desc    Create grievance
// @access  Private (Employee, HR)
router.post('/', protect, async (req, res) => {
  try {
    let employeeIdToUse = req.user.employeeId;
    
    // For HR users, check if they have an employeeId, if not, create/get an Employee profile
    if (req.user.role === 'hr' && !req.user.employeeId) {
      const Employee = require('../models/Employee');
      const HR = require('../models/HR');
      
      // Try to find or create an Employee profile for HR
      const hrProfile = await HR.findOne({ userId: req.user._id });
      if (hrProfile) {
        // Check if there's an Employee record linked to this HR user
        let employeeProfile = await Employee.findOne({ userId: req.user._id });
        
        if (!employeeProfile) {
          // Create a minimal Employee profile for HR to use for grievances
          employeeProfile = await Employee.create({
            userId: req.user._id,
            employeeId: hrProfile.hrId || `HR-${req.user._id.toString().slice(-6)}`,
            personalInfo: {
              fullName: hrProfile.personalInfo?.fullName || req.user.email.split('@')[0],
              email: hrProfile.personalInfo?.email || req.user.email
            },
            companyDetails: {
              department: hrProfile.companyDetails?.department || 'Human Resources',
              designation: hrProfile.companyDetails?.designation || 'HR',
              employmentStatus: 'Active'
            }
          });
          
          // Update user with employeeId
          const User = require('../models/User');
          await User.findByIdAndUpdate(req.user._id, { employeeId: employeeProfile._id });
          employeeIdToUse = employeeProfile._id;
        } else {
          employeeIdToUse = employeeProfile._id;
        }
      } else {
        return res.status(400).json({ message: 'HR profile not found. Please complete your HR profile first.' });
      }
    } else if (!employeeIdToUse) {
      return res.status(400).json({ message: 'Employee profile not found' });
    }
    
    const grievance = await Grievance.create({
      ...req.body,
      employeeId: employeeIdToUse
    });
    
    const populatedGrievance = await Grievance.findById(grievance._id)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email');
    
    res.status(201).json(populatedGrievance);
  } catch (error) {
    console.error('Create grievance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/grievances
// @desc    Get grievances
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'employee') {
      filter.employeeId = req.user.employeeId;
    } else if (req.user.role === 'hr') {
      // HR can see their own grievances
      if (req.user.employeeId) {
        filter.employeeId = req.user.employeeId;
      } else {
        // If HR doesn't have employeeId, try to find their Employee profile
        const Employee = require('../models/Employee');
        const hrEmployee = await Employee.findOne({ userId: req.user._id });
        if (hrEmployee) {
          filter.employeeId = hrEmployee._id;
        } else {
          // No grievances if no employee profile
          filter.employeeId = null;
        }
      }
    } else if (req.user.role === 'manager') {
      // Get team grievances AND HR grievances
      const Employee = require('../models/Employee');
      const manager = await Employee.findById(req.user.employeeId);
      const teamMembers = await Employee.find({
        'companyDetails.reportingManager': manager?._id
      }).select('_id');
      
      // Get HR employees (those in HR department)
      const hrEmployees = await Employee.find({
        'companyDetails.department': 'Human Resources',
        'companyDetails.employmentStatus': 'Active'
      }).select('_id');
      
      // Combine team members and HR employees
      const allEmployeeIds = [
        ...teamMembers.map(e => e._id),
        ...hrEmployees.map(e => e._id)
      ];
      
      filter.employeeId = { $in: allEmployeeIds };
    } else if (req.user.role === 'admin') {
      // Admin can see all grievances (no filter)
    }
    
    if (req.query.status) filter.status = req.query.status;
    
    const grievances = await Grievance.find(filter)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email companyDetails.department')
      .populate('assignedTo', 'email')
      .populate('resolution.resolvedBy', 'email role')
      .sort({ createdAt: -1 });
    
    res.json(grievances);
  } catch (error) {
    console.error('Get grievances error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/grievances/:id/resolve
// @desc    Resolve grievance (Manager/HR/Admin)
// @access  Private (Manager, HR, Admin)
// NOTE: This route must be defined BEFORE /:id route to avoid route conflicts
router.put('/:id/resolve', protect, authorize('manager', 'hr', 'admin'), async (req, res) => {
  console.log(`[GRIEVANCES] Resolve route hit - ID: ${req.params.id}, User: ${req.user.email}, Role: ${req.user.role}`);
  try {
    const grievance = await Grievance.findById(req.params.id)
      .populate('employeeId', 'companyDetails.reportingManager');
    
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found' });
    }
    
    // For managers, verify they can only resolve their team members' or HR's grievances
    if (req.user.role === 'manager') {
      const Employee = require('../models/Employee');
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        return res.status(404).json({ message: 'Manager profile not found' });
      }
      
      // Check if grievance belongs to manager's team member
      const isTeamMember = grievance.employeeId?.companyDetails?.reportingManager?.toString() === manager._id.toString();
      
      // Check if grievance belongs to HR (HR department)
      const isHR = grievance.employeeId?.companyDetails?.department === 'Human Resources';
      
      if (!isTeamMember && !isHR) {
        return res.status(403).json({ 
          message: 'You can only resolve grievances for your team members or HR.',
          error: 'NOT_AUTHORIZED'
        });
      }
    }
    
    // Validate resolution details
    if (!req.body.resolutionDetails || req.body.resolutionDetails.trim() === '') {
      return res.status(400).json({ message: 'Resolution details are required' });
    }
    
    // Update grievance status and resolution
    grievance.status = 'Resolved';
    grievance.resolution = {
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
      resolutionDetails: req.body.resolutionDetails
    };
    
    // Add to status history
    grievance.statusHistory.push({
      status: 'Resolved',
      updatedBy: req.user._id,
      updatedAt: new Date(),
      comments: `Resolved by ${req.user.role === 'manager' ? 'Manager' : req.user.role.toUpperCase()}: ${req.body.resolutionDetails}`
    });
    
    await grievance.save();
    
    const populatedGrievance = await Grievance.findById(grievance._id)
      .populate('employeeId', 'employeeId personalInfo.fullName')
      .populate('resolution.resolvedBy', 'email role')
      .populate('assignedTo', 'email');
    
    console.log(`[GRIEVANCES] Grievance ${grievance.ticketNumber} resolved by ${req.user.email} (${req.user.role})`);
    
    res.json(populatedGrievance);
  } catch (error) {
    console.error('Resolve grievance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/grievances/:id
// @desc    Update grievance
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found' });
    }
    
    // Check permissions
    if (req.user.role === 'employee' && grievance.employeeId.toString() !== req.user.employeeId?.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // For managers, verify they can only update their team members' grievances
    if (req.user.role === 'manager') {
      const Employee = require('../models/Employee');
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        return res.status(404).json({ message: 'Manager profile not found' });
      }
      
      const grievanceEmployee = await Employee.findById(grievance.employeeId);
      const isTeamMember = grievanceEmployee?.companyDetails?.reportingManager?.toString() === manager._id.toString();
      if (!isTeamMember) {
        return res.status(403).json({ 
          message: 'You can only update grievances for your team members.',
          error: 'NOT_TEAM_MEMBER'
        });
      }
    }
    
    // Add to status history if status changed
    if (req.body.status && req.body.status !== grievance.status) {
      grievance.statusHistory.push({
        status: req.body.status,
        updatedBy: req.user._id,
        updatedAt: new Date(),
        comments: req.body.comments || `Status changed to ${req.body.status}`
      });
    }
    
    Object.assign(grievance, req.body);
    await grievance.save();
    
    const populatedGrievance = await Grievance.findById(grievance._id)
      .populate('employeeId', 'employeeId personalInfo.fullName')
      .populate('assignedTo', 'email')
      .populate('resolution.resolvedBy', 'email role');
    
    res.json(populatedGrievance);
  } catch (error) {
    console.error('Update grievance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Debug route to test if routes are working
router.get('/test-routes', (req, res) => {
  res.json({ 
    message: 'Grievances routes are working',
    routes: [
      'POST /api/grievances',
      'GET /api/grievances',
      'PUT /api/grievances/:id/resolve',
      'PUT /api/grievances/:id'
    ]
  });
});

module.exports = router;

