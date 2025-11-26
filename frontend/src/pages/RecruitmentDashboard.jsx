import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import RecruitmentATS from './RecruitmentATS'
import InterviewScheduling from './InterviewScheduling'
import OfferManagement from './OfferManagement'
import EmployeeLifecycle from './EmployeeLifecycle'
import {
  FiBriefcase,
  FiUsers,
  FiCalendar,
  FiFileText,
  FiTrendingUp,
  FiCheckCircle,
  FiX
} from 'react-icons/fi'

const RecruitmentDashboard = () => {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(() => {
    // Determine active tab based on current route
    if (location.pathname.includes('/interviews')) return 'interviews'
    if (location.pathname.includes('/offers')) return 'offers'
    if (location.pathname.includes('/lifecycle')) return 'lifecycle'
    if (location.pathname.includes('/onboarding')) return 'onboarding'
    return 'ats' // Default to ATS
  })

  // Update active tab when route changes
  useEffect(() => {
    if (location.pathname.includes('/interviews')) {
      setActiveTab('interviews')
    } else if (location.pathname.includes('/offers')) {
      setActiveTab('offers')
    } else if (location.pathname.includes('/lifecycle')) {
      setActiveTab('lifecycle')
    } else if (location.pathname.includes('/onboarding')) {
      setActiveTab('onboarding')
    } else {
      setActiveTab('ats')
    }
  }, [location.pathname])

  const tabs = [
    { id: 'ats', name: 'Application Tracking', icon: FiUsers, path: '/recruitment/ats' },
    { id: 'interviews', name: 'Interview Scheduling', icon: FiCalendar, path: '/recruitment/interviews' },
    { id: 'offers', name: 'Offer Management', icon: FiFileText, path: '/recruitment/offers' },
    { id: 'lifecycle', name: 'Employee Lifecycle', icon: FiTrendingUp, path: '/recruitment/lifecycle' }
  ]

  const handleTabChange = (tab) => {
    setActiveTab(tab.id)
    navigate(tab.path)
  }

  if (user?.role !== 'hr' && user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">You don't have permission to access this page</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recruitment Management</h1>
          <p className="mt-2 text-gray-600">Complete recruitment and employee lifecycle management</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="mr-2" size={20} />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'ats' && <RecruitmentATS />}
          {activeTab === 'interviews' && <InterviewScheduling />}
          {activeTab === 'offers' && <OfferManagement />}
          {activeTab === 'lifecycle' && <EmployeeLifecycle />}
        </div>
      </div>
    </div>
  )
}

export default RecruitmentDashboard

