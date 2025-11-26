import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { FiAlertCircle, FiPlus, FiCheck, FiEye, FiX } from 'react-icons/fi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const Grievances = () => {
  const { user } = useAuth()
  const [grievances, setGrievances] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [selectedGrievance, setSelectedGrievance] = useState(null)
  const [resolveDetails, setResolveDetails] = useState('')
  const [formData, setFormData] = useState({
    type: 'Query',
    category: 'HR Issues',
    title: '',
    description: '',
    priority: 'Medium'
  })

  useEffect(() => {
    fetchGrievances()
  }, [])

  const fetchGrievances = async () => {
    try {
      const { data } = await axios.get('/api/grievances')
      setGrievances(data)
    } catch (error) {
      console.error('Error fetching grievances:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/grievances', formData)
      toast.success('Grievance submitted successfully!')
      setShowForm(false)
      setFormData({
        type: 'Query',
        category: 'HR Issues',
        title: '',
        description: '',
        priority: 'Medium'
      })
      fetchGrievances()
    } catch (error) {
      toast.error('Failed to submit grievance')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-800'
      case 'High':
        return 'bg-orange-100 text-orange-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleResolveClick = (grievance) => {
    setSelectedGrievance(grievance)
    setResolveDetails('')
    setShowResolveModal(true)
  }

  const handleResolve = async (e) => {
    e.preventDefault()
    
    if (!resolveDetails.trim()) {
      toast.error('Please provide resolution details')
      return
    }

    try {
      console.log(`[GRIEVANCES] Resolving grievance ${selectedGrievance._id} with details:`, resolveDetails)
      const response = await axios.put(`/api/grievances/${selectedGrievance._id}/resolve`, {
        resolutionDetails: resolveDetails
      })
      
      console.log('[GRIEVANCES] Resolution response:', response.data)
      toast.success('Grievance resolved successfully!')
      setShowResolveModal(false)
      setSelectedGrievance(null)
      setResolveDetails('')
      fetchGrievances()
    } catch (error) {
      console.error('Error resolving grievance:', error)
      console.error('Error response:', error.response)
      console.error('Error URL:', error.config?.url)
      if (error.response?.status === 404) {
        toast.error('Route not found. Please check server logs and restart the server.')
      } else {
        toast.error(error.response?.data?.message || 'Failed to resolve grievance')
      }
    }
  }

  const canResolve = (grievance) => {
    if (user?.role !== 'manager') return false
    return grievance.status !== 'Resolved' && grievance.status !== 'Closed'
  }

  const getResolvedBy = (grievance) => {
    if (grievance.status === 'Resolved' && grievance.resolution?.resolvedBy) {
      const resolver = grievance.resolution.resolvedBy
      if (resolver.role === 'manager') {
        return 'Solved by Manager'
      } else if (resolver.role === 'hr') {
        return 'Solved by HR'
      } else if (resolver.role === 'admin') {
        return 'Solved by Admin'
      }
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grievances & Queries</h1>
          <p className="text-gray-600 mt-1">Raise and track your concerns</p>
        </div>
        {(user?.role === 'employee' || user?.role === 'hr') && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <FiPlus size={20} />
            <span>Raise Ticket</span>
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Raise New Ticket</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <select className="input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="Grievance">Grievance</option>
                  <option value="Complaint">Complaint</option>
                  <option value="Query">Query</option>
                  <option value="Suggestion">Suggestion</option>
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  <option value="HR Issues">HR Issues</option>
                  <option value="Salary Issues">Salary Issues</option>
                  <option value="IT Support">IT Support</option>
                  <option value="Workplace Complaints">Workplace Complaints</option>
                  <option value="Policy Queries">Policy Queries</option>
                  <option value="Facilities/Maintenance">Facilities/Maintenance</option>
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Title</label>
              <input type="text" className="input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
            </div>
            <div className="flex space-x-4">
              <button type="submit" className="btn btn-primary">Submit</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {user?.role !== 'employee' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {user?.role === 'manager' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {grievances.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'manager' ? 7 : user?.role !== 'employee' ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                    No grievances found
                  </td>
                </tr>
              ) : (
                grievances.map((grievance) => (
                <tr key={grievance._id}>
                  {user?.role !== 'employee' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {grievance.employeeId?.personalInfo?.fullName || grievance.employeeId?.employeeId}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grievance.ticketNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{grievance.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grievance.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(grievance.priority)}`}>
                      {grievance.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(grievance.status)}`}>
                        {grievance.status}
                      </span>
                      {getResolvedBy(grievance) && (
                        <span className="text-xs text-gray-500 mt-1">
                          {getResolvedBy(grievance)}
                        </span>
                      )}
                    </div>
                  </td>
                  {user?.role === 'manager' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {canResolve(grievance) && (
                          <button
                            onClick={() => handleResolveClick(grievance)}
                            className="btn btn-primary text-sm flex items-center space-x-1"
                          >
                            <FiCheck className="w-4 h-4" />
                            <span>Resolve</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedGrievance(grievance)
                            setShowResolveModal(true)
                          }}
                          className="btn btn-secondary text-sm flex items-center space-x-1"
                        >
                          <FiEye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Grievance Modal */}
      {showResolveModal && selectedGrievance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {canResolve(selectedGrievance) ? 'Resolve Grievance' : 'Grievance Details'}
                  </h2>
                  <p className="text-gray-600 mt-1">Ticket #{selectedGrievance.ticketNumber}</p>
                </div>
                <button
                  onClick={() => {
                    setShowResolveModal(false)
                    setSelectedGrievance(null)
                    setResolveDetails('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              {/* Grievance Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <p className="text-gray-900">{selectedGrievance.title}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedGrievance.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <p className="text-gray-900">{selectedGrievance.category}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(selectedGrievance.priority)}`}>
                      {selectedGrievance.priority}
                    </span>
                  </div>
                </div>
                {selectedGrievance.status === 'Resolved' && selectedGrievance.resolution && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-green-800 mb-1">Resolution Details</label>
                    <p className="text-green-900 whitespace-pre-wrap">{selectedGrievance.resolution.resolutionDetails}</p>
                    <p className="text-xs text-green-700 mt-2">
                      Resolved on: {new Date(selectedGrievance.resolution.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Resolve Form (only if not resolved) */}
              {canResolve(selectedGrievance) && (
                <form onSubmit={handleResolve} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Details <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={resolveDetails}
                      onChange={(e) => setResolveDetails(e.target.value)}
                      className="input"
                      rows={5}
                      required
                      placeholder="Enter resolution details and actions taken..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResolveModal(false)
                        setSelectedGrievance(null)
                        setResolveDetails('')
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex items-center space-x-2"
                    >
                      <FiCheck className="w-4 h-4" />
                      <span>Mark as Resolved</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Grievances

