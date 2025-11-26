import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiXCircle, FiLoader, FiFileText, FiMail } from 'react-icons/fi'
import { format } from 'date-fns'

const OfferResponse = () => {
  const { applicationId, action } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [application, setApplication] = useState(null)
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    if (applicationId && email) {
      fetchApplication()
    } else {
      setLoading(false)
    }
  }, [applicationId, email])

  const fetchApplication = async () => {
    try {
      const { data } = await axios.get(`/api/recruitment/applications/${applicationId}`)
      setApplication(data)
    } catch (error) {
      console.error('Error fetching application:', error)
      toast.error('Failed to load offer details')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!email) {
      toast.error('Email is required')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await axios.post(`/api/recruitment/applications/${applicationId}/accept-offer`, {
        candidateEmail: email
      })
      toast.success('Offer accepted successfully! We look forward to working with you.')
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (error) {
      console.error('Error accepting offer:', error)
      toast.error(error.response?.data?.message || 'Failed to accept offer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!email) {
      toast.error('Email is required')
      return
    }

    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejecting the offer')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await axios.post(`/api/recruitment/applications/${applicationId}/reject-offer`, {
        candidateEmail: email,
        reason: rejectReason
      })
      toast.success('Offer rejection recorded. Thank you for your response.')
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (error) {
      console.error('Error rejecting offer:', error)
      toast.error(error.response?.data?.message || 'Failed to reject offer')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FiLoader className="animate-spin mx-auto text-primary-600" size={48} />
          <p className="mt-4 text-gray-600">Loading offer details...</p>
        </div>
      </div>
    )
  }

  if (!application || !application.offerLetter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <FiXCircle className="mx-auto text-red-500" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mt-4">Offer Not Found</h2>
          <p className="text-gray-600 mt-2">The offer letter you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    )
  }

  const offer = application.offerLetter
  const isExpired = offer.expiryDate && new Date(offer.expiryDate) < new Date()
  const isAccepted = offer.status === 'Accepted'
  const isRejected = offer.status === 'Rejected'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Job Offer Letter</h1>
                <p className="mt-2 text-primary-100">Review and respond to your job offer</p>
              </div>
              {isAccepted && <FiCheckCircle className="text-green-300" size={48} />}
              {isRejected && <FiXCircle className="text-red-300" size={48} />}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-lg text-gray-700">
                Dear <strong>{offer.candidateName}</strong>,
              </p>
              <p className="text-gray-600 mt-2">
                Congratulations! We are delighted to extend a job offer to you for the position of{' '}
                <strong>{offer.jobTitle}</strong>.
              </p>
            </div>

            {/* Offer Details */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Offer Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Position</p>
                  <p className="font-semibold text-gray-900">{offer.jobTitle}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Department</p>
                  <p className="font-semibold text-gray-900">{offer.department || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Salary (CTC)</p>
                  <p className="font-semibold text-gray-900">₹{offer.salary?.toLocaleString('en-IN') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Joining Date</p>
                  <p className="font-semibold text-gray-900">
                    {offer.joiningDate ? format(new Date(offer.joiningDate), 'MMMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Work Type</p>
                  <p className="font-semibold text-gray-900">{offer.workType || 'WFO'}</p>
                </div>
                {offer.workLocation && (
                  <div>
                    <p className="text-sm text-gray-600">Work Location</p>
                    <p className="font-semibold text-gray-900">{offer.workLocation}</p>
                  </div>
                )}
                {offer.probationPeriod && (
                  <div>
                    <p className="text-sm text-gray-600">Probation Period</p>
                    <p className="font-semibold text-gray-900">{offer.probationPeriod}</p>
                  </div>
                )}
                {offer.noticePeriod && (
                  <div>
                    <p className="text-sm text-gray-600">Notice Period</p>
                    <p className="font-semibold text-gray-900">{offer.noticePeriod}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Expiry Notice */}
            {offer.expiryDate && (
              <div className={`rounded-lg p-4 mb-6 ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`font-semibold ${isExpired ? 'text-red-800' : 'text-yellow-800'}`}>
                  {isExpired ? '⚠️ Offer Expired' : '⏰ Important'}
                </p>
                <p className={`text-sm mt-1 ${isExpired ? 'text-red-700' : 'text-yellow-700'}`}>
                  This offer {isExpired ? 'expired on' : 'expires on'}{' '}
                  <strong>{format(new Date(offer.expiryDate), 'MMMM dd, yyyy')}</strong>.
                </p>
              </div>
            )}

            {/* Additional Terms */}
            {offer.additionalTerms && (
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Additional Terms</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{offer.additionalTerms}</p>
              </div>
            )}

            {/* Status Messages */}
            {isAccepted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <div className="flex items-center">
                  <FiCheckCircle className="text-green-600 mr-3" size={24} />
                  <div>
                    <p className="font-semibold text-green-900">Offer Accepted</p>
                    <p className="text-sm text-green-700 mt-1">
                      You have accepted this offer. Our HR team will contact you shortly for the next steps.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isRejected && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <div className="flex items-center">
                  <FiXCircle className="text-red-600 mr-3" size={24} />
                  <div>
                    <p className="font-semibold text-red-900">Offer Rejected</p>
                    <p className="text-sm text-red-700 mt-1">
                      You have rejected this offer. Thank you for your response.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isAccepted && !isRejected && !isExpired && action === 'accept' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiMail className="inline mr-2" />
                    Confirm Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your email address"
                  />
                </div>
                <button
                  onClick={handleAccept}
                  disabled={submitting || !email}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="mr-2" size={20} />
                      Accept Offer
                    </>
                  )}
                </button>
              </div>
            )}

            {!isAccepted && !isRejected && !isExpired && action === 'reject' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiMail className="inline mr-2" />
                    Confirm Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 mb-4"
                    placeholder="Enter your email address"
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Rejection (Optional)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Please provide a reason for rejecting this offer..."
                  />
                </div>
                <button
                  onClick={handleReject}
                  disabled={submitting || !email}
                  className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiXCircle className="mr-2" size={20} />
                      Reject Offer
                    </>
                  )}
                </button>
              </div>
            )}

            {/* View Offer Letter */}
            {offer.documentUrl && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <a
                  href={`http://localhost:5000${offer.documentUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
                >
                  <FiFileText className="mr-2" size={20} />
                  View/Download Offer Letter PDF
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OfferResponse

