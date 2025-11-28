import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  FiBriefcase,
  FiMapPin,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiUpload,
  FiCheckCircle,
  FiX,
  FiSearch,
  FiFilter,
  FiSend
} from 'react-icons/fi'

const Recruitment = () => {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [applicationForm, setApplicationForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    coverLetter: '',
    expectedSalary: '',
    skills: '',
    experience: '',
    education: '',
    certifications: '',
    resume: null
  })

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchTerm, filterDepartment])

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/jobs')
      setJobs(data)
      setFilteredJobs(data)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      toast.error('Failed to load job listings')
    } finally {
      setLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = [...jobs]
    
    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.department.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (filterDepartment) {
      filtered = filtered.filter(job => job.department === filterDepartment)
    }
    
    setFilteredJobs(filtered)
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
      setApplicationForm({ ...applicationForm, resume: file })
    }
  }

  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    
    if (!applicationForm.resume) {
      toast.error('Please upload your resume')
      return
    }

    try {
      const formData = new FormData()
      formData.append('resume', applicationForm.resume)
      formData.append('fullName', applicationForm.fullName)
      formData.append('email', applicationForm.email)
      formData.append('phone', applicationForm.phone)
      formData.append('coverLetter', applicationForm.coverLetter)
      formData.append('expectedSalary', applicationForm.expectedSalary)
      formData.append('skills', applicationForm.skills)
      formData.append('experience', applicationForm.experience)
      formData.append('education', applicationForm.education)
      formData.append('certifications', applicationForm.certifications)
      formData.append('jobId', selectedJob._id)

      await axios.post('/api/recruitment/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success('Application submitted successfully!')
      setShowApplicationForm(false)
      setSelectedJob(null)
      setApplicationForm({
        fullName: '',
        email: '',
        phone: '',
        coverLetter: '',
        expectedSalary: '',
        skills: '',
        experience: '',
        education: '',
        certifications: '',
        resume: null
      })
    } catch (error) {
      console.error('Error submitting application:', error)
      if (error.response?.data?.isDuplicate) {
        toast.error('You have already applied for this position')
      } else {
        toast.error(error.response?.data?.message || 'Failed to submit application')
      }
    }
  }

  const openApplicationForm = (job) => {
    setSelectedJob(job)
    setApplicationForm({
      ...applicationForm,
      email: user?.email || '',
      fullName: user?.email?.split('@')[0] || ''
    })
    setShowApplicationForm(true)
  }

  const departments = [...new Set(jobs.map(job => job.department))]

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
          <h1 className="text-3xl font-bold text-gray-900">Career Opportunities</h1>
          <p className="mt-2 text-gray-600">Find your next career opportunity with us</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search jobs by title, description, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FiBriefcase className="mx-auto text-gray-400" size={48} />
            <p className="mt-4 text-gray-600">No job openings found</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <motion.div
              key={job._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{job.title}</h3>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <FiMapPin className="mr-1" size={16} />
                    <span>{job.department}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  job.status === 'Open' ? 'bg-green-100 text-green-800' :
                  job.status === 'Closed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {job.status}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{job.description}</p>

              {job.requirements && (
                <div className="mb-4">
                  {job.requirements.skills && job.requirements.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {job.requirements.skills.slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {job.requirements.skills.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{job.requirements.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  {job.requirements.minExperience && (
                    <div className="flex items-center text-sm text-gray-600">
                      <FiClock className="mr-1" size={14} />
                      <span>{job.requirements.minExperience} years experience</span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => openApplicationForm(job)}
                disabled={job.status !== 'Open'}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  job.status === 'Open'
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {job.status === 'Open' ? 'Apply Now' : 'Closed'}
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowApplicationForm(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Apply for {selectedJob?.title}</h3>
                  <button
                    onClick={() => setShowApplicationForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmitApplication} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={applicationForm.fullName}
                        onChange={(e) => setApplicationForm({ ...applicationForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={applicationForm.email}
                        onChange={(e) => setApplicationForm({ ...applicationForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={applicationForm.phone}
                        onChange={(e) => setApplicationForm({ ...applicationForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Salary
                      </label>
                      <input
                        type="number"
                        value={applicationForm.expectedSalary}
                        onChange={(e) => setApplicationForm({ ...applicationForm, expectedSalary: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={applicationForm.skills}
                      onChange={(e) => setApplicationForm({ ...applicationForm, skills: e.target.value })}
                      placeholder="e.g., JavaScript, React, Node.js"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Experience (years)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={applicationForm.experience}
                        onChange={(e) => setApplicationForm({ ...applicationForm, experience: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Education
                      </label>
                      <input
                        type="text"
                        value={applicationForm.education}
                        onChange={(e) => setApplicationForm({ ...applicationForm, education: e.target.value })}
                        placeholder="e.g., B.Tech Computer Science"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Certifications (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={applicationForm.certifications}
                      onChange={(e) => setApplicationForm({ ...applicationForm, certifications: e.target.value })}
                      placeholder="e.g., AWS Certified, PMP"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cover Letter
                    </label>
                    <textarea
                      rows={4}
                      value={applicationForm.coverLetter}
                      onChange={(e) => setApplicationForm({ ...applicationForm, coverLetter: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resume (PDF, DOC, DOCX) *
                    </label>
                    <div className="mt-1 flex items-center">
                      <label className="flex items-center px-4 py-2 bg-primary-50 text-primary-700 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors">
                        <FiUpload className="mr-2" size={20} />
                        {applicationForm.resume ? applicationForm.resume.name : 'Choose File'}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      {applicationForm.resume && (
                        <span className="ml-3 text-sm text-gray-600">{applicationForm.resume.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowApplicationForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
                    >
                      <FiSend className="mr-2" size={18} />
                      Submit Application
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Recruitment








