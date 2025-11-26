import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { FiDollarSign, FiPlusCircle, FiUser, FiCalendar, FiCheck, FiX, FiEdit2, FiInfo } from 'react-icons/fi'
import toast from 'react-hot-toast'

const Payroll = () => {
  const { user } = useAuth()
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [allEmployees, setAllEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showCalculateForm, setShowCalculateForm] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [showSalaryUpdate, setShowSalaryUpdate] = useState(false)
  const [salaryFormData, setSalaryFormData] = useState({
    monthlySalary: '',
    salaryStatus: 'Active',
    reason: ''
  })
  const [selectedEmployeeForSalary, setSelectedEmployeeForSalary] = useState(null)

  useEffect(() => {
    fetchPayrolls()
    if (user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager') {
      fetchAllEmployees()
    }
  }, [user, selectedEmployeeId, selectedMonth, selectedYear])

  const fetchPayrolls = async () => {
    try {
      setLoading(true)
      let params = {}
      
      if (user?.role === 'employee') {
        // Employees see only their own payroll
        params = {}
      } else if (user?.role === 'manager') {
        // Managers can filter by team member
        if (selectedEmployeeId) {
          params.employeeId = selectedEmployeeId
        }
        // Otherwise, backend will return all team members' payroll
      } else if (selectedEmployeeId) {
        // HR/Admin can filter by employeeId
        params.employeeId = selectedEmployeeId
      }
      
      if (selectedMonth && selectedYear) {
        params.month = selectedMonth
        params.year = selectedYear
      }
      
      const { data } = await axios.get('/api/payroll', { params })
      setPayrolls(data)
    } catch (error) {
      console.error('Error fetching payrolls:', error)
      toast.error(error.response?.data?.message || 'Failed to load payroll records')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllEmployees = async () => {
    try {
      const { data } = await axios.get('/api/employees')
      setAllEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const handleCalculatePayroll = async () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee')
      return
    }

    try {
      setCalculating(true)
      const { data } = await axios.post('/api/payroll/calculate', {
        employeeId: selectedEmployeeId,
        month: selectedMonth,
        year: selectedYear
      })
      
      toast.success('Payroll calculated successfully!')
      setShowCalculateForm(false)
      // Refresh employees to get updated salary info
      await fetchAllEmployees()
      // Refresh payroll list
      await fetchPayrolls()
    } catch (error) {
      console.error('Error calculating payroll:', error)
      toast.error(error.response?.data?.message || 'Failed to calculate payroll')
    } finally {
      setCalculating(false)
    }
  }

  const handleUpdateSalary = async (e) => {
    e.preventDefault()
    if (!selectedEmployeeForSalary) {
      toast.error('Please select an employee')
      return
    }

    if (!salaryFormData.monthlySalary || parseFloat(salaryFormData.monthlySalary) <= 0) {
      toast.error('Please enter a valid monthly salary')
      return
    }

    try {
      const payload = {
        monthlySalary: parseFloat(salaryFormData.monthlySalary),
        salaryStatus: salaryFormData.salaryStatus,
        reason: salaryFormData.reason || undefined
      }
      
      await axios.put(`/api/employees/${selectedEmployeeForSalary}/salary`, payload)
      toast.success('Salary updated successfully!')
      setShowSalaryUpdate(false)
      setSalaryFormData({ monthlySalary: '', salaryStatus: 'Active', reason: '' })
      setSelectedEmployeeForSalary(null)
      // Refresh employees list to show updated salary
      await fetchAllEmployees()
      // Refresh payroll list to reflect any changes
      await fetchPayrolls()
    } catch (error) {
      console.error('Error updating salary:', error)
      toast.error(error.response?.data?.message || 'Failed to update salary')
    }
  }

  const handleMarkAsPaid = async (payrollId) => {
    try {
      await axios.put(`/api/payroll/${payrollId}/status`, { status: 'Paid' })
      toast.success('Payroll marked as paid')
      fetchPayrolls()
    } catch (error) {
      console.error('Error updating payroll status:', error)
      toast.error('Failed to update payroll status')
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-gray-600 mt-1">Manage employee payroll and salary information</p>
        </div>
        {(user?.role === 'hr' || user?.role === 'admin') && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowSalaryUpdate(true)}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <FiEdit2 size={18} />
              <span>Update Salary</span>
            </button>
            <button
              onClick={() => setShowCalculateForm(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <FiPlusCircle size={18} />
              <span>Calculate Payroll</span>
            </button>
          </div>
        )}
        {user?.role === 'manager' && (
          <div className="text-sm text-gray-600">
            View your team members' payroll information
          </div>
        )}
      </div>

      {/* Employee Selection for HR/Admin/Manager */}
      {(user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card ${user?.role === 'manager' ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50 border border-purple-200'}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Select Employee</label>
              <select
                className="input"
                value={selectedEmployeeId || ''}
                onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
              >
                <option value="">
                  {user?.role === 'manager' ? 'All Team Members' : 'All Employees'}
                </option>
                {allEmployees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.personalInfo?.fullName || employee.employeeId} ({employee.employeeId})
                    {employee.companyDetails?.monthlySalary 
                      ? ` - ₹${employee.companyDetails.monthlySalary.toLocaleString('en-IN')}/month`
                      : ''
                    }
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select
                className="input"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Calculate Payroll Form */}
      {showCalculateForm && (user?.role === 'hr' || user?.role === 'admin') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-blue-50 border border-blue-200"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FiPlusCircle className="mr-2" />
            Calculate Payroll
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Employee *</label>
                <select
                  className="input"
                  value={selectedEmployeeId || ''}
                  onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                  required
                >
                  <option value="">Select Employee</option>
                  {allEmployees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.personalInfo?.fullName || employee.employeeId} ({employee.employeeId})
                      {employee.companyDetails?.monthlySalary 
                        ? ` - ₹${employee.companyDetails.monthlySalary.toLocaleString('en-IN')}/month`
                        : ' - Salary not set'
                      }
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Month *</label>
                <select
                  className="input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  required
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Year *</label>
                <select
                  className="input"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  required
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg space-y-2">
              <p className="text-sm text-blue-800">
                <FiInfo className="inline mr-1" />
                <strong>Formula:</strong> Net Salary = Monthly Salary − (Monthly Salary / 30 × Unpaid Leaves)
              </p>
              {selectedEmployeeId && (() => {
                const selectedEmp = allEmployees.find(emp => emp._id === selectedEmployeeId)
                return selectedEmp?.companyDetails?.monthlySalary ? (
                  <p className="text-sm text-blue-800">
                    <strong>Current Salary:</strong> ₹{selectedEmp.companyDetails.monthlySalary.toLocaleString('en-IN')}/month
                    {selectedEmp.companyDetails.salaryLastUpdated && (
                      <span className="text-xs ml-2">
                        (Updated: {new Date(selectedEmp.companyDetails.salaryLastUpdated).toLocaleDateString('en-GB')})
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-orange-800">
                    <strong>⚠️ Warning:</strong> Employee salary not set. Please update salary first.
                  </p>
                )
              })()}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCalculatePayroll}
                disabled={calculating || !selectedEmployeeId}
                className="btn btn-primary flex items-center space-x-2"
              >
                <FiPlusCircle size={18} />
                <span>{calculating ? 'Calculating...' : 'Calculate Payroll'}</span>
              </button>
              <button
                onClick={() => setShowCalculateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Update Salary Form */}
      {showSalaryUpdate && (user?.role === 'hr' || user?.role === 'admin') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-green-50 border border-green-200"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FiEdit2 className="mr-2" />
            Update Employee Salary
          </h2>
          <form onSubmit={handleUpdateSalary} className="space-y-4">
            <div>
              <label className="label">Employee *</label>
              <select
                className="input"
                value={selectedEmployeeForSalary || ''}
                onChange={(e) => {
                  const empId = e.target.value
                  setSelectedEmployeeForSalary(empId)
                  const employee = allEmployees.find(emp => emp._id === empId)
                  if (employee) {
                    setSalaryFormData({
                      ...salaryFormData,
                      monthlySalary: employee.companyDetails?.monthlySalary || '',
                      salaryStatus: employee.companyDetails?.salaryStatus || 'Active'
                    })
                  }
                }}
                required
              >
                <option value="">Select Employee</option>
                {allEmployees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.personalInfo?.fullName || employee.employeeId} ({employee.employeeId})
                    {employee.companyDetails?.monthlySalary 
                      ? ` - Current: ₹${employee.companyDetails.monthlySalary.toLocaleString('en-IN')}/month`
                      : ' - Salary not set'
                    }
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Monthly Salary (₹) *</label>
                <input
                  type="number"
                  className="input"
                  value={salaryFormData.monthlySalary}
                  onChange={(e) => setSalaryFormData({ ...salaryFormData, monthlySalary: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Salary Status *</label>
                <select
                  className="input"
                  value={salaryFormData.salaryStatus}
                  onChange={(e) => setSalaryFormData({ ...salaryFormData, salaryStatus: e.target.value })}
                  required
                >
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Reason (Optional)</label>
              <textarea
                className="input"
                rows={3}
                value={salaryFormData.reason}
                onChange={(e) => setSalaryFormData({ ...salaryFormData, reason: e.target.value })}
                placeholder="Reason for salary update..."
              />
            </div>
            <div className="flex space-x-3">
              <button type="submit" className="btn btn-primary">
                Update Salary
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSalaryUpdate(false)
                  setSalaryFormData({ monthlySalary: '', salaryStatus: 'Active', reason: '' })
                  setSelectedEmployeeForSalary(null)
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Payroll Records Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h2 className="text-xl font-semibold mb-4">Payroll Records</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {(user?.role !== 'employee') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unpaid Leaves</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deduction</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {(user?.role === 'hr' || user?.role === 'admin') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payrolls.length === 0 ? (
                <tr>
                  <td 
                    colSpan={
                      user?.role === 'employee' ? 7 : 
                      (user?.role === 'hr' || user?.role === 'admin') ? 8 : 
                      user?.role === 'manager' ? 7 : 7
                    } 
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No payroll records found
                  </td>
                </tr>
              ) : (
                payrolls.map((payroll) => (
                  <tr key={payroll._id} className="hover:bg-gray-50">
                    {(user?.role !== 'employee') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                            <span className="text-primary-600 font-semibold text-xs">
                              {(payroll.employeeId?.personalInfo?.fullName || 'E').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{payroll.employeeId?.personalInfo?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{payroll.employeeId?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payroll.payPeriod?.year, payroll.payPeriod?.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{payroll.salaryStructure?.monthlySalary?.toLocaleString('en-IN') || payroll.salaryStructure?.basic?.toLocaleString('en-IN') || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payroll.attendance?.unpaidLeaveDays || 0} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      ₹{payroll.deductions?.unpaidLeaveDeduction?.toLocaleString('en-IN') || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₹{payroll.netSalary?.toLocaleString('en-IN') || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        payroll.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                        payroll.status === 'Processed' ? 'bg-blue-100 text-blue-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payroll.status}
                      </span>
                    </td>
                    {(user?.role === 'hr' || user?.role === 'admin') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {payroll.status !== 'Paid' ? (
                            <button
                              onClick={() => handleMarkAsPaid(payroll._id)}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-1 text-sm font-medium transition-colors"
                              title="Mark as Paid"
                            >
                              <FiCheck size={16} />
                              <span>Mark Paid</span>
                            </button>
                          ) : (
                            <span className="text-green-600 text-sm font-medium flex items-center space-x-1">
                              <FiCheck size={16} />
                              <span>Paid</span>
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

export default Payroll
