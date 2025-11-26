import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { FiTrendingUp, FiStar, FiEye, FiEdit2, FiCheck, FiX, FiPlus, FiUsers } from 'react-icons/fi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const Performance = () => {
  const { user } = useAuth()
  const [performances, setPerformances] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPerformance, setSelectedPerformance] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // HR-specific state (similar to attendance and leaves modules)
  const [allEmployees, setAllEmployees] = useState([]) // For HR to view all employees
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null) // null = view all employees
  const [reviewForm, setReviewForm] = useState({
    overallRating: 0,
    feedback: '',
    improvementPlan: '',
    kpiRatings: []
  })
  const [createForm, setCreateForm] = useState({
    employeeId: '',
    selectedEmployeeName: '',
    reviewCycle: 'Quarterly',
    period: '',
    startDate: '',
    endDate: '',
    rating: 0,
    kpis: [{ title: '', description: '', weightage: 0, targetValue: 0, achievedValue: 0 }]
  })

  useEffect(() => {
    fetchPerformances()
    if (user?.role === 'manager') {
      fetchTeamMembers()
    }
    if (user?.role === 'hr') {
      fetchAllEmployees()
    }
  }, [user, selectedEmployeeId])

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

  const fetchPerformances = async () => {
    try {
      let params = {}
      
      // For HR, if viewing specific employee, pass employeeId
      if (user?.role === 'hr' && selectedEmployeeId) {
        params.employeeId = selectedEmployeeId
      }
      // If HR not viewing specific employee, backend returns all performance reviews
      
      const { data } = await axios.get('/api/performance', { params })
      setPerformances(data || [])
    } catch (error) {
      console.error('Error fetching performances:', error)
      toast.error('Failed to load performance reviews')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const { data } = await axios.get('/api/performance/team-members')
      console.log('[PERFORMANCE] Team members fetched:', data)
      setTeamMembers(data || [])
      
      if (!data || data.length === 0) {
        console.warn('[PERFORMANCE] No team members found. This could mean:')
        console.warn('  1. No employees have reportingManager set to this manager')
        console.warn('  2. Employees might not have employeeId set')
        console.warn('  3. All team members might be inactive')
        console.warn('  4. Check server logs for detailed debugging information')
        
        // Show helpful message to user
        toast.error('No team members found. Please ensure employees have reportingManager set and employeeId assigned.', {
          duration: 5000
        })
      } else {
        console.log(`[PERFORMANCE] Successfully loaded ${data.length} team member(s)`)
        data.forEach((member, idx) => {
          console.log(`  ${idx + 1}. Employee ID: ${member.employeeId || 'MISSING'}, Name: ${member.personalInfo?.fullName || 'N/A'}, _id: ${member._id}`)
          // Verify employeeId is present
          if (!member.employeeId) {
            console.warn(`  ⚠️ Team member ${idx + 1} (${member.personalInfo?.fullName || member._id}) is missing employeeId!`)
          }
        })
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
      console.error('Error details:', error.response?.data)
      toast.error(error.response?.data?.message || 'Failed to load team members. Please check server logs.', {
        duration: 5000
      })
      setTeamMembers([]) // Set empty array on error
    }
  }

  const handleViewDetails = async (id) => {
    try {
      const { data } = await axios.get(`/api/performance/${id}`)
      setSelectedPerformance(data)
      setShowReviewModal(true)
      
      // Pre-fill form if manager review exists
      if (data.managerReview) {
        setReviewForm({
          overallRating: data.managerReview.overallRating || 0,
          feedback: data.managerReview.feedback || '',
          improvementPlan: data.managerReview.improvementPlan || '',
          kpiRatings: data.kpis?.map(kpi => ({
            rating: kpi.rating || 0,
            status: kpi.status || 'In Progress'
          })) || []
        })
      } else {
        // Initialize with empty ratings
        setReviewForm({
          overallRating: 0,
          feedback: '',
          improvementPlan: '',
          kpiRatings: data.kpis?.map(() => ({
            rating: 0,
            status: 'In Progress'
          })) || []
        })
      }
    } catch (error) {
      console.error('Error fetching performance details:', error)
      toast.error('Failed to load performance details')
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    
    if (!reviewForm.overallRating || reviewForm.overallRating < 1 || reviewForm.overallRating > 5) {
      toast.error('Please provide an overall rating (1-5)')
      return
    }

    try {
      await axios.put(`/api/performance/${selectedPerformance._id}/manager-review`, {
        overallRating: reviewForm.overallRating,
        feedback: reviewForm.feedback,
        improvementPlan: reviewForm.improvementPlan,
        kpiRatings: reviewForm.kpiRatings
      })
      
      toast.success('Performance review submitted successfully!')
      setShowReviewModal(false)
      setSelectedPerformance(null)
      fetchPerformances()
    } catch (error) {
      console.error('Error submitting review:', error)
      toast.error(error.response?.data?.message || 'Failed to submit review')
    }
  }

  const handleCreateReview = async (e) => {
    e.preventDefault()
    
    if (!createForm.employeeId || !createForm.period || !createForm.startDate || !createForm.endDate) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!createForm.rating || createForm.rating < 1 || createForm.rating > 5) {
      toast.error('Please provide a rating (1-5)')
      return
    }

    // Validate KPIs
    const validKPIs = createForm.kpis.filter(kpi => kpi.title && kpi.description)
    if (validKPIs.length === 0) {
      toast.error('Please add at least one KPI')
      return
    }

    // Calculate total weightage
    const totalWeightage = validKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.weightage) || 0), 0)
    if (Math.abs(totalWeightage - 100) > 0.01) {
      toast.error(`Total KPI weightage must equal 100%. Current: ${totalWeightage}%`)
      return
    }

    try {
      const performanceData = {
        employeeId: createForm.employeeId,
        reviewCycle: createForm.reviewCycle,
        period: createForm.period,
        startDate: new Date(createForm.startDate).toISOString(),
        endDate: new Date(createForm.endDate).toISOString(),
        rating: createForm.rating || 0,
        kpis: validKPIs.map(kpi => ({
          title: kpi.title,
          description: kpi.description,
          weightage: parseFloat(kpi.weightage) || 0,
          targetValue: parseFloat(kpi.targetValue) || 0,
          achievedValue: parseFloat(kpi.achievedValue) || 0,
          status: 'In Progress'
        })),
        status: 'Draft'
      }

      await axios.post('/api/performance', performanceData)
      
      toast.success('Performance review created successfully!')
      setShowCreateModal(false)
      setCreateForm({
        employeeId: '',
        selectedEmployeeName: '',
        reviewCycle: 'Quarterly',
        period: '',
        startDate: '',
        endDate: '',
        rating: 0,
        kpis: [{ title: '', description: '', weightage: 0, targetValue: 0, achievedValue: 0 }]
      })
      fetchPerformances()
    } catch (error) {
      console.error('Error creating review:', error)
      toast.error(error.response?.data?.message || 'Failed to create performance review')
    }
  }

  const addKPI = () => {
    setCreateForm({
      ...createForm,
      kpis: [...createForm.kpis, { title: '', description: '', weightage: 0, targetValue: 0, achievedValue: 0 }]
    })
  }

  const removeKPI = (index) => {
    const newKPIs = createForm.kpis.filter((_, i) => i !== index)
    setCreateForm({ ...createForm, kpis: newKPIs })
  }

  const updateKPI = (index, field, value) => {
    const newKPIs = [...createForm.kpis]
    newKPIs[index][field] = value
    setCreateForm({ ...createForm, kpis: newKPIs })
  }

  // Predefined KPIs list
  const predefinedKPIs = [
    {
      title: 'Project Delivery',
      description: 'On-time delivery of assigned projects and tasks',
      defaultWeightage: 25
    },
    {
      title: 'Code Quality',
      description: 'Quality of code written, adherence to coding standards, and code reviews',
      defaultWeightage: 20
    },
    {
      title: 'Team Collaboration',
      description: 'Effective collaboration with team members, communication, and knowledge sharing',
      defaultWeightage: 15
    },
    {
      title: 'Client Satisfaction',
      description: 'Client feedback and satisfaction ratings',
      defaultWeightage: 20
    },
    {
      title: 'Problem Solving',
      description: 'Ability to identify, analyze, and solve complex problems',
      defaultWeightage: 10
    },
    {
      title: 'Learning & Development',
      description: 'Continuous learning, skill development, and training completion',
      defaultWeightage: 10
    },
    {
      title: 'Attendance & Punctuality',
      description: 'Regular attendance, punctuality, and meeting deadlines',
      defaultWeightage: 15
    },
    {
      title: 'Task Completion Rate',
      description: 'Percentage of assigned tasks completed within deadline',
      defaultWeightage: 20
    },
    {
      title: 'Bug Resolution Time',
      description: 'Average time taken to resolve bugs and issues',
      defaultWeightage: 15
    },
    {
      title: 'Documentation Quality',
      description: 'Quality and completeness of technical documentation',
      defaultWeightage: 10
    },
    {
      title: 'Customer Support',
      description: 'Response time and quality of customer support provided',
      defaultWeightage: 20
    },
    {
      title: 'Sales Target Achievement',
      description: 'Percentage of sales targets achieved',
      defaultWeightage: 30
    },
    {
      title: 'Revenue Generation',
      description: 'Revenue generated or contributed to business growth',
      defaultWeightage: 25
    },
    {
      title: 'Process Improvement',
      description: 'Contributions to process improvements and efficiency',
      defaultWeightage: 15
    },
    {
      title: 'Leadership & Mentoring',
      description: 'Leadership skills and mentoring of junior team members',
      defaultWeightage: 20
    }
  ]

  const handleAddPredefinedKPI = (predefinedKPI) => {
    // Check if KPI already exists
    const exists = createForm.kpis.some(kpi => kpi.title === predefinedKPI.title)
    if (exists) {
      toast.error('This KPI is already added')
      return
    }

    // Calculate remaining weightage
    const usedWeightage = createForm.kpis.reduce((sum, kpi) => sum + (parseFloat(kpi.weightage) || 0), 0)
    const remainingWeightage = 100 - usedWeightage
    
    // Use predefined weightage or distribute remaining
    const weightage = predefinedKPI.defaultWeightage <= remainingWeightage 
      ? predefinedKPI.defaultWeightage 
      : remainingWeightage > 0 ? remainingWeightage : 0

    const newKPI = {
      title: predefinedKPI.title,
      description: predefinedKPI.description,
      weightage: weightage,
      targetValue: 0,
      achievedValue: 0
    }

    setCreateForm({
      ...createForm,
      kpis: [...createForm.kpis, newKPI]
    })
  }

  const handleAddManualKPI = () => {
    addKPI()
  }

  const renderStars = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={`w-5 h-5 ${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'Manager Review':
        return 'bg-blue-100 text-blue-800'
      case 'Self Assessment':
        return 'bg-yellow-100 text-yellow-800'
      case 'HR Review':
        return 'bg-purple-100 text-purple-800'
      case 'Locked':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const canReview = (perf) => {
    if (user?.role !== 'manager') return false
    return perf.status === 'Self Assessment' || perf.status === 'Manager Review'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Management</h1>
          <p className="text-gray-600 mt-1">Track performance reviews and appraisals</p>
        </div>
        {user?.role === 'manager' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <FiPlus className="w-5 h-5" />
            <span>Create Review</span>
          </button>
        )}
      </div>

      {/* Employee Selector for HR */}
      {user?.role === 'hr' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-purple-50 border border-purple-200"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiUsers className="inline mr-2 text-purple-600" size={18} />
                View Performance Reviews
              </label>
              <select
                value={selectedEmployeeId || 'all-employees'}
                onChange={(e) => {
                  if (e.target.value === 'all-employees') {
                    setSelectedEmployeeId(null)
                  } else {
                    setSelectedEmployeeId(e.target.value)
                  }
                }}
                className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
              >
                <option value="all-employees">👥 All Employees (All Reviews)</option>
                {allEmployees && allEmployees.length > 0 ? (
                  allEmployees.map((employee) => {
                    const displayName = employee.personalInfo?.fullName || employee.employeeId || 'Unknown'
                    const empId = employee.employeeId || employee._id
                    const department = employee.companyDetails?.department ? ` - ${employee.companyDetails.department}` : ''
                    return (
                      <option key={employee._id} value={employee._id}>
                        👤 {displayName} ({empId}){department}
                      </option>
                    )
                  })
                ) : (
                  <option value="" disabled>No employees found</option>
                )}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                {selectedEmployeeId ? (
                  <span className="text-purple-700">
                    📖 <strong>Viewing employee performance:</strong> Showing reviews for selected employee
                  </span>
                ) : (
                  <span className="text-blue-700">
                    👥 <strong>Viewing all employees:</strong> Showing all performance reviews
                  </span>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {(user?.role !== 'employee') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Employee
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Review Cycle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {performances.length === 0 ? (
                <tr>
                  <td colSpan={user?.role !== 'employee' ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                    No performance reviews found
                  </td>
                </tr>
              ) : (
                performances.map((perf) => (
                  <tr key={perf._id} className="hover:bg-gray-50">
                    {user?.role !== 'employee' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {perf.employeeId?.personalInfo?.fullName || perf.employeeId?.employeeId}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.reviewCycle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {perf.managerReview?.overallRating ? (
                        <div className="flex items-center space-x-2">
                          {renderStars(perf.managerReview.overallRating)}
                          <span className="text-gray-900 font-medium">
                            {perf.managerReview.overallRating}/5
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not rated</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(perf.status)}`}>
                        {perf.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(perf._id)}
                          className="text-primary-600 hover:text-primary-900 flex items-center space-x-1"
                        >
                          <FiEye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                        {canReview(perf) && (
                          <button
                            onClick={() => handleViewDetails(perf._id)}
                            className="text-green-600 hover:text-green-900 flex items-center space-x-1"
                          >
                            <FiEdit2 className="w-4 h-4" />
                            <span>Review</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedPerformance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Performance Review</h2>
                  <p className="text-gray-600 mt-1">
                    {selectedPerformance.employeeId?.personalInfo?.fullName || selectedPerformance.employeeId?.employeeId} - {selectedPerformance.period}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReviewModal(false)
                    setSelectedPerformance(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Self Assessment Section */}
                {selectedPerformance.selfAssessment && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Self Assessment</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-700">Achievements:</p>
                        <p className="text-gray-600 mt-1">{selectedPerformance.selfAssessment.achievements || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Challenges:</p>
                        <p className="text-gray-600 mt-1">{selectedPerformance.selfAssessment.challenges || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Training Needs:</p>
                        <p className="text-gray-600 mt-1">{selectedPerformance.selfAssessment.trainingNeeds || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* KPIs Section */}
                {selectedPerformance.kpis && selectedPerformance.kpis.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Key Performance Indicators (KPIs)</h3>
                    <div className="space-y-4">
                      {selectedPerformance.kpis.map((kpi, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{kpi.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{kpi.description}</p>
                              <div className="mt-2 text-sm text-gray-500">
                                <span>Target: {kpi.targetValue}</span>
                                <span className="mx-2">|</span>
                                <span>Achieved: {kpi.achievedValue}</span>
                                <span className="mx-2">|</span>
                                <span>Weightage: {kpi.weightage}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center space-x-4">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rating (1-5)
                              </label>
                              <div className="flex items-center space-x-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  user?.role === 'manager' && canReview(selectedPerformance) ? (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => {
                                        const newRatings = [...reviewForm.kpiRatings]
                                        newRatings[index] = {
                                          ...newRatings[index],
                                          rating: star
                                        }
                                        setReviewForm({ ...reviewForm, kpiRatings: newRatings })
                                      }}
                                      className="focus:outline-none"
                                    >
                                      <FiStar
                                        className={`w-6 h-6 ${
                                          star <= (reviewForm.kpiRatings[index]?.rating || 0)
                                            ? 'text-yellow-400 fill-current'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    </button>
                                  ) : (
                                    <FiStar
                                      key={star}
                                      className={`w-6 h-6 ${
                                        star <= (kpi.rating || 0)
                                          ? 'text-yellow-400 fill-current'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  )
                                ))}
                                <span className="ml-2 text-sm text-gray-600">
                                  {user?.role === 'manager' && canReview(selectedPerformance)
                                    ? (reviewForm.kpiRatings[index]?.rating || 0)
                                    : (kpi.rating || 0)}/5
                                </span>
                              </div>
                            </div>
                            <div className="w-48">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                              </label>
                              {user?.role === 'manager' && canReview(selectedPerformance) ? (
                                <select
                                  value={reviewForm.kpiRatings[index]?.status || 'In Progress'}
                                  onChange={(e) => {
                                    const newRatings = [...reviewForm.kpiRatings]
                                    newRatings[index] = {
                                      ...newRatings[index],
                                      status: e.target.value
                                    }
                                    setReviewForm({ ...reviewForm, kpiRatings: newRatings })
                                  }}
                                  className="input text-sm"
                                >
                                  <option value="Achieved">Achieved</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Behind Target">Behind Target</option>
                                </select>
                              ) : (
                                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    kpi.status === 'Achieved' 
                                      ? 'bg-green-100 text-green-800'
                                      : kpi.status === 'Behind Target'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {kpi.status || 'In Progress'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manager Review Section */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Manager Review</h3>
                  
                  {selectedPerformance.managerReview ? (
                    // Show existing manager review (read-only for HR, editable for managers)
                    <div className="space-y-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Overall Rating
                        </label>
                        <div className="flex items-center space-x-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FiStar
                              key={star}
                              className={`w-8 h-8 ${
                                star <= (selectedPerformance.managerReview?.overallRating || 0)
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="ml-3 text-lg font-medium text-gray-900">
                            {selectedPerformance.managerReview.overallRating}/5
                          </span>
                        </div>
                        {selectedPerformance.managerReview.reviewedBy && (
                          <p className="text-xs text-gray-500 mt-2">
                            Reviewed by: {selectedPerformance.managerReview.reviewedBy?.email || 'Manager'} on{' '}
                            {selectedPerformance.managerReview.reviewedAt 
                              ? new Date(selectedPerformance.managerReview.reviewedAt).toLocaleDateString()
                              : 'N/A'}
                          </p>
                        )}
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Feedback
                        </label>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {selectedPerformance.managerReview.feedback || 'No feedback provided'}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Improvement Plan
                        </label>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {selectedPerformance.managerReview.improvementPlan || 'No improvement plan provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Show editable form for managers (if no review exists yet)
                    user?.role === 'manager' && (
                      <form onSubmit={handleSubmitReview} className="space-y-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Overall Rating (1-5) <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center space-x-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewForm({ ...reviewForm, overallRating: star })}
                                className="focus:outline-none"
                              >
                                <FiStar
                                  className={`w-8 h-8 ${
                                    star <= reviewForm.overallRating
                                      ? 'text-yellow-400 fill-current'
                                      : 'text-gray-300'
                                  }`}
                                />
                              </button>
                            ))}
                            <span className="ml-3 text-lg font-medium text-gray-900">
                              {reviewForm.overallRating}/5
                            </span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Feedback
                          </label>
                          <textarea
                            value={reviewForm.feedback}
                            onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                            rows={4}
                            className="input"
                            placeholder="Provide detailed feedback on the employee's performance..."
                          />
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Improvement Plan
                          </label>
                          <textarea
                            value={reviewForm.improvementPlan}
                            onChange={(e) => setReviewForm({ ...reviewForm, improvementPlan: e.target.value })}
                            rows={4}
                            className="input"
                            placeholder="Outline areas for improvement and development plan..."
                          />
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t">
                          <button
                            type="button"
                            onClick={() => {
                              setShowReviewModal(false)
                              setSelectedPerformance(null)
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
                            <span>Submit Review</span>
                          </button>
                        </div>
                      </form>
                    )
                  )}
                  
                  {/* Show message if no manager review exists and user is HR */}
                  {!selectedPerformance.managerReview && user?.role === 'hr' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ Manager review not yet submitted. This performance review is still pending manager review.
                      </p>
                    </div>
                  )}
                </div>

                {/* Close button for HR (view-only mode) */}
                {user?.role === 'hr' && (
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReviewModal(false)
                        setSelectedPerformance(null)
                      }}
                      className="btn btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Review Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Create Performance Review</h2>
                  <p className="text-gray-600 mt-1">Create a new performance review for a team member</p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateForm({
                      employeeId: '',
                      selectedEmployeeName: '',
                      reviewCycle: 'Quarterly',
                      period: '',
                      startDate: '',
                      endDate: '',
                      rating: 0,
                      kpis: [{ title: '', description: '', weightage: 0, targetValue: 0, achievedValue: 0 }]
                    })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateReview} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee ID <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={createForm.employeeId}
                      onChange={(e) => {
                        const selectedMember = teamMembers.find(m => m._id === e.target.value)
                        setCreateForm({ 
                          ...createForm, 
                          employeeId: e.target.value,
                          selectedEmployeeName: selectedMember ? (selectedMember.personalInfo?.fullName || 'N/A') : ''
                        })
                      }}
                      className="input"
                      required
                    >
                      <option value="">Select Employee ID</option>
                      {teamMembers.length === 0 ? (
                        <option value="" disabled>No team members found</option>
                      ) : (
                        teamMembers.map((member) => {
                          // Ensure employeeId is displayed - it should come from database
                          const displayEmployeeId = member.employeeId || 'N/A';
                          const displayName = member.personalInfo?.fullName || 'Unknown';
                          
                          return (
                            <option key={member._id} value={member._id}>
                              {displayEmployeeId} - {displayName}
                            </option>
                          );
                        })
                      )}
                    </select>
                    {teamMembers.length === 0 && (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800 font-medium mb-1">
                          ⚠️ No team members found
                        </p>
                        <p className="text-xs text-orange-700">
                          This could mean:
                        </p>
                        <ul className="text-xs text-orange-700 list-disc list-inside mt-1 space-y-1">
                          <li>Employees don't have <code className="bg-orange-100 px-1 rounded">reportingManager</code> set to your manager ID</li>
                          <li>Employees might not have <code className="bg-orange-100 px-1 rounded">employeeId</code> assigned</li>
                          <li>All team members might be inactive</li>
                        </ul>
                        <p className="text-xs text-orange-700 mt-2">
                          <strong>Solution:</strong> Contact HR to assign employees to your team or run the fix script: <code className="bg-orange-100 px-1 rounded">node backend/fix-ved-pawar-manager.js your-email@example.com</code>
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee Name
                    </label>
                    <input
                      type="text"
                      value={createForm.selectedEmployeeName}
                      readOnly
                      className="input bg-gray-50 cursor-not-allowed"
                      placeholder="Employee name will appear here"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Review Cycle <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={createForm.reviewCycle}
                      onChange={(e) => setCreateForm({ ...createForm, reviewCycle: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.period}
                      onChange={(e) => setCreateForm({ ...createForm, period: e.target.value })}
                      className="input"
                      placeholder="e.g., Q1-2025, H1-2025, 2025"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={createForm.endDate}
                      onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>

                {/* Rating Field */}
                <div className="border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rating (1-5) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setCreateForm({ ...createForm, rating: star })}
                          className="focus:outline-none"
                        >
                          <FiStar
                            className={`w-8 h-8 ${
                              star <= createForm.rating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-3 text-lg font-medium text-gray-900">
                        {createForm.rating}/5
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Select overall performance rating for this review period
                    </p>
                  </div>
                </div>

                {/* KPIs Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">Key Performance Indicators (KPIs)</h3>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const selectedKPI = predefinedKPIs.find(kpi => kpi.title === e.target.value)
                              if (selectedKPI) {
                                handleAddPredefinedKPI(selectedKPI)
                              }
                              e.target.value = '' // Reset dropdown
                            }
                          }}
                          className="input text-sm pr-8"
                          defaultValue=""
                        >
                          <option value="">Select Predefined KPI</option>
                          {predefinedKPIs.map((kpi, idx) => (
                            <option key={idx} value={kpi.title}>
                              {kpi.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddManualKPI}
                        className="btn btn-secondary text-sm flex items-center space-x-1"
                      >
                        <FiPlus className="w-4 h-4" />
                        <span>Add Custom KPI</span>
                      </button>
                    </div>
                  </div>
                  
                  {createForm.kpis.length === 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                      <p className="text-gray-600 mb-3">No KPIs added yet. Select from predefined list or add custom KPI.</p>
                      <div className="flex justify-center space-x-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const selectedKPI = predefinedKPIs.find(kpi => kpi.title === e.target.value)
                              if (selectedKPI) {
                                handleAddPredefinedKPI(selectedKPI)
                              }
                              e.target.value = ''
                            }
                          }}
                          className="input text-sm"
                          defaultValue=""
                        >
                          <option value="">Select Predefined KPI</option>
                          {predefinedKPIs.map((kpi, idx) => (
                            <option key={idx} value={kpi.title}>
                              {kpi.title}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-400 self-center">or</span>
                        <button
                          type="button"
                          onClick={handleAddManualKPI}
                          className="btn btn-secondary text-sm flex items-center space-x-1"
                        >
                          <FiPlus className="w-4 h-4" />
                          <span>Add Custom KPI</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {createForm.kpis.map((kpi, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-gray-900">KPI {index + 1}</h4>
                          {createForm.kpis.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeKPI(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <FiX className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Title <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={kpi.title}
                              onChange={(e) => updateKPI(index, 'title', e.target.value)}
                              className="input text-sm"
                              placeholder="KPI Title"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Weightage (%) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              value={kpi.weightage}
                              onChange={(e) => updateKPI(index, 'weightage', e.target.value)}
                              className="input text-sm"
                              placeholder="0"
                              min="0"
                              max="100"
                              step="0.01"
                              required
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={kpi.description}
                              onChange={(e) => updateKPI(index, 'description', e.target.value)}
                              className="input text-sm"
                              rows={2}
                              placeholder="KPI Description"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Target Value
                            </label>
                            <input
                              type="number"
                              value={kpi.targetValue}
                              onChange={(e) => updateKPI(index, 'targetValue', e.target.value)}
                              className="input text-sm"
                              placeholder="0"
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Achieved Value
                            </label>
                            <input
                              type="number"
                              value={kpi.achievedValue}
                              onChange={(e) => updateKPI(index, 'achievedValue', e.target.value)}
                              className="input text-sm"
                              placeholder="0"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-600">
                    Total Weightage: {createForm.kpis.reduce((sum, kpi) => sum + (parseFloat(kpi.weightage) || 0), 0).toFixed(2)}%
                    {Math.abs(createForm.kpis.reduce((sum, kpi) => sum + (parseFloat(kpi.weightage) || 0), 0) - 100) > 0.01 && (
                      <span className="text-red-600 ml-2">(Must equal 100%)</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreateForm({
                        employeeId: '',
                        selectedEmployeeName: '',
                        reviewCycle: 'Quarterly',
                        period: '',
                        startDate: '',
                        endDate: '',
                        rating: 0,
                        kpis: [{ title: '', description: '', weightage: 0, targetValue: 0, achievedValue: 0 }]
                      })
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
                    <span>Create Review</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Performance
