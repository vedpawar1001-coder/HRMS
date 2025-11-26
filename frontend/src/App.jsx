import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Profile from './pages/Profile'
import HRProfile from './pages/HRProfile'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import Payroll from './pages/Payroll'
import Performance from './pages/Performance'
import Engagement from './pages/Engagement'
import Grievances from './pages/Grievances'
import Recruitment from './pages/Recruitment'
import RecruitmentDashboard from './pages/RecruitmentDashboard'
import OnboardingPortal from './pages/OnboardingPortal'
import OfferResponse from './pages/OfferResponse'
import Layout from './components/Layout'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/offer/:applicationId/:action" element={<OfferResponse />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:employeeId" element={<Profile />} />
              <Route path="/hr-profile" element={<HRProfile />} />
              <Route path="/hr-profile/:employeeId" element={<HRProfile />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/engagement" element={<Engagement />} />
              <Route path="/grievances" element={<Grievances />} />
              <Route path="/recruitment" element={<Recruitment />} />
              <Route path="/recruitment/ats" element={<RecruitmentDashboard />} />
              <Route path="/recruitment/interviews" element={<RecruitmentDashboard />} />
              <Route path="/recruitment/offers" element={<RecruitmentDashboard />} />
              <Route path="/recruitment/lifecycle" element={<RecruitmentDashboard />} />
              <Route path="/onboarding/:linkId" element={<OnboardingPortal />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

