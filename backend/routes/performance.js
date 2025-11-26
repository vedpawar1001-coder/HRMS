const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const Performance = require('../models/Performance');
const Employee = require('../models/Employee');
const router = express.Router();

// @route   GET /api/performance
// @desc    Get performance reviews
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'employee') {
      // Employees can only see their own performance reviews
      filter.employeeId = req.user.employeeId;
    } else if (req.user.role === 'manager') {
      // Managers can see their own reviews and their team members' reviews
      if (!req.user.employeeId) {
        return res.status(400).json({ 
          message: 'Manager profile not found. Please contact HR.',
          error: 'NO_EMPLOYEE_PROFILE'
        });
      }
      
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        return res.status(404).json({ message: 'Manager profile not found' });
      }
      
      // If specific employee requested, verify they're in manager's team
      if (req.query.employeeId) {
        const requestedEmployeeId = req.query.employeeId;
        const isOwnProfile = manager._id.toString() === requestedEmployeeId.toString();
        const teamMember = await Employee.findById(requestedEmployeeId);
        const isTeamMember = teamMember?.companyDetails?.reportingManager?.toString() === manager._id.toString();
        
        if (isOwnProfile || isTeamMember) {
          filter.employeeId = requestedEmployeeId;
        } else {
          return res.status(403).json({ 
            message: 'Access denied. You can only view your team members\' performance reviews.',
            error: 'FORBIDDEN'
          });
        }
      } else {
        // Default: Show manager's own reviews and team members' reviews
        const teamMembers = await Employee.find({
          'companyDetails.reportingManager': manager._id
        }).select('_id');
        
        const teamMemberIds = teamMembers.map(emp => emp._id);
        teamMemberIds.push(manager._id); // Include manager's own ID
        
        filter.employeeId = { $in: teamMemberIds };
      }
    }
    
    const performance = await Performance.find(filter)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email')
      .populate('managerReview.reviewedBy', 'email')
      .sort({ createdAt: -1 });
    
    res.json(performance);
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/performance/team-members
// @desc    Get team members for manager to create performance reviews
// @access  Private (Manager)
// NOTE: This route must be defined BEFORE /:id route to avoid route conflicts
router.get('/team-members', protect, authorize('manager'), async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ 
        message: 'Manager profile not found. Please contact HR.',
        error: 'NO_EMPLOYEE_PROFILE'
      });
    }
    
    const manager = await Employee.findById(req.user.employeeId);
    if (!manager) {
      return res.status(404).json({ message: 'Manager profile not found' });
    }
    
    console.log(`[PERFORMANCE/TEAM-MEMBERS] Fetching team members for manager: ${manager.employeeId || manager._id}`);
    
    // Get team members with unique employee IDs
    // Handle both ObjectId and string comparisons for reportingManager
    // This ensures employees who set their reportingManager in profile edit are found
    const managerId = manager._id;
    const managerIdString = managerId.toString();
    
    // Try to convert reportingManager to ObjectId if it's stored as string
    // This handles cases where employees set reportingManager via profile edit
    let teamMembers = await Employee.find({
      $or: [
        { 'companyDetails.reportingManager': managerId },
        { 'companyDetails.reportingManager': managerIdString },
        // Handle if reportingManager is stored as ObjectId but we're comparing with string
        { 'companyDetails.reportingManager': mongoose.Types.ObjectId.isValid(managerIdString) ? new mongoose.Types.ObjectId(managerIdString) : managerId }
      ],
      'companyDetails.employmentStatus': 'Active',
      employeeId: { $exists: true, $ne: null } // Ensure employeeId exists
    })
    .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department companyDetails.reportingManager')
    .sort({ employeeId: 1 }); // Sort by employeeId
    
    console.log(`[PERFORMANCE/TEAM-MEMBERS] Found ${teamMembers.length} team members with reportingManager matching manager._id (${managerIdString})`);
    
    // If still no team members found, try a more flexible query that handles any format
    if (teamMembers.length === 0) {
      console.log(`[PERFORMANCE/TEAM-MEMBERS] Trying flexible query to find employees with this manager as reportingManager...`);
      
      // Get all active employees with employeeId
      const allActiveEmployees = await Employee.find({
        'companyDetails.employmentStatus': 'Active',
        employeeId: { $exists: true, $ne: null }
      })
      .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department companyDetails.reportingManager')
      .lean(); // Use lean() for better performance
      
      // Filter in JavaScript to handle any format mismatch
      teamMembers = allActiveEmployees.filter(emp => {
        const reportingMgr = emp.companyDetails?.reportingManager;
        if (!reportingMgr) return false;
        
        // Compare as strings to handle ObjectId/string mismatches
        const reportingMgrStr = reportingMgr.toString();
        const managerIdStr = managerIdString;
        
        return reportingMgrStr === managerIdStr || 
               reportingMgrStr === managerId.toString() ||
               (mongoose.Types.ObjectId.isValid(reportingMgrStr) && 
                mongoose.Types.ObjectId.isValid(managerIdStr) &&
                new mongoose.Types.ObjectId(reportingMgrStr).equals(new mongoose.Types.ObjectId(managerIdStr)));
      });
      
      console.log(`[PERFORMANCE/TEAM-MEMBERS] Flexible query found ${teamMembers.length} team members`);
    }
    
    // If no team members found, show ALL active employees with employeeId from database
    // This ensures managers can see and select employees even if reportingManager is not set
    if (teamMembers.length === 0) {
      console.log(`[PERFORMANCE/TEAM-MEMBERS] No team members found with reportingManager. Fetching ALL active employees with employeeId from database...`);
      
      const allActiveEmployees = await Employee.find({
        'companyDetails.employmentStatus': 'Active',
        employeeId: { $exists: true, $ne: null, $ne: '' } // Ensure employeeId exists and is not empty
      })
      .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department companyDetails.reportingManager')
      .sort({ employeeId: 1 }) // Sort by employeeId
      .lean(); // Use lean() for better performance
      
      console.log(`[PERFORMANCE/TEAM-MEMBERS] ✅ Found ${allActiveEmployees.length} active employees with employeeId in database:`);
      allActiveEmployees.forEach((emp, idx) => {
        console.log(`  ${idx + 1}. Employee ID: ${emp.employeeId} - Name: ${emp.personalInfo?.fullName || 'N/A'} (reportingManager: ${emp.companyDetails?.reportingManager || 'NOT SET'})`);
      });
      
      // Use all active employees as team members (fallback to show all employees with employeeIds)
      teamMembers = allActiveEmployees;
      
      console.log(`[PERFORMANCE/TEAM-MEMBERS] ⚠️ Using ALL active employees as fallback (${teamMembers.length} employees). Employee IDs will appear in dropdown.`);
    }
    
    // Remove duplicates based on employeeId (in case of any duplicates)
    const uniqueTeamMembers = teamMembers.filter((member, index, self) =>
      index === self.findIndex((m) => m.employeeId === member.employeeId)
    );
    
    // Filter out any employees without employeeId (they shouldn't be in the list)
    // Only include employees that have employeeId from database
    const employeesWithIds = uniqueTeamMembers.filter(member => {
      if (!member.employeeId || member.employeeId.trim() === '') {
        console.warn(`[PERFORMANCE/TEAM-MEMBERS] ⚠️ Skipping employee ${member._id} (${member.personalInfo?.fullName}) - no employeeId in database`);
        return false;
      }
      return true;
    });
    
    // Format the response with employeeId from database
    const formattedTeamMembers = employeesWithIds.map(member => {
      return {
        _id: member._id,
        employeeId: member.employeeId, // Employee ID from database (e.g., EMP-2025-00001)
        personalInfo: {
          fullName: member.personalInfo?.fullName || 'Unknown',
          email: member.personalInfo?.email || '',
        },
        companyDetails: {
          designation: member.companyDetails?.designation || '',
          department: member.companyDetails?.department || '',
        }
      };
    });
    
    console.log(`[PERFORMANCE/TEAM-MEMBERS] ✅ Returning ${formattedTeamMembers.length} employees with employeeIds from database:`);
    formattedTeamMembers.forEach((member, idx) => {
      console.log(`  ${idx + 1}. ${member.employeeId} - ${member.personalInfo.fullName}`);
    });
    
    // Return the formatted team members with employeeIds from database
    res.json(formattedTeamMembers);
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/performance/:id
// @desc    Get single performance review
// @access  Private
// NOTE: This route must be defined AFTER /team-members to avoid route conflicts
router.get('/:id', protect, async (req, res) => {
  try {
    const performance = await Performance.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.reportingManager')
      .populate('managerReview.reviewedBy', 'email')
      .populate('hrReview.reviewedBy', 'email');
    
    if (!performance) {
      return res.status(404).json({ message: 'Performance review not found' });
    }
    
    // Check access permissions
    if (req.user.role === 'employee') {
      if (performance.employeeId._id.toString() !== req.user.employeeId?.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'manager') {
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        return res.status(404).json({ message: 'Manager profile not found' });
      }
      
      const isOwnProfile = manager._id.toString() === performance.employeeId._id.toString();
      const isTeamMember = performance.employeeId.companyDetails?.reportingManager?.toString() === manager._id.toString();
      
      if (!isOwnProfile && !isTeamMember) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view your team members\' performance reviews.',
          error: 'FORBIDDEN'
        });
      }
    }
    // HR/Admin can view all performance reviews (no additional check needed)
    
    res.json(performance);
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/performance
// @desc    Create performance review
// @access  Private (HR/Manager)
router.post('/', protect, authorize('manager', 'hr', 'admin'), async (req, res) => {
  try {
    // If manager is creating, validate they can only create for team members
    if (req.user.role === 'manager') {
      if (!req.user.employeeId) {
        return res.status(400).json({ 
          message: 'Manager profile not found. Please contact HR.',
          error: 'NO_EMPLOYEE_PROFILE'
        });
      }
      
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        return res.status(404).json({ message: 'Manager profile not found' });
      }
      
      // Verify the employee is in manager's team
      const employee = await Employee.findById(req.body.employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      const isTeamMember = employee.companyDetails?.reportingManager?.toString() === manager._id.toString();
      if (!isTeamMember) {
        return res.status(403).json({ 
          message: 'You can only create performance reviews for your team members.',
          error: 'NOT_TEAM_MEMBER'
        });
      }
    }
    
    // Validate required fields
    if (!req.body.employeeId || !req.body.reviewCycle || !req.body.period) {
      return res.status(400).json({ 
        message: 'Missing required fields: employeeId, reviewCycle, and period are required',
        error: 'MISSING_FIELDS'
      });
    }

    // Validate rating if provided
    if (req.body.rating !== undefined) {
      if (req.body.rating < 1 || req.body.rating > 5) {
        return res.status(400).json({ 
          message: 'Rating must be between 1 and 5',
          error: 'INVALID_RATING'
        });
      }
    }
    
    // Check if performance review already exists for this employee and period
    const existingReview = await Performance.findOne({
      employeeId: req.body.employeeId,
      period: req.body.period,
      reviewCycle: req.body.reviewCycle
    });
    
    if (existingReview) {
      return res.status(400).json({ 
        message: 'Performance review already exists for this employee and period',
        error: 'DUPLICATE_REVIEW'
      });
    }
    
    // Set default status
    const performanceData = {
      ...req.body,
      status: req.body.status || 'Draft'
    };
    
    const performance = await Performance.create(performanceData);
    
    const populatedPerformance = await Performance.findById(performance._id)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email');
    
    console.log(`[PERFORMANCE] Performance review created by ${req.user.email} for employee ${performance.employeeId}`);
    
    res.status(201).json(populatedPerformance);
  } catch (error) {
    console.error('Create performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/performance/:id/manager-review
// @desc    Submit manager review and rating
// @access  Private (Manager)
router.put('/:id/manager-review', protect, authorize('manager'), async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ 
        message: 'Manager profile not found. Please contact HR.',
        error: 'NO_EMPLOYEE_PROFILE'
      });
    }
    
    const performance = await Performance.findById(req.params.id)
      .populate('employeeId', 'companyDetails.reportingManager');
    
    if (!performance) {
      return res.status(404).json({ message: 'Performance review not found' });
    }
    
    // Verify manager can review this employee
    const manager = await Employee.findById(req.user.employeeId);
    if (!manager) {
      return res.status(404).json({ message: 'Manager profile not found' });
    }
    
    const isOwnProfile = manager._id.toString() === performance.employeeId._id.toString();
    const isTeamMember = performance.employeeId.companyDetails?.reportingManager?.toString() === manager._id.toString();
    
    if (isOwnProfile) {
      return res.status(403).json({ 
        message: 'You cannot review your own performance. Please contact HR.',
        error: 'SELF_REVIEW_NOT_ALLOWED'
      });
    }
    
    if (!isTeamMember) {
      return res.status(403).json({ 
        message: 'You can only review your team members\' performance.',
        error: 'NOT_TEAM_MEMBER'
      });
    }
    
    const { overallRating, feedback, improvementPlan, kpiRatings } = req.body;
    
    // Validate overall rating
    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ 
        message: 'Overall rating must be between 1 and 5',
        error: 'INVALID_RATING'
      });
    }
    
    // Update KPI ratings if provided
    if (kpiRatings && Array.isArray(kpiRatings)) {
      kpiRatings.forEach((kpiRating, index) => {
        if (performance.kpis[index]) {
          if (kpiRating.rating !== undefined) {
            performance.kpis[index].rating = kpiRating.rating;
          }
          if (kpiRating.status) {
            performance.kpis[index].status = kpiRating.status;
          }
        }
      });
    }
    
    // Update manager review
    performance.managerReview = {
      overallRating: overallRating,
      feedback: feedback || '',
      improvementPlan: improvementPlan || '',
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    };
    
    // Update status to Manager Review if it was in Self Assessment
    if (performance.status === 'Self Assessment') {
      performance.status = 'Manager Review';
    }
    
    await performance.save();
    
    const updatedPerformance = await Performance.findById(performance._id)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email')
      .populate('managerReview.reviewedBy', 'email');
    
    console.log(`[PERFORMANCE] Manager review submitted by ${req.user.email} for employee ${performance.employeeId._id}`);
    
    res.json(updatedPerformance);
  } catch (error) {
    console.error('Manager review error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

