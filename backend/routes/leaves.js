const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const router = express.Router();

// Helper function to calculate paid leaves based on employee tenure
function calculatePaidLeaves(joiningDate) {
  if (!joiningDate) {
    return 0; // No joining date = 0 paid leaves
  }
  
  const today = new Date();
  const joining = new Date(joiningDate);
  
  // Calculate months of experience
  let monthsDiff = (today.getFullYear() - joining.getFullYear()) * 12 + 
                   (today.getMonth() - joining.getMonth());
  
  // Adjust for days - if not completed month, don't count it
  if (today.getDate() < joining.getDate()) {
    monthsDiff--;
  }
  
  // Rules:
  // 0 months (new employee): 0 paid leaves
  // 6 months or more but less than 12 months: 2 paid leaves
  // 12 months (1 year) or more: 4 paid leaves
  
  if (monthsDiff < 6) {
    return 0; // Less than 6 months
  } else if (monthsDiff < 12) {
    return 2; // 6 months to less than 1 year
  } else {
    return 4; // 1 year or more
  }
}

// @route   POST /api/leaves
// @desc    Apply for leave
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ message: 'Employee profile not found' });
    }
    
    console.log(`[LEAVES/APPLY] ===== LEAVE APPLICATION SUBMISSION =====`);
    console.log(`[LEAVES/APPLY] User: ${req.user.email} (Role: ${req.user.role})`);
    console.log(`[LEAVES/APPLY] EmployeeId: ${req.user.employeeId}`);
    console.log(`[LEAVES/APPLY] Leave data:`, JSON.stringify(req.body, null, 2));
    
    // Normalize dates to start of day to ensure correct date storage
    const normalizeDate = (dateValue) => {
      if (!dateValue) return null
      const date = new Date(dateValue)
      // Set to start of day in local timezone
      date.setHours(0, 0, 0, 0)
      return date
    }
    
    // Validate paid leave balance if applying for paid leave
    if (req.body.leaveType === 'PL') {
      // Get employee to check tenure
      const Employee = require('../models/Employee');
      const employee = await Employee.findById(req.user.employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }
      
      // Calculate available paid leaves based on tenure
      const joiningDate = employee.companyDetails?.joiningDate;
      const calculatedPaidLeaves = calculatePaidLeaves(joiningDate);
      
      // Get current balance
      let balance = await LeaveBalance.findOne({ employeeId: req.user.employeeId });
      
      if (!balance) {
        // Create balance with calculated paid leaves
        balance = await LeaveBalance.create({
          employeeId: req.user.employeeId,
          balances: {
            PL: calculatedPaidLeaves,
            UL: 0
          }
        });
      } else {
        // Update paid leaves if tenure increased
        const currentPaidLeaves = balance.balances?.PL || 0;
        if (calculatedPaidLeaves > currentPaidLeaves) {
          balance.balances.PL = calculatedPaidLeaves;
          balance.lastUpdated = new Date();
          await balance.save();
        }
      }
      
      // Calculate requested leave days
      const start = normalizeDate(req.body.startDate);
      const end = normalizeDate(req.body.endDate);
      const requestedDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      
      // Check if employee has enough paid leaves
      const availablePaidLeaves = balance.balances?.PL || 0;
      
      if (requestedDays > availablePaidLeaves) {
        return res.status(400).json({ 
          message: `Insufficient paid leave balance. You have ${availablePaidLeaves} paid leave(s) available, but requested ${requestedDays} day(s).`,
          availableBalance: availablePaidLeaves,
          requestedDays: requestedDays
        });
      }
    }
    
    const leaveData = {
      ...req.body,
      employeeId: req.user.employeeId,
      startDate: normalizeDate(req.body.startDate),
      endDate: normalizeDate(req.body.endDate)
    }
    
    console.log(`[LEAVES/APPLY] Normalized dates:`, {
      originalStartDate: req.body.startDate,
      normalizedStartDate: leaveData.startDate,
      originalEndDate: req.body.endDate,
      normalizedEndDate: leaveData.endDate
    });
    
    const leave = await Leave.create(leaveData);
    
    console.log(`[LEAVES/APPLY] ✅ Leave created successfully!`);
    console.log(`[LEAVES/APPLY]   Leave ID: ${leave._id}`);
    console.log(`[LEAVES/APPLY]   Leave employeeId: ${leave.employeeId}`);
    console.log(`[LEAVES/APPLY]   Leave type: ${leave.leaveType}`);
    console.log(`[LEAVES/APPLY]   Leave status: ${leave.status}`);
    
    // Populate employeeId for response
    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email');
    
    console.log(`[LEAVES/APPLY]   Employee: ${populatedLeave.employeeId?.personalInfo?.fullName || populatedLeave.employeeId?.employeeId}`);
    console.log(`[LEAVES/APPLY] =========================================`);
    
    res.status(201).json(populatedLeave);
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves
// @desc    Get leaves
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'employee') {
      // Employees see only their own leaves
      filter.employeeId = req.user.employeeId;
    } else if (req.user.role === 'manager') {
      const Employee = require('../models/Employee');
      
      // Check if manager wants to view specific employee's leaves or their own
      if (req.query.employeeId) {
        // Viewing specific employee's leaves (for approval)
        const manager = await Employee.findById(req.user.employeeId);
        const requestedEmployeeId = req.query.employeeId;
        
        // Verify access: must be own profile or team member
        const isOwnProfile = manager._id.toString() === requestedEmployeeId.toString();
        const teamMember = await Employee.findById(requestedEmployeeId);
        const isTeamMember = teamMember?.companyDetails?.reportingManager?.toString() === manager._id.toString();
        
        if (isOwnProfile || isTeamMember) {
          filter.employeeId = requestedEmployeeId;
        } else {
          return res.status(403).json({ 
            message: 'Access denied. You can only view your team members\' leaves.',
            error: 'FORBIDDEN'
          });
        }
      } else if (req.query.viewTeam === 'true') {
        // View team members' leaves for approval
        const manager = await Employee.findById(req.user.employeeId);
        const teamMembers = await Employee.find({
          'companyDetails.reportingManager': manager?._id
        }).select('_id');
        
        filter.employeeId = { $in: teamMembers.map(e => e._id) };
        filter.status = { $in: ['Pending', 'Manager Approved'] };
      } else {
        // Default: Show ONLY manager's own leaves (when viewing "My Leaves")
        // IMPORTANT: Managers should only see their own applied leaves, not team members'
        if (!req.user.employeeId) {
          return res.status(400).json({ 
            message: 'Manager profile not found. Please contact HR to link your employee profile.',
            error: 'NO_EMPLOYEE_PROFILE'
          });
        }
        
        // STRICT: Only manager's own leaves - explicitly filter by manager's employeeId
        // This ensures we ONLY show leaves that the manager submitted via "Apply for Leave"
        filter.employeeId = req.user.employeeId;
        console.log(`[LEAVES] Manager ${req.user.email} viewing ONLY own leaves (employeeId: ${req.user.employeeId})`);
        console.log(`[LEAVES] Filter applied: { employeeId: "${req.user.employeeId}" }`);
      }
    } else if (req.user.role === 'hr') {
      // HR can view employees' leaves
      if (req.query.employeeId) {
        // View specific employee's leaves
        filter.employeeId = req.query.employeeId;
        console.log(`[LEAVES] HR ${req.user.email} viewing leaves for employee: ${req.query.employeeId}`);
      } else {
        // If no employeeId specified, default to HR's own leaves (when viewing "My Leaves")
        // This ensures HR only sees their own leaves when not viewing a specific employee
        if (req.user.employeeId) {
          filter.employeeId = req.user.employeeId;
          console.log(`[LEAVES] HR ${req.user.email} viewing own leaves (employeeId: ${req.user.employeeId})`);
        } else {
          // If HR doesn't have employeeId, return empty array
          return res.json([]);
        }
      }
      
      // Optionally filter by status if provided
      if (req.query.status) {
        filter.status = req.query.status;
      }
    } else if (req.user.role === 'admin') {
      // Admin can view ALL employees' leaves (including HR and managers)
      if (req.query.employeeId) {
        // View specific employee's leaves
        filter.employeeId = req.query.employeeId;
        console.log(`[LEAVES] Admin ${req.user.email} viewing leaves for employee: ${req.query.employeeId}`);
      } else {
        // If no employeeId specified, admin sees ALL leaves (no filter)
        // This will return leaves for all employees
        console.log(`[LEAVES] Admin ${req.user.email} viewing ALL employees' leaves`);
      }
      
      // Optionally filter by status if provided
      if (req.query.status) {
        filter.status = req.query.status;
      }
    }
    
    // Convert filter to plain object for logging (MongoDB ObjectIds need special handling)
    const filterForLog = {};
    Object.keys(filter).forEach(key => {
      if (filter[key] && filter[key].toString) {
        filterForLog[key] = filter[key].toString();
      } else {
        filterForLog[key] = filter[key];
      }
    });
    console.log(`[LEAVES] Query filter:`, JSON.stringify(filterForLog, null, 2));
    console.log(`[LEAVES] User role: ${req.user.role}, employeeId: ${req.user.employeeId}`);
    
    // Query leaves - don't use lean() for managers viewing own leaves to ensure populate works correctly
    const leaves = await Leave.find(filter)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email')
      .sort({ appliedAt: -1 });
    
    console.log(`[LEAVES] Found ${leaves.length} leaves from database query`);
    
    // For managers viewing their own leaves, verify each leave belongs to manager
    let filteredLeaves = leaves;
    
    if (req.user.role === 'manager' && !req.query.viewTeam && !req.query.employeeId) {
      const managerEmployeeId = req.user.employeeId.toString();
      console.log(`[LEAVES] ===== MANAGER VIEWING OWN LEAVES =====`);
      console.log(`[LEAVES] Manager employeeId: ${managerEmployeeId}`);
      console.log(`[LEAVES] Leaves found from DB: ${leaves.length}`);
      
      // Filter to ensure only manager's own leaves
      filteredLeaves = leaves.filter(leave => {
        if (!leave.employeeId) {
          console.log(`[LEAVES] ❌ Leave ${leave._id} has no employeeId`);
          return false;
        }
        
        // Handle populated employeeId object
        const leaveEmployeeId = (leave.employeeId._id || leave.employeeId).toString();
        const matches = leaveEmployeeId === managerEmployeeId;
        
        if (!matches) {
          console.log(`[LEAVES] ❌ FILTERED OUT: Leave ${leave._id} (not manager's)`);
          return false;
        }
        
        return true;
      });
      
      console.log(`[LEAVES] Manager's own leaves after filter: ${filteredLeaves.length}`);
      if (filteredLeaves.length > 0) {
        filteredLeaves.slice(0, 5).forEach((leave, idx) => {
          const employeeName = leave.employeeId?.personalInfo?.fullName || leave.employeeId?.employeeId || 'Unknown';
          const appliedDate = leave.appliedAt ? new Date(leave.appliedAt).toLocaleDateString() : 'Unknown';
          console.log(`[LEAVES]   ✅ ${idx + 1}. ${leave.leaveType} | Status: ${leave.status} | ${employeeName} | Applied: ${appliedDate}`);
        });
      } else {
        console.log(`[LEAVES] ⚠️  No manager's own leaves found!`);
        if (leaves.length > 0) {
          console.log(`[LEAVES] ⚠️  But ${leaves.length} leaves were returned - checking why:`);
          leaves.slice(0, 3).forEach((leave, idx) => {
            const leaveEmpId = (leave.employeeId?._id || leave.employeeId)?.toString() || 'Unknown';
            const isMatch = leaveEmpId === managerEmployeeId;
            console.log(`[LEAVES]     Leave ${idx + 1}: employeeId=${leaveEmpId}, Match=${isMatch}`);
          });
        }
      }
      console.log(`[LEAVES] ======================================`);
    }
    
    // Convert to plain objects for response
    res.json(filteredLeaves.map(leave => leave.toObject ? leave.toObject() : leave));
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/approve
// @desc    Approve/reject leave
// @access  Private (Manager/HR)
router.put('/:id/approve', protect, authorize('manager', 'hr', 'admin'), async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }
    
    const { status, comments } = req.body;
    
    if (req.user.role === 'manager') {
      // Managers can only approve team members' leaves (not their own)
      const Employee = require('../models/Employee');
      const managerEmployee = await Employee.findById(req.user.employeeId);
      const leaveEmployee = await Employee.findById(leave.employeeId);
      
      // Check if manager is trying to approve their own leave
      if (managerEmployee && leaveEmployee && 
          managerEmployee._id.toString() === leaveEmployee._id.toString()) {
        return res.status(403).json({ 
          message: 'You cannot approve your own leave application. Please contact HR/Admin.',
          error: 'SELF_APPROVAL_NOT_ALLOWED'
        });
      }
      
      // Verify the employee is in manager's team
      const isTeamMember = leaveEmployee?.companyDetails?.reportingManager?.toString() === managerEmployee._id.toString();
      if (!isTeamMember) {
        return res.status(403).json({ 
          message: 'You can only approve leaves of your team members.',
          error: 'NOT_TEAM_MEMBER'
        });
      }
      
      leave.managerApproval = {
        approvedBy: req.user._id,
        approvedAt: new Date(),
        comments
      };
      leave.status = status === 'Approved' ? 'Manager Approved' : 'Manager Rejected';
    } else if (req.user.role === 'hr' || req.user.role === 'admin') {
      leave.hrApproval = {
        approvedBy: req.user._id,
        approvedAt: new Date(),
        comments
      };
      leave.status = status === 'Approved' ? 'HR Approved' : 'HR Rejected';
      
      // Update leave balance if approved (only for paid leaves)
      if (status === 'Approved' && leave.leaveType === 'PL') {
        // Get employee to ensure balance is up to date
        const Employee = require('../models/Employee');
        const employee = await Employee.findById(leave.employeeId);
        
        let balance = await LeaveBalance.findOne({ employeeId: leave.employeeId });
        
        if (!balance) {
          // Calculate paid leaves based on tenure
          const joiningDate = employee?.companyDetails?.joiningDate;
          const calculatedPaidLeaves = calculatePaidLeaves(joiningDate);
          
          balance = await LeaveBalance.create({ 
            employeeId: leave.employeeId,
            balances: {
              PL: calculatedPaidLeaves,
              UL: 0
            }
          });
        } else {
          // Update paid leaves if tenure increased
          if (employee) {
            const joiningDate = employee.companyDetails?.joiningDate;
            const calculatedPaidLeaves = calculatePaidLeaves(joiningDate);
            const currentPaidLeaves = balance.balances?.PL || 0;
            
            if (calculatedPaidLeaves > currentPaidLeaves) {
              balance.balances.PL = calculatedPaidLeaves;
            }
          }
        }
        
        // Deduct from paid leave balance
        const currentBalance = balance.balances?.PL || 0;
        if (currentBalance >= leave.totalDays) {
          balance.balances.PL = Math.max(0, currentBalance - leave.totalDays);
          balance.lastUpdated = new Date();
          await balance.save();
        } else {
          console.warn(`[LEAVES/APPROVE] Warning: Insufficient paid leave balance. Balance: ${currentBalance}, Requested: ${leave.totalDays}`);
          // Still approve but log warning
          balance.balances.PL = 0;
          balance.lastUpdated = new Date();
          await balance.save();
        }
      }
    }
    
    await leave.save();
    res.json(leave);
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/leaves/balance
// @desc    Get leave balance (with automatic calculation based on tenure)
// @access  Private
router.get('/balance', protect, async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ message: 'Employee profile not found' });
    }
    
    // Get employee to check joining date
    const Employee = require('../models/Employee');
    const employee = await Employee.findById(req.user.employeeId);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    // Calculate paid leaves based on tenure
    const joiningDate = employee.companyDetails?.joiningDate;
    const calculatedPaidLeaves = calculatePaidLeaves(joiningDate);
    
    // Get or create leave balance
    let balance = await LeaveBalance.findOne({ employeeId: req.user.employeeId });
    
    if (!balance) {
      // Create new balance with calculated paid leaves
      balance = await LeaveBalance.create({ 
        employeeId: req.user.employeeId,
        balances: {
          PL: calculatedPaidLeaves,
          UL: 0
        }
      });
    } else {
      // Update paid leaves if tenure has changed (e.g., employee reached 6 months or 1 year)
      const currentPaidLeaves = balance.balances?.PL || 0;
      
      // Only update if the calculated value is higher (employee gained more leaves due to tenure)
      // This ensures we don't reduce leaves if they've already been used
      if (calculatedPaidLeaves > currentPaidLeaves) {
        balance.balances.PL = calculatedPaidLeaves;
        balance.lastUpdated = new Date();
        await balance.save();
      }
    }
    
    res.json(balance);
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

