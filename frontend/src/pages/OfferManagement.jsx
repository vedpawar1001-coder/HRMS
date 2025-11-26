import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  FiFileText,
  FiUpload,
  FiSend,
  FiEye,
  FiCheckCircle,
  FiXCircle,
  FiDownload,
  FiPlus,
  FiSearch,
  FiCalendar,
  FiFilter,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiMail,
  FiAlertCircle,
  FiRefreshCw,
  FiCopy,
  FiEdit,
  FiBarChart2,
  FiTrash2
} from 'react-icons/fi'
import { format } from 'date-fns'

const OfferManagement = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [applications, setApplications] = useState([])
  const [allApplications, setAllApplications] = useState([]) // Store all applications for filtering
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    expiryDate: ''
  })
  const [stats, setStats] = useState({
    totalOffers: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    sent: 0,
    expiring: 0,
    acceptanceRate: 0
  })
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    template: null
  })
  const [offerForm, setOfferForm] = useState({
    templateId: '',
    candidateName: '',
    jobTitle: '',
    salary: '',
    joiningDate: '',
    reportingManager: '',
    department: '',
    workType: 'WFO',
    workLocation: '',
    probationPeriod: '',
    noticePeriod: '',
    additionalTerms: '',
    expiryDate: ''
  })

  useEffect(() => {
    if (user?.role === 'hr' || user?.role === 'admin') {
      fetchTemplates()
      fetchApplications()
      fetchManagers()
    }
  }, [user])

  const fetchTemplates = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/offer-templates')
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchApplications = async () => {
    try {
      const { data } = await axios.get('/api/recruitment/applications')
      setAllApplications(data)
      // Filter to show selected candidates and those with offers
      const filtered = data.filter(app => 
        app.status === 'Selected' || app.status === 'Offer' || app.offerLetter
      )
      setApplications(filtered)
      calculateStats(filtered)
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (apps) => {
    const offers = apps.filter(app => app.offerLetter)
    const totalOffers = offers.length
    const pending = offers.filter(o => o.offerLetter.status === 'Pending').length
    const sent = offers.filter(o => o.offerLetter.status === 'Sent').length
    const accepted = offers.filter(o => o.offerLetter.status === 'Accepted').length
    const rejected = offers.filter(o => o.offerLetter.status === 'Rejected').length
    
    // Count expiring offers (within 3 days)
    const today = new Date()
    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    const expiring = offers.filter(o => {
      if (!o.offerLetter.expiryDate) return false
      const expiry = new Date(o.offerLetter.expiryDate)
      return expiry >= today && expiry <= threeDaysLater && o.offerLetter.status !== 'Accepted' && o.offerLetter.status !== 'Rejected'
    }).length

    const responded = accepted + rejected
    const acceptanceRate = responded > 0 ? ((accepted / responded) * 100).toFixed(1) : 0

    setStats({
      totalOffers,
      pending,
      accepted,
      rejected,
      sent,
      expiring,
      acceptanceRate: parseFloat(acceptanceRate)
    })
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  const applyFilters = (filterValues) => {
    let filtered = [...allApplications]
    
    // Filter by status
    if (filterValues.status) {
      filtered = filtered.filter(app => {
        if (filterValues.status === 'with-offer') {
          return app.offerLetter
        } else if (filterValues.status === 'without-offer') {
          return !app.offerLetter && app.status === 'Selected'
        } else if (app.offerLetter) {
          return app.offerLetter.status === filterValues.status
        }
        return false
      })
    } else {
      filtered = filtered.filter(app => 
        app.status === 'Selected' || app.status === 'Offer' || app.offerLetter
      )
    }

    // Filter by search
    if (filterValues.search) {
      const searchLower = filterValues.search.toLowerCase()
      filtered = filtered.filter(app =>
        app.candidateInfo.fullName?.toLowerCase().includes(searchLower) ||
        app.candidateInfo.email?.toLowerCase().includes(searchLower) ||
        app.jobId?.title?.toLowerCase().includes(searchLower) ||
        app.candidateInfo.appliedJobRole?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by expiring offers
    if (filterValues.expiryDate === 'expiring') {
      const today = new Date()
      const threeDaysLater = new Date(today)
      threeDaysLater.setDate(threeDaysLater.getDate() + 3)
      filtered = filtered.filter(app => {
        if (!app.offerLetter?.expiryDate) return false
        const expiry = new Date(app.offerLetter.expiryDate)
        return expiry >= today && expiry <= threeDaysLater && 
               app.offerLetter.status !== 'Accepted' && 
               app.offerLetter.status !== 'Rejected'
      })
    }

    setApplications(filtered)
    calculateStats(filtered)
  }

  const handleBulkSendReminders = async () => {
    const pendingOffers = applications.filter(app => 
      app.offerLetter && 
      (app.offerLetter.status === 'Sent' || app.offerLetter.status === 'Pending')
    )

    if (pendingOffers.length === 0) {
      toast.error('No pending offers to send reminders')
      return
    }

    try {
      let successCount = 0
      for (const app of pendingOffers) {
        try {
          await axios.post(`/api/recruitment/applications/${app._id}/send-offer-reminder`)
          successCount++
        } catch (error) {
          console.error(`Error sending reminder to ${app.candidateInfo.email}:`, error)
        }
      }
      toast.success(`Reminders sent to ${successCount} candidates`)
      fetchApplications()
    } catch (error) {
      console.error('Error sending bulk reminders:', error)
      toast.error('Failed to send some reminders')
    }
  }

  const handleDuplicateOffer = (application) => {
    if (!application.offerLetter) {
      toast.error('No offer letter to duplicate')
      return
    }
    const offer = application.offerLetter
    setSelectedApplication(application)
    setOfferForm({
      templateId: offer.templateId || '',
      candidateName: offer.candidateName,
      jobTitle: offer.jobTitle,
      salary: offer.salary,
      joiningDate: offer.joiningDate ? format(new Date(offer.joiningDate), 'yyyy-MM-dd') : '',
      reportingManager: offer.reportingManager || '',
      department: offer.department,
      workType: offer.workType || 'WFO',
      workLocation: offer.workLocation || '',
      probationPeriod: offer.probationPeriod || '3 months',
      noticePeriod: offer.noticePeriod || '30 days',
      additionalTerms: offer.additionalTerms || '',
      expiryDate: offer.expiryDate ? format(new Date(offer.expiryDate), 'yyyy-MM-dd') : ''
    })
    setShowOfferForm(true)
  }

  const fetchManagers = async () => {
    try {
      const { data } = await axios.get('/api/employees/managers')
      setManagers(data)
    } catch (error) {
      console.error('Error fetching managers:', error)
    }
  }

  const handleUploadTemplate = async (e) => {
    e.preventDefault()
    if (!templateForm.template) {
      toast.error('Please select a template file')
      return
    }

    try {
      const formData = new FormData()
      formData.append('template', templateForm.template)
      formData.append('name', templateForm.name)
      formData.append('description', templateForm.description)
      formData.append('placeholders', JSON.stringify([]))

      await axios.post('/api/recruitment/offer-templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success('Template uploaded successfully')
      setShowTemplateForm(false)
      setTemplateForm({ name: '', description: '', template: null })
      fetchTemplates()
    } catch (error) {
      console.error('Error uploading template:', error)
      toast.error('Failed to upload template')
    }
  }

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!window.confirm(`Are you sure you want to delete the template "${templateName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await axios.delete(`/api/recruitment/offer-templates/${templateId}`)
      toast.success('Template deleted successfully')
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error(error.response?.data?.message || 'Failed to delete template')
    }
  }

  const handleGenerateOffer = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post(
        `/api/recruitment/applications/${selectedApplication._id}/generate-offer`,
        offerForm
      )
      toast.success('Offer letter generated successfully')
      setShowOfferForm(false)
      fetchApplications()
    } catch (error) {
      console.error('Error generating offer:', error)
      toast.error('Failed to generate offer letter')
    }
  }

  const handleSendOffer = async (applicationId) => {
    try {
      const { data } = await axios.post(`/api/recruitment/applications/${applicationId}/send-offer`)
      toast.success(
        `Offer letter sent successfully to ${data.candidateEmail || 'candidate'}`,
        { duration: 5000 }
      )
      fetchApplications()
    } catch (error) {
      console.error('Error sending offer:', error)
      const errorMessage = error.response?.data?.message || 'Failed to send offer letter'
      const errorDetails = error.response?.data?.error || error.response?.data?.details
      const candidateEmail = error.response?.data?.candidateEmail
      
      if (error.response?.status === 500 && errorDetails) {
        toast.error(
          <div>
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-sm mt-1">{errorDetails}</p>
            {candidateEmail && <p className="text-xs mt-1">Candidate: {candidateEmail}</p>}
          </div>,
          { duration: 8000 }
        )
      } else {
        toast.error(errorMessage, { duration: 5000 })
      }
    }
  }

  const openOfferForm = (application) => {
    setSelectedApplication(application)
    setOfferForm({
      templateId: '',
      candidateName: application.candidateInfo.fullName,
      jobTitle: application.jobId?.title || application.candidateInfo.appliedJobRole,
      salary: application.candidateInfo.expectedSalary || '',
      joiningDate: '',
      reportingManager: '',
      department: application.jobId?.department || '',
      workType: 'WFO',
      workLocation: '',
      probationPeriod: '3 months',
      noticePeriod: '30 days',
      additionalTerms: '',
      expiryDate: ''
    })
    setShowOfferForm(true)
  }

  const handleExportOffers = () => {
    const offersData = applications
      .filter(app => app.offerLetter)
      .map(app => ({
        'Candidate Name': app.candidateInfo.fullName,
        'Email': app.candidateInfo.email,
        'Phone': app.candidateInfo.phone,
        'Position': app.jobId?.title || app.candidateInfo.appliedJobRole,
        'Department': app.jobId?.department || 'N/A',
        'Salary (CTC)': app.offerLetter.salary || 'N/A',
        'Joining Date': app.offerLetter.joiningDate ? format(new Date(app.offerLetter.joiningDate), 'MMM dd, yyyy') : 'N/A',
        'Status': app.offerLetter.status,
        'Expiry Date': app.offerLetter.expiryDate ? format(new Date(app.offerLetter.expiryDate), 'MMM dd, yyyy') : 'N/A',
        'Sent Date': app.offerLetter.sentAt ? format(new Date(app.offerLetter.sentAt), 'MMM dd, yyyy') : 'N/A'
      }))

    if (offersData.length === 0) {
      toast.error('No offers to export')
      return
    }

    // Convert to CSV
    const headers = Object.keys(offersData[0] || {})
    const csvContent = [
      headers.join(','),
      ...offersData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `offer-letters-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Offer data exported successfully')
  }

  const applicationsWithOffers = applications.filter(app => app.offerLetter)

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
          <h1 className="text-3xl font-bold text-gray-900">Offer Letter Management</h1>
          <p className="mt-2 text-gray-600">Generate, track, and manage offer letters efficiently</p>
        </div>
        <div className="flex space-x-3">
          {applicationsWithOffers.length > 0 && (
            <button
              onClick={handleExportOffers}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              title="Export offer data to CSV"
            >
              <FiDownload className="mr-2" size={20} />
              Export
            </button>
          )}
          <button
            onClick={handleBulkSendReminders}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center"
            title="Send reminders to all pending offers"
          >
            <FiMail className="mr-2" size={20} />
            Send Reminders
          </button>
          <button
            onClick={() => setShowTemplateForm(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <FiUpload className="mr-2" size={20} />
            Upload Template
          </button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Offers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOffers}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiFileText className="text-blue-600" size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.accepted}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.acceptanceRate}% acceptance rate</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FiCheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending + stats.sent}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting response</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FiClock className="text-yellow-600" size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.expiring}</p>
              <p className="text-xs text-gray-500 mt-1">Within 3 days</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FiAlertCircle className="text-red-600" size={24} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by candidate name, email, or position..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Offers</option>
              <option value="with-offer">With Offer</option>
              <option value="without-offer">Without Offer</option>
              <option value="Pending">Pending</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Quick Filter</label>
            <select
              value={filters.expiryDate}
              onChange={(e) => handleFilterChange('expiryDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              <option value="expiring">Expiring Soon</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ status: '', search: '', expiryDate: '' })
                applyFilters({ status: '', search: '', expiryDate: '' })
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <FiRefreshCw className="mr-2" size={18} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Templates Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Offer Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
              <FiFileText className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-600">No templates found</p>
            </div>
          ) : (
            templates.map(template => (
              <div key={template._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded mt-1 inline-block">
                      {template.fileType}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTemplate(template._id, template.name)}
                    className="ml-2 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
                {template.description && (
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Created: {format(new Date(template.createdAt), 'MMM dd, yyyy')}
                  </div>
                  {template.templateFile && (
                    <a
                      href={`http://localhost:5000${template.templateFile}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      View Template
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Applications Ready for Offer */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Offer Management ({applications.length})</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <FiBarChart2 size={18} />
            <span>Showing {applications.length} of {allApplications.length} candidates</span>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offer Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No candidates found
                    </td>
                  </tr>
                ) : (
                  applications.map(app => {
                    const isExpiring = app.offerLetter?.expiryDate && 
                      new Date(app.offerLetter.expiryDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) &&
                      app.offerLetter.status !== 'Accepted' && 
                      app.offerLetter.status !== 'Rejected'
                    
                    return (
                      <tr key={app._id} className={`hover:bg-gray-50 ${isExpiring ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{app.candidateInfo.fullName}</div>
                          <div className="text-sm text-gray-500">{app.candidateInfo.email}</div>
                          <div className="text-xs text-gray-400">{app.candidateInfo.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{app.jobId?.title || app.candidateInfo.appliedJobRole}</div>
                          <div className="text-xs text-gray-500">{app.jobId?.department || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {app.offerLetter ? (
                            <div className="text-sm">
                              <div className="text-gray-900">₹{app.offerLetter.salary?.toLocaleString('en-IN') || 'N/A'}</div>
                              <div className="text-gray-500 text-xs">
                                {app.offerLetter.joiningDate ? format(new Date(app.offerLetter.joiningDate), 'MMM dd, yyyy') : 'N/A'}
                              </div>
                              <div className="text-gray-500 text-xs">{app.offerLetter.workType || 'N/A'}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No offer generated</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {app.offerLetter ? (
                            <div className="flex flex-col space-y-1">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                app.offerLetter.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                                app.offerLetter.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                app.offerLetter.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {app.offerLetter.status}
                              </span>
                              {app.offerLetter.sentAt && (
                                <span className="text-xs text-gray-500">
                                  Sent: {format(new Date(app.offerLetter.sentAt), 'MMM dd')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No offer</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {app.offerLetter?.expiryDate ? (
                            <div className={`text-sm ${isExpiring ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              {format(new Date(app.offerLetter.expiryDate), 'MMM dd, yyyy')}
                              {isExpiring && (
                                <div className="text-xs text-red-500 mt-1 flex items-center">
                                  <FiAlertCircle size={12} className="mr-1" />
                                  Expiring soon
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No expiry</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {!app.offerLetter ? (
                              <button
                                onClick={() => openOfferForm(app)}
                                className="text-primary-600 hover:text-primary-700 flex items-center"
                              >
                                <FiPlus className="mr-1" size={16} />
                                Generate
                              </button>
                            ) : (
                              <>
                                {app.offerLetter.status === 'Pending' && (
                                  <button
                                    onClick={() => handleSendOffer(app._id)}
                                    className="text-green-600 hover:text-green-700 flex items-center"
                                    title="Send offer to candidate"
                                  >
                                    <FiSend className="mr-1" size={16} />
                                    Send
                                  </button>
                                )}
                                {app.offerLetter.status === 'Sent' && (
                                  <button
                                    onClick={() => handleSendOffer(app._id)}
                                    className="text-yellow-600 hover:text-yellow-700 flex items-center"
                                    title="Resend offer"
                                  >
                                    <FiMail className="mr-1" size={16} />
                                    Remind
                                  </button>
                                )}
                                {app.offerLetter.documentUrl && (
                                  <button
                                    onClick={() => {
                                      // Use full backend URL for file access
                                      let fileUrl = app.offerLetter.documentUrl
                                      if (!fileUrl.startsWith('http')) {
                                        // Ensure it starts with /uploads
                                        if (!fileUrl.startsWith('/')) {
                                          fileUrl = '/' + fileUrl
                                        }
                                        fileUrl = `http://localhost:5000${fileUrl}`
                                      }
                                      console.log('Opening offer letter:', fileUrl)
                                      setPreviewUrl(fileUrl)
                                      setShowPreviewModal(true)
                                    }}
                                    className="text-blue-600 hover:text-blue-700 flex items-center"
                                    title="View offer letter"
                                  >
                                    <FiEye className="mr-1" size={16} />
                                    View
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDuplicateOffer(app)}
                                  className="text-purple-600 hover:text-purple-700 flex items-center"
                                  title="Duplicate offer"
                                >
                                  <FiCopy className="mr-1" size={16} />
                                  Duplicate
                                </button>
                                {app.offerLetter.status === 'Pending' && (
                                  <button
                                    onClick={() => {
                                      setSelectedApplication(app)
                                      setOfferForm({
                                        templateId: app.offerLetter.templateId || '',
                                        candidateName: app.offerLetter.candidateName,
                                        jobTitle: app.offerLetter.jobTitle,
                                        salary: app.offerLetter.salary,
                                        joiningDate: app.offerLetter.joiningDate ? format(new Date(app.offerLetter.joiningDate), 'yyyy-MM-dd') : '',
                                        reportingManager: app.offerLetter.reportingManager || '',
                                        department: app.offerLetter.department,
                                        workType: app.offerLetter.workType || 'WFO',
                                        workLocation: app.offerLetter.workLocation || '',
                                        probationPeriod: app.offerLetter.probationPeriod || '3 months',
                                        noticePeriod: app.offerLetter.noticePeriod || '30 days',
                                        additionalTerms: app.offerLetter.additionalTerms || '',
                                        expiryDate: app.offerLetter.expiryDate ? format(new Date(app.offerLetter.expiryDate), 'yyyy-MM-dd') : ''
                                      })
                                      setShowOfferForm(true)
                                    }}
                                    className="text-gray-600 hover:text-gray-700 flex items-center"
                                    title="Edit offer"
                                  >
                                    <FiEdit className="mr-1" size={16} />
                                    Edit
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upload Template Modal */}
      {showTemplateForm && (
        <TemplateUploadModal
          formData={templateForm}
          onFormChange={setTemplateForm}
          onSubmit={handleUploadTemplate}
          onClose={() => {
            setShowTemplateForm(false)
            setTemplateForm({ name: '', description: '', template: null })
          }}
        />
      )}

      {/* Generate Offer Modal */}
      {showOfferForm && selectedApplication && (
        <OfferGenerateModal
          application={selectedApplication}
          templates={templates}
          managers={managers}
          formData={offerForm}
          onFormChange={setOfferForm}
          onSubmit={handleGenerateOffer}
          onClose={() => {
            setShowOfferForm(false)
            setSelectedApplication(null)
          }}
        />
      )}

      {/* Offer Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowPreviewModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Offer Letter Preview</h3>
                  <div className="flex items-center space-x-2">
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                    >
                      <FiDownload className="mr-2" size={18} />
                      Download
                    </a>
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <FiXCircle size={24} />
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '80vh' }}>
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    title="Offer Letter Preview"
                    style={{ border: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Template Upload Modal
const TemplateUploadModal = ({ formData, onFormChange, onSubmit, onClose }) => {
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.includes('pdf') && !file.type.includes('doc') && !file.type.includes('docx')) {
        toast.error('Only PDF, DOC, and DOCX files are allowed')
        return
      }
      onFormChange({ ...formData, template: file })
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Offer Template</h3>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template File (PDF/DOCX) *</label>
                <label className="flex items-center px-4 py-2 bg-primary-50 text-primary-700 rounded-lg cursor-pointer hover:bg-primary-100">
                  <FiUpload className="mr-2" size={20} />
                  {formData.template ? formData.template.name : 'Choose File'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
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
                  Upload Template
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// Offer Generate Modal
const OfferGenerateModal = ({ application, templates, managers, formData, onFormChange, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Generate Offer Letter</h3>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template *</label>
                <select
                  required
                  value={formData.templateId}
                  onChange={(e) => onFormChange({ ...formData, templateId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select template...</option>
                  {templates.map(template => (
                    <option key={template._id} value={template._id}>{template.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.candidateName}
                    onChange={(e) => onFormChange({ ...formData, candidateName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.jobTitle}
                    onChange={(e) => onFormChange({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary (CTC) *</label>
                  <input
                    type="number"
                    required
                    value={formData.salary}
                    onChange={(e) => onFormChange({ ...formData, salary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.joiningDate}
                    onChange={(e) => onFormChange({ ...formData, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => onFormChange({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Type *</label>
                  <select
                    required
                    value={formData.workType}
                    onChange={(e) => onFormChange({ ...formData, workType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="WFH">WFH</option>
                    <option value="WFO">WFO</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
                <select
                  value={formData.reportingManager}
                  onChange={(e) => onFormChange({ ...formData, reportingManager: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select reporting manager...</option>
                  {managers.map(manager => (
                    <option key={manager._id} value={manager._id}>
                      {manager.personalInfo?.fullName || manager.email} {manager.employeeId ? `(${manager.employeeId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Location</label>
                <input
                  type="text"
                  value={formData.workLocation}
                  onChange={(e) => onFormChange({ ...formData, workLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Probation Period</label>
                  <input
                    type="text"
                    value={formData.probationPeriod}
                    onChange={(e) => onFormChange({ ...formData, probationPeriod: e.target.value })}
                    placeholder="e.g., 3 months"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period</label>
                  <input
                    type="text"
                    value={formData.noticePeriod}
                    onChange={(e) => onFormChange({ ...formData, noticePeriod: e.target.value })}
                    placeholder="e.g., 30 days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Terms</label>
                <textarea
                  rows={3}
                  value={formData.additionalTerms}
                  onChange={(e) => onFormChange({ ...formData, additionalTerms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offer Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => onFormChange({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

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
                  Generate Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OfferManagement

