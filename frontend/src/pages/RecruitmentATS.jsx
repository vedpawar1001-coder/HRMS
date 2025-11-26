import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  FiUsers,
  FiBriefcase,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiClock,
  FiSearch,
  FiFilter,
  FiEye,
  FiEdit,
  FiFileText,
  FiMail,
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiUserCheck,
  FiUserX,
  FiStar,
  FiDownload,
  FiUpload,
  FiUserPlus
} from 'react-icons/fi'
import { format } from 'date-fns'

const RecruitmentATS = () => {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [candidateNames, setCandidateNames] = useState([]) // Store unique candidate names
  const [filters, setFilters] = useState({
    status: '',
    jobId: '',
    jobPosition: '',
    candidateName: '', // Changed from search to candidateName
    screeningResult: '',
    priorityScore: '',
    inTalentPool: ''
  })
  const [appliedFilters, setAppliedFilters] = useState({
    status: '',
    jobId: '',
    jobPosition: '',
    candidateName: '', // Changed from search to candidateName
    screeningResult: '',
    priorityScore: '',
    inTalentPool: ''
  })

  // Predefined list of job positions
  const jobPositions = [
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Software Developer',
    'Software Engineer',
    'Senior Software Engineer',
    'Mobile Developer',
    'DevOps Engineer',
    'QA Engineer',
    'Test Engineer',
    'Digital Marketing',
    'Digital Marketing Executive',
    'Digital Marketing Manager',
    'IT Sales',
    'IT Sales Executive',
    'IT Sales Manager',
    'Sales Executive',
    'Sales Manager',
    'HR',
    'HR Executive',
    'HR Manager',
    'Business Analyst',
    'Product Manager',
    'Project Manager',
    'Data Analyst',
    'Data Scientist',
    'UI/UX Designer',
    'Graphic Designer',
    'Content Writer',
    'Marketing Executive',
    'Marketing Manager',
    'Finance Executive',
    'Finance Manager',
    'Operations Executive',
    'Operations Manager',
    'Customer Support Executive',
    'Network Engineer',
    'System Administrator',
    'Database Administrator',
    'Tech Lead',
    'Team Lead',
    'Engineering Manager',
    'Other'
  ]
  const [uploadForm, setUploadForm] = useState({
    jobId: '',
    jobPosition: '', // New field for job position dropdown
    fullName: '',
    email: '',
    phone: '',
    coverLetter: '',
    expectedSalary: '',
    skills: [], // Changed to array for multi-select
    experience: '',
    education: '',
    certifications: '',
    appliedJobRole: '',
    resume: null
  })

  // Predefined list of skills for multi-select dropdown
  const availableSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', '.NET',
    'React', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask',
    'Spring Boot', 'Laravel', 'PHP', 'Ruby', 'Ruby on Rails',
    'HTML', 'CSS', 'SCSS', 'SASS', 'Tailwind CSS', 'Bootstrap',
    'MongoDB', 'PostgreSQL', 'MySQL', 'SQL Server', 'Oracle', 'Redis',
    'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins',
    'Git', 'GitHub', 'GitLab', 'CI/CD', 'DevOps', 'Linux', 'Unix',
    'REST API', 'GraphQL', 'Microservices', 'Agile', 'Scrum', 'JIRA',
    'Machine Learning', 'Data Science', 'AI', 'TensorFlow', 'PyTorch',
    'React Native', 'Flutter', 'iOS Development', 'Android Development',
    'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator',
    'Project Management', 'Product Management', 'Business Analysis',
    'Sales', 'Marketing', 'Digital Marketing', 'SEO', 'SEM', 'Content Writing',
    'HR Management', 'Finance', 'Accounting', 'Operations',
    'Customer Support', 'Technical Support', 'Quality Assurance', 'Testing',
    'Selenium', 'Cypress', 'Jest', 'Mocha', 'Chai', 'Unit Testing',
    'System Administration', 'Network Administration', 'Security',
    'Cybersecurity', 'Data Analysis', 'Excel', 'Power BI', 'Tableau'
  ]
  const [parsedData, setParsedData] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Initial load
  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager') {
      fetchJobs()
      fetchStats()
      // Fetch all applications on initial load
      fetchApplications()
    }
  }, [user])

  // Fetch applications when filters are applied
  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin' || user?.role === 'manager' && appliedFilters) {
      fetchApplications()
    }
  }, [appliedFilters])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (appliedFilters.status) params.append('status', appliedFilters.status)
      if (appliedFilters.jobId) params.append('jobId', appliedFilters.jobId)
      if (appliedFilters.candidateName) params.append('search', appliedFilters.candidateName)
      if (appliedFilters.screeningResult) params.append('screeningResult', appliedFilters.screeningResult)
      if (appliedFilters.priorityScore) params.append('priorityScore', appliedFilters.priorityScore)
      if (appliedFilters.inTalentPool) params.append('inTalentPool', appliedFilters.inTalentPool)

      const { data } = await axios.get(`/api/recruitment/applications?${params.toString()}`)
      
      // Extract unique candidate names from all applications
      const uniqueNames = [...new Set(data.map(app => app.candidateInfo?.fullName).filter(Boolean))].sort()
      setCandidateNames(uniqueNames)
      
      // Filter by job position if selected
      let filteredData = data
      if (appliedFilters.jobPosition) {
        filteredData = data.filter(app => {
          const appliedJobRole = app.candidateInfo?.appliedJobRole || ''
          const jobTitle = app.jobId?.title || ''
          return appliedJobRole.toLowerCase().includes(appliedFilters.jobPosition.toLowerCase()) ||
                 jobTitle.toLowerCase().includes(appliedFilters.jobPosition.toLowerCase())
        })
      }
      
      // Filter by candidate name if selected
      if (appliedFilters.candidateName) {
        filteredData = filteredData.filter(app => 
          app.candidateInfo?.fullName?.toLowerCase().includes(appliedFilters.candidateName.toLowerCase())
        )
      }
      
      setApplications(filteredData)
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterSubmit = (e) => {
    e.preventDefault()
    setAppliedFilters({ ...filters })
    toast.success('Filters applied successfully')
  }

  const handleResetFilters = () => {
    const resetFilters = {
      status: '',
      jobId: '',
      jobPosition: '',
      search: '',
      screeningResult: '',
      priorityScore: '',
      inTalentPool: ''
    }
    setFilters(resetFilters)
    setAppliedFilters(resetFilters)
    toast.success('Filters reset')
  }

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/jobs')
      setJobs(data)
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/stats')
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleStatusChange = async (applicationId, newStatus, comments, rejectionReason, inTalentPool, currentRound) => {
    try {
      await axios.put(`/api/recruitment/applications/${applicationId}/status`, {
        status: newStatus,
        comments,
        rejectionReason,
        inTalentPool,
        currentRound
      })
      toast.success('Status updated successfully')
      fetchApplications()
      fetchStats()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const runScreening = async (applicationId) => {
    try {
      await axios.post(`/api/recruitment/applications/${applicationId}/screening`)
      toast.success('Screening completed')
      fetchApplications()
    } catch (error) {
      console.error('Error running screening:', error)
      toast.error('Failed to run screening')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }
      if (!file.type.includes('pdf') && !file.type.includes('doc') && !file.type.includes('docx')) {
        toast.error('Only PDF, DOC, and DOCX files are allowed')
        return
      }
      setUploadForm({ ...uploadForm, resume: file })
    }
  }

  const handleUploadApplication = async (e) => {
    e.preventDefault()
    setUploading(true)

    if (!uploadForm.jobPosition || !uploadForm.resume) {
      toast.error('Please select a job position and upload a resume')
      setUploading(false)
      return
    }

    try {
      // Find or create a job based on the selected position
      let jobId = uploadForm.jobId
      if (!jobId && uploadForm.jobPosition) {
        // Try to find existing job with this title
        const existingJob = jobs.find(job => job.title === uploadForm.jobPosition)
        if (existingJob) {
          jobId = existingJob._id
        } else {
          // Create a new job posting for this position
          try {
            const { data: newJob } = await axios.post('/api/recruitment/jobs', {
              title: uploadForm.jobPosition,
              department: 'General',
              description: `Position: ${uploadForm.jobPosition}`,
              status: 'Open'
            }, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            })
            jobId = newJob._id
            // Refresh jobs list
            await fetchJobs()
          } catch (jobError) {
            console.error('Error creating job:', jobError)
            toast.error('Failed to create job posting. Please try again.')
            setUploading(false)
            return
          }
        }
      }

      if (!jobId) {
        toast.error('Failed to get or create job. Please try again.')
        setUploading(false)
        return
      }

      const formData = new FormData()
      formData.append('resume', uploadForm.resume)
      formData.append('jobId', jobId)
      if (uploadForm.fullName) formData.append('fullName', uploadForm.fullName)
      if (uploadForm.email) formData.append('email', uploadForm.email)
      if (uploadForm.phone) formData.append('phone', uploadForm.phone)
      if (uploadForm.coverLetter) formData.append('coverLetter', uploadForm.coverLetter)
      if (uploadForm.expectedSalary) formData.append('expectedSalary', uploadForm.expectedSalary)
      // Handle skills as array
      if (uploadForm.skills && uploadForm.skills.length > 0) {
        if (Array.isArray(uploadForm.skills)) {
          formData.append('skills', uploadForm.skills.join(','))
        } else {
          formData.append('skills', uploadForm.skills)
        }
      }
      if (uploadForm.experience) formData.append('experience', uploadForm.experience)
      if (uploadForm.education) formData.append('education', uploadForm.education)
      if (uploadForm.certifications) formData.append('certifications', uploadForm.certifications)
      formData.append('appliedJobRole', uploadForm.jobPosition || uploadForm.appliedJobRole || '')

      console.log('Submitting application with jobId:', jobId)
      console.log('Form data keys:', Array.from(formData.keys()))
      
      const { data } = await axios.post('/api/recruitment/applications/hr-upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000 // 30 second timeout
      })
      
      console.log('Application submitted successfully:', data)

      if (data.parsedData) {
        setParsedData(data.parsedData)
        // Auto-fill form with parsed data if fields are empty
        if (!uploadForm.fullName && data.parsedData.fullName) {
          setUploadForm({ ...uploadForm, fullName: data.parsedData.fullName })
        }
        if (!uploadForm.email && data.parsedData.email) {
          setUploadForm({ ...uploadForm, email: data.parsedData.email })
        }
        if (!uploadForm.phone && data.parsedData.phone) {
          setUploadForm({ ...uploadForm, phone: data.parsedData.phone })
        }
        if (!uploadForm.skills || uploadForm.skills.length === 0) {
          if (data.parsedData.skills && data.parsedData.skills.length > 0) {
            setUploadForm({ ...uploadForm, skills: data.parsedData.skills })
          }
        }
        if (!uploadForm.experience && data.parsedData.experience) {
          setUploadForm({ ...uploadForm, experience: data.parsedData.experience })
        }
        if (!uploadForm.education && data.parsedData.education) {
          setUploadForm({ ...uploadForm, education: data.parsedData.education })
        }
        if (!uploadForm.certifications && data.parsedData.certifications && data.parsedData.certifications.length > 0) {
          setUploadForm({ ...uploadForm, certifications: data.parsedData.certifications.join(', ') })
        }
      }

      toast.success('Application submitted successfully! It is now visible in HR, Manager, and Admin panels.')
      setShowUploadModal(false)
      setUploadForm({
        jobId: '',
        jobPosition: '',
        fullName: '',
        email: '',
        phone: '',
        coverLetter: '',
        expectedSalary: '',
        skills: [],
        experience: '',
        education: '',
        certifications: '',
        appliedJobRole: '',
        resume: null
      })
      setParsedData(null)
      // Refresh applications list to show the new submission immediately
      await fetchApplications()
      await fetchStats()
    } catch (error) {
      console.error('Error uploading application:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      })
      
      if (!error.response) {
        // Network error - server might not be running
        toast.error('Cannot connect to server. Please make sure the backend server is running on port 5000 and restart it if needed.')
      } else if (error.response?.status === 404) {
        toast.error('Route not found. Please restart the backend server to apply route changes.')
      } else if (error.response?.data?.isDuplicate) {
        toast.error(error.response.data.message || 'Duplicate application detected')
      } else if (error.response?.data?.parsedData) {
        setParsedData(error.response.data.parsedData)
        toast.error(error.response.data.message || 'Please fill in the missing required fields')
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message)
      } else {
        toast.error(error.message || 'Failed to upload application. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  const convertToEmployee = async (applicationId) => {
    if (!window.confirm('Are you sure you want to convert this candidate to an employee? This will create an employee profile with a unique employee ID.')) {
      return
    }

    try {
      const { data } = await axios.post(`/api/recruitment/applications/${applicationId}/convert-to-employee`)
      toast.success(`Candidate converted to employee! Employee ID: ${data.employee.employeeId}`)
      fetchApplications()
      if (showDetails) {
        setShowDetails(false)
        setSelectedApplication(null)
      }
    } catch (error) {
      console.error('Error converting to employee:', error)
      toast.error(error.response?.data?.message || 'Failed to convert candidate to employee')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'Application': 'bg-gray-100 text-gray-800',
      'Shortlisted': 'bg-blue-100 text-blue-800',
      'Interview': 'bg-yellow-100 text-yellow-800',
      'Selected': 'bg-green-100 text-green-800',
      'Offer': 'bg-purple-100 text-purple-800',
      'Onboarding': 'bg-indigo-100 text-indigo-800',
      'Rejected': 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getScreeningColor = (result) => {
    const colors = {
      'Fit': 'bg-green-100 text-green-800',
      'Partially Fit': 'bg-yellow-100 text-yellow-800',
      'Not Fit': 'bg-red-100 text-red-800',
      'Needs Manual Review': 'bg-blue-100 text-blue-800'
    }
    return colors[result] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      'High': 'bg-red-100 text-red-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-gray-100 text-gray-800'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Application Tracking System</h1>
          <p className="mt-2 text-gray-600">Manage candidates and recruitment pipeline</p>
        </div>
        {(user?.role === 'hr' || user?.role === 'admin') && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 md:mt-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
          >
            <FiUpload className="mr-2" size={18} />
            Upload Resume
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalApplications || 0}</p>
              </div>
              <FiUsers className="text-primary-600" size={32} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Jobs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.jobsByStatus?.find(s => s._id === 'Open')?.count || 0}
                </p>
              </div>
              <FiBriefcase className="text-green-600" size={32} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Interview</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.applicationsByStatus?.find(s => s._id === 'Interview')?.count || 0}
                </p>
              </div>
              <FiCalendar className="text-yellow-600" size={32} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Selected</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.applicationsByStatus?.find(s => s._id === 'Selected')?.count || 0}
                </p>
              </div>
              <FiCheckCircle className="text-green-600" size={32} />
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleFilterSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name of Candidate</label>
              <select
                value={filters.candidateName}
                onChange={(e) => setFilters({ ...filters, candidateName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Candidates</option>
                {candidateNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {candidateNames.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">No candidates found. Upload applications to see names here.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">All Jobs</label>
              <select
                value={filters.jobPosition}
                onChange={(e) => setFilters({ ...filters, jobPosition: e.target.value, jobId: '' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Positions</option>
                {jobPositions.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="Application">Application</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interview">Interview</option>
                <option value="Selected">Selected</option>
                <option value="Offer">Offer</option>
                <option value="Onboarding">Onboarding</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Screening</label>
              <select
                value={filters.screeningResult}
                onChange={(e) => setFilters({ ...filters, screeningResult: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Screening</option>
                <option value="Fit">Fit</option>
                <option value="Partially Fit">Partially Fit</option>
                <option value="Not Fit">Not Fit</option>
                <option value="Needs Manual Review">Needs Manual Review</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priorityScore}
                onChange={(e) => setFilters({ ...filters, priorityScore: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          
          {/* Submit and Reset Buttons */}
          <div className="flex justify-end space-x-3 pt-4 mt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors flex items-center"
            >
              <FiXCircle className="mr-2" size={18} />
              Reset
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center min-w-[120px] justify-center"
            >
              <FiCheckCircle className="mr-2" size={18} />
              Submit
            </button>
          </div>
        </form>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Round
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Screening
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    No applications found
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{app.candidateInfo.fullName}</div>
                        <div className="text-sm text-gray-500">{app.candidateInfo.email}</div>
                        <div className="text-sm text-gray-500">{app.candidateInfo.phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{app.jobId?.title || app.candidateInfo.appliedJobRole}</div>
                      <div className="text-sm text-gray-500">{app.jobId?.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {app.currentRound && app.currentRound !== 'None' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {app.currentRound}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not Set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {app.screening?.result ? (
                        <div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScreeningColor(app.screening.result)}`}>
                            {app.screening.result}
                          </span>
                          {app.screening.overallMatchPercentage && (
                            <div className="text-xs text-gray-500 mt-1">
                              {app.screening.overallMatchPercentage.toFixed(0)}% match
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          <span className="italic">Auto-calculating...</span>
                          <button
                            onClick={() => runScreening(app._id)}
                            className="ml-2 text-primary-600 hover:text-primary-700 underline"
                          >
                            Re-calculate
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {app.screening?.priorityScore && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(app.screening.priorityScore)}`}>
                          {app.screening.priorityScore}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(app.candidateInfo.appliedDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedApplication(app)
                          setShowDetails(true)
                        }}
                        className="text-primary-600 hover:text-primary-700 mr-3"
                      >
                        <FiEye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Application Details Modal */}
      {showDetails && selectedApplication && (
        <ApplicationDetailsModal
          application={selectedApplication}
          onClose={() => {
            setShowDetails(false)
            setSelectedApplication(null)
          }}
          onStatusChange={handleStatusChange}
          onRefresh={fetchApplications}
          onConvertToEmployee={convertToEmployee}
        />
      )}

      {/* HR Upload Modal */}
      {showUploadModal && (
        <HRUploadModal
          jobs={jobs}
          jobPositions={jobPositions}
          availableSkills={availableSkills}
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          parsedData={parsedData}
          onFileChange={handleFileChange}
          onSubmit={handleUploadApplication}
          onClose={() => {
            setShowUploadModal(false)
            setUploadForm({
              jobId: '',
              jobPosition: '',
              fullName: '',
              email: '',
              phone: '',
              coverLetter: '',
              expectedSalary: '',
              skills: [],
              experience: '',
              education: '',
              certifications: '',
              appliedJobRole: '',
              resume: null
            })
            setParsedData(null)
          }}
          uploading={uploading}
        />
      )}
    </div>
  )
}

// Application Details Modal Component
const ApplicationDetailsModal = ({ application, onClose, onStatusChange, onRefresh, onConvertToEmployee }) => {
  const { user } = useAuth()
  const [statusForm, setStatusForm] = useState({
    status: application.status,
    currentRound: application.currentRound || 'None',
    comments: '',
    rejectionReason: '',
    inTalentPool: application.inTalentPool || false
  })

  const handleCurrentRoundChange = async (newRound) => {
    try {
      await axios.put(`/api/recruitment/applications/${application._id}/current-round`, {
        currentRound: newRound
      })
      toast.success('Current round updated')
      onRefresh()
      setStatusForm({ ...statusForm, currentRound: newRound })
    } catch (error) {
      console.error('Error updating current round:', error)
      toast.error('Failed to update current round')
    }
  }

  const handleSubmit = () => {
    onStatusChange(
      application._id,
      statusForm.status,
      statusForm.comments,
      statusForm.rejectionReason,
      statusForm.inTalentPool,
      statusForm.currentRound
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Application Details</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <FiXCircle size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Candidate Info */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Candidate Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="text-sm font-medium text-gray-900">{application.candidateInfo.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-sm font-medium text-gray-900">{application.candidateInfo.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{application.candidateInfo.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Applied Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(application.candidateInfo.appliedDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Skills & Experience */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Skills & Experience</h4>
                <div className="space-y-2">
                  {application.candidateInfo.skills && application.candidateInfo.skills.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600">Skills</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {application.candidateInfo.skills.map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {application.candidateInfo.experience && (
                    <div>
                      <p className="text-sm text-gray-600">Experience</p>
                      <p className="text-sm font-medium text-gray-900">{application.candidateInfo.experience} years</p>
                    </div>
                  )}
                  {application.candidateInfo.education && (
                    <div>
                      <p className="text-sm text-gray-600">Education</p>
                      <p className="text-sm font-medium text-gray-900">{application.candidateInfo.education}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Screening Results */}
              {application.screening && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Screening Results</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Result</p>
                      <p className="text-sm font-medium text-gray-900">{application.screening.result}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Match Percentage</p>
                      <p className="text-sm font-medium text-gray-900">
                        {application.screening.overallMatchPercentage?.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Priority Score</p>
                      <p className="text-sm font-medium text-gray-900">{application.screening.priorityScore}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Round */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Current Round</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Current Round</label>
                  <select
                    value={statusForm.currentRound}
                    onChange={(e) => {
                      const newRound = e.target.value
                      setStatusForm({ ...statusForm, currentRound: newRound })
                      handleCurrentRoundChange(newRound)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="None">None</option>
                    <option value="Aptitude Test">Aptitude Test</option>
                    <option value="Technical Round">Technical Round</option>
                    <option value="Interview Round">Interview Round</option>
                    <option value="HR Round">HR Round</option>
                  </select>
                </div>
              </div>

              {/* Interview Rounds */}
              {application.interviewRounds && application.interviewRounds.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Interview Rounds</h4>
                  <div className="space-y-3">
                    {application.interviewRounds.map((round, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{round.roundType}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            round.status === 'Passed' ? 'bg-green-100 text-green-800' :
                            round.status === 'Failed' ? 'bg-red-100 text-red-800' :
                            round.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                            round.status === 'No Show' ? 'bg-orange-100 text-orange-800' :
                            round.status === 'Rescheduled' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {round.status}
                          </span>
                        </div>
                        {round.scheduledDate && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Date:</span> {format(new Date(round.scheduledDate), 'MMM dd, yyyy')} at {round.scheduledTime}
                          </div>
                        )}
                        {round.evaluator && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Evaluator:</span> {round.evaluator.email || round.evaluator}
                          </div>
                        )}
                        {round.feedback && (
                          <p className="text-sm text-gray-600 mt-2"><span className="font-medium">Feedback:</span> {round.feedback}</p>
                        )}
                        {round.rating && (
                          <div className="flex items-center mt-2">
                            <FiStar className="text-yellow-400" size={16} />
                            <span className="text-sm text-gray-600 ml-1">Rating: {round.rating}/5</span>
                          </div>
                        )}
                        {round.mode && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Mode:</span> {round.mode}
                          </div>
                        )}
                        {round.meetingLink && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Meeting Link:</span> <a href={round.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{round.meetingLink}</a>
                          </div>
                        )}
                        {round.venue && (
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Venue:</span> {round.venue}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Update Form */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Update Status</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={statusForm.status}
                      onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="Application">Application</option>
                      <option value="Shortlisted">Shortlisted</option>
                      <option value="Interview">Interview</option>
                      <option value="Selected">Selected</option>
                      <option value="Offer">Offer</option>
                      <option value="Onboarding">Onboarding</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                    <textarea
                      rows={3}
                      value={statusForm.comments}
                      onChange={(e) => setStatusForm({ ...statusForm, comments: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  {statusForm.status === 'Rejected' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
                      <textarea
                        rows={2}
                        value={statusForm.rejectionReason}
                        onChange={(e) => setStatusForm({ ...statusForm, rejectionReason: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="talentPool"
                      checked={statusForm.inTalentPool}
                      onChange={(e) => setStatusForm({ ...statusForm, inTalentPool: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="talentPool" className="ml-2 text-sm text-gray-700">
                      Add to Talent Pool
                    </label>
                  </div>

                  <div className="flex justify-between items-center">
                    {(application.status === 'Selected' || application.status === 'Onboarding') && onConvertToEmployee && (
                      <button
                        onClick={() => onConvertToEmployee(application._id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                      >
                        <FiUserPlus className="mr-2" size={18} />
                        Convert to Employee
                      </button>
                    )}
                    <div className="flex justify-end space-x-3 ml-auto">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// HR Upload Modal Component
const HRUploadModal = ({ jobs, jobPositions, availableSkills, uploadForm, setUploadForm, parsedData, onFileChange, onSubmit, onClose, uploading }) => {
  // Check if all required fields are filled
  const isFormValid = () => {
    return (
      uploadForm.jobPosition &&
      uploadForm.resume &&
      uploadForm.fullName &&
      uploadForm.fullName.trim() !== '' &&
      uploadForm.email &&
      uploadForm.email.trim() !== '' &&
      uploadForm.phone &&
      uploadForm.phone.trim() !== ''
    )
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!isFormValid()) {
      toast.error('Please fill all required fields')
      return
    }
    onSubmit(e)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Upload Resume</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <FiXCircle size={24} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Screening and Priority will be automatically calculated by comparing the candidate's resume with the job description when you upload the resume.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Position <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={uploadForm.jobPosition}
                  onChange={(e) => setUploadForm({ ...uploadForm, jobPosition: e.target.value, appliedJobRole: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    !uploadForm.jobPosition ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select Position</option>
                  {jobPositions.map(position => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resume (PDF/DOCX) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={onFileChange}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    !uploadForm.resume ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {parsedData && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <p className="font-medium">Parsed from resume:</p>
                    <ul className="list-disc list-inside mt-1">
                      {parsedData.fullName && <li>Name: {parsedData.fullName}</li>}
                      {parsedData.email && <li>Email: {parsedData.email}</li>}
                      {parsedData.phone && <li>Phone: {parsedData.phone}</li>}
                      {parsedData.skills && parsedData.skills.length > 0 && <li>Skills: {parsedData.skills.join(', ')}</li>}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadForm.fullName}
                  onChange={(e) => setUploadForm({ ...uploadForm, fullName: e.target.value })}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    !uploadForm.fullName || uploadForm.fullName.trim() === '' ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter candidate's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={uploadForm.email}
                  onChange={(e) => setUploadForm({ ...uploadForm, email: e.target.value })}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    !uploadForm.email || uploadForm.email.trim() === '' ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="candidate@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={uploadForm.phone}
                  onChange={(e) => setUploadForm({ ...uploadForm, phone: e.target.value })}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    !uploadForm.phone || uploadForm.phone.trim() === '' ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter phone number"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (Select Multiple)</label>
                <select
                  multiple
                  value={uploadForm.skills}
                  onChange={(e) => {
                    const selectedSkills = Array.from(e.target.selectedOptions, option => option.value)
                    setUploadForm({ ...uploadForm, skills: selectedSkills })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[120px]"
                  size="5"
                >
                  {availableSkills.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple skills. Selected: {uploadForm.skills.length}
                </p>
                {uploadForm.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploadForm.skills.map(skill => (
                      <span
                        key={skill}
                        className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => {
                            setUploadForm({
                              ...uploadForm,
                              skills: uploadForm.skills.filter(s => s !== skill)
                            })
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <FiX size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                <input
                  type="text"
                  value={uploadForm.experience}
                  onChange={(e) => setUploadForm({ ...uploadForm, experience: e.target.value })}
                  placeholder="e.g., 3 years"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                <input
                  type="text"
                  value={uploadForm.education}
                  onChange={(e) => setUploadForm({ ...uploadForm, education: e.target.value })}
                  placeholder="e.g., B.Tech Computer Science"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Salary</label>
                <input
                  type="number"
                  value={uploadForm.expectedSalary}
                  onChange={(e) => setUploadForm({ ...uploadForm, expectedSalary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter</label>
                <textarea
                  rows={4}
                  value={uploadForm.coverLetter}
                  onChange={(e) => setUploadForm({ ...uploadForm, coverLetter: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Form Validation Status */}
              {!isFormValid() && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Please complete all required fields (*) to enable Submit button:</strong>
                  </p>
                  <ul className="mt-2 text-xs text-yellow-700 list-disc list-inside space-y-1">
                    {!uploadForm.jobPosition && <li>Select a Job Position</li>}
                    {!uploadForm.resume && <li>Upload Resume file</li>}
                    {(!uploadForm.fullName || uploadForm.fullName.trim() === '') && <li>Enter Full Name</li>}
                    {(!uploadForm.email || uploadForm.email.trim() === '') && <li>Enter Email</li>}
                    {(!uploadForm.phone || uploadForm.phone.trim() === '') && <li>Enter Phone</li>}
                  </ul>
                </div>
              )}

              {/* Submit Button Section - Always Visible at Bottom */}
              <div className="bg-white pt-6 mt-6 border-t-2 border-gray-200 -mx-6 -mb-4 px-6 pb-4 sm:-mx-6 sm:px-6">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={uploading}
                    className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isFormValid() || uploading}
                    className={`px-8 py-2.5 rounded-lg font-semibold text-base transition-all duration-200 min-w-[120px] ${
                      isFormValid() && !uploading
                        ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer shadow-md hover:shadow-lg active:scale-95'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={!isFormValid() ? 'Please fill all required fields (*) to enable Submit' : 'Submit application to save and make it visible to HR and Manager'}
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <FiCheckCircle className="mr-2" size={18} />
                        Submit
                      </span>
                    )}
                  </button>
                </div>
                {isFormValid() && !uploading && (
                  <p className="text-xs text-gray-500 text-right mt-3 pr-2 italic">
                    ✓ Application will be visible to HR and Manager after submission
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecruitmentATS

