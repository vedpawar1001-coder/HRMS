import { createContext, useState, useContext, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const { data } = await axios.get('/api/auth/me')
      setUser(data)
    } catch (error) {
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const { data } = await axios.post('/api/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
      setUser(data)
      toast.success('Login successful!')
      return data
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code
      })
      
      let errorMessage = 'Login failed'
      
      if (!error.response) {
        // Network error - backend might not be running
        errorMessage = 'Cannot connect to server. Please make sure the backend server is running on port 5000.'
      } else if (error.response.status === 401) {
        errorMessage = error.response.data?.message || 'Invalid email or password'
      } else if (error.response.status === 500) {
        errorMessage = error.response.data?.message || 'Server error. Please check backend logs.'
      } else {
        errorMessage = error.response.data?.message || `Login failed (${error.response.status})`
      }
      
      toast.error(errorMessage)
      throw error
    }
  }

  const register = async (userData) => {
    try {
      const { data } = await axios.post('/api/auth/register', userData)
      localStorage.setItem('token', data.token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
      setUser(data)
      toast.success('Registration successful!')
      return data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed')
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
    toast.success('Logged out successfully')
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    fetchUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

