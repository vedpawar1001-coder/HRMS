const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const router = express.Router();

// @route   GET /api/payroll
// @desc    Get payroll records
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'employee') {
      // Employees can only see their own payroll
      filter.employeeId = req.user.employeeId;
    } else if (req.user.role === 'manager') {
      // Managers can see their team members' payroll
      if (!req.user.employeeId) {
        return res.status(400).json({ 
          message: 'Manager profile not found. Please contact HR.',
          error: 'NO_EMPLOYEE_PROFILE'
        });
      }
      
      const Employee = require('../models/Employee');
      const manager = await Employee.findById(req.user.employeeId);
      
      if (!manager) {
        return res.status(404).json({ message: 'Manager profile not found' });
      }
      
      // Get team members
      const teamMembers = await Employee.find({
        'companyDetails.reportingManager': manager._id,
        _id: { $ne: manager._id } // Exclude manager's own profile
      }).select('_id');
      
      const teamMemberIds = teamMembers.map(emp => emp._id);
      
      // If specific employee requested, verify they're a team member
      if (req.query.employeeId) {
        if (teamMemberIds.some(id => id.toString() === req.query.employeeId)) {
          filter.employeeId = req.query.employeeId;
        } else {
          return res.status(403).json({ 
            message: 'Access denied. You can only view your team members\' payroll.',
            error: 'FORBIDDEN'
          });
        }
      } else {
        // Show all team members' payroll
        filter.employeeId = { $in: teamMemberIds };
      }
    } else if (req.query.employeeId) {
      // HR/Admin can filter by employeeId
      filter.employeeId = req.query.employeeId;
    }
    
    if (req.query.month && req.query.year) {
      filter['payPeriod.month'] = parseInt(req.query.month);
      filter['payPeriod.year'] = parseInt(req.query.year);
    }
    
    const payroll = await Payroll.find(filter)
      .populate('employeeId', 'employeeId personalInfo.fullName companyDetails.department companyDetails.designation')
      .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 });
    
    res.json(payroll);
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/payroll/calculate
// @desc    Calculate payroll (HR/Admin)
// @access  Private
router.post('/calculate', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;
    
    if (!employeeId || !month || !year) {
      return res.status(400).json({ message: 'Employee ID, month, and year are required' });
    }
    
    // Check if payroll already exists for this period
    const existingPayroll = await Payroll.findOne({
      employeeId,
      'payPeriod.month': month,
      'payPeriod.year': year
    });
    
    if (existingPayroll) {
      return res.status(400).json({ 
        message: 'Payroll already exists for this period',
        payroll: existingPayroll 
      });
    }
    
    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    // Get employee with salary information
    const Employee = require('../models/Employee');
    const employee = await Employee.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    const monthlySalary = employee.companyDetails?.monthlySalary || 0;
    
    if (monthlySalary === 0) {
      return res.status(400).json({ 
        message: 'Employee monthly salary is not set. Please update employee salary first.' 
      });
    }
    
    // Calculate attendance days
    const attendance = await Attendance.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate },
      status: 'Present'
    });
    
    const presentDays = attendance.length;
    const totalDays = endDate.getDate();
    
    // Get approved unpaid leaves for the month
    const unpaidLeaves = await Leave.find({
      employeeId,
      leaveType: 'UL', // Unpaid Leave
      status: 'HR Approved',
      $or: [
        {
          startDate: { $gte: startDate, $lte: endDate }
        },
        {
          endDate: { $gte: startDate, $lte: endDate }
        },
        {
          $and: [
            { startDate: { $lte: startDate } },
            { endDate: { $gte: endDate } }
          ]
        }
      ]
    });
    
    // Calculate unpaid leave days that fall within the month
    let unpaidLeaveDays = 0;
    unpaidLeaves.forEach(leave => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      
      // Calculate overlap with the payroll month
      const overlapStart = leaveStart < startDate ? startDate : leaveStart;
      const overlapEnd = leaveEnd > endDate ? endDate : leaveEnd;
      
      if (overlapStart <= overlapEnd) {
        const daysDiff = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
        unpaidLeaveDays += daysDiff;
      }
    });
    
    // Get paid leaves for reference
    const paidLeaves = await Leave.find({
      employeeId,
      leaveType: 'PL', // Paid Leave
      status: 'HR Approved',
      $or: [
        {
          startDate: { $gte: startDate, $lte: endDate }
        },
        {
          endDate: { $gte: startDate, $lte: endDate }
        },
        {
          $and: [
            { startDate: { $lte: startDate } },
            { endDate: { $gte: endDate } }
          ]
        }
      ]
    });
    
    let paidLeaveDays = 0;
    paidLeaves.forEach(leave => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      
      const overlapStart = leaveStart < startDate ? startDate : leaveStart;
      const overlapEnd = leaveEnd > endDate ? endDate : leaveEnd;
      
      if (overlapStart <= overlapEnd) {
        const daysDiff = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
        paidLeaveDays += daysDiff;
      }
    });
    
    // Calculate Net Salary = Monthly Salary − (Monthly Salary / 30 × Unpaid Leaves)
    const dailySalary = monthlySalary / 30;
    const unpaidLeaveDeduction = dailySalary * unpaidLeaveDays;
    const netSalary = Math.max(0, monthlySalary - unpaidLeaveDeduction);
    
    // Calculate other deductions (can be extended)
    const otherDeductions = 0; // PF, ESI, TDS, etc. - can be added later
    
    const payroll = await Payroll.create({
      employeeId,
      payPeriod: { month, year },
      salaryStructure: { 
        basic: monthlySalary,
        monthlySalary: monthlySalary
      },
      earnings: { 
        grossSalary: monthlySalary,
        totalEarnings: monthlySalary 
      },
      deductions: { 
        unpaidLeaveDeduction: unpaidLeaveDeduction,
        otherDeductions: otherDeductions,
        totalDeductions: unpaidLeaveDeduction + otherDeductions
      },
      netSalary: netSalary,
      attendance: {
        totalDays,
        presentDays,
        paidLeaveDays,
        unpaidLeaveDays,
        lopDays: 0
      },
      status: 'Processed',
      processedBy: req.user._id,
      processedAt: new Date()
    });
    
    const populatedPayroll = await Payroll.findById(payroll._id)
      .populate('employeeId', 'employeeId personalInfo.fullName companyDetails.department companyDetails.designation');
    
    res.status(201).json(populatedPayroll);
  } catch (error) {
    console.error('Calculate payroll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/payroll/:id/status
// @desc    Update payroll status (HR/Admin)
// @access  Private
router.put('/:id/status', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['Draft', 'Processed', 'Paid'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('employeeId', 'employeeId personalInfo.fullName');
    
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll not found' });
    }
    
    res.json(payroll);
  } catch (error) {
    console.error('Update payroll status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

