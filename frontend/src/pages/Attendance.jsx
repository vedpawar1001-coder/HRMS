import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiClock, FiMapPin, FiAlertCircle, FiCheckCircle, FiXCircle, FiUsers, FiCalendar, FiTrendingUp, FiBarChart2 } from 'react-icons/fi'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

// Component to convert coordinates to location name for old records
const LocationConverter = ({ coordinates }) => {
  const [locationName, setLocationName] = useState(null)
  const [converting, setConverting] = useState(true)
  
  useEffect(() => {
    const convertLocation = async () => {
      if (!coordinates?.latitude || !coordinates?.longitude) {
        setConverting(false)
        return
      }
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json&addressdetails=1&zoom=18&namedetails=1`,
          {
            headers: {
              'User-Agent': 'HRMS-App/1.0'
            }
          }
        )
        const data = await response.json()
        
        if (data && data.address) {
          const addr = data.address
          const locationParts = []
          
          // Use same logic as backend geocoding
          const isWrongArea = (str) => str && /shivajinagar|pune district|district/i.test(str.toLowerCase())
          const hasLocationKeyword = (str) => str && /naghegaon|narhegaon|navle|bridge|gaon|nagar|wadi/i.test(str.toLowerCase())
          
          // Parse display_name first
          if (data.display_name) {
            const displayParts = data.display_name.split(',').map(p => p.trim())
            for (let i = 0; i < Math.min(displayParts.length, 5); i++) {
              const part = displayParts[i]
              const isGeneric = part.match(/^(Pune|Maharashtra|India|PIN|District|Pune District)$/i)
              if (!isWrongArea(part) && !isGeneric && part.length > 2) {
                if (hasLocationKeyword(part) || locationParts.length === 0) {
                  locationParts.push(part)
                  if (hasLocationKeyword(part)) break
                }
              }
            }
          }
          
          // Add from address components
          if (locationParts.length === 0 || !hasLocationKeyword(locationParts.join(' '))) {
            if (addr.quarter && !isWrongArea(addr.quarter)) locationParts.unshift(addr.quarter)
            else if (addr.neighbourhood && !isWrongArea(addr.neighbourhood)) locationParts.unshift(addr.neighbourhood)
            else if (addr.suburb && !isWrongArea(addr.suburb)) locationParts.unshift(addr.suburb)
            else if (addr.village && !isWrongArea(addr.village)) locationParts.unshift(addr.village)
          }
          
          // Add road/landmark
          if (addr.road && (addr.road.toLowerCase().includes('bridge') || hasLocationKeyword(addr.road))) {
            if (!locationParts.includes(addr.road)) locationParts.unshift(addr.road)
          }
          
          // Add city
          const cityName = addr.city || addr.town
          if (cityName && !isWrongArea(cityName) && locationParts.length > 0 && !locationParts.includes(cityName)) {
            locationParts.push(cityName)
          }
          
          if (locationParts.length > 0) {
            setLocationName(locationParts.join(', '))
          }
        }
      } catch (error) {
        console.error('Error converting location:', error)
      } finally {
        setConverting(false)
      }
    }
    
    convertLocation()
  }, [coordinates])
  
  if (converting) {
    return (
      <p className="text-xs text-gray-500">
        <FiMapPin size={12} className="inline mr-1" />
        Converting location...
      </p>
    )
  }
  
  if (locationName) {
    return (
      <p className="text-xs text-gray-500">
        <FiMapPin size={12} className="inline mr-1" />
        {locationName}
      </p>
    )
  }
  
  // Fallback to coordinates
  return (
    <p className="text-xs text-gray-500">
      <FiMapPin size={12} className="inline mr-1" />
      {coordinates?.latitude?.toFixed(4)}, {coordinates?.longitude?.toFixed(4)}
    </p>
  )
}

const Attendance = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attendance, setAttendance] = useState([])
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [showEarlyExitModal, setShowEarlyExitModal] = useState(false)
  const [punchOutTime, setPunchOutTime] = useState(null)
  
  // Manager-specific state
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null) // null = own attendance
  const [viewingOwnAttendance, setViewingOwnAttendance] = useState(true)
  
  // HR-specific state (same as manager but for all employees)
  const [allEmployees, setAllEmployees] = useState([]) // For HR to view all employees
  
  // Admin-specific state for daily attendance overview
  const [dailyStats, setDailyStats] = useState(null)
  const [dailyAttendance, setDailyAttendance] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loadingDailyStats, setLoadingDailyStats] = useState(false)
  
  // Admin-specific state for monthly attendance view
  const [monthlyView, setMonthlyView] = useState(false) // Toggle between daily and monthly view
  const [selectedEmployeeForMonthly, setSelectedEmployeeForMonthly] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [monthlyAttendance, setMonthlyAttendance] = useState(null)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  
  // Employee-specific state for monthly attendance view
  const [employeeMonthlyView, setEmployeeMonthlyView] = useState(false) // Toggle for employees
  const [employeeSelectedMonth, setEmployeeSelectedMonth] = useState(new Date().getMonth() + 1)
  const [employeeSelectedYear, setEmployeeSelectedYear] = useState(new Date().getFullYear())
  const [employeeMonthlyAttendance, setEmployeeMonthlyAttendance] = useState(null)
  const [loadingEmployeeMonthly, setLoadingEmployeeMonthly] = useState(false)

  // Admin: Fetch daily attendance statistics for all employees
  const fetchDailyStats = async () => {
    if (user?.role !== 'admin') return
    
    setLoadingDailyStats(true)
    try {
      const { data } = await axios.get('/api/attendance/daily-stats', {
        params: { date: selectedDate }
      })
      setDailyStats(data.stats)
      setDailyAttendance(data.dailyAttendance || [])
    } catch (error) {
      console.error('Error fetching daily stats:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = error.response?.data?.message || 'Failed to load daily attendance statistics'
      toast.error(errorMessage)
      setDailyStats(null)
      setDailyAttendance([])
    } finally {
      setLoadingDailyStats(false)
    }
  }

  // Employee: Fetch own monthly attendance
  const fetchEmployeeMonthlyAttendance = async () => {
    if (user?.role !== 'employee') {
      console.log('[EMPLOYEE-MONTHLY] Not an employee, skipping fetch')
      return
    }
    
    if (!employeeSelectedMonth || !employeeSelectedYear) {
      toast.error('Please select both month and year')
      return
    }
    
    console.log('[EMPLOYEE-MONTHLY] Fetching monthly attendance:', { month: employeeSelectedMonth, year: employeeSelectedYear })
    setLoadingEmployeeMonthly(true)
    try {
      const { data } = await axios.get('/api/attendance/monthly/my-attendance', {
        params: { month: employeeSelectedMonth, year: employeeSelectedYear }
      })
      console.log('[EMPLOYEE-MONTHLY] Received data:', data)
      
      if (data && data.stats && data.employee && data.calendarData) {
        setEmployeeMonthlyAttendance(data)
        toast.success('Monthly attendance loaded successfully')
      } else {
        console.error('[EMPLOYEE-MONTHLY] Invalid data structure:', data)
        toast.error('Invalid data received from server')
        setEmployeeMonthlyAttendance(null)
      }
    } catch (error) {
      console.error('Error fetching employee monthly attendance:', error)
      console.error('Error response:', error.response?.data)
      toast.error(error.response?.data?.message || 'Failed to load monthly attendance')
      setEmployeeMonthlyAttendance(null)
    } finally {
      setLoadingEmployeeMonthly(false)
    }
  }

  // Admin/HR/Manager: Fetch monthly attendance for a specific employee
  const fetchMonthlyAttendance = async () => {
    if ((user?.role !== 'admin' && user?.role !== 'hr' && user?.role !== 'manager') || !selectedEmployeeForMonthly) return
    
    setLoadingMonthly(true)
    try {
      const { data } = await axios.get(`/api/attendance/monthly/${selectedEmployeeForMonthly}`, {
        params: { month: selectedMonth, year: selectedYear }
      })
      setMonthlyAttendance(data)
    } catch (error) {
      console.error('Error fetching monthly attendance:', error)
      toast.error(error.response?.data?.message || 'Failed to load monthly attendance')
      setMonthlyAttendance(null)
    } finally {
      setLoadingMonthly(false)
    }
  }

  useEffect(() => {
    // For managers, fetch team members and all employees (for dropdown - managers can view any employee's attendance)
    if (user?.role === 'manager') {
      fetchTeamMembers()
      fetchAllEmployees()
    }
    
    // For HR and Admin, fetch all employees (for dropdown)
    if (user?.role === 'hr' || user?.role === 'admin') {
      fetchAllEmployees()
    }
    
    // For employees and managers/HR viewing their own attendance
    if (user?.role === 'employee' || 
        (user?.role === 'manager' && viewingOwnAttendance && !selectedEmployeeId) ||
        (user?.role === 'hr' && viewingOwnAttendance && !selectedEmployeeId)) {
      fetchTodayAttendance()
      fetchAttendance() // This will fetch only their own attendance
      getLocation()
      
      // Refresh attendance every minute
      const interval = setInterval(() => {
        fetchTodayAttendance()
      }, 60000)
      
      return () => clearInterval(interval)
    }
    
    // For managers viewing employee attendance
    if (user?.role === 'manager' && selectedEmployeeId) {
      fetchEmployeeAttendance(selectedEmployeeId)
      fetchAttendance() // This will fetch only the selected employee's attendance
    }
    
    // For HR viewing employee attendance
    if (user?.role === 'hr' && selectedEmployeeId) {
      fetchEmployeeAttendance(selectedEmployeeId)
      fetchAttendance() // This will fetch only the selected employee's attendance
    }
    
    // For Admin, HR, and Manager viewing all employees or specific employee attendance
    if (user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager') {
      if (selectedEmployeeId) {
        fetchEmployeeAttendance(selectedEmployeeId)
        fetchAttendance() // This will fetch specific employee's attendance
      } else if (!monthlyView) {
        // Admin viewing all employees - fetch daily stats (only if not in monthly view)
        if (user?.role === 'admin') {
          fetchDailyStats()
        }
      }
    }
  }, [user, selectedEmployeeId, viewingOwnAttendance, selectedDate, monthlyView])

  const fetchTeamMembers = async () => {
    try {
      const { data } = await axios.get('/api/employees')
      setTeamMembers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  // HR: Fetch all employees
  const fetchAllEmployees = async () => {
    try {
      const { data } = await axios.get('/api/employees')
      setAllEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching all employees:', error)
    }
  }

  const fetchTeamMemberAttendance = async (employeeId) => {
    try {
      // Fetch today's attendance for the selected team member using query parameter
      const { data } = await axios.get('/api/attendance/today', {
        params: { employeeId: employeeId }
      })
      setTodayAttendance(data)
    } catch (error) {
      console.error('Error fetching team member attendance:', error)
      setTodayAttendance(null)
    }
  }

  // HR/Admin: Fetch employee attendance (same as manager's fetchTeamMemberAttendance)
  const fetchEmployeeAttendance = async (employeeId) => {
    try {
      // Fetch today's attendance for the selected employee using query parameter
      const { data } = await axios.get('/api/attendance/today', {
        params: { employeeId: employeeId }
      })
      setTodayAttendance(data)
    } catch (error) {
      console.error('Error fetching employee attendance:', error)
      setTodayAttendance(null)
    }
  }

  const getLocation = () => {
    setFetchingLocation(true)
    setLocationError(null)
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
          
          // Try to get specific location name from coordinates using reverse geocoding
          let locationName = null
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&addressdetails=1&zoom=18&namedetails=1`,
              {
                headers: {
                  'User-Agent': 'HRMS-App/1.0'
                }
              }
            )
            const data = await response.json()
            
            if (data && data.address) {
              const addr = data.address
              console.log('[FRONTEND_GEOCODING] Address data:', addr)
              const locationParts = []
              
              // Priority: Most specific location first
              // Check quarter, neighbourhood, suburb (smallest areas first)
              if (addr.quarter) {
                locationParts.push(addr.quarter)
              } else if (addr.neighbourhood) {
                locationParts.push(addr.neighbourhood)
              } else if (addr.suburb) {
                locationParts.push(addr.suburb)
              } else if (addr.residential) {
                locationParts.push(addr.residential)
              } else if (addr.village) {
                locationParts.push(addr.village)
              } else if (addr.locality) {
                locationParts.push(addr.locality)
              }
              
              // Add road/landmark if available (bridges, major roads)
              if (addr.road) {
                const roadName = addr.road
                // Include road for landmarks or if no specific area found
                if (roadName.toLowerCase().includes('bridge') || 
                    roadName.toLowerCase().includes('road') ||
                    roadName.toLowerCase().includes('street') ||
                    roadName.toLowerCase().includes('nagar') ||
                    roadName.toLowerCase().includes('gaon') ||
                    roadName.toLowerCase().includes('wadi') ||
                    locationParts.length === 0) {
                  if (!locationParts.includes(roadName)) {
                    locationParts.push(roadName)
                  }
                }
              }
              
              // If still no specific location, try parsing display_name
              if (locationParts.length === 0 && data.display_name) {
                const parts = data.display_name.split(',').map(p => p.trim())
                // Extract first meaningful part (most specific)
                for (let i = 0; i < Math.min(3, parts.length); i++) {
                  const part = parts[i]
                  if (!part.match(/^(Pune|Maharashtra|India|PIN|District)$/i)) {
                    locationParts.push(part)
                    break
                  }
                }
              }
              
              // Add city for context only if we have a specific location
              const cityName = addr.city || addr.town || addr.county
              if (cityName && !locationParts.includes(cityName) && locationParts.length > 0) {
                locationParts.push(cityName)
              }
              
              if (locationParts.length > 0) {
                locationName = locationParts.join(', ')
                console.log('[FRONTEND_GEOCODING] Resolved:', locationName)
              } else if (data.display_name) {
                // Fallback to display_name
                const parts = data.display_name.split(',').map(p => p.trim())
                const meaningfulParts = parts.filter(p => 
                  !p.match(/^(Maharashtra|India|District)$/i)
                ).slice(0, 2)
                if (meaningfulParts.length > 0) {
                  locationName = meaningfulParts.join(', ')
                }
              }
            }
          } catch (error) {
            console.error('Error getting location name:', error)
          }
          
          setLocation({
            ...coords,
            cityName: locationName || `Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
          })
          setFetchingLocation(false)
          toast.success(locationName ? `Location captured: ${locationName}` : 'Location captured successfully')
        },
        (error) => {
          console.error('Error getting location:', error)
          setLocationError('Unable to get your location. Please enable location access.')
          setFetchingLocation(false)
          toast.error('Location access denied. Please enable location services.')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      setLocationError('Geolocation is not supported by your browser')
      setFetchingLocation(false)
    }
  }

  const fetchTodayAttendance = async () => {
    if (user?.role !== 'employee' && 
        !(user?.role === 'manager' && viewingOwnAttendance && !selectedEmployeeId) &&
        !(user?.role === 'hr' && viewingOwnAttendance && !selectedEmployeeId)) return
    
    try {
      const { data } = await axios.get('/api/attendance/today')
      setTodayAttendance(data)
    } catch (error) {
      console.error('Error fetching today attendance:', error)
    }
  }

  const fetchAttendance = async () => {
    try {
      let params = {}
      
      // For employees: always fetch their own attendance (default backend behavior)
      // Backend automatically filters by req.user.employeeId for employees
      // No params needed - backend handles it
      
      // For managers
      if (user?.role === 'manager') {
        if (selectedEmployeeId) {
          // Viewing specific employee's attendance
          params.employeeId = selectedEmployeeId
        }
        // If viewing own attendance (no selectedEmployeeId), backend defaults to manager's own attendance
      }
      
      // For HR
      if (user?.role === 'hr') {
        if (selectedEmployeeId) {
          // Viewing specific employee's attendance
          params.employeeId = selectedEmployeeId
        } else {
          // Viewing own attendance - MUST pass HR's own employeeId to ensure only HR's attendance is shown
          if (user?.employeeId) {
            params.employeeId = user.employeeId
          } else {
            // HR doesn't have employeeId linked - show empty
            setAttendance([])
            return
          }
        }
      }
      
      // For Admin
      if (user?.role === 'admin') {
        if (selectedEmployeeId) {
          // Viewing specific employee's attendance
          params.employeeId = selectedEmployeeId
        }
        // If no selectedEmployeeId, admin sees ALL employees' attendance (backend handles this)
      }
      
      console.log('[ATTENDANCE] Fetching attendance with params:', { role: user?.role, params, selectedEmployeeId })
      const { data } = await axios.get('/api/attendance', { params })
      console.log('[ATTENDANCE] Received attendance records:', data?.length || 0)
      setAttendance(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
      toast.error('Failed to load attendance records')
      setAttendance([])
    }
  }

  const handlePunch = async (punchType) => {
    // Validate location
    if (!location) {
      toast.error('Location is required. Please allow location access and try again.')
      getLocation()
      return
    }

    // Check if punching out during early exit window (6:50 PM - 7:00 PM)
    const currentTime = new Date()
    const currentHour = currentTime.getHours()
    const currentMinute = currentTime.getMinutes()
    const currentSeconds = currentTime.getSeconds()
    const currentTimeInMinutes = currentHour * 60 + currentMinute + currentSeconds / 60
    
    const earlyExitWindowStart = 18 * 60 + 50 // 6:50 PM = 1130 minutes
    const earlyExitWindowEnd = 19 * 60 // 7:00 PM = 1140 minutes
    
    const isEarlyExitWindow = currentTimeInMinutes >= earlyExitWindowStart && currentTimeInMinutes < earlyExitWindowEnd

    setLoading(true)
    try {
      const { data } = await axios.post('/api/attendance/punch', {
        punchType,
        location
      })
      
      toast.success(data.message || `${punchType} successful!`)
      fetchTodayAttendance()
      fetchAttendance()
      
      // Show warning if running out of time
      if (data.currentStatus === 'Running Out of Time') {
        toast.error(
          `⚠️ You have worked ${data.hoursWorked} hours. Need ${data.hoursRemaining} more hours to complete 9 hours.`,
          { duration: 6000 }
        )
      }
      
      // Show warning for late entry (only when punching IN between 10:15 AM - 10:35 AM)
      if (punchType === 'Punch In' && data.isLateEntry) {
        toast.error('⚠️ Late Entry: You punched in between 10:15 AM - 10:35 AM', { duration: 5000 })
      }
      
      // Show modal popup for early exit (only when punching OUT during 6:50 PM - 7:00 PM)
      if (punchType === 'Punch Out' && isEarlyExitWindow) {
        setPunchOutTime(currentTime)
        setShowEarlyExitModal(true)
      }
      
    } catch (error) {
      toast.error(error.response?.data?.message || `${punchType} failed`)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Complete':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Running Out of Time':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'Late Entry':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'Early Exit':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'Short Hours':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Complete':
        return <FiCheckCircle className="text-green-600" size={20} />
      case 'Running Out of Time':
        return <FiAlertCircle className="text-yellow-600" size={20} />
      case 'Late Entry':
      case 'Early Exit':
      case 'Short Hours':
        return <FiXCircle className="text-red-600" size={20} />
      default:
        return <FiClock className="text-gray-600" size={20} />
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Early Exit Modal Popup */}
      {showEarlyExitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-center mb-4">
              <div className="bg-orange-100 rounded-full p-3">
                <FiAlertCircle className="text-orange-600" size={48} />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
              ⚠️ Early Exit Warning
            </h3>
            
            <div className="text-center mb-6">
              <p className="text-lg font-semibold text-orange-600 mb-2">
                You punched out between 6:50 PM - 7:00 PM
              </p>
              {punchOutTime && (
                <p className="text-sm text-gray-600">
                  Punch Out Time: {punchOutTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </p>
              )}
              <p className="text-sm text-gray-700 mt-3">
                Please note that leaving office before the designated time may affect your attendance record.
              </p>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={() => setShowEarlyExitModal(false)}
                className="btn btn-primary px-8 py-2"
              >
                I Understand
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'manager' 
              ? (selectedEmployeeId ? 'View employee attendance' : 'Track your daily attendance')
              : 'Track your daily attendance'}
          </p>
        </div>
      </div>

      {/* Employee Selector for Managers */}
      {user?.role === 'manager' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-blue-50 border border-blue-200"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiUsers className="inline mr-2 text-blue-600" size={18} />
                View Attendance
              </label>
              <select
                value={selectedEmployeeId || 'my-attendance'}
                onChange={(e) => {
                  if (e.target.value === 'my-attendance') {
                    setSelectedEmployeeId(null)
                    setViewingOwnAttendance(true)
                  } else {
                    setSelectedEmployeeId(e.target.value)
                    setViewingOwnAttendance(false)
                  }
                }}
                className="input w-full bg-white border-2 border-blue-300 focus:border-blue-500"
              >
                <option value="my-attendance">📝 My Attendance (Punch In/Out)</option>
                {allEmployees && allEmployees.length > 0 ? (
                  allEmployees.map((employee) => {
                    const displayName = employee.personalInfo?.fullName || employee.employeeId || 'Unknown'
                    const empId = employee.employeeId || employee._id
                    const department = employee.companyDetails?.department ? ` - ${employee.companyDetails.department}` : ''
                    const designation = employee.companyDetails?.designation ? ` (${employee.companyDetails.designation})` : ''
                    return (
                      <option key={employee._id} value={employee._id}>
                        👤 {displayName} ({empId}){designation}{department}
                      </option>
                    )
                  })
                ) : (
                  <option value="" disabled>No employees found</option>
                )}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                {selectedEmployeeId ? (
                  <span className="text-blue-700">
                    📖 <strong>Viewing employee attendance:</strong> Read-only mode
                  </span>
                ) : (
                  <span className="text-green-700">
                    ✏️ <strong>Your attendance:</strong> You can punch in/out
                  </span>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Employee Selector for HR and Admin */}
      {(user?.role === 'hr' || user?.role === 'admin') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-purple-50 border border-purple-200"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiUsers className="inline mr-2 text-purple-600" size={18} />
                View Attendance
              </label>
              <select
                value={selectedEmployeeId || 'my-attendance'}
                onChange={(e) => {
                  if (e.target.value === 'my-attendance') {
                    setSelectedEmployeeId(null)
                    setViewingOwnAttendance(true)
                  } else {
                    setSelectedEmployeeId(e.target.value)
                    setViewingOwnAttendance(false)
                  }
                }}
                className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
              >
                <option value="my-attendance">📝 My Attendance (Punch In/Out)</option>
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
                    📖 <strong>Viewing employee attendance:</strong> Read-only mode
                  </span>
                ) : (
                  <span className="text-green-700">
                    ✏️ <strong>Your attendance:</strong> You can punch in/out
                  </span>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Location Status - Only for employees, managers, and HR viewing their own attendance */}
      {(user?.role === 'employee' || 
        (user?.role === 'manager' && viewingOwnAttendance && !selectedEmployeeId) ||
        (user?.role === 'hr' && viewingOwnAttendance && !selectedEmployeeId)) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-blue-50 border border-blue-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiMapPin className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-blue-900">Location Status</p>
                {location ? (
                  <p className="text-sm text-blue-700">
                    ✓ Location captured: {location.cityName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </p>
                ) : (
                  <p className="text-sm text-red-700">
                    {locationError || 'Location not available'}
                  </p>
                )}
              </div>
            </div>
            {!location && (
              <button
                onClick={getLocation}
                disabled={fetchingLocation}
                className="btn btn-primary text-sm"
              >
                {fetchingLocation ? 'Getting Location...' : 'Get Location'}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Punch In/Out Section - Only for Employees, Managers, and HR viewing their own attendance */}
      {(user?.role === 'employee' || 
        (user?.role === 'manager' && viewingOwnAttendance && !selectedEmployeeId) ||
        (user?.role === 'hr' && viewingOwnAttendance && !selectedEmployeeId)) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Today's Attendance</h2>
            <div className="text-right">
              <p className="text-sm text-gray-500">Current Time</p>
              <p className="text-lg font-semibold text-gray-700">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          
          {/* Status Card - Show only if attendance data exists */}
          {todayAttendance && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${getStatusColor(todayAttendance.status || 'Absent')}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(todayAttendance.status || 'Absent')}
                <div>
                  <p className="font-semibold text-lg">{todayAttendance.status || 'Absent'}</p>
                  <p className="text-sm">
                    Hours Worked: <span className="font-bold">{todayAttendance.hoursWorked || 0} hrs</span>
                    {todayAttendance.hoursWorked < 9 && (
                      <span className="ml-2">
                        (Need {parseFloat((9 - (todayAttendance.hoursWorked || 0)).toFixed(2))} more hours)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Warnings */}
            {todayAttendance.status === 'Running Out of Time' && (
              <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-300">
                <div className="flex items-start space-x-2">
                  <FiAlertCircle className="text-yellow-600 mt-0.5" size={18} />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold">⚠️ Running Out of Time</p>
                    <p>You need to complete 9 working hours. Notifications have been sent via email and SMS.</p>
                  </div>
                </div>
              </div>
            )}
            
            {(() => {
              // Get last punch type to show appropriate warnings
              // Sort punches by time to get the actual last punch
              let lastPunch = null
              let lastPunchType = null
              
              if (todayAttendance.punches && todayAttendance.punches.length > 0) {
                const sortedPunches = [...todayAttendance.punches].sort((a, b) => new Date(a.time) - new Date(b.time))
                lastPunch = sortedPunches[sortedPunches.length - 1]
                lastPunchType = lastPunch?.punchType
              }
              
              // Only show Late Entry if last punch was Punch In AND isLateEntry is true
              const showLateEntry = todayAttendance.isLateEntry && lastPunchType === 'Punch In'
              
              // Only show Early Exit if last punch was Punch Out AND isEarlyExit is true
              // IMPORTANT: Early Exit should ONLY show when last punch is actually Punch Out
              const showEarlyExit = todayAttendance.isEarlyExit && lastPunchType === 'Punch Out'
              
              // Debug logging
              console.log('[ATTENDANCE WARNINGS]', {
                lastPunchType,
                isLateEntry: todayAttendance.isLateEntry,
                isEarlyExit: todayAttendance.isEarlyExit,
                showLateEntry,
                showEarlyExit,
                punches: todayAttendance.punches?.length
              })
              
              if (showLateEntry || showEarlyExit) {
                return (
                  <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-300">
                    <div className="flex items-start space-x-2">
                      <FiAlertCircle className="text-orange-600 mt-0.5" size={18} />
                      <div className="text-sm text-orange-800">
                        {showLateEntry && <p className="font-semibold">⚠️ Late Entry: Punched in between 10:15 AM - 10:35 AM</p>}
                        {showEarlyExit && <p className="font-semibold">⚠️ Early Exit: Punched out between 6:50 PM - 7:00 PM</p>}
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>
          )}

          {/* Punch Buttons - Always Visible */}
          <div className="mb-6 border-2 border-blue-300 rounded-lg p-6 bg-white">
            <h3 className="text-xl font-bold mb-4 text-gray-900 flex items-center">
              <FiClock className="mr-2 text-primary-600" size={24} />
              Mark Attendance - Punch In / Punch Out
            </h3>
            <p className="text-sm text-gray-600 mb-4">Click the buttons below to record your attendance with time and location</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.button
                whileHover={{ scale: (!todayAttendance || todayAttendance?.canPunchIn) && location && !loading ? 1.02 : 1 }}
                whileTap={{ scale: (!todayAttendance || todayAttendance?.canPunchIn) && location && !loading ? 0.98 : 1 }}
                onClick={() => handlePunch('Punch In')}
                disabled={todayAttendance?.canPunchIn === false || loading || !location}
                className={`relative py-6 px-8 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${
                  todayAttendance?.canPunchIn === false || !location || loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-200 cursor-pointer'
                }`}
              >
                <FiClock size={32} />
                <span className="text-xl">
                  {loading ? 'Processing...' : 
                   !location ? 'Location Required' :
                   'Punch In'}
                </span>
                {(!todayAttendance || todayAttendance?.canPunchIn) && location && !loading && (
                  <span className="text-sm font-normal opacity-90">Click to record your entry time and location</span>
                )}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: todayAttendance?.canPunchOut && location && !loading ? 1.02 : 1 }}
                whileTap={{ scale: todayAttendance?.canPunchOut && location && !loading ? 0.98 : 1 }}
                onClick={() => handlePunch('Punch Out')}
                disabled={!todayAttendance?.canPunchOut || loading || !location}
                className={`relative py-6 px-8 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${
                  !todayAttendance?.canPunchOut || !location || loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-200 cursor-pointer'
                }`}
              >
                <FiClock size={32} />
                <span className="text-xl">
                  {loading ? 'Processing...' : 
                   !location ? 'Location Required' :
                   'Punch Out'}
                </span>
                {todayAttendance?.canPunchOut && location && !loading && (
                  <span className="text-sm font-normal opacity-90">Click to record your exit time and location</span>
                )}
              </motion.button>
            </div>
          </div>

          {/* Punch Windows Info */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">Punch Windows:</h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>• First Punch In: 10:00 AM - 10:15 AM (Late Entry warning: 10:15 AM - 10:35 AM)</li>
              <li>• Final Punch Out: 6:55 PM - 7:05 PM (Early Exit warning: 6:50 PM - 7:00 PM)</li>
              <li>• Required Working Hours: 9 hours per day</li>
            </ul>
          </div>

          {/* Loading Message */}
          {!todayAttendance && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">Loading today's attendance data...</p>
            </div>
          )}

          {/* Today's Punches */}
          {todayAttendance && todayAttendance.punches && todayAttendance.punches.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Today's Punch Records:</h3>
              <div className="space-y-2">
                {todayAttendance.punches
                  .sort((a, b) => new Date(a.time) - new Date(b.time))
                  .map((punch, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          punch.punchType === 'Punch In' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium">
                            {punch.punchType} - {formatTime(punch.time)}
                          </p>
                          {(() => {
                            // Priority 1: Use locationName if available (most specific)
                            if (punch.locationName && typeof punch.locationName === 'string') {
                              return (
                                <p className="text-xs text-gray-500">
                                  <FiMapPin size={12} className="inline mr-1" />
                                  {punch.locationName}
                                </p>
                              )
                            }
                            
                            // Priority 2: Use location if it's a string (legacy format)
                            if (punch.location && typeof punch.location === 'string' && punch.location !== 'undefined') {
                              return (
                                <p className="text-xs text-gray-500">
                                  <FiMapPin size={12} className="inline mr-1" />
                                  {punch.location}
                                </p>
                              )
                            }
                            
                            // Priority 3: Convert coordinates to location name (for old records)
                            if (punch.coordinates?.latitude && punch.coordinates?.longitude) {
                              return <LocationConverter coordinates={punch.coordinates} />
                            }
                            
                            // Priority 4: Use location object coordinates as fallback
                            if (punch.location && typeof punch.location === 'object' && punch.location.latitude) {
                              return <LocationConverter coordinates={punch.location} />
                            }
                            
                            return null
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Admin/HR/Manager View Toggle */}
      {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager') && !selectedEmployeeId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 mb-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">View Mode</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMonthlyView(false)
                  setSelectedEmployeeForMonthly(null)
                  setMonthlyAttendance(null)
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  !monthlyView
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📊 Daily Overview
              </button>
              <button
                onClick={() => setMonthlyView(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  monthlyView
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📅 Monthly View
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Admin/HR/Manager Monthly Attendance View */}
      {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager') && !selectedEmployeeId && monthlyView && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Employee and Month Selector */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiUsers className="inline mr-2 text-purple-600" size={18} />
                  Select Employee
                </label>
                <select
                  value={selectedEmployeeForMonthly || ''}
                  onChange={(e) => {
                    setSelectedEmployeeForMonthly(e.target.value || null)
                    setMonthlyAttendance(null)
                  }}
                  className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
                >
                  <option value="">-- Select Employee --</option>
                  {(() => {
                    const employeesList = user?.role === 'manager' 
                      ? (teamMembers.length > 0 ? teamMembers : allEmployees)
                      : allEmployees;
                    return employeesList && employeesList.length > 0 ? (
                      employeesList.map((employee) => {
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
                    )
                  })()}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiCalendar className="inline mr-2 text-purple-600" size={18} />
                  Select Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(parseInt(e.target.value))
                    setMonthlyAttendance(null)
                  }}
                  className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiCalendar className="inline mr-2 text-purple-600" size={18} />
                  Select Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(parseInt(e.target.value))
                    setMonthlyAttendance(null)
                  }}
                  className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {selectedEmployeeForMonthly && (
              <div className="mt-4">
                <button
                  onClick={fetchMonthlyAttendance}
                  disabled={loadingMonthly}
                  className="btn btn-primary w-full"
                >
                  {loadingMonthly ? 'Loading...' : '📊 View Monthly Attendance'}
                </button>
              </div>
            )}
          </motion.div>

          {/* Monthly Statistics */}
          {monthlyAttendance && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium mb-1">Present Days</p>
                      <p className="text-4xl font-bold">{monthlyAttendance.stats.present}</p>
                      <p className="text-green-200 text-xs mt-2">
                        {monthlyAttendance.stats.attendancePercentage}% attendance
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiCheckCircle size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="card bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm font-medium mb-1">Absent Days</p>
                      <p className="text-4xl font-bold">{monthlyAttendance.stats.absent}</p>
                      <p className="text-red-200 text-xs mt-2">
                        {monthlyAttendance.stats.onLeave} days on leave
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiXCircle size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">Total Hours</p>
                      <p className="text-4xl font-bold">{parseFloat(monthlyAttendance.stats.totalWorkingHours).toFixed(1)}</p>
                      <p className="text-blue-200 text-xs mt-2">
                        Avg: {monthlyAttendance.stats.averageWorkingHours} hrs/day
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiClock size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm font-medium mb-1">Late Entries</p>
                      <p className="text-4xl font-bold">{monthlyAttendance.stats.lateEntry}</p>
                      <p className="text-yellow-200 text-xs mt-2">
                        {monthlyAttendance.stats.earlyExit} early exits
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiAlertCircle size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Employee Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-indigo-50 border-2 border-indigo-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{monthlyAttendance.employee.name}</h3>
                    <p className="text-sm text-gray-600">
                      {monthlyAttendance.employee.employeeId} • {monthlyAttendance.employee.department} • {monthlyAttendance.employee.designation}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-indigo-900">{monthlyAttendance.monthName}</p>
                    <p className="text-sm text-gray-600">Monthly Attendance</p>
                  </div>
                </div>
              </motion.div>

              {/* Calendar View */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card shadow-xl border-2 border-gray-200"
              >
                <h3 className="text-xl font-bold mb-6 pb-4 border-b border-gray-200">Monthly Calendar</h3>
                
                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <div key={day} className="text-center text-xs font-bold text-gray-700 py-2 bg-gray-100 rounded-lg">
                      {day.substring(0, 3)}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Body */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const firstDay = new Date(monthlyAttendance.year, monthlyAttendance.month - 1, 1)
                    const firstDayOfWeek = firstDay.getDay()
                    const totalDays = new Date(monthlyAttendance.year, monthlyAttendance.month, 0).getDate()
                    const days = []
                    
                    // Create a map of calendar data by day
                    const calendarMap = new Map()
                    monthlyAttendance.calendarData.forEach(dayData => {
                      calendarMap.set(dayData.day, dayData)
                    })
                    
                    // Add empty cells for days before the first day of the month
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      days.push(
                        <div 
                          key={`empty-${i}`} 
                          className="h-20 md:h-24 bg-gray-50 rounded-lg border border-gray-200"
                        ></div>
                      )
                    }
                    
                    // Add calendar days
                    for (let day = 1; day <= totalDays; day++) {
                      const dayData = calendarMap.get(day)
                      const date = new Date(monthlyAttendance.year, monthlyAttendance.month - 1, day)
                      const isToday = date.toDateString() === new Date().toDateString()
                      
                      const statusColors = {
                        'Present': 'bg-green-50 text-green-900 border-green-400 hover:bg-green-100',
                        'Absent': 'bg-red-50 text-red-900 border-red-400 hover:bg-red-100',
                        'On Leave': 'bg-yellow-50 text-yellow-900 border-yellow-400 hover:bg-yellow-100',
                        'Not Marked': 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100',
                        'Complete': 'bg-emerald-50 text-emerald-900 border-emerald-400 hover:bg-emerald-100'
                      }
                      
                      const status = dayData?.status || 'Not Marked'
                      const workingHours = dayData?.workingHours || 0
                      const isLateEntry = dayData?.isLateEntry || false
                      const isEarlyExit = dayData?.isEarlyExit || false
                      
                      days.push(
                        <motion.div
                          key={day}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (day - 1) * 0.01 }}
                          className={`h-20 md:h-24 p-2 rounded-lg border-2 ${statusColors[status] || statusColors['Not Marked']} flex flex-col justify-between cursor-pointer transition-all relative ${
                            isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                          }`}
                          title={`${day} ${monthlyAttendance.monthName} - ${status}${workingHours > 0 ? ` (${workingHours.toFixed(1)}h)` : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : ''}`}>
                              {day}
                            </span>
                            <div className="flex items-center space-x-1">
                              {isLateEntry && (
                                <span className="text-xs text-orange-600" title="Late Entry">⚠️</span>
                              )}
                              {isEarlyExit && (
                                <span className="text-xs text-red-600" title="Early Exit">⏰</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-start mt-1">
                            <span className={`text-xs font-semibold ${status === 'Present' ? 'text-green-700' : status === 'Absent' ? 'text-red-700' : status === 'On Leave' ? 'text-yellow-700' : 'text-gray-500'}`}>
                              {status === 'Present' ? '✓' : status === 'Absent' ? '✗' : status === 'On Leave' ? 'L' : '-'}
                            </span>
                            {workingHours > 0 && (
                              <span className="text-xs font-medium text-gray-700 mt-0.5">
                                {workingHours.toFixed(1)}h
                              </span>
                            )}
                          </div>
                        </motion.div>
                      )
                    }
                    
                    return days
                  })()}
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      )}

      {/* Admin Daily Attendance Overview */}
      {user?.role === 'admin' && !selectedEmployeeId && !monthlyView && (
        <>
          {/* Statistics Cards */}
          {dailyStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium mb-1">Present</p>
                    <p className="text-4xl font-bold">{dailyStats.present}</p>
                    <p className="text-green-200 text-xs mt-2">
                      {((dailyStats.present / dailyStats.totalEmployees) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-4">
                    <FiCheckCircle size={32} className="text-white" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium mb-1">Absent</p>
                    <p className="text-4xl font-bold">{dailyStats.absent}</p>
                    <p className="text-red-200 text-xs mt-2">
                      {((dailyStats.absent / dailyStats.totalEmployees) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-4">
                    <FiXCircle size={32} className="text-white" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">On Leave</p>
                    <p className="text-4xl font-bold">{dailyStats.onLeave}</p>
                    <p className="text-blue-200 text-xs mt-2">
                      {((dailyStats.onLeave / dailyStats.totalEmployees) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-4">
                    <FiCalendar size={32} className="text-white" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-100 text-sm font-medium mb-1">Not Marked</p>
                    <p className="text-4xl font-bold">{dailyStats.notMarked}</p>
                    <p className="text-gray-200 text-xs mt-2">
                      {((dailyStats.notMarked / dailyStats.totalEmployees) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-4">
                    <FiAlertCircle size={32} className="text-white" />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Additional Statistics */}
          {dailyStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-yellow-50 border-2 border-yellow-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-800 text-sm font-medium mb-1">Late Entry</p>
                    <p className="text-3xl font-bold text-yellow-900">{dailyStats.lateEntry}</p>
                  </div>
                  <FiClock className="text-yellow-600" size={28} />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-orange-50 border-2 border-orange-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-800 text-sm font-medium mb-1">Early Exit</p>
                    <p className="text-3xl font-bold text-orange-900">{dailyStats.earlyExit}</p>
                  </div>
                  <FiAlertCircle className="text-orange-600" size={28} />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-indigo-50 border-2 border-indigo-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-800 text-sm font-medium mb-1">Attendance Rate</p>
                    <p className="text-3xl font-bold text-indigo-900">{dailyStats.attendancePercentage}%</p>
                  </div>
                  <FiTrendingUp className="text-indigo-600" size={28} />
                </div>
              </motion.div>
            </div>
          )}

          {/* Chart */}
          {dailyStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card mb-6"
            >
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <FiBarChart2 className="mr-2 text-purple-600" />
                Attendance Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Present', value: dailyStats.present, color: '#10b981' },
                      { name: 'Absent', value: dailyStats.absent, color: '#ef4444' },
                      { name: 'On Leave', value: dailyStats.onLeave, color: '#3b82f6' },
                      { name: 'Not Marked', value: dailyStats.notMarked, color: '#6b7280' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Present', value: dailyStats.present, color: '#10b981' },
                      { name: 'Absent', value: dailyStats.absent, color: '#ef4444' },
                      { name: 'On Leave', value: dailyStats.onLeave, color: '#3b82f6' },
                      { name: 'Not Marked', value: dailyStats.notMarked, color: '#6b7280' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Daily Attendance Table */}
          {dailyAttendance.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card mb-6"
            >
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <FiUsers className="mr-2 text-purple-600" />
                All Employees Daily Attendance - {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Working Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Punch In
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Punch Out
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailyAttendance.map((emp) => (
                      <tr key={emp.employeeId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 font-semibold">
                                {emp.employeeName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{emp.employeeName}</div>
                              <div className="text-sm text-gray-500">{emp.employeeCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{emp.department}</div>
                            <div className="text-xs text-gray-500">{emp.designation}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(emp.status)}`}>
                            {emp.status}
                            {emp.isLateEntry && <span className="ml-1">⚠️</span>}
                            {emp.isEarlyExit && <span className="ml-1">⏰</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-semibold">{emp.workingHours.toFixed(2)} hrs</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {emp.punchIn ? (
                            <span className="text-green-600 font-medium">
                              {new Date(emp.punchIn).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {emp.punchOut ? (
                            <span className="text-red-600 font-medium">
                              {new Date(emp.punchOut).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Employee Monthly Attendance View Toggle */}
      {user?.role === 'employee' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 mb-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">View Mode</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEmployeeMonthlyView(false)
                  setEmployeeMonthlyAttendance(null)
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  !employeeMonthlyView
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📊 Daily Overview
              </button>
              <button
                onClick={() => setEmployeeMonthlyView(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  employeeMonthlyView
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📅 Monthly View
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Employee Monthly Attendance View */}
      {user?.role === 'employee' && employeeMonthlyView && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mb-8"
        >
          {/* Month and Year Selector */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiCalendar className="inline mr-2 text-purple-600" size={18} />
                  Select Month
                </label>
                <select
                  value={employeeSelectedMonth}
                  onChange={(e) => {
                    setEmployeeSelectedMonth(parseInt(e.target.value))
                    setEmployeeMonthlyAttendance(null)
                  }}
                  className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiCalendar className="inline mr-2 text-purple-600" size={18} />
                  Select Year
                </label>
                <select
                  value={employeeSelectedYear}
                  onChange={(e) => {
                    setEmployeeSelectedYear(parseInt(e.target.value))
                    setEmployeeMonthlyAttendance(null)
                  }}
                  className="input w-full bg-white border-2 border-purple-300 focus:border-purple-500"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchEmployeeMonthlyAttendance}
                disabled={loadingEmployeeMonthly || !employeeSelectedMonth || !employeeSelectedYear}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingEmployeeMonthly ? 'Loading...' : '📊 View Monthly Attendance'}
              </button>
            </div>
          </motion.div>

          {/* Monthly Attendance Display */}
          {loadingEmployeeMonthly && (
            <div className="card text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading monthly attendance...</p>
            </div>
          )}
          
          {!loadingEmployeeMonthly && employeeMonthlyAttendance && (
            <>
              {/* Monthly Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium mb-1">Present Days</p>
                      <p className="text-4xl font-bold">{employeeMonthlyAttendance.stats.present}</p>
                      <p className="text-green-200 text-xs mt-2">
                        {employeeMonthlyAttendance.stats.attendancePercentage}% attendance
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiCheckCircle size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="card bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm font-medium mb-1">Absent Days</p>
                      <p className="text-4xl font-bold">{employeeMonthlyAttendance.stats.absent}</p>
                      <p className="text-red-200 text-xs mt-2">
                        {employeeMonthlyAttendance.stats.onLeave} days on leave
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiXCircle size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">Total Hours</p>
                      <p className="text-4xl font-bold">{parseFloat(employeeMonthlyAttendance.stats.totalWorkingHours).toFixed(1)}</p>
                      <p className="text-blue-200 text-xs mt-2">
                        Avg: {employeeMonthlyAttendance.stats.averageWorkingHours} hrs/day
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiClock size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm font-medium mb-1">Late Entries</p>
                      <p className="text-4xl font-bold">{employeeMonthlyAttendance.stats.lateEntry}</p>
                      <p className="text-yellow-200 text-xs mt-2">
                        {employeeMonthlyAttendance.stats.earlyExit} early exits
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-full p-4">
                      <FiAlertCircle size={32} className="text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Employee Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-indigo-50 border-2 border-indigo-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{employeeMonthlyAttendance.employee.name}</h3>
                    <p className="text-sm text-gray-600">
                      {employeeMonthlyAttendance.employee.employeeId} • {employeeMonthlyAttendance.employee.department} • {employeeMonthlyAttendance.employee.designation}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-indigo-900">{employeeMonthlyAttendance.monthName}</p>
                    <p className="text-sm text-gray-600">Monthly Attendance</p>
                  </div>
                </div>
              </motion.div>

              {/* Monthly Calendar View */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card shadow-xl border-2 border-gray-200"
              >
                <h3 className="text-xl font-bold mb-6 pb-4 border-b border-gray-200">Monthly Calendar</h3>

                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <div key={day} className="text-center text-xs font-bold text-gray-700 py-2 bg-gray-100 rounded-lg">
                      {day.substring(0, 3)}
                    </div>
                  ))}
                </div>

                {/* Calendar Body */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const firstDay = new Date(employeeMonthlyAttendance.year, employeeMonthlyAttendance.month - 1, 1)
                    const startingDayOfWeek = firstDay.getDay()
                    const totalDays = new Date(employeeMonthlyAttendance.year, employeeMonthlyAttendance.month, 0).getDate()
                    const days = []
                    
                    // Create a map of calendar data by day
                    const calendarMap = new Map()
                    employeeMonthlyAttendance.calendarData.forEach(dayData => {
                      calendarMap.set(dayData.day, dayData)
                    })
                    
                    // Empty cells for days before month starts
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(
                        <div 
                          key={`empty-${i}`} 
                          className="h-20 md:h-24 bg-gray-50 rounded-lg border border-gray-200"
                        ></div>
                      )
                    }
                    
                    // Days of the month
                    for (let day = 1; day <= totalDays; day++) {
                      const dayData = calendarMap.get(day)
                      const date = new Date(employeeMonthlyAttendance.year, employeeMonthlyAttendance.month - 1, day)
                      const isToday = date.toDateString() === new Date().toDateString()
                      
                      const statusColors = {
                        'Present': 'bg-green-50 text-green-900 border-green-400 hover:bg-green-100',
                        'Absent': 'bg-red-50 text-red-900 border-red-400 hover:bg-red-100',
                        'On Leave': 'bg-yellow-50 text-yellow-900 border-yellow-400 hover:bg-yellow-100',
                        'Not Marked': 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100',
                        'Complete': 'bg-emerald-50 text-emerald-900 border-emerald-400 hover:bg-emerald-100'
                      }
                      
                      const status = dayData?.status || 'Not Marked'
                      const workingHours = dayData?.workingHours || 0
                      const isLateEntry = dayData?.isLateEntry || false
                      const isEarlyExit = dayData?.isEarlyExit || false
                      
                      days.push(
                        <motion.div
                          key={day}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (day - 1) * 0.01 }}
                          className={`h-20 md:h-24 p-2 rounded-lg border-2 ${statusColors[status] || statusColors['Not Marked']} flex flex-col justify-between cursor-pointer transition-all relative ${
                            isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                          }`}
                          title={`${day} ${employeeMonthlyAttendance.monthName} - ${status}${workingHours > 0 ? ` (${workingHours.toFixed(1)}h)` : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : ''}`}>
                              {day}
                            </span>
                            <div className="flex items-center space-x-1">
                              {isLateEntry && (
                                <span className="text-xs text-orange-600" title="Late Entry">⚠️</span>
                              )}
                              {isEarlyExit && (
                                <span className="text-xs text-red-600" title="Early Exit">⏰</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-start mt-1">
                            <span className={`text-xs font-semibold ${status === 'Present' ? 'text-green-700' : status === 'Absent' ? 'text-red-700' : status === 'On Leave' ? 'text-yellow-700' : 'text-gray-500'}`}>
                              {status === 'Present' ? '✓' : status === 'Absent' ? '✗' : status === 'On Leave' ? 'L' : '-'}
                            </span>
                            {workingHours > 0 && (
                              <span className="text-xs font-medium text-gray-700 mt-0.5">
                                {workingHours.toFixed(1)}h
                              </span>
                            )}
                          </div>
                        </motion.div>
                      )
                    }
                    
                    return days
                  })()}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
                      <span className="text-sm text-gray-600">Present</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                      <span className="text-sm text-gray-600">Absent</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
                      <span className="text-sm text-gray-600">On Leave</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                      <span className="text-sm text-gray-600">Not Marked</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-orange-600">⚠️</span>
                      <span className="text-sm text-gray-600">Late Entry</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
          
          {!loadingEmployeeMonthly && !employeeMonthlyAttendance && (
            <div className="card text-center py-8">
              <p className="text-gray-600">No attendance data found for the selected month and year.</p>
              <p className="text-sm text-gray-500 mt-2">Please select a different month/year or check if you have attendance records.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Attendance History */}
      {(user?.role !== 'admin' || selectedEmployeeId) && !(user?.role === 'employee' && employeeMonthlyView) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h2 className="text-xl font-semibold mb-4">Attendance History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Punches
                </th>
                {(user?.role === 'manager' && selectedEmployeeId) || (user?.role === 'hr' && selectedEmployeeId) ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendance.map((record) => (
                <tr key={record._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <span className="font-semibold">{record.totalWorkingHours?.toFixed(2) || 0} hrs</span>
                      {record.overtime > 0 && (
                        <span className="ml-2 text-green-600 text-xs">(+{record.overtime.toFixed(2)} OT)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="space-y-1">
                      {record.firstPunchIn && (
                        <div className="text-xs">
                          <span className="text-green-600">In:</span> {formatTime(record.firstPunchIn)}
                        </div>
                      )}
                      {record.lastPunchOut && (
                        <div className="text-xs">
                          <span className="text-red-600">Out:</span> {formatTime(record.lastPunchOut)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Total: {record.punches?.length || 0} punches
                      </div>
                    </div>
                  </td>
                  {((user?.role === 'manager' && selectedEmployeeId) || 
                    (user?.role === 'hr' && selectedEmployeeId) || 
                    (user?.role === 'admin')) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                          <span className="text-primary-600 font-semibold text-xs">
                            {(record.employeeId?.personalInfo?.fullName || record.employeeId?.employeeId || 'E').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{record.employeeId?.personalInfo?.fullName || 'Unknown'}</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-xs text-gray-500">{record.employeeId?.employeeId || record.employeeId?._id}</p>
                            {record.employeeId?.companyDetails?.designation && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-xs text-gray-500">{record.employeeId.companyDetails.designation}</p>
                              </>
                            )}
                            {record.employeeId?.companyDetails?.department && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-xs text-gray-500">{record.employeeId.companyDetails.department}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      )}
    </div>
  )
}

export default Attendance
