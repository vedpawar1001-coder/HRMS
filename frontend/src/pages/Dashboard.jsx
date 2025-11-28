import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  FiUsers,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertCircle,
  FiCheckCircle,
  FiUserCheck,
  FiBell,
  FiActivity,
  FiAward,
  FiTarget,
  FiBarChart2,
  FiArrowUp,
  FiArrowDown,
  FiZap,
  FiStar,
  FiEye,
  FiX,
  FiUser,
  FiFileText,
  FiBriefcase
} from 'react-icons/fi'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [managerProfile, setManagerProfile] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [pendingHRProfiles, setPendingHRProfiles] = useState([])
  const [loadingHRProfiles, setLoadingHRProfiles] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchAnnouncements()
    if (user?.role === 'employee') {
      fetchEmployeeProfile()
    } else if (user?.role === 'manager') {
      fetchManagerProfile()
      fetchPendingHRProfiles()
    } else if (user?.role === 'hr' || user?.role === 'admin') {
      fetchHRProfile()
    }
  }, [user])

  const fetchStats = async () => {
    try {
      const { data } = await axios.get('/api/dashboard/stats')
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployeeProfile = async () => {
    try {
      const { data } = await axios.get('/api/profile/my-profile')
      setEmployeeProfile(data)
    } catch (error) {
      console.error('Error fetching employee profile:', error)
      // If profile doesn't exist, that's okay - we'll fall back to email
    }
  }

  const fetchManagerProfile = async () => {
    try {
      // Managers use the same profile endpoint as employees
      const { data } = await axios.get('/api/profile/my-profile')
      setManagerProfile(data)
    } catch (error) {
      console.error('Error fetching manager profile:', error)
      // If profile doesn't exist, that's okay - we'll fall back to email
    }
  }

  const fetchHRProfile = async () => {
    try {
      // HR users have their own profile endpoint
      const { data } = await axios.get('/api/hr-profile/my-profile')
      setManagerProfile(data)
    } catch (error) {
      console.error('Error fetching HR profile:', error)
      // If profile doesn't exist, that's okay - we'll fall back to email
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const { data } = await axios.get('/api/engagement/announcements')
      // Filter only active announcements (not expired and limit to recent ones)
      const activeAnnouncements = data.filter(announcement => {
        if (!announcement.expiryDate) return true
        return new Date(announcement.expiryDate) >= new Date()
      }).slice(0, 10) // Limit to 10 most recent
      setAnnouncements(activeAnnouncements)
    } catch (error) {
      console.error('Error fetching announcements:', error)
    }
  }

  const fetchPendingHRProfiles = async () => {
    if (user?.role !== 'manager') return
    setLoadingHRProfiles(true)
    try {
      const { data } = await axios.get('/api/hr-profile/pending-approvals')
      setPendingHRProfiles(data || [])
    } catch (error) {
      console.error('Error fetching pending HR profiles:', error)
      setPendingHRProfiles([])
    } finally {
      setLoadingHRProfiles(false)
    }
  }

  const handleApproveHRProfile = async (hrProfileId, status, comments = '') => {
    try {
      await axios.put(`/api/hr-profile/${hrProfileId}/approve`, {
        status: status === 'Approved' ? 'Approved' : 'Rejected',
        comments: comments
      })
      // Refresh the list
      fetchPendingHRProfiles()
      // Show success message
      toast.success(`HR profile ${status === 'Approved' ? 'approved' : 'rejected'} successfully`)
    } catch (error) {
      console.error('Error approving HR profile:', error)
      const errorMessage = error.response?.data?.message || 'Failed to approve HR profile'
      toast.error(errorMessage)
    }
  }

  // Get display name - prefer full name, fallback to email
  const getDisplayName = () => {
    // Check employee profile (for employees)
    if (employeeProfile?.personalInfo?.fullName) {
      return employeeProfile.personalInfo.fullName
    }
    // Check manager/HR profile (for managers, HR, admin)
    if (managerProfile?.personalInfo?.fullName) {
      return managerProfile.personalInfo.fullName
    }
    // Fallback to email
    return user?.email || 'User'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const renderEmployeeDashboard = () => {
    const attendanceHistory = stats?.attendanceHistory || [];
    const monthlyChartData = stats?.monthlyChartData || [];
    const upcomingLeaves = stats?.upcomingLeaves || [];
    const recentLeaves = stats?.recentLeaves || [];
    const monthlyStats = stats?.monthlyStats || {};
    const weekSummary = stats?.weekSummary || {};
    const latestPerformance = stats?.latestPerformance;
    const attendanceToday = stats?.attendanceToday;

    const leaveData = [
      { name: 'CL', value: stats?.leaveBalance?.CL || 0, color: '#3b82f6' },
      { name: 'PL', value: stats?.leaveBalance?.PL || 0, color: '#10b981' },
      { name: 'SL', value: stats?.leaveBalance?.SL || 0, color: '#f59e0b' },
    ];

    const totalLeaveBalance = (stats?.leaveBalance?.CL || 0) + (stats?.leaveBalance?.PL || 0) + (stats?.leaveBalance?.SL || 0);
    const attendancePercentage = monthlyStats.totalDays > 0 
      ? ((monthlyStats.presentDays || 0) / monthlyStats.totalDays * 100).toFixed(1)
      : 0;

    const getStatusColor = (status) => {
      const colors = {
        'Present': 'bg-green-100 text-green-800 border-green-300',
        'Absent': 'bg-red-100 text-red-800 border-red-300',
        'On Leave': 'bg-yellow-100 text-yellow-800 border-yellow-300',
        'Not Marked': 'bg-gray-100 text-gray-800 border-gray-300',
        'Complete': 'bg-emerald-100 text-emerald-800 border-emerald-300',
        'Late Entry': 'bg-orange-100 text-orange-800 border-orange-300'
      };
      return colors[status] || colors['Not Marked'];
    };

    const getStatusIcon = (status) => {
      if (status === 'Present' || status === 'Complete') return <FiCheckCircle className="text-green-600" />;
      if (status === 'Absent') return <FiX className="text-red-600" />;
      if (status === 'On Leave') return <FiCalendar className="text-yellow-600" />;
      if (status === 'Late Entry') return <FiClock className="text-orange-600" />;
      return <FiAlertCircle className="text-gray-600" />;
    };

    return (
      <>
        {/* Hero Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 md:mb-8 shadow-2xl"
        >
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 break-words">
                  Welcome back, {getDisplayName()}! 👋
                </h2>
                <p className="text-blue-100 text-sm sm:text-base md:text-lg">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 w-full sm:w-auto">
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-center border border-white border-opacity-30 flex-1 sm:flex-none">
                  <p className="text-white text-xs sm:text-sm font-medium mb-1">This Month</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{monthlyStats.presentDays || 0}/{monthlyStats.totalDays || 0}</p>
                  <p className="text-blue-100 text-xs mt-1">Days Present</p>
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-center border border-white border-opacity-30 flex-1 sm:flex-none">
                  <p className="text-white text-xs sm:text-sm font-medium mb-1">Leave Balance</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{totalLeaveBalance}</p>
                  <p className="text-blue-100 text-xs mt-1">Days Available</p>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-white opacity-5 rounded-full -mr-16 sm:-mr-24 md:-mr-32 -mt-16 sm:-mt-24 md:-mt-32"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-36 sm:h-36 md:w-48 md:h-48 bg-white opacity-5 rounded-full -ml-12 sm:-ml-18 md:-ml-24 -mb-12 sm:-mb-18 md:-mb-24"></div>
        </motion.div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiClock className="text-blue-200" size={18} />
                    <p className="text-blue-100 text-sm font-medium">Today's Status</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {attendanceToday?.status || 'Not Punched'}
                  </p>
                  {attendanceToday?.totalWorkingHours ? (
                    <p className="text-blue-200 text-sm mt-2 flex items-center">
                      <FiActivity className="mr-1" size={14} />
                      {attendanceToday.totalWorkingHours.toFixed(1)} hrs worked
                    </p>
                  ) : (
                    <p className="text-blue-200 text-sm mt-2">No attendance marked</p>
                  )}
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  {getStatusIcon(attendanceToday?.status || 'Not Marked')}
                </div>
              </div>
              {attendanceToday?.punches?.[0] && (
                <div className="mt-4 pt-4 border-t border-blue-400 border-opacity-30">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-blue-200">Punch In</p>
                      <p className="text-white font-semibold">
                        {new Date(attendanceToday.punches[0].time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {attendanceToday.punches[1] && (
                      <div className="text-right">
                        <p className="text-blue-200">Punch Out</p>
                        <p className="text-white font-semibold">
                          {new Date(attendanceToday.punches[1].time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiCalendar className="text-green-200" size={18} />
                    <p className="text-green-100 text-sm font-medium">Leave Balance</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {totalLeaveBalance}
                    <span className="text-xl text-green-200 font-normal"> Days</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                      <p className="text-green-200">CL</p>
                      <p className="text-white font-bold">{stats?.leaveBalance?.CL || 0}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                      <p className="text-green-200">PL</p>
                      <p className="text-white font-bold">{stats?.leaveBalance?.PL || 0}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-2 text-center">
                      <p className="text-green-200">SL</p>
                      <p className="text-white font-bold">{stats?.leaveBalance?.SL || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiCalendar size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiTrendingUp className="text-purple-200" size={18} />
                    <p className="text-purple-100 text-sm font-medium">Monthly Attendance</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {monthlyStats.presentDays || 0}
                    <span className="text-xl text-purple-200 font-normal">/{monthlyStats.totalDays || 0}</span>
                  </p>
                  <div className="flex items-center space-x-2 mt-3">
                    <div className="flex-1 bg-purple-400 bg-opacity-30 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${attendancePercentage}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className={`h-full rounded-full ${
                          attendancePercentage >= 90 ? 'bg-green-300' :
                          attendancePercentage >= 70 ? 'bg-yellow-300' : 'bg-red-300'
                        }`}
                      ></motion.div>
                    </div>
                    <span className="text-purple-200 text-xs font-semibold">{attendancePercentage}%</span>
                  </div>
                  <p className="text-purple-200 text-sm mt-2 flex items-center">
                    <FiClock className="mr-1" size={14} />
                    {monthlyStats.totalWorkingHours?.toFixed(1) || 0} hrs this month
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiTrendingUp size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiCheckCircle className="text-orange-200" size={18} />
                    <p className="text-orange-100 text-sm font-medium">This Week</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {weekSummary.daysWorked || 0}
                    <span className="text-xl text-orange-200 font-normal"> Days</span>
                  </p>
                  <div className="mt-3 space-y-1">
                    <p className="text-orange-200 text-sm flex items-center">
                      <FiClock className="mr-1" size={14} />
                      {weekSummary.totalHours?.toFixed(1) || 0} hrs worked
                    </p>
                    {weekSummary.averageHours > 0 && (
                      <p className="text-orange-200 text-sm flex items-center">
                        <FiBarChart2 className="mr-1" size={14} />
                        Avg: {weekSummary.averageHours} hrs/day
                      </p>
                    )}
                  </div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiCheckCircle size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts and Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Monthly Attendance Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FiTrendingUp className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Monthly Attendance</h3>
                  <p className="text-sm text-gray-500">Last 14 days overview</p>
                </div>
              </div>
            </div>
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="flex items-center space-x-2 mb-1">
                  <FiCheckCircle className="text-green-600" size={16} />
                  <span className="text-xs text-gray-600 font-medium">Present</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{monthlyStats.presentDays || 0}</span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="flex items-center space-x-2 mb-1">
                  <FiX className="text-red-600" size={16} />
                  <span className="text-xs text-gray-600 font-medium">Absent</span>
                </div>
                <span className="text-2xl font-bold text-red-600">{monthlyStats.absentDays || 0}</span>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <div className="flex items-center space-x-2 mb-1">
                  <FiCalendar className="text-yellow-600" size={16} />
                  <span className="text-xs text-gray-600 font-medium">On Leave</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">{monthlyStats.leaveDays || 0}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChartData.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '11px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="hours" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                >
                  {monthlyChartData.slice(-14).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.status === 'Present' ? '#10b981' :
                        entry.status === 'Absent' ? '#ef4444' :
                        entry.status === 'On Leave' ? '#f59e0b' :
                        '#9ca3af'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Leave Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <FiCalendar className="text-green-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Leave Balance</h3>
                  <p className="text-sm text-gray-500">Available leave days</p>
                </div>
              </div>
            </div>
            {leaveData.some(l => l.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leaveData.filter(l => l.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {leaveData.filter(l => l.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="text-center">
                  <FiCalendar size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No leave balance available</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Attendance History & Upcoming Leaves */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Attendance History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="lg:col-span-2 card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FiClock className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Recent Attendance</h3>
                  <p className="text-sm text-gray-500">Last 7 days overview</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Date</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Day</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Punch In</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Punch Out</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((record, index) => (
                    <motion.tr 
                      key={index} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                    >
                      <td className="py-4 px-4 text-sm font-medium text-gray-700">
                        {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{record.day}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)}
                          <span>{record.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-gray-700">
                        {record.punchIn ? (
                          <span className="flex items-center space-x-1">
                            <FiClock size={14} className="text-blue-500" />
                            <span>{new Date(record.punchIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-gray-700">
                        {record.punchOut ? (
                          <span className="flex items-center space-x-1">
                            <FiClock size={14} className="text-red-500" />
                            <span>{new Date(record.punchOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm font-bold text-gray-800">
                        {record.workingHours > 0 ? (
                          <span className="text-blue-600">{record.workingHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Upcoming Leaves & Quick Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <FiCalendar className="text-green-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Upcoming Leaves</h3>
                  <p className="text-sm text-gray-500">Scheduled time off</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {upcomingLeaves.length > 0 ? (
                upcomingLeaves.map((leave, index) => (
                  <motion.div
                    key={leave._id || index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-l-4 border-green-500 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiCalendar className="text-green-600" size={18} />
                          <p className="text-sm font-bold text-gray-900">{leave.type || 'Leave'}</p>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 flex items-center space-x-1">
                          <span>{new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span>-</span>
                          <span>{new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </p>
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                          <FiCheckCircle size={12} />
                          <span>Approved</span>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <div className="bg-gray-100 rounded-full p-4 w-fit mx-auto mb-3">
                    <FiCalendar size={32} className="opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No upcoming leaves</p>
                  <p className="text-xs mt-1">Your approved leaves will appear here</p>
                </div>
              )}
            </div>

            {/* Performance Status */}
            {latestPerformance && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 pt-6 border-t border-gray-200"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FiAward className="text-blue-600" size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Performance Review</h4>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-900">{latestPerformance.reviewCycle}</p>
                    {latestPerformance.overallRating && (
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <FiStar 
                            key={i} 
                            size={16} 
                            className={i < latestPerformance.overallRating ? 'text-yellow-400 fill-current' : 'text-gray-300'} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-3 flex items-center">
                    <FiCalendar className="mr-1" size={12} />
                    Period: {latestPerformance.period}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                      latestPerformance.status === 'Completed' ? 'bg-green-100 text-green-800 border-green-300' :
                      latestPerformance.status === 'Manager Review' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                      'bg-yellow-100 text-yellow-800 border-yellow-300'
                    }`}>
                      {latestPerformance.status === 'Completed' && <FiCheckCircle size={12} />}
                      <span>{latestPerformance.status}</span>
                    </span>
                    {latestPerformance.overallRating && (
                      <span className="text-sm font-bold text-gray-700">
                        {latestPerformance.overallRating}/5
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl p-8"
        >
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Quick Actions</h3>
                <p className="text-indigo-100 text-sm">Access frequently used features</p>
              </div>
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-4 py-2">
                <FiZap className="text-white" size={24} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.a
                href="/attendance"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiClock size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Punch In/Out</p>
                <p className="text-xs text-indigo-100 mt-1">Mark attendance</p>
              </motion.a>
              <motion.a
                href="/leaves"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiCalendar size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Apply Leave</p>
                <p className="text-xs text-indigo-100 mt-1">Request time off</p>
              </motion.a>
              <motion.a
                href="/grievances"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiAlertCircle size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Raise Grievance</p>
                <p className="text-xs text-indigo-100 mt-1">Report issues</p>
              </motion.a>
              <motion.a
                href="/performance"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiTrendingUp size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">View Performance</p>
                <p className="text-xs text-indigo-100 mt-1">Check reviews</p>
              </motion.a>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
        </motion.div>
      </>
    )
  }

  const renderManagerDashboard = () => {
    const attendanceTrendData = stats?.attendanceTrend || [];
    const leaveTrendData = stats?.leaveTrend || [];
    const departmentData = stats?.departmentDistribution ? 
      Object.entries(stats.departmentDistribution).map(([name, value]) => ({ name, value })) : [];
    
    const teamMemberStatus = stats?.teamMemberStatus || [];
    const recentLeaves = stats?.recentLeaves || [];
    const recentGrievances = stats?.recentGrievances || [];
    const recentOffers = stats?.recentOffers || [];

    // Calculate attendance percentage with visual indicator
    const attendancePercentage = stats?.attendancePercentage || 0;
    const attendanceColor = attendancePercentage >= 90 ? 'green' : attendancePercentage >= 70 ? 'yellow' : 'red';

    return (
      <>
        {/* Hero Section with Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 shadow-2xl"
        >
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Welcome back, {getDisplayName()}! 👋
                </h2>
                <p className="text-indigo-100 text-sm sm:text-lg">
                  Here's your team overview for today
                </p>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-center flex-1 sm:flex-none">
                  <p className="text-white text-xs sm:text-sm font-medium mb-1">Team Size</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.teamSize || 0}</p>
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-center flex-1 sm:flex-none">
                  <p className="text-white text-xs sm:text-sm font-medium mb-1">Active Today</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.teamPresent || 0}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        </motion.div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiUserCheck className="text-blue-200" size={18} />
                    <p className="text-blue-100 text-sm font-medium">Team Present Today</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {stats?.teamPresent || 0}
                    <span className="text-xl text-blue-200 font-normal">/{stats?.teamSize || 0}</span>
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="flex-1 bg-blue-400 bg-opacity-30 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${attendancePercentage}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className={`h-full rounded-full ${
                          attendanceColor === 'green' ? 'bg-green-300' :
                          attendanceColor === 'yellow' ? 'bg-yellow-300' : 'bg-red-300'
                        }`}
                      ></motion.div>
                    </div>
                    <span className="text-blue-200 text-xs font-semibold whitespace-nowrap">
                      {attendancePercentage}%
                    </span>
                  </div>
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 group-hover:bg-opacity-30 transition-all">
                  <FiUserCheck size={36} className="text-white" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-400 border-opacity-30">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white bg-opacity-10 rounded-lg p-2 text-center">
                    <p className="text-blue-200 text-xs mb-1">Absent</p>
                    <p className="text-white font-bold text-lg">{stats?.teamAbsent || 0}</p>
                  </div>
                  <div className="bg-white bg-opacity-10 rounded-lg p-2 text-center">
                    <p className="text-blue-200 text-xs mb-1">On Leave</p>
                    <p className="text-white font-bold text-lg">{stats?.teamOnLeave || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-28 h-28 bg-white rounded-full -ml-14 -mt-14"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 bg-white rounded-full -mr-10 -mb-10"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiClock className="text-orange-200" size={18} />
                    <p className="text-orange-100 text-sm font-medium">Pending Approvals</p>
                  </div>
                  <p className="text-4xl font-bold mb-2">{stats?.pendingApprovals || 0}</p>
                  {stats?.pendingApprovals > 0 && (
                    <div className="flex items-center space-x-1 text-orange-200 text-xs">
                      <FiZap className="animate-pulse" size={12} />
                      <span>Requires Immediate Action</span>
                    </div>
                  )}
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 group-hover:bg-opacity-30 transition-all relative">
                  <FiClock size={36} className="text-white" />
                  {stats?.pendingApprovals > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-ping"></div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-orange-400 border-opacity-30">
                <div className="flex items-center justify-between">
                  <span className="text-orange-200 text-sm">Approved Today</span>
                  <span className="text-white font-bold text-lg">{stats?.approvedLeaves || 0}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white rounded-full -ml-10 -mb-10"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiAlertCircle className="text-purple-200" size={18} />
                    <p className="text-purple-100 text-sm font-medium">Team Grievances</p>
                  </div>
                  <p className="text-4xl font-bold mb-2">{stats?.teamGrievances || 0}</p>
                  <p className="text-purple-200 text-xs">Open Issues</p>
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 group-hover:bg-opacity-30 transition-all">
                  <FiAlertCircle size={36} className="text-white" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-purple-400 border-opacity-30">
                <div className="flex items-center justify-between">
                  <span className="text-purple-200 text-sm">Resolved</span>
                  <div className="flex items-center space-x-2">
                    <FiCheckCircle size={16} className="text-green-300" />
                    <span className="text-white font-bold text-lg">{stats?.resolvedGrievances || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mt-12"></div>
              <div className="absolute bottom-0 right-0 w-28 h-28 bg-white rounded-full -mr-14 -mb-14"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiTrendingUp className="text-green-200" size={18} />
                    <p className="text-green-100 text-sm font-medium">Performance Reviews</p>
                  </div>
                  <p className="text-4xl font-bold mb-2">{stats?.pendingReviews || 0}</p>
                  <p className="text-green-200 text-xs">Pending Reviews</p>
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 group-hover:bg-opacity-30 transition-all">
                  <FiAward size={36} className="text-white" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-green-400 border-opacity-30">
                <div className="flex items-center justify-between">
                  <span className="text-green-200 text-sm">Completed</span>
                  <div className="flex items-center space-x-2">
                    <FiStar size={16} className="text-yellow-300" />
                    <span className="text-white font-bold text-lg">{stats?.completedReviews || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Attendance Trend Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Attendance Trend (Last 7 Days)</h3>
              <FiTrendingUp className="text-blue-500" size={20} />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  name="Present"
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981', r: 4 }}
                  name="Total Team"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Department Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Department Distribution</h3>
              <FiUsers className="text-purple-500" size={20} />
            </div>
            {departmentData.length > 0 ? (
              <div className="pb-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <p>No department data available</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Team Member Status & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Team Member Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="lg:col-span-2 card shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Team Member Status</h3>
                <p className="text-sm text-gray-500">Real-time team overview</p>
              </div>
              <div className="bg-blue-100 rounded-xl p-3">
                <FiUsers className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {teamMemberStatus.length > 0 ? (
                teamMemberStatus.map((member, index) => {
                  const statusColors = {
                    'Present': 'bg-green-100 text-green-800',
                    'Absent': 'bg-red-100 text-red-800',
                    'On Leave': 'bg-yellow-100 text-yellow-800',
                    'Not Marked': 'bg-gray-100 text-gray-800'
                  };
                  
                  return (
                    <motion.div
                      key={member._id || index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:shadow-md transition-all duration-200 border border-gray-100 cursor-pointer group"
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          {member.status === 'Present' && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-gray-900 truncate text-base">{member.name || 'Unknown Employee'}</p>
                            {member.isHR && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                                👔 HR
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-gray-600 truncate">
                              {member.employeeId || 'N/A'}
                            </p>
                            {member.designation && (
                              <>
                                <span className="text-gray-400">•</span>
                                <p className="text-sm text-gray-600 truncate">{member.designation}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${statusColors[member.status] || statusColors['Not Marked']}`}>
                          {member.status}
                        </span>
                        {member.punchIn && (
                          <div className="flex items-center space-x-1 bg-blue-50 px-3 py-1.5 rounded-lg">
                            <FiClock size={14} className="text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">
                              {new Date(member.punchIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <FiUsers size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">No team members found</p>
                  <p className="text-sm text-gray-400">
                    Team members will appear here once they set you as their reporting manager.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Employees can set their reporting manager in their profile settings.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Recent Activities</h3>
                <p className="text-sm text-gray-500">Latest updates</p>
              </div>
              <div className="bg-orange-100 rounded-xl p-3 relative">
                <FiBell className="text-orange-600" size={24} />
                {(recentLeaves.length > 0 || recentGrievances.length > 0 || recentOffers.length > 0) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {/* Recent Leaves */}
              {recentLeaves.length > 0 && (
                <>
                  <div className="flex items-center space-x-2 mb-3">
                    <FiCalendar className="text-blue-500" size={16} />
                    <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">Leave Requests</p>
                  </div>
                  {recentLeaves.map((leave, index) => (
                    <motion.div
                      key={leave._id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-l-4 border-blue-500 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {leave.employeeId?.personalInfo?.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              {leave.employeeId?.personalInfo?.fullName || 'Unknown'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-600 ml-10">
                            <FiCalendar size={12} />
                            <span>{leave.type}</span>
                            <span>•</span>
                            <span>{new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            <span>-</span>
                            <span>{new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                          leave.status === 'Pending' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                          leave.status === 'Approved' ? 'bg-green-100 text-green-800 border border-green-200' :
                          'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {leave.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
              
              {/* Recent Grievances */}
              {recentGrievances.length > 0 && (
                <>
                  <div className="flex items-center space-x-2 mb-3 mt-4">
                    <FiAlertCircle className="text-purple-500" size={16} />
                    <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">Grievances</p>
                  </div>
                  {recentGrievances.map((grievance, index) => (
                    <motion.div
                      key={grievance._id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-l-4 border-purple-500 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {grievance.employeeId?.personalInfo?.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              {grievance.employeeId?.personalInfo?.fullName || 'Unknown'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 ml-10 truncate">{grievance.title}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                          grievance.status === 'Open' || grievance.status === 'In Progress' ? 'bg-red-100 text-red-800 border border-red-200' :
                          'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {grievance.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
              
              {/* Recent Offer Letters */}
              {recentOffers.length > 0 && (
                <>
                  <div className="flex items-center space-x-2 mb-3 mt-4">
                    <FiFileText className="text-green-500" size={16} />
                    <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">Offer Letters</p>
                  </div>
                  {recentOffers.map((offer, index) => (
                    <motion.div
                      key={offer._id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-l-4 border-green-500 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {offer.candidateInfo?.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              {offer.candidateInfo?.fullName || 'Unknown Candidate'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-600 ml-10">
                            <FiBriefcase size={12} />
                            <span>{offer.jobId?.title || 'Position'}</span>
                            <span>•</span>
                            <span>{offer.jobId?.department || 'Department'}</span>
                          </div>
                          {offer.offerLetter?.joiningDate && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500 ml-10 mt-1">
                              <FiCalendar size={12} />
                              <span>Joining: {new Date(offer.offerLetter.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                          offer.offerLetter?.status === 'Accepted' ? 'bg-green-100 text-green-800 border border-green-200' :
                          offer.offerLetter?.status === 'Rejected' ? 'bg-red-100 text-red-800 border border-red-200' :
                          offer.offerLetter?.status === 'Sent' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        }`}>
                          {offer.offerLetter?.status || 'Pending'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
              
              {recentLeaves.length === 0 && recentGrievances.length === 0 && recentOffers.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <FiBell size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">No recent activities</p>
                  <p className="text-sm text-gray-400">
                    Recent leave requests, grievances, and offer letters from your team will appear here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl"
        >
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full -mr-48 -mt-48"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white opacity-5 rounded-full -ml-36 -mb-36"></div>
          
          <div className="relative z-10 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-1">Quick Actions</h3>
                <p className="text-indigo-100 text-sm">Manage your team efficiently</p>
              </div>
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-3">
                <FiZap size={28} className="text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.a
                href="/leaves"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-5 text-center transition-all duration-300 border border-white border-opacity-20 hover:border-opacity-40 group"
              >
                <div className="bg-white bg-opacity-30 rounded-lg p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-40 transition-all">
                  <FiCalendar size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Approve Leaves</p>
                {stats?.pendingApprovals > 0 && (
                  <span className="inline-block mt-2 px-2 py-1 bg-red-500 rounded-full text-xs font-bold">
                    {stats.pendingApprovals} New
                  </span>
                )}
              </motion.a>
              <motion.a
                href="/grievances"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-5 text-center transition-all duration-300 border border-white border-opacity-20 hover:border-opacity-40 group"
              >
                <div className="bg-white bg-opacity-30 rounded-lg p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-40 transition-all">
                  <FiAlertCircle size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Resolve Issues</p>
                {stats?.teamGrievances > 0 && (
                  <span className="inline-block mt-2 px-2 py-1 bg-orange-500 rounded-full text-xs font-bold">
                    {stats.teamGrievances} Active
                  </span>
                )}
              </motion.a>
              <motion.a
                href="/performance"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-5 text-center transition-all duration-300 border border-white border-opacity-20 hover:border-opacity-40 group"
              >
                <div className="bg-white bg-opacity-30 rounded-lg p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-40 transition-all">
                  <FiTrendingUp size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Review Performance</p>
                {stats?.pendingReviews > 0 && (
                  <span className="inline-block mt-2 px-2 py-1 bg-yellow-500 rounded-full text-xs font-bold">
                    {stats.pendingReviews} Pending
                  </span>
                )}
              </motion.a>
              <motion.a
                href="/attendance"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-5 text-center transition-all duration-300 border border-white border-opacity-20 hover:border-opacity-40 group"
              >
                <div className="bg-white bg-opacity-30 rounded-lg p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-40 transition-all">
                  <FiActivity size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">View Attendance</p>
                <span className="inline-block mt-2 px-2 py-1 bg-blue-500 rounded-full text-xs font-bold">
                  Live
                </span>
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* Pending HR Profile Approvals Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card shadow-lg mb-8 border-l-4 border-orange-500"
        >
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Pending HR Profile Approvals</h3>
              <p className="text-sm text-gray-500">HR profiles waiting for your approval</p>
            </div>
            <div className="bg-orange-100 rounded-xl p-3">
              <FiUser className="text-orange-600" size={24} />
            </div>
          </div>
          {loadingHRProfiles ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : pendingHRProfiles.length > 0 ? (
            <div className="space-y-4">
              {pendingHRProfiles.map((hrProfile) => (
                <motion.div
                  key={hrProfile._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                          {hrProfile.personalInfo?.fullName?.charAt(0)?.toUpperCase() || 'H'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {hrProfile.personalInfo?.fullName || 'HR User'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {hrProfile.personalInfo?.email || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Submitted: {hrProfile.profileSubmittedAt ? new Date(hrProfile.profileSubmittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="ml-13 mt-2">
                        <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                          Status: {hrProfile.profileStatus}
                        </span>
                        <span className="ml-2 inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          Completion: {hrProfile.profileCompletion || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to approve this HR profile?')) {
                            handleApproveHRProfile(hrProfile._id, 'Approved', '')
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 shadow-md hover:shadow-lg"
                        title="Approve HR Profile"
                      >
                        <FiCheckCircle size={18} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => {
                          const comments = prompt('Please provide a reason for rejection (optional):')
                          if (comments !== null) {
                            handleApproveHRProfile(hrProfile._id, 'Rejected', comments || '')
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 shadow-md hover:shadow-lg"
                        title="Reject HR Profile"
                      >
                        <FiX size={18} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FiCheckCircle className="mx-auto mb-2 text-green-500" size={32} />
              <p className="text-sm">No pending HR profile approvals</p>
            </div>
          )}
        </motion.div>
      </>
    )
  }

  const renderHRDashboard = () => {
    const attendanceTrendData = stats?.attendanceTrend || [];
    const departmentData = stats?.departmentDistribution || [];
    const employeeStatus = stats?.employeeStatus || [];
    const recentLeaves = stats?.recentLeaves || [];
    const recentGrievances = stats?.recentGrievances || [];
    const recentOffers = stats?.recentOffers || [];

    return (
      <>
        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-blue-100 text-sm font-medium mb-1">Total Employees</p>
                <p className="text-3xl font-bold">{stats?.totalEmployees || 0}</p>
                <p className="text-blue-200 text-xs mt-2">Active Employees</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiUsers size={32} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-400 border-opacity-30">
              <p className="text-blue-200 text-sm">Inactive: {stats?.inactiveEmployees || 0}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white shadow-xl hover:shadow-2xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-green-100 text-sm font-medium mb-1">Present Today</p>
                <p className="text-3xl font-bold">{stats?.presentToday || 0}</p>
                <p className="text-green-200 text-xs mt-2">{stats?.attendancePercentage || 0}% Attendance Rate</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiCheckCircle size={32} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-green-400 border-opacity-30">
              <div className="flex justify-between text-sm">
                <span className="text-green-200">Absent: {stats?.absentToday || 0}</span>
                <span className="text-green-200">On Leave: {stats?.onLeaveToday || 0}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl hover:shadow-2xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-orange-100 text-sm font-medium mb-1">Pending Approvals</p>
                <p className="text-3xl font-bold">{stats?.pendingApprovals || 0}</p>
                <p className="text-orange-200 text-xs mt-2">Requires Action</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiClock size={32} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-orange-400 border-opacity-30">
              <div className="flex justify-between text-sm">
                <span className="text-orange-200">Approved: {stats?.approvedLeaves || 0}</span>
                <span className="text-orange-200">Rejected: {stats?.rejectedLeaves || 0}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-purple-100 text-sm font-medium mb-1">Open Grievances</p>
                <p className="text-3xl font-bold">{stats?.openTickets || 0}</p>
                <p className="text-purple-200 text-xs mt-2">Active Issues</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiAlertCircle size={32} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-purple-400 border-opacity-30">
              <p className="text-purple-200 text-sm">Resolved: {stats?.resolvedTickets || 0}</p>
            </div>
          </motion.div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-indigo-100 text-sm font-medium mb-1">Performance Reviews</p>
                <p className="text-3xl font-bold">{stats?.pendingReviews || 0}</p>
                <p className="text-indigo-200 text-xs mt-2">Pending Reviews</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiTrendingUp size={32} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-indigo-400 border-opacity-30">
              <p className="text-indigo-200 text-sm">Completed: {stats?.completedReviews || 0}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700 text-white shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-teal-100 text-sm font-medium mb-1">This Month</p>
                <p className="text-3xl font-bold">{stats?.monthlyPresent || 0}</p>
                <p className="text-teal-200 text-xs mt-2">Present Days</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiCalendar size={32} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-teal-400 border-opacity-30">
              <p className="text-teal-200 text-sm">Absent: {stats?.monthlyAbsent || 0}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card bg-gradient-to-br from-pink-500 via-pink-600 to-pink-700 text-white shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-pink-100 text-sm font-medium mb-1">New Applications</p>
                <p className="text-3xl font-bold">{stats?.newApplications || 0}</p>
                <p className="text-pink-200 text-xs mt-2">Last 7 Days</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <FiUsers size={32} className="text-white" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Attendance Trend Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Attendance Trend (Last 7 Days)</h3>
              <FiTrendingUp className="text-blue-500" size={20} />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 5 }}
                  name="Present"
                />
                <Line 
                  type="monotone" 
                  dataKey="absent" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  dot={{ fill: '#ef4444', r: 5 }}
                  name="Absent"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Department Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Department Distribution</h3>
              <FiUsers className="text-purple-500" size={20} />
            </div>
            {departmentData.length > 0 ? (
              <div className="pb-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <p>No department data available</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Employee Status & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Employee Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 card shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Employee Status (Recent)</h3>
              <FiUsers className="text-blue-500" size={20} />
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {employeeStatus.length > 0 ? (
                employeeStatus.map((employee, index) => {
                  const statusColors = {
                    'Present': 'bg-green-100 text-green-800',
                    'Absent': 'bg-red-100 text-red-800',
                    'On Leave': 'bg-yellow-100 text-yellow-800',
                    'Not Marked': 'bg-gray-100 text-gray-800'
                  };
                  
                  return (
                    <motion.div
                      key={employee._id || index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {employee.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{employee.name || 'Unknown Employee'}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {employee.employeeId || 'N/A'} {employee.designation ? `• ${employee.designation}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[employee.status] || statusColors['Not Marked']}`}>
                          {employee.status}
                        </span>
                        {employee.punchIn && (
                          <span className="text-xs text-gray-500">
                            {new Date(employee.punchIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <FiUsers size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">No employees found</p>
                  <p className="text-sm text-gray-400">
                    Employee status will appear here once they start using the system.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Recent Activities</h3>
              <FiBell className="text-orange-500" size={20} />
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {/* Recent Leaves */}
              {recentLeaves.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Leave Requests</p>
                  {recentLeaves.map((leave, index) => (
                    <div
                      key={leave._id || index}
                      className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {leave.employeeId?.personalInfo?.fullName || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {leave.type} • {new Date(leave.startDate).toLocaleDateString('en-GB')} - {new Date(leave.endDate).toLocaleDateString('en-GB')}
                      </p>
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                        leave.status === 'Pending' || leave.status === 'Manager Approved' ? 'bg-orange-100 text-orange-800' :
                        leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                  ))}
                </>
              )}
              
              {/* Recent Grievances */}
              {recentGrievances.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 mt-4">Grievances</p>
                  {recentGrievances.map((grievance, index) => (
                    <div
                      key={grievance._id || index}
                      className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {grievance.employeeId?.personalInfo?.fullName || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 truncate">{grievance.title}</p>
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                        grievance.status === 'Open' || grievance.status === 'In Progress' ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {grievance.status}
                      </span>
                    </div>
                  ))}
                </>
              )}
              
              {/* Recent Offer Letters */}
              {recentOffers.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 mt-4">Offer Letters</p>
                  {recentOffers.map((offer, index) => (
                    <div
                      key={offer._id || index}
                      className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {offer.candidateInfo?.fullName || 'Unknown Candidate'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {offer.jobId?.title || 'Position'} • {offer.jobId?.department || 'Department'}
                      </p>
                      {offer.offerLetter?.joiningDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Joining: {new Date(offer.offerLetter.joiningDate).toLocaleDateString('en-GB')}
                        </p>
                      )}
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                        offer.offerLetter?.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                        offer.offerLetter?.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        offer.offerLetter?.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {offer.offerLetter?.status || 'Pending'}
                      </span>
                    </div>
                  ))}
                </>
              )}
              
              {recentLeaves.length === 0 && recentGrievances.length === 0 && recentOffers.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <FiBell size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">No recent activities</p>
                  <p className="text-sm text-gray-400">
                    Recent leave requests, grievances, and offer letters will appear here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl"
        >
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            <a
              href="/employees"
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition-all transform hover:scale-105"
            >
              <FiUsers size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Manage Employees</p>
            </a>
            <a
              href="/leaves"
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition-all transform hover:scale-105"
            >
              <FiCalendar size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Approve Leaves</p>
            </a>
            <a
              href="/grievances"
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition-all transform hover:scale-105"
            >
              <FiAlertCircle size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Resolve Issues</p>
            </a>
            <a
              href="/attendance"
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition-all transform hover:scale-105"
            >
              <FiClock size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">View Attendance</p>
            </a>
            <a
              href="/performance"
              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition-all transform hover:scale-105"
            >
              <FiTrendingUp size={24} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Performance</p>
            </a>
          </div>
        </motion.div>
      </>
    )
  }

  const renderAdminDashboard = () => {
    const attendanceTrend = stats?.attendanceTrend || [];
    const departmentData = stats?.departmentDistribution ? 
      Object.entries(stats.departmentDistribution).map(([name, value]) => ({ name, value })) : [];
    const employeeStatus = stats?.employeeStatus || [];
    const recentLeaves = stats?.recentLeaves || [];
    const recentGrievances = stats?.recentGrievances || [];
    
    const attendancePercentage = parseFloat(stats?.attendancePercentage || 0);
    const attendanceColor = attendancePercentage >= 90 ? 'green' : attendancePercentage >= 70 ? 'yellow' : 'red';

    return (
      <>
        {/* Hero Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 mb-8 shadow-2xl"
        >
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Welcome back, {getDisplayName()}! 👋
                </h2>
                <p className="text-indigo-100 text-lg">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-6 py-4 text-center border border-white border-opacity-30">
                  <p className="text-white text-sm font-medium mb-1">Total Employees</p>
                  <p className="text-3xl font-bold text-white">{stats?.totalEmployees || 0}</p>
                  <p className="text-indigo-100 text-xs mt-1">{stats?.activeEmployees || 0} Active</p>
                </div>
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-6 py-4 text-center border border-white border-opacity-30">
                  <p className="text-white text-sm font-medium mb-1">Today's Attendance</p>
                  <p className="text-3xl font-bold text-white">{stats?.presentToday || 0}/{stats?.totalEmployees || 0}</p>
                  <p className="text-indigo-100 text-xs mt-1">{attendancePercentage}% Present</p>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        </motion.div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiUsers className="text-blue-200" size={18} />
                    <p className="text-blue-100 text-sm font-medium">Total Employees</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {stats?.totalEmployees || 0}
                  </p>
                  <div className="mt-3 space-y-1">
                    <p className="text-blue-200 text-sm flex items-center">
                      <FiCheckCircle className="mr-1" size={14} />
                      {stats?.activeEmployees || 0} Active
                    </p>
                    <p className="text-blue-200 text-sm flex items-center">
                      <FiUsers className="mr-1" size={14} />
                      {stats?.inactiveEmployees || 0} Inactive
                    </p>
                  </div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiUsers size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiUserCheck className="text-green-200" size={18} />
                    <p className="text-green-100 text-sm font-medium">Today's Attendance</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {stats?.presentToday || 0}
                    <span className="text-xl text-green-200 font-normal">/{stats?.totalEmployees || 0}</span>
                  </p>
                  <div className="flex items-center space-x-2 mt-3">
                    <div className="flex-1 bg-green-400 bg-opacity-30 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${attendancePercentage}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className={`h-full rounded-full ${
                          attendanceColor === 'green' ? 'bg-green-300' :
                          attendanceColor === 'yellow' ? 'bg-yellow-300' : 'bg-red-300'
                        }`}
                      ></motion.div>
                    </div>
                    <span className="text-green-200 text-xs font-semibold">{attendancePercentage}%</span>
                  </div>
                  <p className="text-green-200 text-sm mt-2 flex items-center">
                    <FiAlertCircle className="mr-1" size={14} />
                    {stats?.absentToday || 0} Absent, {stats?.onLeaveToday || 0} On Leave
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiUserCheck size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiUsers className="text-purple-200" size={18} />
                    <p className="text-purple-100 text-sm font-medium">Departments</p>
                  </div>
                  <p className="text-4xl font-bold mb-1">
                    {stats?.totalDepartments || 0}
                  </p>
                  <p className="text-purple-200 text-sm mt-2 flex items-center">
                    <FiTarget className="mr-1" size={14} />
                    {stats?.totalUsers || 0} Total Users
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiUsers size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative overflow-hidden card bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiDollarSign className="text-orange-200" size={18} />
                    <p className="text-orange-100 text-sm font-medium">Monthly Payroll</p>
                  </div>
                  <p className="text-3xl font-bold mb-1">
                    ₹{(stats?.totalPayrollCost || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-orange-200 text-sm mt-2 flex items-center">
                    <FiTrendingUp className="mr-1" size={14} />
                    Current month cost
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4 group-hover:bg-opacity-30 transition-all">
                  <FiDollarSign size={32} className="text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Secondary Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="card bg-white border-2 border-blue-200 hover:border-blue-400 transition-all"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FiCalendar className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending Approvals</p>
                <p className="text-xl font-bold text-gray-900">{stats?.pendingApprovals || 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="card bg-white border-2 border-green-200 hover:border-green-400 transition-all"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <FiCheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600">Approved Leaves</p>
                <p className="text-xl font-bold text-gray-900">{stats?.approvedLeaves || 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="card bg-white border-2 border-red-200 hover:border-red-400 transition-all"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <FiAlertCircle className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600">Open Tickets</p>
                <p className="text-xl font-bold text-gray-900">{stats?.openTickets || 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="card bg-white border-2 border-purple-200 hover:border-purple-400 transition-all"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FiTarget className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600">New Applications</p>
                <p className="text-xl font-bold text-gray-900">{stats?.newApplications || 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="card bg-white border-2 border-yellow-200 hover:border-yellow-400 transition-all"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <FiAward className="text-yellow-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending Reviews</p>
                <p className="text-xl font-bold text-gray-900">{stats?.pendingReviews || 0}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Attendance Trend Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FiTrendingUp className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Attendance Trend</h3>
                  <p className="text-sm text-gray-500">Last 7 days</p>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#9ca3af" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#9ca3af', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Department Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <FiUsers className="text-purple-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Department Distribution</h3>
                  <p className="text-sm text-gray-500">Employee count by department</p>
                </div>
              </div>
            </div>
            {departmentData.length > 0 ? (
              <div className="pb-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="text-center">
                  <FiUsers size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No department data available</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Employee Status & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Employee Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="lg:col-span-2 card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FiUsers className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Employee Status</h3>
                  <p className="text-sm text-gray-500">Today's attendance overview</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {employeeStatus.length > 0 ? (
                employeeStatus.map((employee, index) => {
                  const statusColors = {
                    'Present': 'bg-green-100 text-green-800 border-green-300',
                    'Absent': 'bg-red-100 text-red-800 border-red-300',
                    'On Leave': 'bg-yellow-100 text-yellow-800 border-yellow-300',
                    'Not Marked': 'bg-gray-100 text-gray-800 border-gray-300',
                    'Complete': 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  };
                  
                  return (
                    <motion.div
                      key={employee._id || index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl hover:shadow-md transition-all duration-200 border border-gray-200"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          {employee.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{employee.name || 'Unknown Employee'}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-gray-600 truncate">
                              {employee.employeeId || 'N/A'}
                            </p>
                            {employee.designation && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-sm text-gray-600 truncate">{employee.designation}</p>
                              </>
                            )}
                            {employee.department && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-sm text-gray-600 truncate">{employee.department}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[employee.status] || statusColors['Not Marked']}`}>
                          {employee.status === 'Present' && <FiCheckCircle size={12} />}
                          {employee.status === 'Absent' && <FiX size={12} />}
                          {employee.status === 'On Leave' && <FiCalendar size={12} />}
                          <span>{employee.status}</span>
                        </span>
                        {employee.punchIn && (
                          <span className="text-xs font-medium text-gray-600 flex items-center">
                            <FiClock className="mr-1" size={12} />
                            {new Date(employee.punchIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <div className="bg-gray-100 rounded-full p-4 w-fit mx-auto mb-3">
                    <FiUsers size={32} className="opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No employee data available</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            className="card shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <FiActivity className="text-indigo-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Recent Activities</h3>
                  <p className="text-sm text-gray-500">Latest updates</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {/* Recent Leaves */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <FiCalendar className="mr-2 text-green-600" size={16} />
                  Recent Leaves
                </h4>
                <div className="space-y-2">
                  {recentLeaves.length > 0 ? (
                    recentLeaves.slice(0, 3).map((leave, index) => (
                      <motion.div
                        key={leave._id || index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500"
                      >
                        <p className="text-xs font-bold text-gray-900">
                          {leave.employeeId?.personalInfo?.fullName || leave.employeeId?.employeeId || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                          leave.status === 'HR Approved' ? 'bg-green-100 text-green-800' :
                          leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {leave.status}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">No recent leaves</p>
                  )}
                </div>
              </div>

              {/* Recent Grievances */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <FiAlertCircle className="mr-2 text-red-600" size={16} />
                  Recent Grievances
                </h4>
                <div className="space-y-2">
                  {recentGrievances.length > 0 ? (
                    recentGrievances.slice(0, 3).map((grievance, index) => (
                      <motion.div
                        key={grievance._id || index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border-l-4 border-red-500"
                      >
                        <p className="text-xs font-bold text-gray-900">
                          {grievance.employeeId?.personalInfo?.fullName || grievance.employeeId?.employeeId || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {grievance.subject || 'No subject'}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                          grievance.status === 'Open' ? 'bg-red-100 text-red-800' :
                          grievance.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {grievance.status}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">No recent grievances</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl p-8"
        >
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Quick Actions</h3>
                <p className="text-indigo-100 text-sm">Access frequently used features</p>
              </div>
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl px-4 py-2">
                <FiZap className="text-white" size={24} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <motion.a
                href="/employees"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiUsers size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Employees</p>
                <p className="text-xs text-indigo-100 mt-1">Manage team</p>
              </motion.a>
              <motion.a
                href="/attendance"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiClock size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Attendance</p>
                <p className="text-xs text-indigo-100 mt-1">View records</p>
              </motion.a>
              <motion.a
                href="/leaves"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiCalendar size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Leaves</p>
                <p className="text-xs text-indigo-100 mt-1">Approve requests</p>
              </motion.a>
              <motion.a
                href="/grievances"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiAlertCircle size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Grievances</p>
                <p className="text-xs text-indigo-100 mt-1">Handle tickets</p>
              </motion.a>
              <motion.a
                href="/recruitment"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-xl p-6 text-center transition-all duration-300 border border-white border-opacity-30 group"
              >
                <div className="bg-white bg-opacity-20 rounded-full p-3 w-fit mx-auto mb-3 group-hover:bg-opacity-30 transition-all">
                  <FiTarget size={28} className="text-white" />
                </div>
                <p className="text-sm font-semibold">Recruitment</p>
                <p className="text-xs text-indigo-100 mt-1">View applications</p>
              </motion.a>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
        </motion.div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {getDisplayName()}</p>
      </div>

      {/* Announcements Scrolling Banner */}
      {announcements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 rounded-lg shadow-xl border-2 border-blue-500"
        >
          {/* Gradient fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-blue-600 to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-blue-600 to-transparent z-10 pointer-events-none"></div>
          
          <div className="flex items-center py-4 px-6">
            <div className="flex-shrink-0 z-20 mr-4">
              <div className="bg-white bg-opacity-20 rounded-full p-2">
                <FiBell className="text-white animate-pulse" size={24} />
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <div className="announcements-scroll flex space-x-12 whitespace-nowrap">
                {/* Duplicate content for seamless loop */}
                {[...announcements, ...announcements].map((announcement, index) => (
                  <div 
                    key={`${announcement._id || index}-${Math.floor(index / announcements.length)}`} 
                    className="inline-flex items-center"
                  >
                    <span className="text-white font-medium text-base md:text-lg">
                      {announcement.isPinned && (
                        <span className="inline-block mr-2 animate-bounce">📌</span>
                      )}
                      <span className="font-bold mr-2">{announcement.title}:</span>
                      <span>{announcement.description}</span>
                    </span>
                    <span className="mx-12 text-blue-200 text-2xl">•</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <style>{`
            .announcements-scroll {
              animation: scroll-horizontal ${Math.max(announcements.length * 25, 80)}s linear infinite;
            }
            .announcements-scroll:hover {
              animation-play-state: paused;
            }
            @keyframes scroll-horizontal {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
            @keyframes fade {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }
          `}</style>
        </motion.div>
      )}

      {user?.role === 'employee' && renderEmployeeDashboard()}
      {user?.role === 'manager' && renderManagerDashboard()}
      {user?.role === 'hr' && renderHRDashboard()}
      {user?.role === 'admin' && renderAdminDashboard()}
    </div>
  )
}

export default Dashboard

