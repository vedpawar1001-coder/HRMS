import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { FiCalendar, FiPlus, FiCheck, FiX, FiUsers } from 'react-icons/fi'
import toast from 'react-hot-toast'

const Leaves = () => {
  const { user } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [balance, setBalance] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState('my-leaves') // 'my-leaves' or 'team-leaves' for managers
  const [formData, setFormData] = useState({
    leaveType: 'PL',
    startDate: '',
    endDate: '',
    totalDays: 1,
    reason: ''
  })
  
  // HR-specific state (similar to attendance module)
  const [allEmployees, setAllEmployees] = useState([]) // For HR to view all employees
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null) // null = own leaves
  const [viewingOwnLeaves, setViewingOwnLeaves] = useState(true) // Flag for HR viewing own leaves

  useEffect(() => {
    // For HR and Admin, fetch all employees (for dropdown)
    if (user?.role === 'hr' || user?.role === 'admin') {
      fetchAllEmployees()
    }
    
    // Ensure default view mode for managers is 'my-leaves'
    if (user?.role === 'manager' && viewMode !== 'my-leaves' && viewMode !== 'team-leaves') {
      setViewMode('my-leaves')
      return
    }
    
    // Fetch leaves when user, viewMode, or selectedEmployeeId changes
    if (user) {
      fetchLeaves()
      // Fetch balance for employees, managers, and HR (all can apply for leaves)
      if (user.role === 'employee' || user.role === 'manager' || (user.role === 'hr' && viewingOwnLeaves && !selectedEmployeeId)) {
        fetchBalance()
      }
    }
  }, [user, viewMode, selectedEmployeeId, viewingOwnLeaves])

  // HR: Fetch all employees
  const fetchAllEmployees = async () => {
    try {
      const { data } = await axios.get('/api/employees')
      setAllEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching all employees:', error)
      setAllEmployees([])
    }
  }

  const fetchLeaves = async () => {
    try {
      let params = {}
      
      // For managers, check view mode
      if (user?.role === 'manager') {
        if (viewMode === 'team-leaves') {
          params.viewTeam = 'true'
          console.log('[LEAVES] Fetching team leaves for approval')
        } else {
          // Explicitly fetch manager's own leaves (default)
          // Don't set viewTeam, which means backend will return only manager's own leaves
          console.log('[LEAVES] Fetching manager\'s own leaves')
        }
      }
      
      // For HR, check if viewing specific employee or own leaves
      if (user?.role === 'hr') {
        if (selectedEmployeeId) {
          // Viewing specific employee's leaves
          params.employeeId = selectedEmployeeId
          console.log('[LEAVES] HR fetching leaves for employee:', selectedEmployeeId)
        } else {
          // Viewing own leaves - pass HR's own employeeId
          if (user?.employeeId) {
            params.employeeId = user.employeeId
            console.log('[LEAVES] HR fetching own leaves (employeeId:', user.employeeId, ')')
          } else {
            // HR doesn't have employeeId - show empty
            setLeaves([])
            return
          }
        }
      }
      
      // For Admin, check if viewing specific employee or all leaves
      if (user?.role === 'admin') {
        if (selectedEmployeeId) {
          // Viewing specific employee's leaves
          params.employeeId = selectedEmployeeId
          console.log('[LEAVES] Admin fetching leaves for employee:', selectedEmployeeId)
        } else {
          // Viewing all employees' leaves - don't pass employeeId (backend will return all)
          console.log('[LEAVES] Admin fetching ALL employees\' leaves')
        }
      }
      
      const { data } = await axios.get('/api/leaves', { params })
      
      // Backend handles filtering correctly, so we can trust the response
      // Only do a simple check to ensure we have an array
      const filteredLeaves = Array.isArray(data) ? data : []
      
      console.log(`[LEAVES] Fetched ${filteredLeaves.length} leaves for ${user?.role} (viewMode: ${viewMode}, selectedEmployeeId: ${selectedEmployeeId})`)
      
      if (user?.role === 'manager' && viewMode === 'my-leaves' && filteredLeaves.length > 0) {
        console.log('[LEAVES] First leave details:', {
          leaveId: filteredLeaves[0]._id,
          employeeId: filteredLeaves[0].employeeId?._id || filteredLeaves[0].employeeId,
          managerEmployeeId: user?.employeeId,
          leaveType: filteredLeaves[0].leaveType,
          status: filteredLeaves[0].status
        })
      }
      
      setLeaves(filteredLeaves)
    } catch (error) {
      console.error('Error fetching leaves:', error)
      toast.error('Failed to load leave applications')
    }
  }

  const fetchBalance = async () => {
    try {
      const { data } = await axios.get('/api/leaves/balance')
      setBalance(data)
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Normalize dates to start of day in local timezone to avoid timezone issues
      const normalizeDate = (dateString) => {
        if (!dateString) return null
        const date = new Date(dateString)
        // Set to start of day in local timezone
        date.setHours(0, 0, 0, 0)
        return date.toISOString()
      }
      
      const startDate = normalizeDate(formData.startDate)
      const endDate = normalizeDate(formData.endDate)
      
      // Calculate days difference
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      
      console.log('[LEAVES] Submitting leave application:', { 
        ...formData, 
        startDate: startDate,
        endDate: endDate,
        totalDays: days, 
        userRole: user?.role, 
        viewMode 
      })
      
      const response = await axios.post('/api/leaves', {
        ...formData,
        startDate: startDate,
        endDate: endDate,
        totalDays: days
      })
      
      console.log('[LEAVES] Leave application submitted successfully:', response.data)
      
      toast.success('Leave application submitted successfully!')
      setShowForm(false)
      setFormData({
        leaveType: 'PL',
        startDate: '',
        endDate: '',
        totalDays: 1,
        reason: ''
      })
      
      // Ensure we're viewing own leaves before fetching (for managers)
      if (user?.role === 'manager') {
        // Set viewMode and let useEffect handle the fetch
        setViewMode('my-leaves')
        // Also fetch immediately as backup
        setTimeout(() => {
          fetchLeaves()
          fetchBalance()
        }, 200)
      } else {
        // For employees, fetch immediately
        fetchLeaves()
        fetchBalance()
      }
    } catch (error) {
      console.error('[LEAVES] Error submitting leave:', error)
      const errorMessage = error.response?.data?.message || 'Failed to submit leave application'
      toast.error(errorMessage)
      
      // If insufficient balance, show detailed message
      if (error.response?.data?.availableBalance !== undefined) {
        toast.error(
          `Available: ${error.response.data.availableBalance} paid leave(s). Requested: ${error.response.data.requestedDays} day(s).`,
          { duration: 5000 }
        )
      }
    }
  }

  const handleApprove = async (id, status) => {
    try {
      await axios.put(`/api/leaves/${id}/approve`, { status })
      toast.success(`Leave ${status === 'Approved' ? 'approved' : 'rejected'}`)
      fetchLeaves()
    } catch (error) {
      toast.error('Failed to update leave status')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'HR Approved':
        return 'bg-green-100 text-green-800'
      case 'Manager Approved':
        return 'bg-blue-100 text-blue-800'
      case 'HR Rejected':
      case 'Manager Rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-600 mt-1">Manage leave applications</p>
        </div>
        {(user?.role === 'employee' || 
          (user?.role === 'manager' && viewMode === 'my-leaves') ||
          (user?.role === 'hr' && viewingOwnLeaves && !selectedEmployeeId)) && (
          <button
            onClick={() => {
              // Open form immediately - this must happen first
              setShowForm(true)
              
              // Determine default leave type based on current balance
              const hasPaidLeaves = balance?.balances?.PL > 0
              
              // Reset form data with appropriate default
              setFormData({
                leaveType: hasPaidLeaves ? 'PL' : 'UL',
                startDate: '',
                endDate: '',
                totalDays: 1,
                reason: ''
              })
              
              // Fetch balance in background if not loaded (non-blocking)
              if (!balance) {
                axios.get('/api/leaves/balance')
                  .then(({ data }) => {
                    setBalance(data)
                    // Update leave type if paid leaves are available
                    const hasPaidLeaves = data?.balances?.PL > 0
                    setFormData(prev => ({
                      ...prev,
                      leaveType: hasPaidLeaves ? 'PL' : 'UL'
                    }))
                  })
                  .catch(error => {
                    console.error('Error fetching balance:', error)
                  })
              }
            }}
            className="btn btn-primary flex items-center space-x-2"
          >
            <FiPlus size={20} />
            <span>Apply for Leave</span>
          </button>
        )}
      </div>

      {/* Employee Selector for HR and Admin */}
      {(user?.role === 'hr' || user?.role === 'admin') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card ${user?.role === 'admin' ? 'bg-indigo-50 border border-indigo-200' : 'bg-purple-50 border border-purple-200'}`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiUsers className={`inline mr-2 ${user?.role === 'admin' ? 'text-indigo-600' : 'text-purple-600'}`} size={18} />
                View Leaves
              </label>
              <select
                value={selectedEmployeeId || (user?.role === 'admin' ? 'all-employees' : 'my-leaves')}
                onChange={(e) => {
                  if (e.target.value === 'my-leaves' || e.target.value === 'all-employees') {
                    setSelectedEmployeeId(null)
                    setViewingOwnLeaves(user?.role === 'hr')
                  } else {
                    setSelectedEmployeeId(e.target.value)
                    setViewingOwnLeaves(false)
                  }
                }}
                className={`input w-full bg-white border-2 ${user?.role === 'admin' ? 'border-indigo-300 focus:border-indigo-500' : 'border-purple-300 focus:border-purple-500'}`}
              >
                {user?.role === 'admin' ? (
                  <option value="all-employees">👥 All Employees Leaves</option>
                ) : (
                  <option value="my-leaves">📝 My Leaves (Apply & View)</option>
                )}
                {allEmployees && allEmployees.length > 0 ? (
                  allEmployees.map((employee) => {
                    const displayName = employee.personalInfo?.fullName || employee.employeeId || 'Unknown'
                    const empId = employee.employeeId || employee._id
                    const department = employee.companyDetails?.department ? ` - ${employee.companyDetails.department}` : ''
                    const designation = employee.companyDetails?.designation ? ` (${employee.companyDetails.designation})` : ''
                    return (
                      <option key={employee._id} value={employee._id}>
                        👤 {displayName} ({empId}){designation}{department}
                      </option>
                    )
                  })
                ) : (
                  <option value="" disabled>No employees found</option>
                )}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                {selectedEmployeeId ? (
                  <span className={user?.role === 'admin' ? 'text-indigo-700' : 'text-purple-700'}>
                    📖 <strong>Viewing employee leaves:</strong> You can approve/reject leaves
                  </span>
                ) : user?.role === 'admin' ? (
                  <span className="text-indigo-700">
                    👥 <strong>Viewing all employees' leaves:</strong> All leaves from employees, managers, and HR
                  </span>
                ) : (
                  <span className="text-green-700">
                    ✏️ <strong>Your leaves:</strong> You can apply and view your own leaves
                  </span>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* View Mode Selector for Managers */}
      {user?.role === 'manager' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-blue-50 border border-blue-200"
        >
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">View:</label>
            <button
              onClick={() => setViewMode('my-leaves')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'my-leaves'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              My Leaves
            </button>
            <button
              onClick={() => setViewMode('team-leaves')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'team-leaves'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Team Leaves (For Approval)
            </button>
          </div>
        </motion.div>
      )}

      {/* Leave Balance - Show for employees, managers, and HR viewing their own leaves */}
      {(user?.role === 'employee' || 
        (user?.role === 'manager' && viewMode === 'my-leaves') ||
        (user?.role === 'hr' && viewingOwnLeaves && !selectedEmployeeId)) && balance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Show only Paid Leave (PL) */}
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <p className="text-blue-100 text-sm">Paid Leave (PL)</p>
              <p className="text-2xl font-bold mt-1">{balance.balances?.PL || 0}</p>
              <p className="text-blue-100 text-xs mt-1">Days Remaining</p>
            </div>
            {/* Show only Unpaid Leave (UL) */}
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <p className="text-blue-100 text-sm">Unpaid Leave (UL)</p>
              <p className="text-2xl font-bold mt-1">{balance.balances?.UL || 0}</p>
              <p className="text-blue-100 text-xs mt-1">Days Remaining</p>
            </div>
          </div>
          {balance.balances?.PL !== undefined && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Paid Leave Policy:</strong> Paid leaves are allocated based on your tenure in the organization.
                <br />
                <span className="text-xs">
                  • Less than 6 months: 0 paid leaves
                  <br />
                  • 6 months to less than 1 year: 2 paid leaves
                  <br />
                  • 1 year or more: 4 paid leaves
                </span>
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Leave Application Form - Show for employees, managers, and HR viewing their own leaves */}
      {showForm && (
        user?.role === 'employee' || 
        (user?.role === 'manager' && viewMode === 'my-leaves') ||
        (user?.role === 'hr' && viewingOwnLeaves && !selectedEmployeeId)
      ) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h2 className="text-xl font-semibold mb-4">Apply for Leave</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Leave Type</label>
                <select
                  className="input"
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                  required
                >
                  {balance?.balances?.PL > 0 ? (
                    <>
                      <option value="PL">Paid Leave (PL) - {balance.balances.PL} available</option>
                      <option value="UL">Unpaid Leave (UL)</option>
                    </>
                  ) : (
                    <>
                      <option value="UL">Unpaid Leave (UL)</option>
                      {balance && balance.balances?.PL === 0 && (
                        <option value="PL" disabled>Paid Leave (PL) - Not available</option>
                      )}
                    </>
                  )}
                </select>
                {balance && balance.balances?.PL === 0 && formData.leaveType === 'PL' && (
                  <p className="text-xs text-orange-600 mt-1">
                    You don't have paid leaves available. Please select Unpaid Leave.
                  </p>
                )}
                {!balance && (
                  <p className="text-xs text-gray-500 mt-1">
                    Loading leave balance...
                  </p>
                )}
              </div>
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea
                className="input"
                rows={4}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </div>
            <div className="flex space-x-4">
              <button type="submit" className="btn btn-primary">
                Submit
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Leave List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h2 className="text-xl font-semibold mb-4">Leave Applications</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {((user?.role === 'manager' && viewMode === 'team-leaves') || 
                  (user?.role === 'hr' && selectedEmployeeId) ||
                  (user?.role === 'admin' && selectedEmployeeId !== null)) ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Employee
                  </th>
                ) : null}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Leave Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                {((user?.role === 'manager' && viewMode === 'team-leaves') || 
                  (user?.role === 'hr' && selectedEmployeeId) ||
                  user?.role === 'admin') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={
                    ((user?.role === 'manager' && viewMode === 'team-leaves') || 
                     (user?.role === 'hr' && selectedEmployeeId) ||
                     user?.role === 'admin') ? 7 : 6
                  } className="px-6 py-8 text-center text-gray-500">
                    {user?.role === 'manager' && viewMode === 'team-leaves' 
                      ? 'No team leave applications pending approval'
                      : (user?.role === 'hr' && selectedEmployeeId) || (user?.role === 'admin' && selectedEmployeeId)
                      ? 'No leave applications found for this employee'
                      : user?.role === 'admin'
                      ? 'No leave applications found'
                      : 'No leave applications found'}
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave._id}>
                    {((user?.role === 'manager' && viewMode === 'team-leaves') || 
                      (user?.role === 'hr' && selectedEmployeeId) ||
                      (user?.role === 'admin' && selectedEmployeeId !== null)) ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                            <span className="text-primary-600 font-semibold text-xs">
                              {(leave.employeeId?.personalInfo?.fullName || leave.employeeId?.employeeId || 'E').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{leave.employeeId?.personalInfo?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{leave.employeeId?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                    ) : null}
                    {/* Employee column for admin viewing all leaves */}
                    {user?.role === 'admin' && selectedEmployeeId === null && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                            <span className="text-indigo-600 font-semibold text-xs">
                              {(leave.employeeId?.personalInfo?.fullName || leave.employeeId?.employeeId || 'E').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{leave.employeeId?.personalInfo?.fullName || 'Unknown'}</p>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-gray-500">{leave.employeeId?.employeeId}</p>
                              {leave.employeeId?.companyDetails?.designation && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <p className="text-xs text-gray-500">{leave.employeeId.companyDetails.designation}</p>
                                </>
                              )}
                              {leave.employeeId?.companyDetails?.department && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <p className="text-xs text-gray-500">{leave.employeeId.companyDetails.department}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leave.leaveType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(leave.startDate).toLocaleDateString('en-GB', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(leave.endDate).toLocaleDateString('en-GB', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leave.totalDays}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  {((user?.role === 'manager' && viewMode === 'team-leaves') || 
                    (user?.role === 'hr' && selectedEmployeeId) ||
                    (user?.role === 'admin' && selectedEmployeeId !== null)) ? (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(leave.status === 'Pending' || leave.status === 'Manager Approved') ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(leave._id, 'Approved')}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <FiCheck size={20} />
                          </button>
                          <button
                            onClick={() => handleApprove(leave._id, 'Rejected')}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <FiX size={20} />
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  ) : null}
                  {/* Actions column for admin viewing all leaves */}
                  {user?.role === 'admin' && selectedEmployeeId === null && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(leave.status === 'Pending' || leave.status === 'Manager Approved') ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(leave._id, 'Approved')}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <FiCheck size={20} />
                          </button>
                          <button
                            onClick={() => handleApprove(leave._id, 'Rejected')}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <FiX size={20} />
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

export default Leaves

