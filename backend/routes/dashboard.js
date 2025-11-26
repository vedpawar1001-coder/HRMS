const express = require('express');
const { protect } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Grievance = require('../models/Grievance');
const Payroll = require('../models/Payroll');
const Application = require('../models/Application');
const router = express.Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = {};
    
    if (req.user.role === 'employee') {
      // Employee dashboard - Comprehensive data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayAttendance = await Attendance.findOne({
        employeeId: req.user.employeeId,
        date: today
      });
      
      const LeaveBalance = require('../models/LeaveBalance');
      const leaveBalance = await LeaveBalance.findOne({ employeeId: req.user.employeeId });
      
      const pendingLeaves = await Leave.countDocuments({
        employeeId: req.user.employeeId,
        status: { $in: ['Pending', 'Manager Approved'] }
      });
      
      const myGrievances = await Grievance.countDocuments({
        employeeId: req.user.employeeId,
        status: { $in: ['Open', 'In Progress'] }
      });
      
      // Recent attendance history (last 7 days)
      const attendanceHistory = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const attendance = await Attendance.findOne({
          employeeId: req.user.employeeId,
          date: date
        });
        
        attendanceHistory.push({
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          status: attendance?.status || 'Not Marked',
          punchIn: attendance?.punches?.[0]?.time || null,
          punchOut: attendance?.punches?.find(p => p.type === 'out')?.time || null,
          workingHours: attendance?.totalWorkingHours || 0,
          location: attendance?.punches?.[0]?.location || null
        });
      }
      
      // Monthly attendance summary (current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      monthStart.setHours(0, 0, 0, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const monthlyAttendance = await Attendance.find({
        employeeId: req.user.employeeId,
        date: { $gte: monthStart, $lte: monthEnd }
      }).sort({ date: 1 });
      
      const monthlyStats = {
        totalDays: monthEnd.getDate(),
        presentDays: monthlyAttendance.filter(a => a.status === 'Present').length,
        absentDays: monthlyAttendance.filter(a => a.status === 'Absent').length,
        leaveDays: monthlyAttendance.filter(a => a.status === 'On Leave').length,
        totalWorkingHours: monthlyAttendance.reduce((sum, a) => sum + (a.totalWorkingHours || 0), 0),
        averageHours: monthlyAttendance.length > 0 
          ? (monthlyAttendance.reduce((sum, a) => sum + (a.totalWorkingHours || 0), 0) / monthlyAttendance.length).toFixed(1)
          : 0
      };
      
      // Upcoming approved leaves
      const upcomingLeaves = await Leave.find({
        employeeId: req.user.employeeId,
        status: 'Approved',
        startDate: { $gte: today }
      })
        .sort({ startDate: 1 })
        .limit(5)
        .select('type startDate endDate status reason')
        .lean();
      
      // Recent leaves (last 5)
      const recentLeaves = await Leave.find({
        employeeId: req.user.employeeId
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type startDate endDate status createdAt reason')
        .lean();
      
      // Performance review status
      const Performance = require('../models/Performance');
      const latestPerformance = await Performance.findOne({
        employeeId: req.user.employeeId
      })
        .sort({ createdAt: -1 })
        .select('reviewCycle period status overallRating createdAt')
        .lean();
      
      // This month's attendance chart data
      const monthlyChartData = [];
      for (let i = 0; i < monthEnd.getDate(); i++) {
        const date = new Date(currentYear, currentMonth, i + 1);
        const attendance = monthlyAttendance.find(a => {
          const aDate = new Date(a.date);
          return aDate.getDate() === date.getDate();
        });
        
        monthlyChartData.push({
          day: i + 1,
          date: date.toISOString().split('T')[0],
          status: attendance?.status || 'Not Marked',
          hours: attendance?.totalWorkingHours || 0
        });
      }
      
      // Work summary (this week)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekAttendance = await Attendance.find({
        employeeId: req.user.employeeId,
        date: { $gte: weekStart, $lte: today }
      });
      
      const weekSummary = {
        daysWorked: weekAttendance.filter(a => a.status === 'Present').length,
        totalHours: weekAttendance.reduce((sum, a) => sum + (a.totalWorkingHours || 0), 0),
        averageHours: weekAttendance.length > 0
          ? (weekAttendance.reduce((sum, a) => sum + (a.totalWorkingHours || 0), 0) / weekAttendance.length).toFixed(1)
          : 0
      };
      
      stats.attendanceToday = todayAttendance || null;
      stats.leaveBalance = leaveBalance?.balances || { PL: 0, UL: 0 };
      stats.pendingLeaves = pendingLeaves;
      stats.openGrievances = myGrievances;
      stats.attendanceHistory = attendanceHistory;
      stats.monthlyStats = monthlyStats;
      stats.monthlyChartData = monthlyChartData;
      stats.upcomingLeaves = upcomingLeaves;
      stats.recentLeaves = recentLeaves;
      stats.latestPerformance = latestPerformance;
      stats.weekSummary = weekSummary;
      
    } else if (req.user.role === 'manager') {
      // Manager dashboard - Comprehensive data
      const manager = await Employee.findById(req.user.employeeId);
      
      if (!manager) {
        console.log('[DASHBOARD] Manager profile not found for employeeId:', req.user.employeeId);
        return res.json({
          teamPresent: 0,
          teamAbsent: 0,
          teamOnLeave: 0,
          teamSize: 0,
          attendancePercentage: 0,
          pendingApprovals: 0,
          approvedLeaves: 0,
          teamGrievances: 0,
          resolvedGrievances: 0,
          pendingReviews: 0,
          completedReviews: 0,
          attendanceTrend: [],
          leaveTrend: [],
          departmentDistribution: {},
          teamMemberStatus: [],
          recentLeaves: [],
          recentGrievances: []
        });
      }
      
      // Try multiple ways to find team members (handle both ObjectId and string)
      const mongoose = require('mongoose');
      const managerId = manager._id;
      const managerIdString = managerId.toString();
      
      let teamMembers = await Employee.find({
        $or: [
          { 'companyDetails.reportingManager': managerId },
          { 'companyDetails.reportingManager': managerIdString },
          { 'companyDetails.reportingManager': mongoose.Types.ObjectId.isValid(managerIdString) ? new mongoose.Types.ObjectId(managerIdString) : managerId }
        ],
        'companyDetails.employmentStatus': 'Active',
        _id: { $ne: managerId } // Exclude manager from their own team
      }).select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department');
      
      console.log(`[DASHBOARD] Manager ${manager.employeeId || manager._id} has ${teamMembers.length} team members`);
      
      const teamIds = teamMembers.map(e => e._id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Basic stats
      const teamPresent = await Attendance.countDocuments({
        employeeId: { $in: teamIds },
        date: today,
        status: 'Present'
      });
      
      const teamAbsent = await Attendance.countDocuments({
        employeeId: { $in: teamIds },
        date: today,
        status: 'Absent'
      });
      
      const teamOnLeave = await Attendance.countDocuments({
        employeeId: { $in: teamIds },
        date: today,
        status: 'On Leave'
      });
      
      const pendingApprovals = await Leave.countDocuments({
        employeeId: { $in: teamIds },
        status: 'Pending'
      });
      
      const approvedLeaves = await Leave.countDocuments({
        employeeId: { $in: teamIds },
        status: 'Approved'
      });
      
      const teamGrievances = await Grievance.countDocuments({
        employeeId: { $in: teamIds },
        status: { $in: ['Open', 'In Progress'] }
      });
      
      const resolvedGrievances = await Grievance.countDocuments({
        employeeId: { $in: teamIds },
        status: 'Resolved'
      });
      
      // Performance reviews
      const Performance = require('../models/Performance');
      const pendingReviews = await Performance.countDocuments({
        employeeId: { $in: teamIds },
        status: { $in: ['Draft', 'Self Assessment'] }
      });
      
      const completedReviews = await Performance.countDocuments({
        employeeId: { $in: teamIds },
        status: { $in: ['Manager Review', 'HR Review', 'Completed'] }
      });
      
      // Attendance trends (last 7 days)
      const attendanceTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const present = await Attendance.countDocuments({
          employeeId: { $in: teamIds },
          date: date,
          status: 'Present'
        });
        
        attendanceTrend.push({
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          present: present,
          total: teamIds.length
        });
      }
      
      // Leave requests trend (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const leaveTrend = await Leave.aggregate([
        {
          $match: {
            employeeId: { $in: teamIds },
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Department distribution
      const departmentDistribution = {};
      teamMembers.forEach(member => {
        const dept = member.companyDetails?.department || 'Unassigned';
        departmentDistribution[dept] = (departmentDistribution[dept] || 0) + 1;
      });
      
      // Team member status (today)
      const teamMemberStatus = await Promise.all(
        teamMembers.map(async (member) => {
          const todayAttendance = await Attendance.findOne({
            employeeId: member._id,
            date: today
          });
          
          return {
            _id: member._id,
            employeeId: member.employeeId,
            name: member.personalInfo?.fullName || 'Unknown',
            email: member.personalInfo?.email || '',
            designation: member.companyDetails?.designation || '',
            department: member.companyDetails?.department || '',
            status: todayAttendance?.status || 'Not Marked',
            punchIn: todayAttendance?.punches?.[0]?.time || null,
            punchOut: todayAttendance?.punches?.find(p => p.type === 'out')?.time || null
          };
        })
      );
      
      // Recent activities
      let recentLeaves = [];
      let recentGrievances = [];
      
      if (teamIds.length > 0) {
        recentLeaves = await Leave.find({
          employeeId: { $in: teamIds }
        })
          .populate('employeeId', 'employeeId personalInfo.fullName')
          .sort({ createdAt: -1 })
          .limit(5)
          .select('employeeId type startDate endDate status createdAt')
          .lean();
        
        recentGrievances = await Grievance.find({
          employeeId: { $in: teamIds }
        })
          .populate('employeeId', 'employeeId personalInfo.fullName')
          .sort({ createdAt: -1 })
          .limit(5)
          .select('employeeId title status createdAt')
          .lean();
      }
      
      console.log(`[DASHBOARD] Recent leaves: ${recentLeaves.length}, Recent grievances: ${recentGrievances.length}`);
      
      // Attendance percentage
      const attendancePercentage = teamIds.length > 0 
        ? Math.round((teamPresent / teamIds.length) * 100) 
        : 0;
      
      stats.teamPresent = teamPresent;
      stats.teamAbsent = teamAbsent;
      stats.teamOnLeave = teamOnLeave;
      stats.teamSize = teamIds.length;
      stats.attendancePercentage = attendancePercentage;
      stats.pendingApprovals = pendingApprovals;
      stats.approvedLeaves = approvedLeaves;
      stats.teamGrievances = teamGrievances;
      stats.resolvedGrievances = resolvedGrievances;
      stats.pendingReviews = pendingReviews;
      stats.completedReviews = completedReviews;
      stats.attendanceTrend = attendanceTrend;
      stats.leaveTrend = leaveTrend;
      stats.departmentDistribution = departmentDistribution;
      stats.teamMemberStatus = teamMemberStatus;
      stats.recentLeaves = recentLeaves;
      stats.recentGrievances = recentGrievances;
      
    } else if (req.user.role === 'hr') {
      // HR dashboard - Comprehensive data (all employees, separate from manager data)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Total employees (all statuses)
      const totalEmployees = await Employee.countDocuments({
        'companyDetails.employmentStatus': 'Active'
      });
      
      const totalEmployeesAll = await Employee.countDocuments();
      const inactiveEmployees = totalEmployeesAll - totalEmployees;
      
      // Today's attendance (all employees)
      const presentToday = await Attendance.countDocuments({
        date: today,
        status: 'Present'
      });
      
      const absentToday = await Attendance.countDocuments({
        date: today,
        status: 'Absent'
      });
      
      const onLeaveToday = await Attendance.countDocuments({
        date: today,
        status: 'On Leave'
      });
      
      const attendancePercentage = totalEmployees > 0 
        ? Math.round((presentToday / totalEmployees) * 100) 
        : 0;
      
      // Leave statistics (all employees)
      const pendingApprovals = await Leave.countDocuments({
        status: { $in: ['Pending', 'Manager Approved'] }
      });
      
      const approvedLeaves = await Leave.countDocuments({
        status: 'Approved'
      });
      
      const rejectedLeaves = await Leave.countDocuments({
        status: 'Rejected'
      });
      
      // Grievance statistics (all employees)
      const openTickets = await Grievance.countDocuments({
        status: { $in: ['Open', 'In Progress'] }
      });
      
      const resolvedTickets = await Grievance.countDocuments({
        status: 'Resolved'
      });
      
      // New applications
      const newApplications = await Application.countDocuments({
        status: 'Application',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      
      // Performance reviews (all employees)
      const Performance = require('../models/Performance');
      const pendingReviews = await Performance.countDocuments({
        status: { $in: ['Draft', 'Self Assessment', 'Manager Review'] }
      });
      
      const completedReviews = await Performance.countDocuments({
        status: { $in: ['HR Review', 'Completed'] }
      });
      
      // Attendance trends (last 7 days - all employees)
      const attendanceTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const present = await Attendance.countDocuments({
          date: date,
          status: 'Present'
        });
        
        const absent = await Attendance.countDocuments({
          date: date,
          status: 'Absent'
        });
        
        attendanceTrend.push({
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          present: present,
          absent: absent,
          total: totalEmployees
        });
      }
      
      // Department distribution (all employees)
      const departmentDistribution = await Employee.aggregate([
        {
          $match: {
            'companyDetails.employmentStatus': 'Active'
          }
        },
        {
          $group: {
            _id: '$companyDetails.department',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ['$_id', 'Unassigned'] },
            value: '$count'
          }
        }
      ]);
      
      // Employee status (today) - sample of recent employees
      const recentEmployees = await Employee.find({
        'companyDetails.employmentStatus': 'Active'
      })
        .select('_id employeeId personalInfo.fullName personalInfo.email companyDetails.designation companyDetails.department')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      const employeeStatus = await Promise.all(
        recentEmployees.map(async (employee) => {
          const todayAttendance = await Attendance.findOne({
            employeeId: employee._id,
            date: today
          });
          
          return {
            _id: employee._id,
            employeeId: employee.employeeId,
            name: employee.personalInfo?.fullName || 'Unknown',
            email: employee.personalInfo?.email || '',
            designation: employee.companyDetails?.designation || '',
            department: employee.companyDetails?.department || '',
            status: todayAttendance?.status || 'Not Marked',
            punchIn: todayAttendance?.punches?.[0]?.time || null,
            punchOut: todayAttendance?.punches?.find(p => p.type === 'out')?.time || null
          };
        })
      );
      
      // Recent activities (all employees)
      const recentLeaves = await Leave.find({})
        .populate('employeeId', 'employeeId personalInfo.fullName')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('employeeId type startDate endDate status createdAt')
        .lean();
      
      const recentGrievances = await Grievance.find({})
        .populate('employeeId', 'employeeId personalInfo.fullName')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('employeeId title status createdAt')
        .lean();
      
      // Monthly attendance summary
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      monthStart.setHours(0, 0, 0, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const monthlyPresent = await Attendance.countDocuments({
        date: { $gte: monthStart, $lte: monthEnd },
        status: 'Present'
      });
      
      const monthlyAbsent = await Attendance.countDocuments({
        date: { $gte: monthStart, $lte: monthEnd },
        status: 'Absent'
      });
      
      stats.totalEmployees = totalEmployees;
      stats.inactiveEmployees = inactiveEmployees;
      stats.presentToday = presentToday;
      stats.absentToday = absentToday;
      stats.onLeaveToday = onLeaveToday;
      stats.attendancePercentage = attendancePercentage;
      stats.pendingApprovals = pendingApprovals;
      stats.approvedLeaves = approvedLeaves;
      stats.rejectedLeaves = rejectedLeaves;
      stats.openTickets = openTickets;
      stats.resolvedTickets = resolvedTickets;
      stats.newApplications = newApplications;
      stats.pendingReviews = pendingReviews;
      stats.completedReviews = completedReviews;
      stats.attendanceTrend = attendanceTrend;
      stats.departmentDistribution = departmentDistribution;
      stats.employeeStatus = employeeStatus;
      stats.recentLeaves = recentLeaves;
      stats.recentGrievances = recentGrievances;
      stats.monthlyPresent = monthlyPresent;
      stats.monthlyAbsent = monthlyAbsent;
      
    } else if (req.user.role === 'admin') {
      // Admin dashboard - Comprehensive data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const totalEmployees = await Employee.countDocuments();
      const activeEmployees = await Employee.countDocuments({ 'companyDetails.employmentStatus': 'Active' });
      const inactiveEmployees = await Employee.countDocuments({ 'companyDetails.employmentStatus': { $ne: 'Active' } });
      const totalDepartments = await Employee.distinct('companyDetails.department');
      const User = require('../models/User');
      const totalUsers = await User.countDocuments();
      
      // Today's attendance stats
      const todayAttendance = await Attendance.find({ date: today });
      const presentToday = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Complete').length;
      const absentToday = todayAttendance.filter(a => a.status === 'Absent').length;
      const onLeaveToday = await Leave.countDocuments({
        startDate: { $lte: today },
        endDate: { $gte: today },
        status: { $in: ['HR Approved', 'Manager Approved'] }
      });
      const attendancePercentage = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0;
      
      // Pending approvals
      const pendingApprovals = await Leave.countDocuments({ status: { $in: ['Pending', 'Manager Approved'] } });
      const approvedLeaves = await Leave.countDocuments({ status: 'HR Approved' });
      const rejectedLeaves = await Leave.countDocuments({ status: { $in: ['HR Rejected', 'Manager Rejected'] } });
      
      // Grievances
      const openTickets = await Grievance.countDocuments({ status: { $in: ['Open', 'In Progress'] } });
      const resolvedTickets = await Grievance.countDocuments({ status: 'Resolved' });
      
      // Recruitment stats
      const Application = require('../models/Application');
      const newApplications = await Application.countDocuments({ status: 'Application' });
      const Job = require('../models/Job');
      const activeJobs = await Job.countDocuments({ status: 'Active' });
      
      // Performance reviews
      const Performance = require('../models/Performance');
      const pendingReviews = await Performance.countDocuments({ status: { $in: ['Pending', 'Manager Review'] } });
      const completedReviews = await Performance.countDocuments({ status: 'Completed' });
      
      // Payroll
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const payrolls = await Payroll.find({
        'payPeriod.month': currentMonth,
        'payPeriod.year': currentYear
      });
      const totalPayrollCost = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
      
      // Attendance trend (last 7 days)
      const attendanceTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayAttendance = await Attendance.find({ date });
        const present = dayAttendance.filter(a => a.status === 'Present' || a.status === 'Complete').length;
        
        attendanceTrend.push({
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          present,
          total: totalEmployees
        });
      }
      
      // Department distribution
      const departmentDistribution = {};
      const employeesByDept = await Employee.aggregate([
        { $group: { _id: '$companyDetails.department', count: { $sum: 1 } } }
      ]);
      employeesByDept.forEach(dept => {
        if (dept._id) {
          departmentDistribution[dept._id] = dept.count;
        }
      });
      
      // Recent employee status (today)
      const employeeStatus = [];
      const allEmployees = await Employee.find({}).limit(20);
      for (const emp of allEmployees) {
        const empAttendance = await Attendance.findOne({ employeeId: emp._id, date: today });
        const isOnLeave = await Leave.findOne({
          employeeId: emp._id,
          startDate: { $lte: today },
          endDate: { $gte: today },
          status: { $in: ['HR Approved', 'Manager Approved'] }
        });
        
        let status = 'Not Marked';
        let punchIn = null;
        
        if (empAttendance) {
          status = empAttendance.status;
          punchIn = empAttendance.punches?.[0]?.time;
        } else if (isOnLeave) {
          status = 'On Leave';
        }
        
        employeeStatus.push({
          _id: emp._id,
          name: emp.personalInfo?.fullName || emp.employeeId || 'Unknown',
          employeeId: emp.employeeId,
          designation: emp.companyDetails?.designation,
          department: emp.companyDetails?.department,
          status,
          punchIn
        });
      }
      
      // Recent leaves
      const recentLeaves = await Leave.find({})
        .populate('employeeId', 'employeeId personalInfo.fullName')
        .sort({ appliedAt: -1 })
        .limit(5);
      
      // Recent grievances
      const recentGrievances = await Grievance.find({})
        .populate('employeeId', 'employeeId personalInfo.fullName')
        .sort({ createdAt: -1 })
        .limit(5);
      
      stats.totalEmployees = totalEmployees;
      stats.activeEmployees = activeEmployees;
      stats.inactiveEmployees = inactiveEmployees;
      stats.totalDepartments = totalDepartments.length;
      stats.totalUsers = totalUsers;
      stats.totalPayrollCost = totalPayrollCost;
      stats.presentToday = presentToday;
      stats.absentToday = absentToday;
      stats.onLeaveToday = onLeaveToday;
      stats.attendancePercentage = attendancePercentage;
      stats.pendingApprovals = pendingApprovals;
      stats.approvedLeaves = approvedLeaves;
      stats.rejectedLeaves = rejectedLeaves;
      stats.openTickets = openTickets;
      stats.resolvedTickets = resolvedTickets;
      stats.newApplications = newApplications;
      stats.activeJobs = activeJobs;
      stats.pendingReviews = pendingReviews;
      stats.completedReviews = completedReviews;
      stats.attendanceTrend = attendanceTrend;
      stats.departmentDistribution = departmentDistribution;
      stats.employeeStatus = employeeStatus;
      stats.recentLeaves = recentLeaves;
      stats.recentGrievances = recentGrievances;
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

