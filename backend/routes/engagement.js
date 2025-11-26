const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { Announcement, Poll, Survey, Event, Feedback } = require('../models/Engagement');
const router = express.Router();

// Announcements
router.get('/announcements', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get all manager and HR user IDs to identify manager/HR-created announcements
    const managers = await User.find({ role: 'manager' }).select('_id');
    const hrs = await User.find({ role: 'hr' }).select('_id');
    const managerIds = managers.map(m => m._id);
    const hrIds = hrs.map(h => h._id);
    const creatorIds = [...managerIds, ...hrIds];
    
    // Build visibility filter - include:
    // 1. Announcements with visibility 'All'
    // 2. Department-specific announcements (if user is in that department)
    // 3. ALL announcements created by managers or HR (visible to everyone)
    const visibilityFilter = {
      $or: [
        { visibility: 'All' },
        { visibility: 'Department', departments: { $in: [req.user.employeeId] } },
        { createdBy: { $in: creatorIds } } // Manager/HR-created announcements visible to all
      ]
    };
    
    // Build expiry filter - show announcements that haven't expired or don't have expiry date
    const expiryFilter = {
      $or: [
        { expiryDate: { $gte: new Date() } },
        { expiryDate: null }
      ]
    };
    
    const announcements = await Announcement.find({
      $and: [visibilityFilter, expiryFilter]
    })
      .populate('createdBy', 'email role')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50); // Increased limit to show more announcements
    
    console.log(`[ENGAGEMENT] Returning ${announcements.length} announcements (including manager-created)`);
    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/announcements', protect, authorize('manager', 'hr', 'admin'), async (req, res) => {
  try {
    // If created by manager or HR, ensure visibility is 'All' so it's visible to everyone
    const announcementData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Managers' and HR's announcements should be visible to all employees, admin, and HR
    if (req.user.role === 'manager' || req.user.role === 'hr') {
      announcementData.visibility = 'All';
      console.log(`[ENGAGEMENT] ${req.user.role} creating announcement - setting visibility to 'All'`);
    }
    
    const announcement = await Announcement.create(announcementData);
    
    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'email role');
    
    console.log(`[ENGAGEMENT] Announcement created by ${req.user.email} (${req.user.role}) - visible to all`);
    res.status(201).json(populatedAnnouncement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Polls
router.get('/polls', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get all manager and HR user IDs to identify manager/HR-created polls
    const managers = await User.find({ role: 'manager' }).select('_id');
    const hrs = await User.find({ role: 'hr' }).select('_id');
    const managerIds = managers.map(m => m._id);
    const hrIds = hrs.map(h => h._id);
    const creatorIds = [...managerIds, ...hrIds];
    
    // Build visibility filter - include:
    // 1. Polls with visibility 'All'
    // 2. Department-specific polls (if user is in that department)
    // 3. ALL polls created by managers or HR (visible to everyone)
    const visibilityFilter = {
      $or: [
        { visibility: 'All' },
        { visibility: 'Department', departments: { $in: [req.user.employeeId] } },
        { createdBy: { $in: creatorIds } } // Manager/HR-created polls visible to all
      ]
    };
    
    // Build deadline filter - show polls that haven't passed deadline or don't have deadline
    const deadlineFilter = {
      $or: [
        { deadline: { $gte: new Date() } },
        { deadline: null }
      ]
    };
    
    const polls = await Poll.find({
      isActive: true,
      $and: [visibilityFilter, deadlineFilter]
    })
      .populate('createdBy', 'email role')
      .populate('options.votes', 'email _id')
      .sort({ createdAt: -1 });
    
    console.log(`[ENGAGEMENT] Returning ${polls.length} polls (including manager/HR-created)`);
    res.json(polls);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/engagement/polls/:id/vote
// @desc    Vote on a poll option
// @access  Private (All authenticated users)
// NOTE: This route must be defined BEFORE /polls to avoid route conflicts
router.post('/polls/:id/vote', protect, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ message: 'Option index is required' });
    }
    
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }
    
    // Check if poll is active
    if (!poll.isActive) {
      return res.status(400).json({ message: 'This poll is no longer active' });
    }
    
    // Check if poll deadline has passed
    if (poll.deadline && new Date(poll.deadline) < new Date()) {
      return res.status(400).json({ message: 'This poll has expired' });
    }
    
    // Validate option index
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }
    
    // Check if user has already voted
    const hasVoted = poll.options.some(option => 
      option.votes.some(vote => vote.toString() === req.user._id.toString())
    );
    
    if (hasVoted) {
      return res.status(400).json({ message: 'You have already voted on this poll' });
    }
    
    // Add user's vote to the selected option
    poll.options[optionIndex].votes.push(req.user._id);
    
    await poll.save();
    
    // Populate the poll with updated data
    const updatedPoll = await Poll.findById(poll._id)
      .populate('createdBy', 'email role')
      .populate('options.votes', 'email');
    
    console.log(`[ENGAGEMENT] User ${req.user.email} voted on poll ${poll._id}, option ${optionIndex}`);
    res.json(updatedPoll);
  } catch (error) {
    console.error('Vote on poll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/polls', protect, authorize('manager', 'hr', 'admin'), async (req, res) => {
  try {
    // If created by manager or HR, ensure visibility is 'All' so it's visible to everyone
    const pollData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Managers' and HR's polls should be visible to all employees, admin, and HR
    if (req.user.role === 'manager' || req.user.role === 'hr') {
      pollData.visibility = 'All';
      console.log(`[ENGAGEMENT] ${req.user.role} creating poll - setting visibility to 'All'`);
    }
    
    const poll = await Poll.create(pollData);
    
    const populatedPoll = await Poll.findById(poll._id)
      .populate('createdBy', 'email role');
    
    console.log(`[ENGAGEMENT] Poll created by ${req.user.email} (${req.user.role}) - visible to all`);
    res.status(201).json(populatedPoll);
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

