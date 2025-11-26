import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  FiSearch,
  FiPlus,
  FiUser,
  FiTrendingUp,
  FiArrowRight,
  FiCalendar,
  FiFileText,
  FiCheckCircle,
  FiXCircle
} from 'react-icons/fi'
import { format } from 'date-fns'

const EmployeeLifecycle = () => {
  const { user } = useAuth()
  const [lifecycles, setLifecycles] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddStageForm, setShowAddStageForm] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [stageForm, setStageForm] = useState({
    employeeId: '',
    stage: 'Joining',
    comments: '',
    reason: '',
    newRole: '',
    newDepartment: '',
    oldDepartment: '',
    exitDate: '',
    exitType: 'Voluntary'
  })

  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager') {
      fetchLifecycles()
      fetchEmployees()
    }
  }, [user, searchTerm])

  const fetchLifecycles = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)

      const { data } = await axios.get(`/api/recruitment/lifecycle?${params.toString()}`)
      setLifecycles(data)
    } catch (error) {
      console.error('Error fetching lifecycles:', error)
      toast.error('Failed to load lifecycle records')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const { data } = await axios.get('/api/employees')
      setEmployees(data)
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const handleAddStage = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/recruitment/lifecycle', stageForm)
      toast.success('Lifecycle stage added successfully')
      setShowAddStageForm(false)
      setStageForm({
        employeeId: '',
        stage: 'Joining',
        comments: '',
        reason: '',
        newRole: '',
        newDepartment: '',
        oldDepartment: '',
        exitDate: '',
        exitType: 'Voluntary'
      })
      fetchLifecycles()
    } catch (error) {
      console.error('Error adding stage:', error)
      toast.error('Failed to add lifecycle stage')
    }
  }

  const getStageColor = (stage) => {
    const colors = {
      'Joining': 'bg-blue-100 text-blue-800',
      'Confirmation': 'bg-green-100 text-green-800',
      'Transfer': 'bg-yellow-100 text-yellow-800',
      'Promotion': 'bg-purple-100 text-purple-800',
      'Resignation': 'bg-orange-100 text-orange-800',
      'Exit': 'bg-red-100 text-red-800'
    }
    return colors[stage] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800',
      'On Notice Period': 'bg-yellow-100 text-yellow-800',
      'Resigned': 'bg-red-100 text-red-800',
      'Terminated': 'bg-red-100 text-red-800',
      'Retired': 'bg-gray-100 text-gray-800',
      'Inactive': 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Lifecycle Management</h1>
          <p className="mt-2 text-gray-600">Track employee journey from joining to exit</p>
        </div>
        <button
          onClick={() => setShowAddStageForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
        >
          <FiPlus className="mr-2" size={20} />
          Add Lifecycle Stage
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by employee ID, name, email, or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lifecycle Records */}
      <div className="space-y-4">
        {lifecycles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FiUser className="mx-auto text-gray-400" size={48} />
            <p className="mt-4 text-gray-600">No lifecycle records found</p>
          </div>
        ) : (
          lifecycles.map(lifecycle => (
            <motion.div
              key={lifecycle._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              {/* Employee Info */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {lifecycle.employeeId?.personalInfo?.fullName || 'N/A'}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>ID: {lifecycle.employeeId?.employeeId || 'N/A'}</p>
                    <p>Email: {lifecycle.employeeId?.personalInfo?.email || 'N/A'}</p>
                    <p>Department: {lifecycle.employeeId?.companyDetails?.department || 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(lifecycle.status)}`}>
                    {lifecycle.status}
                  </span>
                  <p className="text-sm text-gray-500 mt-2">
                    Current Stage: <span className="font-medium">{lifecycle.currentStage}</span>
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-6">
                  {lifecycle.stages.map((stage, idx) => (
                    <div key={idx} className="relative pl-12">
                      <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center ${
                        idx === lifecycle.stages.length - 1 ? 'bg-primary-600' : 'bg-gray-300'
                      }`}>
                        {idx === lifecycle.stages.length - 1 ? (
                          <FiCheckCircle className="text-white" size={16} />
                        ) : (
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(stage.stage)}`}>
                            {stage.stage}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(stage.stageDate), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        {stage.comments && (
                          <p className="text-sm text-gray-700 mt-2">{stage.comments}</p>
                        )}
                        {stage.reason && (
                          <p className="text-sm text-gray-600 mt-1">Reason: {stage.reason}</p>
                        )}
                        {stage.newRole && (
                          <p className="text-sm text-gray-600 mt-1">New Role: {stage.newRole}</p>
                        )}
                        {stage.newDepartment && (
                          <p className="text-sm text-gray-600 mt-1">
                            Transfer: {stage.oldDepartment} → {stage.newDepartment}
                          </p>
                        )}
                        {stage.exitDate && (
                          <p className="text-sm text-gray-600 mt-1">
                            Exit Date: {format(new Date(stage.exitDate), 'MMM dd, yyyy')}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Performed by: {stage.performedBy?.email || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Stage Modal */}
      {showAddStageForm && (
        <AddStageModal
          employees={employees}
          formData={stageForm}
          onFormChange={setStageForm}
          onSubmit={handleAddStage}
          onClose={() => {
            setShowAddStageForm(false)
            setStageForm({
              employeeId: '',
              stage: 'Joining',
              comments: '',
              reason: '',
              newRole: '',
              newDepartment: '',
              oldDepartment: '',
              exitDate: '',
              exitType: 'Voluntary'
            })
          }}
        />
      )}
    </div>
  )
}

// Add Stage Modal
const AddStageModal = ({ employees, formData, onFormChange, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Add Lifecycle Stage</h3>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => onFormChange({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select employee...</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.employeeId} - {emp.personalInfo?.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                <select
                  required
                  value={formData.stage}
                  onChange={(e) => onFormChange({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Joining">Joining</option>
                  <option value="Confirmation">Confirmation</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Promotion">Promotion</option>
                  <option value="Resignation">Resignation</option>
                  <option value="Exit">Exit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                <textarea
                  rows={3}
                  value={formData.comments}
                  onChange={(e) => onFormChange({ ...formData, comments: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {(formData.stage === 'Resignation' || formData.stage === 'Exit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <textarea
                    rows={2}
                    value={formData.reason}
                    onChange={(e) => onFormChange({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {formData.stage === 'Promotion' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Role</label>
                  <input
                    type="text"
                    value={formData.newRole}
                    onChange={(e) => onFormChange({ ...formData, newRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {formData.stage === 'Transfer' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Old Department</label>
                    <input
                      type="text"
                      value={formData.oldDepartment}
                      onChange={(e) => onFormChange({ ...formData, oldDepartment: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Department</label>
                    <input
                      type="text"
                      value={formData.newDepartment}
                      onChange={(e) => onFormChange({ ...formData, newDepartment: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {formData.stage === 'Exit' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exit Date</label>
                    <input
                      type="date"
                      value={formData.exitDate}
                      onChange={(e) => onFormChange({ ...formData, exitDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exit Type</label>
                    <select
                      value={formData.exitType}
                      onChange={(e) => onFormChange({ ...formData, exitType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Voluntary">Voluntary</option>
                      <option value="Involuntary">Involuntary</option>
                      <option value="Retirement">Retirement</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeLifecycle


