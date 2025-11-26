import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import {
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiMapPin,
  FiCreditCard,
  FiFileText,
  FiEdit2,
  FiSave,
  FiX,
  FiUpload,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiDollarSign,
  FiBriefcase,
  FiTrendingUp,
  FiActivity,
  FiEye,
  FiExternalLink,
  FiUsers,
  FiArrowLeft,
  FiCheck,
  FiXCircle
} from 'react-icons/fi'
import toast from 'react-hot-toast'

const HRProfile = () => {
  const { user } = useAuth()
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [formData, setFormData] = useState({})
  const [uploading, setUploading] = useState(false)
  const [timeline, setTimeline] = useState([])
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [missingFields, setMissingFields] = useState([])
  const [showMissingFields, setShowMissingFields] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [employees, setEmployees] = useState([])
  const [isViewOnly, setIsViewOnly] = useState(false) // Flag for view-only mode (viewing employee profiles)

  useEffect(() => {
    // Fetch employees list if HR (needed for dropdown)
    if (user?.role === 'hr') {
      fetchEmployees()
    }
    
    // Fetch profile based on employeeId parameter
    if (employeeId) {
      // Viewing specific employee profile (view-only for HR)
      fetchEmployeeProfile(employeeId)
      setIsViewOnly(true)
      setEditing(false) // Always disable editing when viewing employee profiles
    } else {
      // Viewing own HR profile
      fetchProfile(true, true) // Force recalculation on load
      setIsViewOnly(false)
    }
    fetchTimeline()
    fetchMissingFields()
  }, [employeeId, user])

  const fetchMissingFields = async () => {
    try {
      const { data } = await axios.get('/api/hr-profile/completion-status')
      setMissingFields(data.missingFields || [])
    } catch (error) {
      console.error('Error fetching missing fields:', error)
    }
  }

  // Auto-enable editing mode for HR - they need to fill their own profile
  // Disable editing if viewing employee profiles (view-only mode)
  useEffect(() => {
    if (isViewOnly) {
      setEditing(false)
      return
    }
    
    if (profile && user?.role === 'hr') {
      // Always enable editing for HR so they can fill their profile
      // Only disable if profile is 100% complete AND user hasn't manually disabled it
      const isComplete = profile.profileCompletion >= 100 && 
                         profile.personalInfo?.mobile && 
                         profile.personalInfo?.dateOfBirth &&
                         profile.personalInfo?.gender &&
                         profile.personalInfo?.fullName;
      
      // Auto-enable if profile is not 100% complete
      if (!isComplete) {
        setEditing(true)
      }
    }
  }, [profile, user, isViewOnly])

  const fetchProfile = async (autoCreate = true, forceRecalculate = false) => {
    try {
      // Force recalculation if requested
      if (forceRecalculate) {
        try {
          await axios.post('/api/hr-profile/recalculate')
        } catch (recalcError) {
          console.error('Error recalculating HR profile:', recalcError)
        }
      }
      
      const { data } = await axios.get('/api/hr-profile/my-profile')
      setProfile(data)
      // Ensure all nested structures are initialized
      setFormData({
        ...data,
        idProofs: data.idProofs || {},
        bankDetails: data.bankDetails || {},
        companyDetails: data.companyDetails || {},
        employmentInfo: {
          ...data.employmentInfo,
          previousCompanies: data.employmentInfo?.previousCompanies || []
        }
      })
      setLoading(false)
    } catch (error) {
      console.error('Error fetching profile:', error)
      
      // Always try to auto-create profile if it doesn't exist
      if (autoCreate && (error.response?.status === 404 || error.response?.status === 500 || !profile)) {
        console.log('Attempting to auto-create HR profile...')
        // HR profile is auto-created by the backend, just retry fetching
        setTimeout(async () => {
          try {
            const { data: profileData } = await axios.get('/api/hr-profile/my-profile')
            setProfile(profileData)
            // Ensure all nested structures are initialized
            setFormData({
              ...profileData,
              idProofs: profileData.idProofs || {},
              bankDetails: profileData.bankDetails || {},
              companyDetails: profileData.companyDetails || {},
              employmentInfo: {
                ...profileData.employmentInfo,
                previousCompanies: profileData.employmentInfo?.previousCompanies || []
              }
            })
            toast.success('HR profile created successfully!')
          } catch (retryError) {
            console.error('Error fetching after creation:', retryError)
            toast.error('HR profile created but failed to load. Please refresh the page.')
          } finally {
            setLoading(false)
          }
        }, 500)
        return
      }
      
      // Only show error if we're not auto-creating
      if (!autoCreate) {
        toast.error(error.response?.data?.message || 'Failed to load profile')
      }
      setLoading(false)
    }
  }

  // Fetch employees list for HR
  const fetchEmployees = async () => {
    try {
      const { data } = await axios.get('/api/employees')
      setEmployees(data || [])
      console.log('[HR_PROFILE] Fetched employees:', data?.length || 0)
    } catch (error) {
      console.error('[HR_PROFILE] Error fetching employees:', error)
      setEmployees([])
    }
  }

  // Fetch employee profile by ID (for HR viewing employees)
  const fetchEmployeeProfile = async (empId) => {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/profile/${empId}`)
      setProfile(data)
      // Ensure all nested structures are initialized
      setFormData({
        ...data,
        idProofs: data.idProofs || {},
        bankDetails: data.bankDetails || {},
        companyDetails: data.companyDetails || {},
        employmentInfo: {
          ...data.employmentInfo,
          previousCompanies: data.employmentInfo?.previousCompanies || []
        }
      })
      setIsViewOnly(data.isViewOnly || true)
      setEditing(false) // Always disable editing when viewing employee profiles
      setLoading(false)
    } catch (error) {
      console.error('[HR_PROFILE] Error fetching employee profile:', error)
      toast.error(error.response?.data?.message || 'Failed to load employee profile')
      setLoading(false)
    }
  }

  const fetchTimeline = async () => {
    try {
      let timelineEndpoint
      if (employeeId) {
        // Viewing employee profile - use employee timeline
        timelineEndpoint = `/api/profile/timeline?employeeId=${employeeId}`
      } else {
        // Viewing own HR profile - use HR timeline
        timelineEndpoint = '/api/hr-profile/timeline'
      }
      const { data } = await axios.get(timelineEndpoint)
      setTimeline(data || [])
    } catch (error) {
      console.error('Error fetching timeline:', error)
      setTimeline([])
    }
  }

  const handleSubmitProfile = async () => {
    if (profile.profileCompletion < 100) {
      toast.error('Profile must be 100% complete before submission')
      return
    }
    
    if (profile.profileStatus === 'Submitted' || profile.profileStatus === 'Under Review' || profile.profileStatus === 'Approved') {
      toast.error(`Profile has already been submitted. Status: ${profile.profileStatus}`)
      return
    }

    setSubmitting(true)
    try {
      const { data } = await axios.post('/api/hr-profile/submit')
      toast.success(data.message || 'Profile submitted successfully for HR review!')
      
      // Refresh profile to get updated status
      setTimeout(() => {
        fetchProfile(false, true)
        fetchTimeline()
      }, 500)
    } catch (error) {
      console.error('Error submitting profile:', error)
      toast.error(error.response?.data?.message || 'Failed to submit profile')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    // Prevent updates in view-only mode
    if (isViewOnly) {
      toast.error('You cannot edit this profile. This is view-only mode.')
      return
    }
    
    try {
      // Ensure all fields are properly formatted before sending
      const dataToSend = { ...formData }
      
      // Ensure ID proofs structure exists and is properly formatted
      if (!dataToSend.idProofs) {
        dataToSend.idProofs = {}
      }
      // Keep all ID proof fields, even if empty (let backend handle validation)
      // Safely handle null/undefined values before calling trim
      if (dataToSend.idProofs.aadhaar !== undefined) {
        const aadhaarValue = dataToSend.idProofs.aadhaar
        if (aadhaarValue === null || aadhaarValue === undefined || (typeof aadhaarValue === 'string' && aadhaarValue.trim() === '')) {
          dataToSend.idProofs.aadhaar = ''
        }
      }
      if (dataToSend.idProofs.pan !== undefined) {
        const panValue = dataToSend.idProofs.pan
        if (panValue === null || panValue === undefined || (typeof panValue === 'string' && panValue.trim() === '')) {
          dataToSend.idProofs.pan = ''
        }
      }
      if (dataToSend.idProofs.passport !== undefined) {
        const passportValue = dataToSend.idProofs.passport
        if (passportValue === null || passportValue === undefined || (typeof passportValue === 'string' && passportValue.trim() === '')) {
          dataToSend.idProofs.passport = ''
        }
      }
      if (dataToSend.idProofs.drivingLicense !== undefined) {
        const licenseValue = dataToSend.idProofs.drivingLicense
        if (licenseValue === null || licenseValue === undefined || (typeof licenseValue === 'string' && licenseValue.trim() === '')) {
          dataToSend.idProofs.drivingLicense = ''
        }
      }
      
      // Ensure bank details structure exists
      if (!dataToSend.bankDetails) {
        dataToSend.bankDetails = {}
      }
      // Keep all bank detail fields - safely handle null/undefined values
      if (dataToSend.bankDetails.accountNumber !== undefined) {
        const accountValue = dataToSend.bankDetails.accountNumber
        if (accountValue === null || accountValue === undefined || (typeof accountValue === 'string' && accountValue.trim() === '')) {
          dataToSend.bankDetails.accountNumber = ''
        }
      }
      if (dataToSend.bankDetails.ifscCode !== undefined) {
        const ifscValue = dataToSend.bankDetails.ifscCode
        if (ifscValue === null || ifscValue === undefined || (typeof ifscValue === 'string' && ifscValue.trim() === '')) {
          dataToSend.bankDetails.ifscCode = ''
        }
      }
      if (dataToSend.bankDetails.bankName !== undefined) {
        const bankNameValue = dataToSend.bankDetails.bankName
        if (bankNameValue === null || bankNameValue === undefined || (typeof bankNameValue === 'string' && bankNameValue.trim() === '')) {
          dataToSend.bankDetails.bankName = ''
        }
      }
      if (dataToSend.bankDetails.branchName !== undefined) {
        const branchValue = dataToSend.bankDetails.branchName
        if (branchValue === null || branchValue === undefined || (typeof branchValue === 'string' && branchValue.trim() === '')) {
          dataToSend.bankDetails.branchName = ''
        }
      }
      if (dataToSend.bankDetails.accountHolderName !== undefined) {
        const holderValue = dataToSend.bankDetails.accountHolderName
        if (holderValue === null || holderValue === undefined || (typeof holderValue === 'string' && holderValue.trim() === '')) {
          dataToSend.bankDetails.accountHolderName = ''
        }
      }
      
      // Ensure company details structure exists
      if (!dataToSend.companyDetails) {
        dataToSend.companyDetails = {}
      }
      // Ensure department and designation are not empty strings - set to null if empty
      if (dataToSend.companyDetails.department !== undefined) {
        const deptValue = dataToSend.companyDetails.department
        if (deptValue === null || deptValue === undefined || (typeof deptValue === 'string' && deptValue.trim() === '')) {
          dataToSend.companyDetails.department = 'Human Resources' // Default for HR
        }
      }
      if (dataToSend.companyDetails.designation !== undefined) {
        const desigValue = dataToSend.companyDetails.designation
        if (desigValue === null || desigValue === undefined || (typeof desigValue === 'string' && desigValue.trim() === '')) {
          dataToSend.companyDetails.designation = null
        }
      }
      
      // Ensure employment info structure exists
      if (!dataToSend.employmentInfo) {
        dataToSend.employmentInfo = {}
      }
      if (!dataToSend.employmentInfo.previousCompanies) {
        dataToSend.employmentInfo.previousCompanies = []
      }
      
      console.log('[PROFILE_UPDATE] Sending data:', {
        hasIdProofs: !!dataToSend.idProofs,
        hasAadhaar: !!dataToSend.idProofs?.aadhaar,
        aadhaarValue: dataToSend.idProofs?.aadhaar ? (dataToSend.idProofs.aadhaar.substring(0, 4) + '...') : 'empty',
        hasPAN: !!dataToSend.idProofs?.pan,
        panValue: dataToSend.idProofs?.pan || 'empty',
        hasBankAccount: !!dataToSend.bankDetails?.accountNumber,
        accountValue: dataToSend.bankDetails?.accountNumber ? (dataToSend.bankDetails.accountNumber.substring(0, 4) + '...') : 'empty',
        hasCompanyDetails: !!dataToSend.companyDetails,
        hasEmploymentInfo: !!dataToSend.employmentInfo
      })
      
      const { data } = await axios.put('/api/hr-profile/my-profile', dataToSend)
      
      console.log('[HR_PROFILE_UPDATE] Update successful:', data)
      
      // Update state with response data
      setProfile(data)
      setFormData({
        ...data,
        idProofs: data.idProofs || {},
        bankDetails: data.bankDetails || {},
        companyDetails: data.companyDetails || {},
        employmentInfo: {
          ...data.employmentInfo,
          previousCompanies: data.employmentInfo?.previousCompanies || []
        }
      })
      setEditing(false)
      
      toast.success('HR profile updated successfully')
      
      // Force refresh profile and missing fields after a short delay
      setTimeout(() => {
        fetchProfile(false, true) // Force recalculation
        fetchMissingFields() // Refresh missing fields list
      }, 500)
    } catch (error) {
      console.error('[HR_PROFILE_UPDATE] Error:', error)
      console.error('[HR_PROFILE_UPDATE] Error response:', error.response?.data)
      console.error('[HR_PROFILE_UPDATE] Error message:', error.message)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to update HR profile'
      toast.error(errorMessage)
      
      // Log validation errors if present
      if (error.response?.data?.errors) {
        console.error('[HR_PROFILE_UPDATE] Validation errors:', error.response.data.errors)
      }
    }
  }

  // Document verification handlers for HR
  const handleVerifyDocument = async (documentIndex) => {
    if (!employeeId || !profile) {
      toast.error('Cannot verify document. Employee profile not found.')
      return
    }
    
    const url = `/api/profile/${employeeId}/documents/${documentIndex}/verify`
    console.log('[HR_PROFILE] Verifying document:', { employeeId, documentIndex, url })
    
    try {
      const { data } = await axios.put(url)
      toast.success('Document verified successfully!')
      // Refresh the profile to get updated document status
      await fetchEmployeeProfile(employeeId)
    } catch (error) {
      console.error('[HR_PROFILE] Error verifying document:', {
        error,
        response: error.response,
        status: error.response?.status,
        message: error.response?.data?.message,
        url
      })
      toast.error(error.response?.data?.message || `Failed to verify document: ${error.message}`)
    }
  }

  const handleRejectDocument = async (documentIndex, rejectionReason) => {
    if (!employeeId || !profile) {
      toast.error('Cannot reject document. Employee profile not found.')
      return
    }
    
    if (!rejectionReason || rejectionReason.trim() === '') {
      toast.error('Please provide a reason for rejection')
      return
    }
    
    const url = `/api/profile/${employeeId}/documents/${documentIndex}/reject`
    console.log('[HR_PROFILE] Rejecting document:', { employeeId, documentIndex, url, rejectionReason })
    
    try {
      const { data } = await axios.put(url, {
        rejectionReason: rejectionReason.trim()
      })
      toast.success('Document rejected successfully!')
      // Refresh the profile to get updated document status
      await fetchEmployeeProfile(employeeId)
    } catch (error) {
      console.error('[HR_PROFILE] Error rejecting document:', {
        error,
        response: error.response,
        status: error.response?.status,
        message: error.response?.data?.message,
        url
      })
      toast.error(error.response?.data?.message || `Failed to reject document: ${error.message}`)
    }
  }

  const handleFileUpload = async (e, documentType, companyIndex = null, documentCategory = null) => {
    // Prevent file uploads in view-only mode
    if (isViewOnly) {
      toast.error('You cannot upload documents in view-only mode.')
      e.target.value = '' // Clear the file input
      return
    }
    
    const file = e.target.files?.[0]
    if (!file) {
      console.log('[UPLOAD] No file selected')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    const uploadFormData = new FormData() // Renamed to avoid shadowing state formData
    uploadFormData.append('document', file)
    
    // If uploading for a company, include company index and document category
    if (companyIndex !== null && documentCategory) {
      uploadFormData.append('companyIndex', companyIndex.toString())
      uploadFormData.append('documentCategory', documentCategory)
      console.log('[UPLOAD] Uploading company document:', { 
        companyIndex, 
        documentCategory, 
        fileName: file.name, 
        fileSize: file.size,
        currentCompanies: profile?.employmentInfo?.previousCompanies?.length || 0
      })
    } else {
      uploadFormData.append('documentType', documentType)
    }

    setUploading(true)
    try {
      const { data } = await axios.post('/api/hr-profile/upload-document', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      console.log('[UPLOAD] Upload response:', data)
      
      // If it's a company document, update both formData and profile state immediately for instant UI update
      if (companyIndex !== null && documentCategory && data.url) {
        console.log('[UPLOAD] Updating state for company document:', { companyIndex, documentCategory, url: data.url, response: data })
        
        // Show success toast immediately
        toast.success(data.message || 'Document uploaded successfully!')
        
        // Force immediate state update by using functional updates
        setFormData(prevFormData => {
          const currentCompanies = prevFormData.employmentInfo?.previousCompanies || profile?.employmentInfo?.previousCompanies || []
          const updatedCompanies = currentCompanies.length > 0 ? [...currentCompanies] : []
          
          // Ensure company exists at this index
          while (updatedCompanies.length <= companyIndex) {
            updatedCompanies.push({ 
              companyName: '', 
              position: '', 
              startDate: '', 
              endDate: '', 
              experience: '', 
              experienceLetter: '', 
              salarySlip: '' 
            })
          }
          
          // Create a new company object with updated document URL
          updatedCompanies[companyIndex] = {
            ...updatedCompanies[companyIndex],
            [documentCategory]: data.url,
            // Also update from backend response if available
            ...(data.company || {})
          }
          
          console.log('[UPLOAD] Updated formData:', { 
            companyIndex, 
            documentCategory,
            url: data.url,
            company: updatedCompanies[companyIndex],
            allCompanies: updatedCompanies
          })
          
          return {
            ...prevFormData,
            employmentInfo: {
              ...prevFormData.employmentInfo,
              previousCompanies: updatedCompanies
            }
          }
        })
        
        // Also update profile state immediately (for view mode) 
        setProfile(prevProfile => {
          if (!prevProfile) {
            console.warn('[UPLOAD] Profile not available for update')
            return prevProfile
          }
          
          const currentCompanies = prevProfile.employmentInfo?.previousCompanies || []
          const updatedCompanies = currentCompanies.length > 0 ? [...currentCompanies] : []
          
          // Ensure company exists at this index
          while (updatedCompanies.length <= companyIndex) {
            updatedCompanies.push({ 
              companyName: '', 
              position: '', 
              startDate: '', 
              endDate: '', 
              experience: '', 
              experienceLetter: '', 
              salarySlip: '' 
            })
          }
          
          // Create a new company object with updated document URL
          updatedCompanies[companyIndex] = {
            ...updatedCompanies[companyIndex],
            [documentCategory]: data.url,
            // Also update from backend response if available
            ...(data.company || {})
          }
          
          console.log('[UPLOAD] Updated profile:', { 
            companyIndex, 
            documentCategory,
            url: data.url,
            company: updatedCompanies[companyIndex],
            allCompanies: updatedCompanies
          })
          
          return {
            ...prevProfile,
            employmentInfo: {
              ...prevProfile.employmentInfo,
              previousCompanies: updatedCompanies
            }
          }
        })
        
        // Force component re-render by updating refresh key
        setRefreshKey(prev => prev + 1)
        
        toast.success(data.message || 'Document uploaded successfully!')
        
        // Refresh profile from database after a short delay to ensure DB is updated
        setTimeout(async () => {
          console.log('[UPLOAD] Refreshing profile from database...')
          try {
            const { data: profileData } = await axios.get('/api/hr-profile/my-profile')
            console.log('[UPLOAD] Fetched profile data:', {
              companies: profileData.employmentInfo?.previousCompanies?.map((c, i) => ({
                index: i,
                name: c.companyName,
                expLetter: c.experienceLetter,
                salarySlip: c.salarySlip
              }))
            })
            setProfile(profileData)
            setFormData(profileData)
            setRefreshKey(prev => prev + 1) // Force another re-render after refresh
            fetchTimeline()
            console.log('[UPLOAD] Profile refreshed successfully')
          } catch (refreshError) {
            console.error('[UPLOAD] Error refreshing profile:', refreshError)
          }
        }, 500)
      } else {
        // Regular document upload
        toast.success(data.message || 'Document uploaded successfully!')
        setTimeout(async () => {
          await fetchProfile(false, false)
          fetchTimeline()
        }, 800)
      }
    } catch (error) {
      console.error('[UPLOAD] Error:', error.response?.data || error.message)
      toast.error(error.response?.data?.message || 'Failed to upload document')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const tabs = [
    { id: 'personal', name: 'Personal Info', icon: FiUser },
    { id: 'idproofs', name: 'ID Proofs', icon: FiCreditCard },
    { id: 'company', name: 'Company Details', icon: FiBriefcase },
    { id: 'employment', name: 'Employment', icon: FiTrendingUp },
    { id: 'bank', name: 'Bank Details', icon: FiDollarSign },
    { id: 'documents', name: 'Documents', icon: FiFileText },
    { id: 'timeline', name: 'Timeline', icon: FiActivity }
  ]

  // Show loading spinner, but also show dropdown for managers
  if (loading && !profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  const handleCreateProfile = async () => {
    setCreatingProfile(true)
    try {
      // HR profile is auto-created by backend, just fetch it
      await fetchProfile(true, true)
      toast.success('HR profile created successfully!')
    } catch (error) {
      console.error('Error creating HR profile:', error)
      toast.error(error.response?.data?.message || 'Failed to create HR profile')
    } finally {
      setCreatingProfile(false)
    }
  }

  // Show loading while creating profile automatically
  if (!profile && (loading || creatingProfile)) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">Creating your profile...</p>
        <p className="text-sm text-gray-500 mt-2">This will only take a moment</p>
      </div>
    )
  }

  // Show create button only if auto-creation failed
  if (!profile && !loading && !creatingProfile) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <FiUser className="mx-auto text-gray-400" size={64} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">HR Profile Not Found</h2>
          <p className="text-gray-600 mb-6">
            Your HR profile hasn't been created yet. Click the button below to create it automatically.
          </p>
          <button
            onClick={handleCreateProfile}
            disabled={creatingProfile}
            className="btn btn-primary"
          >
            {creatingProfile ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Profile...
              </>
            ) : (
              <>
                <FiEdit2 className="mr-2" />
                Create My HR Profile
              </>
            )}
          </button>
          {creatingProfile && (
            <p className="text-sm text-gray-500 mt-4">
              Please wait while we create your profile...
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Employee Selector for HR - Always show for HR */}
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
                {isViewOnly ? 'Viewing Employee Profile' : 'View Employee Profile'}
              </label>
              <select
                value={employeeId || 'my-profile'}
                onChange={(e) => {
                  if (e.target.value === 'my-profile') {
                    navigate('/hr-profile')
                    setIsViewOnly(false)
                    setEditing(false) // Reset editing when switching to own profile
                  } else {
                    navigate(`/hr-profile/${e.target.value}`)
                    setIsViewOnly(true)
                    setEditing(false) // Disable editing when viewing employee profile
                  }
                }}
                className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
                disabled={loading}
              >
                <option value="my-profile">👤 My HR Profile (Editable)</option>
                {employees && employees.length > 0 ? (
                  employees.map((employee) => {
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
                {isViewOnly ? (
                  <span className="text-purple-700">
                    📖 <strong>View-only mode:</strong> You can view and verify documents for this employee
                  </span>
                ) : (
                  <span className="text-green-700">
                    ✏️ <strong>Edit mode:</strong> You can edit your own HR profile
                  </span>
                )}
              </p>
            </div>
            {isViewOnly && (
              <button
                onClick={() => {
                  navigate('/hr-profile')
                  setIsViewOnly(false)
                  setEditing(false)
                }}
                className="btn btn-secondary flex items-center whitespace-nowrap"
              >
                <FiArrowLeft className="mr-2" />
                Back to My Profile
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Header with Profile Completion */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {profile.personalInfo?.fullName 
                ? profile.personalInfo.fullName.trim() || 'My Profile'
                : 'My Profile'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isViewOnly ? `Employee ID: ${profile.employeeId}` : `HR ID: ${profile.hrId}`}
            </p>
            {profile.profileStatus && (
              <div className="mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  profile.profileStatus === 'Approved' ? 'bg-green-100 text-green-800' :
                  profile.profileStatus === 'Submitted' || profile.profileStatus === 'Under Review' ? 'bg-blue-100 text-blue-800' :
                  profile.profileStatus === 'Rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  Status: {profile.profileStatus}
                </span>
                {profile.profileSubmittedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted: {new Date(profile.profileSubmittedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            {profile.profileCompletion < 50 && (
              <p className="text-sm text-yellow-600 mt-2">
                <FiAlertCircle className="inline mr-1" />
                Please complete your profile by filling in the required fields below.
              </p>
            )}
          </div>
          {/* Show edit button only if not in view-only mode */}
          {!isViewOnly && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="btn btn-primary flex items-center"
            >
              <FiEdit2 className="mr-2" />
              Edit Profile
            </button>
          )}
          {/* Show view-only indicator */}
          {isViewOnly && (
            <div className="flex items-center px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
              <FiEye className="mr-2 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">View Only - Employee Profile</span>
            </div>
          )}
          {editing && (
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-blue-600">✏️ Edit Mode Active</p>
                <p className="text-xs text-gray-500">Fill in all fields and click "Save Changes"</p>
              </div>
              {profile.profileCompletion < 50 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-1">
                  <p className="text-xs text-yellow-800">Complete your profile</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Completion Meter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Profile Completion</span>
            <span className="text-sm font-bold text-primary-600">{profile.profileCompletion || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile.profileCompletion || 0}%` }}
              transition={{ duration: 0.5 }}
              className={`h-3 rounded-full ${
                profile.profileCompletion >= 80
                  ? 'bg-green-500'
                  : profile.profileCompletion >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
          </div>
          {profile.profileCompletion < 100 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">
                Complete your profile to unlock all features
              </p>
              {missingFields.length > 0 && (
                <div>
                  <button
                    onClick={() => {
                      fetchMissingFields()
                      setShowMissingFields(!showMissingFields)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    {showMissingFields ? 'Hide' : 'Show'} missing fields ({missingFields.length})
                  </button>
                  {showMissingFields && (
                    <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-yellow-800 mb-1">Missing Fields:</p>
                      <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
                        {missingFields.map((field, idx) => (
                          <li key={idx}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {profile.profileCompletion === 100 && (profile.profileStatus === 'Draft' || profile.profileStatus === 'Rejected' || !profile.profileStatus) && (
            <div className="mt-4 pt-4 border-t border-green-200 bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800 mb-1">
                    <FiCheckCircle className="inline mr-2" />
                    Profile Complete!
                  </p>
                  <p className="text-xs text-green-700">
                    Your profile is 100% complete. Submit it for HR review.
                  </p>
                </div>
                <button
                  onClick={handleSubmitProfile}
                  disabled={submitting}
                  className="btn bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center shadow-md"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="mr-2" size={18} />
                      Submit Profile
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          {profile.profileCompletion === 100 && (profile.profileStatus === 'Submitted' || profile.profileStatus === 'Under Review') && (
            <div className="mt-4 pt-4 border-t border-blue-200 bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800">
                <FiCheckCircle className="inline mr-2" />
                Profile Submitted for Review
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Your profile has been submitted and is currently under HR review. You will be notified once it's approved.
              </p>
            </div>
          )}
          {profile.profileCompletion === 100 && profile.profileStatus === 'Approved' && (
            <div className="mt-4 pt-4 border-t border-green-200 bg-green-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800">
                <FiCheckCircle className="inline mr-2" />
                Profile Approved!
              </p>
              <p className="text-xs text-green-700 mt-1">
                Your profile has been approved by HR. All information is now verified.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="mr-2" size={18} />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'personal' && (
            <PersonalInfoTab
              profile={profile}
              formData={formData}
              setFormData={setFormData}
              editing={editing}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          )}

          {activeTab === 'idproofs' && (
            <IDProofsTab
              profile={profile}
              formData={formData}
              setFormData={setFormData}
              editing={editing}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          )}

          {activeTab === 'company' && (
            <CompanyDetailsTab
              profile={profile}
              formData={formData}
              setFormData={setFormData}
              editing={editing}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          )}

          {activeTab === 'employment' && (
            <EmploymentTab
              profile={profile}
              formData={formData}
              setFormData={setFormData}
              editing={editing}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
              onUpload={handleFileUpload}
              uploading={uploading}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'bank' && (
            <BankDetailsTab
              profile={profile}
              formData={formData}
              setFormData={setFormData}
              editing={editing}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsTab
              profile={profile}
              onUpload={handleFileUpload}
              uploading={uploading}
              isViewOnly={isViewOnly}
              userRole={user?.role}
              onVerifyDocument={handleVerifyDocument}
              onRejectDocument={handleRejectDocument}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineTab timeline={timeline} />
          )}
        </div>
      </div>
    </div>
  )
}

// Personal Information Tab Component
const PersonalInfoTab = ({ profile, formData, setFormData, editing, onSave, onCancel }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editing ? (formData.personalInfo?.fullName || '') : (profile.personalInfo?.fullName || '')}
            onChange={(e) => {
              // Auto-capitalize first letter of each word
              const value = e.target.value
              setFormData({
                ...formData,
                personalInfo: {
                  ...formData.personalInfo,
                  fullName: value
                }
              })
            }}
            disabled={!editing}
            className="input font-medium"
            placeholder="Enter your full name (e.g., Ved Pawar)"
            required
          />
          {editing && (
            <p className="text-xs text-blue-600 mt-1">
              💡 This name will be displayed on your profile header and throughout the system
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={profile.personalInfo?.email || ''}
            disabled
            className="input bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">Email is linked to your account and cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={editing ? (formData.personalInfo?.mobile || '') : (profile.personalInfo?.mobile || '')}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: {
                ...formData.personalInfo,
                mobile: e.target.value.replace(/\D/g, '').slice(0, 10)
              }
            })}
            disabled={!editing}
            className="input"
            placeholder="10-digit mobile number"
            maxLength={10}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={editing 
              ? (formData.personalInfo?.dateOfBirth 
                  ? new Date(formData.personalInfo.dateOfBirth).toISOString().split('T')[0] 
                  : '')
              : (profile.personalInfo?.dateOfBirth 
                  ? new Date(profile.personalInfo.dateOfBirth).toISOString().split('T')[0] 
                  : '')
            }
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: {
                ...formData.personalInfo,
                dateOfBirth: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            max={new Date().toISOString().split('T')[0]}
            required
          />
          {profile.age && <p className="text-xs text-gray-500 mt-1">Age: {profile.age} years (auto-calculated)</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            value={editing ? (formData.personalInfo?.gender || '') : (profile.personalInfo?.gender || '')}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: {
                ...formData.personalInfo,
                gender: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
          <select
            value={editing ? (formData.personalInfo?.bloodGroup || '') : (profile.personalInfo?.bloodGroup || '')}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: {
                ...formData.personalInfo,
                bloodGroup: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
          >
            <option value="">Select Blood Group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
          <select
            value={editing ? (formData.personalInfo?.maritalStatus || '') : (profile.personalInfo?.maritalStatus || '')}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: {
                ...formData.personalInfo,
                maritalStatus: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
          >
            <option value="">Select</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
            <input
              type="text"
              value={editing ? (formData.personalInfo?.emergencyContact?.name || '') : (profile.personalInfo?.emergencyContact?.name || '')}
              onChange={(e) => setFormData({
                ...formData,
                personalInfo: {
                  ...formData.personalInfo,
                  emergencyContact: {
                    ...formData.personalInfo?.emergencyContact,
                    name: e.target.value
                  }
                }
              })}
              disabled={!editing}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
            <input
              type="tel"
              value={editing ? (formData.personalInfo?.emergencyContact?.number || '') : (profile.personalInfo?.emergencyContact?.number || '')}
              onChange={(e) => setFormData({
                ...formData,
                personalInfo: {
                  ...formData.personalInfo,
                  emergencyContact: {
                    ...formData.personalInfo?.emergencyContact,
                    number: e.target.value
                  }
                }
              })}
              disabled={!editing}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium">Permanent Address</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Street"
                value={editing ? (formData.personalInfo?.address?.permanent?.street || '') : (profile.personalInfo?.address?.permanent?.street || '')}
                onChange={(e) => setFormData({
                  ...formData,
                  personalInfo: {
                    ...formData.personalInfo,
                    address: {
                      ...formData.personalInfo?.address,
                      permanent: {
                        ...formData.personalInfo?.address?.permanent,
                        street: e.target.value
                      }
                    }
                  }
                })}
                disabled={!editing}
                className="input"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={editing ? (formData.personalInfo?.address?.permanent?.city || '') : (profile.personalInfo?.address?.permanent?.city || '')}
                  onChange={(e) => setFormData({
                    ...formData,
                    personalInfo: {
                      ...formData.personalInfo,
                      address: {
                        ...formData.personalInfo?.address,
                        permanent: {
                          ...formData.personalInfo?.address?.permanent,
                          city: e.target.value
                        }
                      }
                    }
                  })}
                  disabled={!editing}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={editing ? (formData.personalInfo?.address?.permanent?.state || '') : (profile.personalInfo?.address?.permanent?.state || '')}
                  onChange={(e) => setFormData({
                    ...formData,
                    personalInfo: {
                      ...formData.personalInfo,
                      address: {
                        ...formData.personalInfo?.address,
                        permanent: {
                          ...formData.personalInfo?.address?.permanent,
                          state: e.target.value
                        }
                      }
                    }
                  })}
                  disabled={!editing}
                  className="input"
                />
              </div>
              <input
                type="text"
                placeholder="Pincode"
                value={editing ? (formData.personalInfo?.address?.permanent?.pincode || '') : (profile.personalInfo?.address?.permanent?.pincode || '')}
                onChange={(e) => setFormData({
                  ...formData,
                  personalInfo: {
                    ...formData.personalInfo,
                    address: {
                      ...formData.personalInfo?.address,
                      permanent: {
                        ...formData.personalInfo?.address?.permanent,
                        pincode: e.target.value
                      }
                    }
                  }
                })}
                disabled={!editing}
                className="input"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Present Address</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Street"
                value={editing ? (formData.personalInfo?.address?.present?.street || '') : (profile.personalInfo?.address?.present?.street || '')}
                onChange={(e) => setFormData({
                  ...formData,
                  personalInfo: {
                    ...formData.personalInfo,
                    address: {
                      ...formData.personalInfo?.address,
                      present: {
                        ...formData.personalInfo?.address?.present,
                        street: e.target.value
                      }
                    }
                  }
                })}
                disabled={!editing}
                className="input"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={editing ? (formData.personalInfo?.address?.present?.city || '') : (profile.personalInfo?.address?.present?.city || '')}
                  onChange={(e) => setFormData({
                    ...formData,
                    personalInfo: {
                      ...formData.personalInfo,
                      address: {
                        ...formData.personalInfo?.address,
                        present: {
                          ...formData.personalInfo?.address?.present,
                          city: e.target.value
                        }
                      }
                    }
                  })}
                  disabled={!editing}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={editing ? (formData.personalInfo?.address?.present?.state || '') : (profile.personalInfo?.address?.present?.state || '')}
                  onChange={(e) => setFormData({
                    ...formData,
                    personalInfo: {
                      ...formData.personalInfo,
                      address: {
                        ...formData.personalInfo?.address,
                        present: {
                          ...formData.personalInfo?.address?.present,
                          state: e.target.value
                        }
                      }
                    }
                  })}
                  disabled={!editing}
                  className="input"
                />
              </div>
              <input
                type="text"
                placeholder="Pincode"
                value={editing ? (formData.personalInfo?.address?.present?.pincode || '') : (profile.personalInfo?.address?.present?.pincode || '')}
                onChange={(e) => setFormData({
                  ...formData,
                  personalInfo: {
                    ...formData.personalInfo,
                    address: {
                      ...formData.personalInfo?.address,
                      present: {
                        ...formData.personalInfo?.address?.present,
                        pincode: e.target.value
                      }
                    }
                  }
                })}
                disabled={!editing}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onCancel} className="btn btn-secondary">
            <FiX className="mr-2" />
            Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary">
            <FiSave className="mr-2" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}

// ID Proofs Tab Component
const IDProofsTab = ({ profile, formData, setFormData, editing, onSave, onCancel }) => {
  // Helper to get display value (masked if exists, or form value)
  const getDisplayValue = (field, encrypted) => {
    if (!editing) {
      // Show masked value if encrypted
      if (encrypted && encrypted.includes(':')) {
        return field.includes('aadhaar') ? 'XXXX-XXXX-XXXX' : 'XXXXX1234X';
      }
      return encrypted || 'Not provided';
    }
    // In edit mode, show decrypted value for editing (if exists) or empty
    return formData.idProofs?.[field] || '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800">
          <FiAlertCircle className="inline mr-2" />
          ID Proofs will be encrypted and stored securely. These details will be verified by HR.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aadhaar Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editing 
              ? (formData.idProofs?.aadhaar || '') 
              : (formData.idProofs?.aadhaar || profile.idProofs?.aadhaar || '')
            }
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 12);
              setFormData({
                ...formData,
                idProofs: {
                  ...(formData.idProofs || {}),
                  aadhaar: value
                }
              });
            }}
            disabled={false}
            className="input"
            placeholder="Enter 12-digit Aadhaar number"
            maxLength={12}
          />
          {editing && (
            <p className="text-xs text-gray-500 mt-1">
              Format: 12 digits (e.g., 123456789012)
            </p>
          )}
          {!editing && profile.idProofs?.aadhaar && (
            <p className="text-xs text-gray-500 mt-1">Masked for security</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PAN Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editing 
              ? (formData.idProofs?.pan || '') 
              : (formData.idProofs?.pan || profile.idProofs?.pan || '')
            }
            onChange={(e) => {
              const value = e.target.value.toUpperCase().slice(0, 10);
              setFormData({
                ...formData,
                idProofs: {
                  ...(formData.idProofs || {}),
                  pan: value
                }
              });
            }}
            disabled={false}
            className="input"
            placeholder="e.g., ABCDE1234F"
            maxLength={10}
            style={{ textTransform: 'uppercase' }}
          />
          {editing && (
            <p className="text-xs text-gray-500 mt-1">
              Format: ABCDE1234F (5 letters + 4 digits + 1 letter)
            </p>
          )}
          {!editing && profile.idProofs?.pan && (
            <p className="text-xs text-gray-500 mt-1">Masked for security</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Passport Number</label>
          <input
            type="text"
            value={editing 
              ? (formData.idProofs?.passport || '') 
              : (profile.idProofs?.passport || 'Not provided')
            }
            onChange={(e) => setFormData({
              ...formData,
              idProofs: {
                ...(formData.idProofs || {}),
                passport: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            placeholder={editing ? "Enter passport number" : ""}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Driving License</label>
          <input
            type="text"
            value={editing 
              ? (formData.idProofs?.drivingLicense || '') 
              : (profile.idProofs?.drivingLicense || 'Not provided')
            }
            onChange={(e) => setFormData({
              ...formData,
              idProofs: {
                ...(formData.idProofs || {}),
                drivingLicense: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            placeholder={editing ? "Enter driving license number" : ""}
          />
        </div>
      </div>

      {editing && (
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onCancel} className="btn btn-secondary">
            <FiX className="mr-2" />
            Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary">
            <FiSave className="mr-2" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}

// Company Details Tab Component
const CompanyDetailsTab = ({ profile, formData, setFormData, editing, onSave, onCancel }) => {
  const { user } = useAuth()
  const [managers, setManagers] = useState([])
  const [loadingManagers, setLoadingManagers] = useState(false)

  // Fetch managers list for reporting manager dropdown
  useEffect(() => {
    // Fetch managers when component mounts or when editing starts
    // Also fetch when viewing to show current reporting manager name
    fetchManagers()
  }, [editing, profile?._id])

  const fetchManagers = async () => {
    setLoadingManagers(true)
    try {
      // Use dedicated managers endpoint that's accessible by all roles
      const { data: managerList } = await axios.get('/api/employees/managers')
      
      // Exclude the current employee from the list (can't report to themselves)
      const filteredManagers = (managerList || []).filter(manager => 
        manager._id?.toString() !== profile?._id?.toString()
      )
      
      setManagers(filteredManagers)
      console.log('[COMPANY_DETAILS] Fetched managers for reporting manager dropdown:', {
        total: managerList?.length || 0,
        filtered: filteredManagers.length,
        managers: filteredManagers.map(m => ({
          id: m._id,
          name: m.personalInfo?.fullName,
          designation: m.companyDetails?.designation
        }))
      })
    } catch (error) {
      console.error('[COMPANY_DETAILS] Error fetching managers:', error)
      setManagers([])
    } finally {
      setLoadingManagers(false)
    }
  }

  const departments = [
    'Development',
    'Testing',
    'IT',
    'Sales',
    'Digital',
    'Marketing',
    'Human Resources',
    'Finance',
    'Operations',
    'Management',
    'Customer Support',
    'Research & Development',
    'Quality Assurance',
    'Business Development',
    'Product',
    'Design',
    'Content',
    'Legal',
    'General'
  ]

  const designations = [
    'Software Engineer',
    'Senior Software Engineer',
    'Lead Software Engineer',
    'Software Developer',
    'Senior Developer',
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Mobile Developer',
    'DevOps Engineer',
    'QA Engineer',
    'Senior QA Engineer',
    'Test Engineer',
    'QA Lead',
    'Business Analyst',
    'Senior Business Analyst',
    'Product Manager',
    'Senior Product Manager',
    'Project Manager',
    'Senior Project Manager',
    'Scrum Master',
    'Tech Lead',
    'Team Lead',
    'Engineering Manager',
    'Manager',
    'Senior Manager',
    'Assistant Manager',
    'Associate',
    'Senior Associate',
    'Executive',
    'Senior Executive',
    'Analyst',
    'Senior Analyst',
    'Consultant',
    'Senior Consultant',
    'Sales Executive',
    'Sales Manager',
    'Marketing Executive',
    'Marketing Manager',
    'HR Executive',
    'HR Manager',
    'Finance Executive',
    'Finance Manager',
    'Operations Executive',
    'Operations Manager',
    'Designer',
    'Senior Designer',
    'UI/UX Designer',
    'Graphic Designer',
    'Content Writer',
    'Content Manager',
    'Data Analyst',
    'Data Scientist',
    'Database Administrator',
    'System Administrator',
    'Network Engineer',
    'IT Support',
    'Customer Support Executive',
    'Intern',
    'Trainee',
    'Employee',
    'Other'
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            value={editing ? (formData.companyDetails?.department || '') : (profile.companyDetails?.department || '')}
            onChange={(e) => setFormData({
              ...formData,
              companyDetails: {
                ...(formData.companyDetails || {}),
                department: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            required
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Designation <span className="text-red-500">*</span>
          </label>
          <select
            value={editing ? (formData.companyDetails?.designation || '') : (profile.companyDetails?.designation || '')}
            onChange={(e) => setFormData({
              ...formData,
              companyDetails: {
                ...(formData.companyDetails || {}),
                designation: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            required
          >
            <option value="">Select Designation</option>
            {designations.map((designation) => (
              <option key={designation} value={designation}>{designation}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Joining Date</label>
          <input
            type="text"
            value={profile.companyDetails?.joiningDate ? new Date(profile.companyDetails.joiningDate).toLocaleDateString() : '-'}
            disabled
            className="input bg-gray-50"
          />
          {profile.workAnniversary !== null && profile.workAnniversary !== undefined && (
            <p className="text-xs text-gray-500 mt-1">Work Anniversary: {profile.workAnniversary} years</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Joining date is managed by HR</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work Type</label>
          <select
            value={editing ? (formData.companyDetails?.workType || '') : (profile.companyDetails?.workType || '')}
            onChange={(e) => setFormData({
              ...formData,
              companyDetails: {
                ...(formData.companyDetails || {}),
                workType: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
          >
            <option value="">Select Work Type</option>
            <option value="WFH">Work From Home (WFH)</option>
            <option value="WFO">Work From Office (WFO)</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <input
            type="text"
            value={editing ? (formData.companyDetails?.location || '') : (profile.companyDetails?.location || '')}
            onChange={(e) => setFormData({
              ...formData,
              companyDetails: {
                ...(formData.companyDetails || {}),
                location: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            placeholder="e.g., Mumbai, Bangalore, Delhi"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
          <input
            type="text"
            value={profile.companyDetails?.employmentStatus || '-'}
            disabled
            className="input bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">Employment status is managed by HR</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reporting Manager
          </label>
          {editing ? (
            <select
              value={formData.companyDetails?.reportingManager || ''}
              onChange={(e) => setFormData({
                ...formData,
                companyDetails: {
                  ...(formData.companyDetails || {}),
                  reportingManager: e.target.value || undefined
                }
              })}
              disabled={!editing || loadingManagers}
              className="input"
            >
              <option value="">Select Reporting Manager</option>
              {loadingManagers ? (
                <option value="" disabled>Loading managers...</option>
              ) : managers.length > 0 ? (
                managers.map((manager) => (
                  <option key={manager._id} value={manager._id}>
                    {manager.personalInfo?.fullName || manager.employeeId || 'Unknown'} - {manager.companyDetails?.designation || 'Manager'}
                  </option>
                ))
              ) : (
                <option value="" disabled>No managers found</option>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={
                profile.reportingManagerInfo?.fullName || 
                (profile.companyDetails?.reportingManager 
                  ? (() => {
                      // Try to find manager in current managers list
                      const manager = managers.find(m => 
                        m._id?.toString() === profile.companyDetails.reportingManager?.toString() ||
                        profile.companyDetails.reportingManager?.toString() === m._id?.toString()
                      )
                      if (manager) {
                        return manager.personalInfo?.fullName || manager.employeeId || 'Unknown Manager'
                      }
                      return 'Loading manager name...'
                    })()
                  : 'Not assigned')
              }
              disabled
              className="input bg-gray-50"
            />
          )}
          {editing && (
            <p className="text-xs text-gray-500 mt-1">
              Select your reporting manager from the list
            </p>
          )}
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <FiAlertCircle className="inline mr-2" />
          Joining Date and Employment Status are managed by HR and cannot be changed by employees.
        </p>
      </div>

      {editing && (
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onCancel} className="btn btn-secondary">
            <FiX className="mr-2" />
            Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary">
            <FiSave className="mr-2" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}

// Employment Tab Component
const EmploymentTab = ({ profile, formData, setFormData, editing, onSave, onCancel, onUpload, uploading, refreshKey = 0 }) => {
  // Ensure profile and formData exist
  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading employment information...</p>
      </div>
    )
  }

  // Use formData if editing, otherwise use profile - always fallback to profile
  const companies = editing 
    ? (formData?.employmentInfo?.previousCompanies || profile?.employmentInfo?.previousCompanies || [])
    : (profile?.employmentInfo?.previousCompanies || []);

  const addCompany = () => {
    setFormData({
      ...formData,
      employmentInfo: {
        ...(formData.employmentInfo || {}),
        previousCompanies: [
          ...companies,
          { companyName: '', position: '', startDate: '', endDate: '', experience: '', experienceLetter: '', salarySlip: '' }
        ]
      }
    });
  };

  const removeCompany = (index) => {
    const updated = companies.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      employmentInfo: {
        ...(formData.employmentInfo || {}),
        previousCompanies: updated
      }
    });
  };

  const updateCompany = (index, field, value) => {
    const updated = [...companies];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({
      ...formData,
      employmentInfo: {
        ...(formData.employmentInfo || {}),
        previousCompanies: updated
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Previous Companies</h3>
          {editing && (
            <button
              onClick={addCompany}
              className="btn btn-primary text-sm"
            >
              <FiEdit2 className="mr-2" size={16} />
              Add Company
            </button>
          )}
        </div>

        {companies.length > 0 ? (
          <div className="space-y-4">
            {companies.map((company, idx) => {
              // Get document URLs directly from source for reliable display
              const expLetterUrl = editing 
                ? (formData.employmentInfo?.previousCompanies?.[idx]?.experienceLetter || company.experienceLetter || profile.employmentInfo?.previousCompanies?.[idx]?.experienceLetter)
                : (company.experienceLetter || profile.employmentInfo?.previousCompanies?.[idx]?.experienceLetter || formData.employmentInfo?.previousCompanies?.[idx]?.experienceLetter);
              
              const salarySlipUrl = editing 
                ? (formData.employmentInfo?.previousCompanies?.[idx]?.salarySlip || company.salarySlip || profile.employmentInfo?.previousCompanies?.[idx]?.salarySlip)
                : (company.salarySlip || profile.employmentInfo?.previousCompanies?.[idx]?.salarySlip || formData.employmentInfo?.previousCompanies?.[idx]?.salarySlip);
              
              return (
              <div key={`company-${idx}-${refreshKey}-${expLetterUrl || 'no-exp'}-${salarySlipUrl || 'no-slip'}`} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium">Company #{idx + 1}</h4>
                  {editing && (
                    <button
                      onClick={() => removeCompany(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FiX size={20} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                    <input
                      type="text"
                      value={company.companyName || ''}
                      onChange={(e) => updateCompany(idx, 'companyName', e.target.value)}
                      disabled={!editing}
                      className="input"
                      placeholder="Company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                    <input
                      type="text"
                      value={company.position || ''}
                      onChange={(e) => updateCompany(idx, 'position', e.target.value)}
                      disabled={!editing}
                      className="input"
                      placeholder="Your position"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={company.startDate ? new Date(company.startDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateCompany(idx, 'startDate', e.target.value)}
                      disabled={!editing}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={company.endDate ? new Date(company.endDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateCompany(idx, 'endDate', e.target.value)}
                      disabled={!editing}
                      className="input"
                    />
                  </div>
                </div>
                
                {/* Experience Letter and Salary Slip Upload */}
                <div className="mt-4 pt-4 border-t">
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">Supporting Documents</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Experience Letter
                      </label>
                      <div className="space-y-2">
                        {/* Display view option if document exists */}
                        {expLetterUrl ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`http://localhost:5000${expLetterUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-300 rounded-lg hover:bg-green-100 hover:border-green-400 transition-colors text-sm font-medium shadow-sm"
                              title="View Experience Letter Document"
                            >
                              <FiEye size={18} />
                              <span>View Document</span>
                              <FiExternalLink size={14} className="opacity-70" />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No experience letter uploaded</p>
                        )}
                        {editing && (
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-primary-600 hover:text-primary-800 border border-dashed border-primary-300 rounded-lg px-3 py-2 hover:bg-primary-50 transition-colors">
                            <FiUpload size={16} />
                            {expLetterUrl ? 'Replace Experience Letter' : 'Upload Experience Letter'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              onChange={(e) => onUpload(e, null, idx, 'experienceLetter')}
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Salary Slip
                      </label>
                      <div className="space-y-2">
                        {/* Display view option if document exists */}
                        {salarySlipUrl ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`http://localhost:5000${salarySlipUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-300 rounded-lg hover:bg-green-100 hover:border-green-400 transition-colors text-sm font-medium shadow-sm"
                              title="View Salary Slip Document"
                            >
                              <FiEye size={18} />
                              <span>View Document</span>
                              <FiExternalLink size={14} className="opacity-70" />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No salary slip uploaded</p>
                        )}
                        {editing && (
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-primary-600 hover:text-primary-800 border border-dashed border-primary-300 rounded-lg px-3 py-2 hover:bg-primary-50 transition-colors">
                            <FiUpload size={16} />
                            {salarySlipUrl ? 'Replace Salary Slip' : 'Upload Salary Slip'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              onChange={(e) => onUpload(e, null, idx, 'salarySlip')}
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-4">No previous companies recorded</p>
            {editing && (
              <button onClick={addCompany} className="btn btn-primary">
                Add Your First Company
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Previous Salary (Optional)</h3>
        <input
          type="number"
          value={editing 
            ? (formData?.employmentInfo?.previousSalary || '') 
            : (profile?.employmentInfo?.previousSalary || '')
          }
          onChange={(e) => setFormData({
            ...formData,
            employmentInfo: {
              ...formData.employmentInfo,
              previousSalary: e.target.value ? parseFloat(e.target.value) : null
            }
          })}
          disabled={!editing}
          className="input"
          placeholder="Enter previous salary (optional)"
          min="0"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <FiCheckCircle className="inline mr-2" />
          Total Experience: <strong>{profile?.employmentInfo?.totalExperience || 'Will be calculated automatically'}</strong>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Experience is auto-calculated from your previous companies' start and end dates.
        </p>
      </div>

      {profile?.salaryRevisionHistory && profile.salaryRevisionHistory.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Salary Revision History</h3>
          <div className="space-y-3">
            {profile.salaryRevisionHistory.map((revision, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{revision.reason || 'Salary Revision'}</p>
                    <p className="text-sm text-gray-500">
                      {revision.effectiveDate ? new Date(revision.effectiveDate).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Old: ₹{revision.oldSalary?.toLocaleString() || '-'}</p>
                    <p className="text-lg font-semibold text-green-600">
                      New: ₹{revision.newSalary?.toLocaleString() || '-'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onCancel} className="btn btn-secondary">
            <FiX className="mr-2" />
            Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary">
            <FiSave className="mr-2" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}

// Bank Details Tab Component
const BankDetailsTab = ({ profile, formData, setFormData, editing, onSave, onCancel }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
          <input
            type="text"
            value={editing ? (formData.bankDetails?.accountNumber || '') : (profile.bankDetails?.accountNumber || '')}
            onChange={(e) => setFormData({
              ...formData,
              bankDetails: {
                ...(formData.bankDetails || {}),
                accountNumber: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
            placeholder="Enter account number"
          />
          <p className="text-xs text-gray-500 mt-1">Last 4 digits visible for security</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
          <input
            type="text"
            value={editing ? (formData.bankDetails?.ifscCode || '') : (profile.bankDetails?.ifscCode || '')}
            onChange={(e) => setFormData({
              ...formData,
              bankDetails: {
                ...(formData.bankDetails || {}),
                ifscCode: e.target.value.toUpperCase()
              }
            })}
            disabled={!editing}
            className="input"
            placeholder="e.g., SBIN0001234"
            maxLength={11}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
          <input
            type="text"
            value={editing ? (formData.bankDetails?.bankName || '') : (profile.bankDetails?.bankName || '')}
            onChange={(e) => setFormData({
              ...formData,
              bankDetails: {
                ...(formData.bankDetails || {}),
                bankName: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name</label>
          <input
            type="text"
            value={editing ? (formData.bankDetails?.branchName || '') : (profile.bankDetails?.branchName || '')}
            onChange={(e) => setFormData({
              ...formData,
              bankDetails: {
                ...(formData.bankDetails || {}),
                branchName: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
          <input
            type="text"
            value={editing ? (formData.bankDetails?.accountHolderName || '') : (profile.bankDetails?.accountHolderName || '')}
            onChange={(e) => setFormData({
              ...formData,
              bankDetails: {
                ...(formData.bankDetails || {}),
                accountHolderName: e.target.value
              }
            })}
            disabled={!editing}
            className="input"
          />
        </div>
      </div>

      {editing && (
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onCancel} className="btn btn-secondary">
            <FiX className="mr-2" />
            Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary">
            <FiSave className="mr-2" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}

// Documents Tab Component
const DocumentsTab = ({ profile, onUpload, uploading, isViewOnly = false, userRole, onVerifyDocument, onRejectDocument }) => {
  const documentTypes = ['Resume', 'Aadhaar', 'PAN', 'Photo', 'Passport', 'Driving License', 'NOC', 'Experience Certificate', 'Bank Details', 'Other']
  const [rejectingDocIndex, setRejectingDocIndex] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const handleRejectClick = (docIndex) => {
    setRejectingDocIndex(docIndex)
    setRejectionReason('')
  }

  const handleRejectSubmit = (docIndex) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    if (onRejectDocument) {
      onRejectDocument(docIndex, rejectionReason)
    }
    setRejectingDocIndex(null)
    setRejectionReason('')
  }

  const handleRejectCancel = () => {
    setRejectingDocIndex(null)
    setRejectionReason('')
  }

  return (
    <div className="space-y-6">
      {/* Upload section - only show if not in view-only mode */}
      {!isViewOnly && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {documentTypes.map((type) => (
              <label
                key={type}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-colors"
              >
                <FiUpload className="text-gray-400 mb-2" size={24} />
                <span className="text-sm text-center">{type}</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => onUpload && onUpload(e, type)}
                  disabled={uploading}
                />
              </label>
            ))}
          </div>
          {uploading && (
            <div className="mt-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Uploading...</p>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">
          {isViewOnly ? 'Employee Documents' : 'Uploaded Documents'}
        </h3>
        {profile?.documents && profile.documents.length > 0 ? (
          <div className="space-y-3">
            {profile.documents.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  <FiFileText className="text-gray-400" size={24} />
                  <div className="flex-1">
                    <p className="font-medium">{doc.type}</p>
                    <p className="text-sm text-gray-500">
                      Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '-'}
                    </p>
                    {doc.verifiedBy && (
                      <p className="text-xs text-gray-400 mt-1">
                        Verified by: {doc.verifiedBy?.email || 'HR'} on {doc.verifiedAt ? new Date(doc.verifiedAt).toLocaleDateString() : '-'}
                      </p>
                    )}
                    {doc.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">
                        Rejection reason: {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'Verified'
                      ? 'bg-green-100 text-green-800'
                      : doc.status === 'Rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {doc.status || 'Pending'}
                  </span>
                  {doc.url && (
                    <a
                      href={`http://localhost:5000${doc.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 flex items-center"
                      title="View Document"
                    >
                      <FiEye className="mr-1" size={18} />
                      View
                    </a>
                  )}
                  {/* Verification buttons for HR in view-only mode */}
                  {isViewOnly && userRole === 'hr' && doc.status === 'Pending' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onVerifyDocument && onVerifyDocument(idx)}
                        className="btn bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 flex items-center"
                        title="Verify Document"
                      >
                        <FiCheck className="mr-1" size={16} />
                        Verify
                      </button>
                      {rejectingDocIndex === idx ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Rejection reason"
                            className="input text-sm w-48"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleRejectSubmit(idx)
                              }
                            }}
                          />
                          <button
                            onClick={() => handleRejectSubmit(idx)}
                            className="btn bg-red-600 hover:bg-red-700 text-white text-sm px-2 py-1"
                          >
                            Submit
                          </button>
                          <button
                            onClick={handleRejectCancel}
                            className="btn btn-secondary text-sm px-2 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRejectClick(idx)}
                          className="btn bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 flex items-center"
                          title="Reject Document"
                        >
                          <FiXCircle className="mr-1" size={16} />
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No documents uploaded</p>
        )}
      </div>
    </div>
  )
}

// Timeline Tab Component
const TimelineTab = ({ timeline }) => {
  return (
    <div className="space-y-4">
      {timeline && timeline.length > 0 ? (
        <div className="relative">
          {timeline.map((item, idx) => (
            <div key={idx} className="flex items-start space-x-4 pb-6 last:pb-0">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  {item.type === 'activity' ? (
                    <FiEdit2 className="text-primary-600" />
                  ) : (
                    <FiTrendingUp className="text-primary-600" />
                  )}
                </div>
                {idx < timeline.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 ml-5 -mt-2"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium">{item.action || item.stage}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(item.updatedAt || item.date).toLocaleDateString()}
                    </p>
                  </div>
                  {item.field && (
                    <p className="text-sm text-gray-600">Field: {item.field}</p>
                  )}
                  {item.comments && (
                    <p className="text-sm text-gray-600 mt-2">{item.comments}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No activity timeline available</p>
      )}
    </div>
  )
}

export default HRProfile

