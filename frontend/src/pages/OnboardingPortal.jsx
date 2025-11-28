import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  FiUpload,
  FiCheckCircle,
  FiXCircle,
  FiFileText,
  FiClock,
  FiUser
} from 'react-icons/fi'
import { format } from 'date-fns'

const OnboardingPortal = () => {
  const { linkId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [onboarding, setOnboarding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})

  useEffect(() => {
    fetchOnboarding()
  }, [linkId])

  const fetchOnboarding = async () => {
    try {
      const { data } = await axios.get(`/api/recruitment/onboarding/${linkId}`)
      setOnboarding(data)
    } catch (error) {
      console.error('Error fetching onboarding:', error)
      toast.error('Failed to load onboarding details')
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentUpload = async (documentName, file) => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setUploading({ ...uploading, [documentName]: true })
    try {
      const formData = new FormData()
      formData.append('document', file)
      formData.append('documentName', documentName)

      const { data } = await axios.post(
        `/api/recruitment/onboarding/${onboarding._id}/upload-document`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setOnboarding(data)
      toast.success('Document uploaded successfully')
    } catch (error) {
      console.error('Error uploading document:', error)
      toast.error('Failed to upload document')
    } finally {
      setUploading({ ...uploading, [documentName]: false })
    }
  }

  const requiredDocuments = [
    'Aadhaar',
    'PAN',
    'Address Proof',
    'Bank Details',
    'Education Certificate',
    'Experience Letter',
    'Photo',
    'Resume'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!onboarding) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Onboarding not found</p>
      </div>
    )
  }

  const uploadedDocs = onboarding.documents || []
  const uploadedDocNames = uploadedDocs.map(d => d.name)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Onboarding!</h1>
        <p className="text-gray-600">
          Dear {onboarding.candidateName}, please complete the onboarding process by uploading the required documents.
        </p>
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <FiClock className="mr-2" size={16} />
          <span>Joining Date: {format(new Date(onboarding.joiningDate), 'MMM dd, yyyy')}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Onboarding Progress</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Documents Uploaded</span>
            <span className={`text-sm font-medium ${
              onboarding.checklist?.documentsUploaded ? 'text-green-600' : 'text-gray-400'
            }`}>
              {onboarding.checklist?.documentsUploaded ? (
                <FiCheckCircle size={20} />
              ) : (
                <FiXCircle size={20} />
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Documents Verified</span>
            <span className={`text-sm font-medium ${
              onboarding.checklist?.documentsVerified ? 'text-green-600' : 'text-gray-400'
            }`}>
              {onboarding.checklist?.documentsVerified ? (
                <FiCheckCircle size={20} />
              ) : (
                <FiXCircle size={20} />
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Profile Created</span>
            <span className={`text-sm font-medium ${
              onboarding.checklist?.profileCreated ? 'text-green-600' : 'text-gray-400'
            }`}>
              {onboarding.checklist?.profileCreated ? (
                <FiCheckCircle size={20} />
              ) : (
                <FiXCircle size={20} />
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Documents Upload */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Required Documents</h2>
        <div className="space-y-4">
          {requiredDocuments.map(docName => {
            const existingDoc = uploadedDocs.find(d => d.name === docName)
            const isUploading = uploading[docName]

            return (
              <div key={docName} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <FiFileText className="mr-2 text-gray-400" size={20} />
                    <span className="font-medium text-gray-900">{docName}</span>
                    {existingDoc && (
                      <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                        existingDoc.status === 'Verified' ? 'bg-green-100 text-green-800' :
                        existingDoc.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {existingDoc.status}
                      </span>
                    )}
                  </div>
                  {existingDoc?.documentUrl && (
                    <a
                      href={existingDoc.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      View
                    </a>
                  )}
                </div>

                {existingDoc?.rejectionReason && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    Rejection Reason: {existingDoc.rejectionReason}
                  </div>
                )}

                {!existingDoc || existingDoc.status === 'Rejected' ? (
                  <div>
                    <label className="flex items-center px-4 py-2 bg-primary-50 text-primary-700 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors inline-block">
                      <FiUpload className="mr-2" size={20} />
                      {isUploading ? 'Uploading...' : existingDoc ? 'Re-upload' : 'Upload'}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handleDocumentUpload(docName, e.target.files[0])
                          }
                        }}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    Uploaded on {format(new Date(existingDoc.uploadedAt), 'MMM dd, yyyy')}
                    {existingDoc.verifiedAt && (
                      <span className="ml-2">
                        • Verified on {format(new Date(existingDoc.verifiedAt), 'MMM dd, yyyy')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Current Status</h2>
        <p className="text-gray-600">{onboarding.onboardingStatus}</p>
      </div>
    </div>
  )
}

export default OnboardingPortal








