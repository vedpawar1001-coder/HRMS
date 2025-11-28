import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiUsers, FiSearch, FiEye, FiFilter, FiX, FiClock, FiUserCheck, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'

const Employees = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [hrProfiles, setHrProfiles] = useState([])
  const [filteredHrProfiles, setFilteredHrProfiles] = useState([])
  const [activeTab, setActiveTab] = useState('employees') // 'employees' or 'hr-profiles'
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingHR, setLoadingHR] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    departments: {}
  })

  useEffect(() => {
    fetchEmployees()
    if (user?.role === 'manager') {
      fetchHRProfiles()
    }
  }, [user])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const params = {}
      if (search) params.search = search
      if (departmentFilter) params.department = departmentFilter
      if (statusFilter) params.status = statusFilter

      const { data } = await axios.get('/api/employees', { params })
      const employeesList = Array.isArray(data) ? data : [data]
      setEmployees(employeesList)
      setFilteredEmployees(employeesList)

      // Calculate statistics
      const active = employeesList.filter(emp => emp.companyDetails?.employmentStatus === 'Active').length
      const inactive = employeesList.filter(emp => emp.companyDetails?.employmentStatus !== 'Active').length
      const departments = {}
      employeesList.forEach(emp => {
        const dept = emp.companyDetails?.department || 'Unassigned'
        departments[dept] = (departments[dept] || 0) + 1
      })

      setStats({
        total: employeesList.length,
        active,
        inactive,
        departments
      })
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'employees') {
        fetchEmployees()
      } else if (activeTab === 'hr-profiles' && user?.role === 'manager') {
        fetchHRProfiles()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search, departmentFilter, statusFilter, activeTab])

  // Fetch HR profiles when switching to HR Profiles tab
  useEffect(() => {
    if (activeTab === 'hr-profiles' && user?.role === 'manager') {
      fetchHRProfiles()
    }
  }, [activeTab, user])

  useEffect(() => {
    // Filter HR profiles based on search
    if (activeTab === 'hr-profiles') {
      let filtered = [...hrProfiles]
      if (search) {
        const searchLower = search.toLowerCase()
        filtered = filtered.filter(hr =>
          hr.personalInfo?.fullName?.toLowerCase().includes(searchLower) ||
          hr.personalInfo?.email?.toLowerCase().includes(searchLower) ||
          hr.hrId?.toLowerCase().includes(searchLower)
        )
      }
      setFilteredHrProfiles(filtered)
    }
  }, [search, hrProfiles, activeTab])

  const fetchHRProfiles = async () => {
    if (user?.role !== 'manager') return
    try {
      setLoadingHR(true)
      console.log('[EMPLOYEES] Fetching HR profiles for manager...')
      const { data } = await axios.get('/api/hr-profile/all')
      console.log('[EMPLOYEES] HR profiles fetched:', data?.length || 0)
      setHrProfiles(data || [])
      setFilteredHrProfiles(data || [])
      if (data && data.length === 0) {
        console.log('[EMPLOYEES] No HR profiles found')
      }
    } catch (error) {
      console.error('[EMPLOYEES] Error fetching HR profiles:', error)
      console.error('[EMPLOYEES] Error response:', error.response?.data)
      toast.error(error.response?.data?.message || 'Failed to load HR profiles')
      setHrProfiles([])
      setFilteredHrProfiles([])
    } finally {
      setLoadingHR(false)
    }
  }

  const handleViewProfile = (employeeId, isHR = false) => {
    // HR users have Employee profiles, so they can be viewed through the regular profile route
    navigate(`/profile/${employeeId}`)
  }

  const handleViewHRProfile = async (hrProfileId, e) => {
    if (e) e.stopPropagation()
    // Navigate directly to HR profile view using the HR profile ID
    navigate(`/hr-profile/${hrProfileId}`)
  }

  const handleApproveHRProfile = async (hrProfileId, status, e) => {
    if (e) e.stopPropagation()
    try {
      const comments = status === 'Rejected' 
        ? window.prompt('Please provide a reason for rejection (optional):') || ''
        : ''
      
      if (status === 'Rejected' && comments === null) {
        return // User cancelled
      }

      await axios.put(`/api/hr-profile/${hrProfileId}/approve`, {
        status: status === 'Approved' ? 'Approved' : 'Rejected',
        comments: comments
      })
      
      toast.success(`HR profile ${status === 'Approved' ? 'approved' : 'rejected'} successfully`)
      fetchHRProfiles() // Refresh the list
    } catch (error) {
      console.error('Error approving HR profile:', error)
      toast.error(error.response?.data?.message || 'Failed to approve HR profile')
    }
  }

  const handleApproveProfile = async (employeeId, status, e) => {
    e.stopPropagation() // Prevent row click
    try {
      const comments = status === 'Rejected' 
        ? window.prompt('Please provide a reason for rejection (optional):') || ''
        : ''
      
      if (status === 'Rejected' && comments === null) {
        return // User cancelled
      }

      await axios.put(`/api/employees/${employeeId}/approve-profile`, {
        status: status === 'Approved' ? 'Approved' : 'Rejected',
        comments: comments
      })
      
      toast.success(`Employee profile ${status === 'Approved' ? 'approved' : 'rejected'} successfully`)
      fetchEmployees() // Refresh the list
    } catch (error) {
      console.error('Error approving employee profile:', error)
      toast.error(error.response?.data?.message || 'Failed to approve employee profile')
    }
  }

  const handleClearFilters = () => {
    setSearch('')
    setDepartmentFilter('')
    setStatusFilter('')
    setShowFilters(false)
  }

  const uniqueDepartments = [...new Set(employees.map(emp => emp.companyDetails?.department).filter(Boolean))]

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'manager' ? 'Manage employees and HR profiles' : 'Manage employee information'}
          </p>
        </div>
      </div>

      {/* Tabs for Managers */}
      {user?.role === 'manager' && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'employees'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiUsers className="inline mr-2" size={18} />
              Employees ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('hr-profiles')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'hr-profiles'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiUserCheck className="inline mr-2" size={18} />
              HR Profiles ({hrProfiles.length})
            </button>
          </nav>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Employees</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <FiUsers className="text-4xl text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Active</p>
              <p className="text-3xl font-bold mt-1">{stats.active}</p>
            </div>
            <FiUserCheck className="text-4xl text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Inactive</p>
              <p className="text-3xl font-bold mt-1">{stats.inactive}</p>
            </div>
            <FiX className="text-4xl text-red-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Departments</p>
              <p className="text-3xl font-bold mt-1">{Object.keys(stats.departments).length}</p>
            </div>
            <FiFilter className="text-4xl text-purple-200" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, email, or employee ID..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <FiFilter /> Filters
            {(departmentFilter || statusFilter) && (
              <span className="bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {[departmentFilter, statusFilter].filter(Boolean).length}
              </span>
            )}
          </button>
          {(departmentFilter || statusFilter) && (
            <button
              onClick={handleClearFilters}
              className="btn-secondary flex items-center gap-2"
            >
              <FiX /> Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="input"
                >
                  <option value="">All Departments</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Employees Table */}
        {activeTab === 'employees' && (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle sm:px-0 px-4">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <FiUsers className="mx-auto text-gray-400 text-5xl mb-4" />
              <p className="text-gray-500 text-lg">No employees found</p>
              <p className="text-gray-400 text-sm mt-2">
                {search || departmentFilter || statusFilter
                  ? 'Try adjusting your filters'
                  : 'No employees available'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employment Status
                  </th>
                  {(user?.role === 'hr' || user?.role === 'admin') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profile Status
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewProfile(emp._id, emp.isHR)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {emp.employeeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                          <span className="text-primary-600 font-semibold">
                            {emp.personalInfo?.fullName?.charAt(0) || 'E'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{emp.personalInfo?.fullName || 'N/A'}</span>
                          {emp.isHR && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                              👔 HR
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.personalInfo?.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {emp.companyDetails?.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {emp.companyDetails?.designation || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        emp.companyDetails?.employmentStatus === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : emp.companyDetails?.employmentStatus === 'On Leave'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.companyDetails?.employmentStatus || 'Active'}
                      </span>
                    </td>
                    {(user?.role === 'hr' || user?.role === 'admin') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          emp.profileStatus === 'Approved' 
                            ? 'bg-green-100 text-green-800' 
                            : emp.profileStatus === 'Submitted' || emp.profileStatus === 'Under Review' || emp.profileStatus === 'Manager Approved'
                            ? 'bg-orange-100 text-orange-800'
                            : emp.profileStatus === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {emp.profileStatus || 'Draft'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewProfile(emp._id, emp.isHR)}
                          className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
                        >
                          <FiEye /> View
                        </button>
                        {(user?.role === 'hr' || user?.role === 'admin') && 
                         (emp.profileStatus === 'Submitted' || emp.profileStatus === 'Under Review' || emp.profileStatus === 'Manager Approved') && (
                          <>
                            <button
                              onClick={(e) => {
                                if (window.confirm('Are you sure you want to approve this employee profile?')) {
                                  handleApproveProfile(emp._id, 'Approved', e)
                                }
                              }}
                              className="text-green-600 hover:text-green-900 flex items-center gap-1"
                              title="Approve Profile"
                            >
                              <FiCheckCircle size={18} />
                            </button>
                            <button
                              onClick={(e) => handleApproveProfile(emp._id, 'Rejected', e)}
                              className="text-red-600 hover:text-red-900 flex items-center gap-1"
                              title="Reject Profile"
                            >
                              <FiXCircle size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
        )}

        {/* Results Count */}
        {activeTab === 'employees' && filteredEmployees.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        )}
      </div>

      {/* HR Profiles Section for Managers */}
      {user?.role === 'manager' && activeTab === 'hr-profiles' && (
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search HR profiles by name, email, or HR ID..."
                className="input pl-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingHR ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle sm:px-0 px-4">
                {filteredHrProfiles.length === 0 ? (
                  <div className="text-center py-12">
                    <FiUserCheck className="mx-auto text-gray-400 text-5xl mb-4" />
                    <p className="text-gray-500 text-lg">No HR profiles found</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {search ? 'Try adjusting your search' : 'No HR profiles available'}
                    </p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          HR ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Profile Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completion
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredHrProfiles.map((hr) => (
                        <tr key={hr._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {hr.hrId || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                                <span className="text-purple-600 font-semibold">
                                  {hr.personalInfo?.fullName?.charAt(0) || 'H'}
                                </span>
                              </div>
                              <span>{hr.personalInfo?.fullName || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {hr.personalInfo?.email || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {hr.companyDetails?.department || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              hr.profileStatus === 'Approved' || hr.profileStatus === 'Manager Approved'
                                ? 'bg-green-100 text-green-800' 
                                : hr.profileStatus === 'Submitted'
                                ? 'bg-orange-100 text-orange-800'
                                : hr.profileStatus === 'Rejected' || hr.profileStatus === 'Manager Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {hr.profileStatus || 'Draft'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-primary-600 h-2 rounded-full" 
                                  style={{ width: `${hr.profileCompletion || 0}%` }}
                                ></div>
                              </div>
                              <span>{hr.profileCompletion || 0}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleViewHRProfile(hr._id, e)}
                                className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
                              >
                                <FiEye /> View
                              </button>
                              {hr.profileStatus === 'Submitted' && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      if (window.confirm('Are you sure you want to approve this HR profile?')) {
                                        handleApproveHRProfile(hr._id, 'Approved', e)
                                      }
                                    }}
                                    className="text-green-600 hover:text-green-900 flex items-center gap-1"
                                    title="Approve Profile"
                                  >
                                    <FiCheckCircle size={18} />
                                  </button>
                                  <button
                                    onClick={(e) => handleApproveHRProfile(hr._id, 'Rejected', e)}
                                    className="text-red-600 hover:text-red-900 flex items-center gap-1"
                                    title="Reject Profile"
                                  >
                                    <FiXCircle size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'hr-profiles' && filteredHrProfiles.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Showing {filteredHrProfiles.length} of {hrProfiles.length} HR profiles
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Employees

