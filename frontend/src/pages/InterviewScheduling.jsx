import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  FiCalendar,
  FiClock,
  FiUser,
  FiVideo,
  FiMapPin,
  FiEdit,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiPlus,
  FiMail
} from 'react-icons/fi'
import { format } from 'date-fns'

// 12-Hour Time Picker Component
const TimePicker12Hour = ({ value, onChange }) => {
  // Convert 24-hour format (HH:mm) to 12-hour format
  const convert24To12 = (time24) => {
    if (!time24) return { hour: '12', minute: '00', ampm: 'AM' }
    const [hours, minutes] = time24.split(':')
    const hour24 = parseInt(hours, 10)
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
    const ampm = hour24 < 12 ? 'AM' : 'PM'
    return {
      hour: hour12.toString().padStart(2, '0'),
      minute: minutes || '00',
      ampm
    }
  }

  // Convert 12-hour format to 24-hour format (HH:mm)
  const convert12To24 = (hour, minute, ampm) => {
    let hour24 = parseInt(hour, 10)
    if (ampm === 'PM' && hour24 !== 12) {
      hour24 += 12
    } else if (ampm === 'AM' && hour24 === 12) {
      hour24 = 0
    }
    return `${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  const time12 = convert24To12(value)
  const [hour, setHour] = useState(time12.hour)
  const [minute, setMinute] = useState(time12.minute)
  const [ampm, setAmpm] = useState(time12.ampm)

  // Update when value prop changes
  useEffect(() => {
    const time12 = convert24To12(value)
    setHour(time12.hour)
    setMinute(time12.minute)
    setAmpm(time12.ampm)
  }, [value])

  const handleChange = (newHour, newMinute, newAmpm) => {
    setHour(newHour)
    setMinute(newMinute)
    setAmpm(newAmpm)
    const time24 = convert12To24(newHour, newMinute, newAmpm)
    onChange(time24)
  }

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  
  // Generate minute options (00-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  return (
    <div className="flex items-center space-x-2">
      <select
        value={hour}
        onChange={(e) => handleChange(e.target.value, minute, ampm)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
      >
        {hourOptions.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-gray-500">:</span>
      <select
        value={minute}
        onChange={(e) => handleChange(hour, e.target.value, ampm)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
      >
        {minuteOptions.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={ampm}
        onChange={(e) => handleChange(hour, minute, e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

const InterviewScheduling = () => {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [evaluators, setEvaluators] = useState([])
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    roundType: 'Aptitude Test',
    scheduledDate: '',
    scheduledTime: '',
    evaluator: '',
    mode: 'Online',
    meetingLink: '',
    venue: ''
  })

  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager') {
      fetchApplications()
      fetchEvaluators()
      fetchInterviews()
    }
  }, [user])

  const fetchApplications = async () => {
    try {
      // Fetch all applications to get all candidate names
      const { data } = await axios.get('/api/recruitment/applications')
      setApplications(data)
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const fetchEvaluators = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/evaluators')
      setEvaluators(data)
    } catch (error) {
      console.error('Error fetching evaluators:', error)
      // Fallback: try to get from employees
      try {
        const { data: employees } = await axios.get('/api/employees')
        setEvaluators(employees)
      } catch (fallbackError) {
        console.error('Error fetching employees as fallback:', fallbackError)
      }
    }
  }

  const fetchInterviews = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/applications')
      // Extract all interviews from applications
      const allInterviews = []
      data.forEach(app => {
        if (app.interviewRounds && app.interviewRounds.length > 0) {
          app.interviewRounds.forEach(round => {
            allInterviews.push({
              ...round,
              applicationId: app._id,
              candidateName: app.candidateInfo.fullName,
              candidateEmail: app.candidateInfo.email,
              jobTitle: app.jobId?.title || app.candidateInfo.appliedJobRole
            })
          })
        }
      })
      setInterviews(allInterviews)
    } catch (error) {
      console.error('Error fetching interviews:', error)
    }
  }

  const handleScheduleInterview = async (applicationId, e) => {
    e.preventDefault()
    if (!applicationId) {
      toast.error('Please select an application')
      return
    }
    try {
      await axios.post(`/api/recruitment/applications/${applicationId}/interviews`, scheduleForm)
      toast.success('Interview scheduled successfully')
      setShowScheduleForm(false)
      setSelectedApplication(null)
      setScheduleForm({
        roundType: 'Aptitude Test',
        scheduledDate: '',
        scheduledTime: '',
        evaluator: '',
        mode: 'Online',
        meetingLink: '',
        venue: ''
      })
      fetchApplications()
      fetchInterviews()
    } catch (error) {
      console.error('Error scheduling interview:', error)
      if (error.response?.data?.conflict) {
        toast.error('Interviewer has a conflicting interview at this time')
      } else {
        toast.error(error.response?.data?.message || 'Failed to schedule interview')
      }
    }
  }

  const handleUpdateInterview = async (e) => {
    e.preventDefault()
    try {
      await axios.put(
        `/api/recruitment/applications/${selectedInterview.applicationId}/interviews/${selectedInterview._id}`,
        scheduleForm
      )
      toast.success('Interview updated successfully')
      setShowEditForm(false)
      setSelectedInterview(null)
      fetchInterviews()
    } catch (error) {
      console.error('Error updating interview:', error)
      if (error.response?.data?.conflict) {
        toast.error('Interviewer has a conflicting interview at this time')
      } else {
        toast.error('Failed to update interview')
      }
    }
  }

  const handleCompleteInterview = async (interview, status, feedback, rating) => {
    try {
      await axios.put(
        `/api/recruitment/applications/${interview.applicationId}/interviews/${interview._id}`,
        {
          status,
          feedback,
          rating
        }
      )
      toast.success('Interview completed')
      fetchInterviews()
      fetchApplications()
    } catch (error) {
      console.error('Error completing interview:', error)
      toast.error('Failed to complete interview')
    }
  }

  const openScheduleForm = (application) => {
    setSelectedApplication(application)
    setShowScheduleForm(true)
  }

  const openEditForm = (interview) => {
    setSelectedInterview(interview)
    setScheduleForm({
      roundType: interview.roundType,
      scheduledDate: format(new Date(interview.scheduledDate), 'yyyy-MM-dd'),
      scheduledTime: interview.scheduledTime,
      evaluator: interview.evaluator?._id || interview.evaluator,
      mode: interview.mode,
      meetingLink: interview.meetingLink || '',
      venue: interview.venue || ''
    })
    setShowEditForm(true)
  }

  const upcomingInterviews = interviews.filter(int => {
    const interviewDate = new Date(int.scheduledDate)
    return interviewDate >= new Date() && (int.status === 'Scheduled' || int.status === 'Rescheduled')
  }).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))

  const pastInterviews = interviews.filter(int => {
    const interviewDate = new Date(int.scheduledDate)
    return interviewDate < new Date() || int.status === 'Completed' || int.status === 'Passed' || int.status === 'Failed'
  }).sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))

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
          <h1 className="text-3xl font-bold text-gray-900">Interview Scheduling</h1>
          <p className="mt-2 text-gray-600">Schedule and manage candidate interviews</p>
        </div>
        <button
          onClick={() => setShowScheduleForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
        >
          <FiPlus className="mr-2" size={20} />
          Schedule Interview
        </button>
      </div>

      {/* Upcoming Interviews */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Interviews</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingInterviews.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
              <FiCalendar className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-600">No upcoming interviews</p>
            </div>
          ) : (
            upcomingInterviews.map((interview, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{interview.candidateName}</h3>
                    <p className="text-sm text-gray-600">{interview.jobTitle}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    interview.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                    interview.status === 'Rescheduled' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {interview.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <FiCalendar className="mr-2" size={16} />
                    {format(new Date(interview.scheduledDate), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FiClock className="mr-2" size={16} />
                    {interview.scheduledTime}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">Round:</span>
                    {interview.roundType}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FiUser className="mr-2" size={16} />
                    {interview.evaluator?.email || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    {interview.mode === 'Online' ? (
                      <FiVideo className="mr-2" size={16} />
                    ) : (
                      <FiMapPin className="mr-2" size={16} />
                    )}
                    {interview.mode}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditForm(interview)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center"
                  >
                    <FiEdit className="mr-1" size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      const status = prompt('Enter status (Passed/Failed/No Show):')
                      const feedback = prompt('Enter feedback:')
                      const rating = prompt('Enter rating (1-5):')
                      if (status && feedback && rating) {
                        handleCompleteInterview(interview, status, feedback, parseInt(rating))
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center"
                  >
                    <FiCheckCircle className="mr-1" size={16} />
                    Complete
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Past Interviews */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Past Interviews</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Round</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pastInterviews.slice(0, 10).map((interview, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {interview.candidateName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {interview.roundType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(interview.scheduledDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        interview.status === 'Passed' ? 'bg-green-100 text-green-800' :
                        interview.status === 'Failed' ? 'bg-red-100 text-red-800' :
                        interview.status === 'No Show' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {interview.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {interview.rating ? `${interview.rating}/5` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Schedule Interview Modal */}
      {showScheduleForm && (
        <InterviewScheduleModal
          applications={applications}
          evaluators={evaluators}
          formData={scheduleForm}
          onFormChange={setScheduleForm}
          onSubmit={(applicationId, e) => handleScheduleInterview(applicationId, e)}
          onClose={() => {
            setShowScheduleForm(false)
            setSelectedApplication(null)
            setScheduleForm({
              roundType: 'Aptitude Test',
              scheduledDate: '',
              scheduledTime: '',
              evaluator: '',
              mode: 'Online',
              meetingLink: '',
              venue: ''
            })
          }}
        />
      )}

      {/* Edit Interview Modal */}
      {showEditForm && selectedInterview && (
        <InterviewEditModal
          interview={selectedInterview}
          evaluators={evaluators}
          formData={scheduleForm}
          onFormChange={setScheduleForm}
          onSubmit={handleUpdateInterview}
          onClose={() => {
            setShowEditForm(false)
            setSelectedInterview(null)
          }}
        />
      )}
    </div>
  )
}

// Schedule Interview Modal
const InterviewScheduleModal = ({ applications, evaluators, formData, onFormChange, onSubmit, onClose }) => {
  const [selectedCandidateName, setSelectedCandidateName] = useState('')

  // Get unique candidate names from applications
  const candidateNames = [...new Set(applications.map(app => app.candidateInfo?.fullName).filter(Boolean))].sort()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedCandidateName) {
      toast.error('Please select a candidate name')
      return
    }
    // Find application by candidate name
    const selectedApp = applications.find(app => app.candidateInfo?.fullName === selectedCandidateName)
    if (!selectedApp) {
      toast.error('Application not found for this candidate')
      return
    }
    onSubmit(selectedApp._id, e)
    // Reset after successful submission
    setSelectedCandidateName('')
  }

  const handleClose = () => {
    setSelectedCandidateName('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Schedule Interview</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter Name *</label>
                <select
                  required
                  value={selectedCandidateName}
                  onChange={(e) => setSelectedCandidateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select candidate name...</option>
                  {candidateNames.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {candidateNames.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No candidates found. Applications must be submitted first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round Type *</label>
                <select
                  required
                  value={formData.roundType}
                  onChange={(e) => onFormChange({ ...formData, roundType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Aptitude Test">Aptitude Test</option>
                  <option value="Technical Round">Technical Round</option>
                  <option value="Interview Round">Interview Round</option>
                  <option value="HR Round">HR Round</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.scheduledDate}
                    onChange={(e) => onFormChange({ ...formData, scheduledDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <TimePicker12Hour
                    value={formData.scheduledTime}
                    onChange={(time24h) => onFormChange({ ...formData, scheduledTime: time24h })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Evaluator *</label>
                <select
                  required
                  value={formData.evaluator}
                  onChange={(e) => onFormChange({ ...formData, evaluator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select evaluator...</option>
                  {evaluators.map(evaluator => (
                    <option key={evaluator._id} value={evaluator._id}>
                      {evaluator.personalInfo?.fullName || evaluator.email} {evaluator.role ? `(${evaluator.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode *</label>
                <select
                  required
                  value={formData.mode}
                  onChange={(e) => onFormChange({ ...formData, mode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              {formData.mode === 'Online' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={formData.meetingLink}
                    onChange={(e) => onFormChange({ ...formData, meetingLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => onFormChange({ ...formData, venue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Schedule Interview
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// Edit Interview Modal
const InterviewEditModal = ({ interview, evaluators, formData, onFormChange, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Edit Interview</h3>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round Type</label>
                <select
                  value={formData.roundType}
                  onChange={(e) => onFormChange({ ...formData, roundType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Aptitude Test">Aptitude Test</option>
                  <option value="Technical Round">Technical Round</option>
                  <option value="Interview Round">Interview Round</option>
                  <option value="HR Round">HR Round</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => onFormChange({ ...formData, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <TimePicker12Hour
                    value={formData.scheduledTime}
                    onChange={(time24h) => onFormChange({ ...formData, scheduledTime: time24h })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Evaluator</label>
                <select
                  value={formData.evaluator}
                  onChange={(e) => onFormChange({ ...formData, evaluator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {evaluators.map(evaluator => (
                    <option key={evaluator._id} value={evaluator._id}>
                      {evaluator.personalInfo?.fullName || evaluator.email} {evaluator.role ? `(${evaluator.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={formData.mode}
                  onChange={(e) => onFormChange({ ...formData, mode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              {formData.mode === 'Online' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={formData.meetingLink}
                    onChange={(e) => onFormChange({ ...formData, meetingLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => onFormChange({ ...formData, venue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
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
                  Update Interview
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InterviewScheduling

