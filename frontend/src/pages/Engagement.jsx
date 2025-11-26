import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { FiMessageSquare, FiCalendar, FiUsers, FiPlus, FiX } from 'react-icons/fi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const Engagement = () => {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [showPollModal, setShowPollModal] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    description: '',
    visibility: 'All',
    departments: [],
    expiryDate: '',
    isPinned: false
  })
  const [pollForm, setPollForm] = useState({
    question: '',
    options: ['', ''],
    deadline: '',
    visibility: 'All',
    departments: []
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [annRes, pollsRes] = await Promise.all([
        axios.get('/api/engagement/announcements'),
        axios.get('/api/engagement/polls')
      ])
      setAnnouncements(annRes.data)
      setPolls(pollsRes.data)
    } catch (error) {
      console.error('Error fetching engagement data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault()
    
    if (!announcementForm.title || !announcementForm.description) {
      toast.error('Please fill in title and description')
      return
    }

    try {
      const announcementData = {
        ...announcementForm,
        expiryDate: announcementForm.expiryDate ? new Date(announcementForm.expiryDate).toISOString() : null,
        departments: announcementForm.visibility === 'Department' ? announcementForm.departments : []
      }

      const { data } = await axios.post('/api/engagement/announcements', announcementData)
      toast.success('Announcement created successfully!')
      setShowAnnouncementModal(false)
      setAnnouncementForm({
        title: '',
        description: '',
        visibility: 'All',
        departments: [],
        expiryDate: '',
        isPinned: false
      })
      fetchData()
    } catch (error) {
      console.error('Error creating announcement:', error)
      toast.error(error.response?.data?.message || 'Failed to create announcement')
    }
  }

  const handleCreatePoll = async (e) => {
    e.preventDefault()
    
    if (!pollForm.question) {
      toast.error('Please enter a question')
      return
    }

    const validOptions = pollForm.options.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      toast.error('Please add at least 2 poll options')
      return
    }

    try {
      const pollData = {
        question: pollForm.question,
        options: validOptions.map(opt => ({ text: opt.trim(), votes: [] })),
        deadline: pollForm.deadline ? new Date(pollForm.deadline).toISOString() : null,
        visibility: pollForm.visibility,
        departments: pollForm.visibility === 'Department' ? pollForm.departments : [],
        isActive: true
      }

      const { data } = await axios.post('/api/engagement/polls', pollData)
      toast.success('Poll created successfully!')
      setShowPollModal(false)
      setPollForm({
        question: '',
        options: ['', ''],
        deadline: '',
        visibility: 'All',
        departments: []
      })
      fetchData()
    } catch (error) {
      console.error('Error creating poll:', error)
      toast.error(error.response?.data?.message || 'Failed to create poll')
    }
  }

  const addPollOption = () => {
    setPollForm({
      ...pollForm,
      options: [...pollForm.options, '']
    })
  }

  const removePollOption = (index) => {
    const newOptions = pollForm.options.filter((_, i) => i !== index)
    if (newOptions.length >= 2) {
      setPollForm({ ...pollForm, options: newOptions })
    } else {
      toast.error('Poll must have at least 2 options')
    }
  }

  const updatePollOption = (index, value) => {
    const newOptions = [...pollForm.options]
    newOptions[index] = value
    setPollForm({ ...pollForm, options: newOptions })
  }

  const handleVote = async (pollId, optionIndex) => {
    try {
      const { data } = await axios.post(`/api/engagement/polls/${pollId}/vote`, {
        optionIndex
      })
      toast.success('Vote submitted successfully!')
      fetchData() // Refresh polls to show updated vote counts
    } catch (error) {
      console.error('Error voting:', error)
      toast.error(error.response?.data?.message || 'Failed to submit vote')
    }
  }

  const hasUserVoted = (poll) => {
    if (!user?._id) return false
    return poll.options.some(option => 
      option.votes?.some(vote => 
        (typeof vote === 'object' ? vote._id : vote) === user._id
      )
    )
  }

  const getUserVotedOption = (poll) => {
    if (!user?._id) return -1
    for (let i = 0; i < poll.options.length; i++) {
      if (poll.options[i].votes?.some(vote => 
        (typeof vote === 'object' ? vote._id : vote) === user._id
      )) {
        return i
      }
    }
    return -1
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Engagement</h1>
          <p className="text-gray-600 mt-1">Announcements, polls, and events</p>
        </div>
        {(user?.role === 'manager' || user?.role === 'hr' || user?.role === 'admin') && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <FiPlus className="w-5 h-5" />
              <span>Create Announcement</span>
            </button>
            <button
              onClick={() => setShowPollModal(true)}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <FiPlus className="w-5 h-5" />
              <span>Create Poll</span>
            </button>
          </div>
        )}
      </div>

      {/* Announcements */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FiMessageSquare className="mr-2" />
          Announcements
        </h2>
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <motion.div
              key={announcement._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{announcement.title}</h3>
                  <p className="text-gray-600 mt-1">{announcement.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(announcement.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {announcement.isPinned && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Pinned</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Polls */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FiUsers className="mr-2" />
          Active Polls
        </h2>
        <div className="space-y-4">
          {polls.map((poll) => (
            <motion.div
              key={poll._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <h3 className="font-semibold mb-3">{poll.question}</h3>
              {poll.deadline && new Date(poll.deadline) < new Date() && (
                <p className="text-sm text-red-600 mb-2">⚠️ This poll has ended</p>
              )}
              <div className="space-y-2">
                {poll.options.map((option, idx) => {
                  const isVoted = hasUserVoted(poll)
                  const userVotedIndex = getUserVotedOption(poll)
                  const isUserVote = userVotedIndex === idx
                  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0)
                  const percentage = totalVotes > 0 ? ((option.votes?.length || 0) / totalVotes * 100).toFixed(1) : 0
                  const isExpired = poll.deadline && new Date(poll.deadline) < new Date()
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                        isUserVote 
                          ? 'bg-primary-50 border-primary-500' 
                          : isExpired || isVoted
                          ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isExpired && !isVoted && user?._id) {
                          handleVote(poll._id, idx)
                        }
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${isUserVote ? 'text-primary-700' : 'text-gray-900'}`}>
                            {option.text}
                          </span>
                          {isUserVote && (
                            <span className="text-xs bg-primary-200 text-primary-800 px-2 py-1 rounded-full">
                              Your Vote
                            </span>
                          )}
                        </div>
                        {isVoted && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${isUserVote ? 'bg-primary-600' : 'bg-gray-400'}`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {option.votes?.length || 0} votes ({percentage}%)
                            </p>
                          </div>
                        )}
                      </div>
                      {!isVoted && !isExpired && (
                        <span className="text-sm text-primary-600 font-medium ml-2">
                          Click to vote
                        </span>
                      )}
                      {isVoted && (
                        <span className="text-sm text-gray-600 ml-2">
                          {option.votes?.length || 0} votes
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {!hasUserVoted(poll) && !(poll.deadline && new Date(poll.deadline) < new Date()) && (
                <p className="text-xs text-gray-500 mt-2">Click on an option to vote</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Create Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Announcement</h2>
                <button
                  onClick={() => setShowAnnouncementModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                    className="input"
                    required
                    placeholder="Enter announcement title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={announcementForm.description}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, description: e.target.value })}
                    className="input"
                    rows={5}
                    required
                    placeholder="Enter announcement description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <select
                      value={announcementForm.visibility}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, visibility: e.target.value })}
                      className="input"
                    >
                      <option value="All">All Employees</option>
                      <option value="Department">Department</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={announcementForm.expiryDate}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, expiryDate: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPinned"
                    checked={announcementForm.isPinned}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="isPinned" className="ml-2 text-sm text-gray-700">
                    Pin this announcement
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAnnouncementModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Announcement
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Poll Modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Poll</h2>
                <button
                  onClick={() => setShowPollModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreatePoll} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pollForm.question}
                    onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })}
                    className="input"
                    required
                    placeholder="Enter poll question"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Options <span className="text-red-500">*</span> (Minimum 2)
                  </label>
                  <div className="space-y-2">
                    {pollForm.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updatePollOption(index, e.target.value)}
                          className="input flex-1"
                          placeholder={`Option ${index + 1}`}
                          required
                        />
                        {pollForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removePollOption(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <FiX className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addPollOption}
                    className="mt-2 btn btn-secondary text-sm"
                  >
                    <FiPlus className="w-4 h-4 mr-1" />
                    Add Option
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <select
                      value={pollForm.visibility}
                      onChange={(e) => setPollForm({ ...pollForm, visibility: e.target.value })}
                      className="input"
                    >
                      <option value="All">All Employees</option>
                      <option value="Department">Department</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={pollForm.deadline}
                      onChange={(e) => setPollForm({ ...pollForm, deadline: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowPollModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Poll
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Engagement

