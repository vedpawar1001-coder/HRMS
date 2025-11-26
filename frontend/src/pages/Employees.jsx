import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiUsers, FiSearch, FiEye, FiFilter, FiX, FiClock, FiUserCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'

const Employees = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
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
  }, [])

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
      fetchEmployees()
    }, 500)
    return () => clearTimeout(timer)
  }, [search, departmentFilter, statusFilter])

  const handleViewProfile = (employeeId) => {
    navigate(`/profile/${employeeId}`)
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
            {user?.role === 'manager' ? 'Manage your team members' : 'Manage employee information'}
          </p>
        </div>
      </div>

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
        <div className="overflow-x-auto">
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewProfile(emp._id)}>
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
                        {emp.personalInfo?.fullName || 'N/A'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleViewProfile(emp._id)}
                        className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
                      >
                        <FiEye /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Results Count */}
        {filteredEmployees.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        )}
      </div>
    </div>
  )
}

export default Employees

