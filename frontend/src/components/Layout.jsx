import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  FiHome,
  FiUsers,
  FiUser,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiMessageSquare,
  FiAlertCircle,
  FiLogOut,
  FiMenu,
  FiX,
  FiBriefcase
} from 'react-icons/fi'
import { useState } from 'react'

const Layout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', path: '/', icon: FiHome, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Employees', path: '/employees', icon: FiUsers, roles: ['manager', 'hr', 'admin'] },
    { name: 'Recruitment', path: '/recruitment/ats', icon: FiBriefcase, roles: ['hr', 'admin', 'manager'] },
    { name: 'My Profile', path: user?.role === 'hr' ? '/hr-profile' : '/profile', icon: FiUser, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Attendance', path: '/attendance', icon: FiClock, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Leaves', path: '/leaves', icon: FiCalendar, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Payroll', path: '/payroll', icon: FiDollarSign, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Performance', path: '/performance', icon: FiTrendingUp, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Engagement', path: '/engagement', icon: FiMessageSquare, roles: ['employee', 'manager', 'hr', 'admin'] },
    { name: 'Grievances', path: '/grievances', icon: FiAlertCircle, roles: ['employee', 'manager', 'hr', 'admin'] },
  ].filter(item => item.roles.includes(user?.role))

  const isActive = (path) => {
    // Special handling for recruitment routes - match any recruitment sub-route
    if (path === '/recruitment/ats') {
      return location.pathname.startsWith('/recruitment')
    }
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 sm:w-72 bg-white shadow-xl max-w-[85vw]">
          <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 border-b">
            <h1 className="text-lg sm:text-xl font-bold text-primary-600">HRMS</h1>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="text-gray-500 p-2 -mr-2"
              aria-label="Close menu"
            >
              <FiX size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
          <nav className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium rounded-lg transition-colors min-h-[44px] ${
                    isActive(item.path)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  <Icon className="mr-2 sm:mr-3 flex-shrink-0" size={18} />
                  <span className="truncate">{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b">
            <h1 className="text-xl font-bold text-primary-600">HRMS</h1>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="mr-3" size={20} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <FiLogOut className="mr-3" size={20} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 p-2 -ml-2"
            aria-label="Open menu"
          >
            <FiMenu size={20} className="sm:w-6 sm:h-6" />
          </button>
          <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
            <div className="text-right hidden xs:block">
              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">{user?.email}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="lg:hidden p-2 text-gray-500 hover:text-red-600"
              aria-label="Logout"
            >
              <FiLogOut size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Page content */}
        <main className="p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout

