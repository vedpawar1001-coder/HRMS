const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  attachments: [String],
  visibility: {
    type: String,
    enum: ['All', 'Department'],
    default: 'All'
  },
  departments: [String],
  expiryDate: Date,
  isPinned: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true
});

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{
    text: String,
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  deadline: Date,
  visibility: {
    type: String,
    enum: ['All', 'Department'],
    default: 'All'
  },
  departments: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const surveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: [{
    question: String,
    type: { type: String, enum: ['MCQ', 'Text'] },
    options: [String]
  }],
  isAnonymous: { type: Boolean, default: false },
  deadline: Date,
  responses: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    answers: [{
      questionId: mongoose.Schema.Types.ObjectId,
      answer: String
    }],
    submittedAt: Date
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  time: String,
  location: String,
  type: { type: String, enum: ['Festival', 'HR Event', 'Training', 'Important'], default: 'HR Event' },
  attachments: [String],
  visibility: {
    type: String,
    enum: ['All', 'Department'],
    default: 'All'
  },
  departments: [String],
  rsvp: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['Yes', 'No', 'Maybe'] }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

const feedbackSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  category: { type: String, enum: ['HR', 'Management', 'Workplace', 'Policy'], required: true },
  message: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  status: { type: String, enum: ['Pending', 'Reviewed', 'Resolved'], default: 'Pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date
}, {
  timestamps: true
});

module.exports = {
  Announcement: mongoose.model('Announcement', announcementSchema),
  Poll: mongoose.model('Poll', pollSchema),
  Survey: mongoose.model('Survey', surveySchema),
  Event: mongoose.model('Event', eventSchema),
  Feedback: mongoose.model('Feedback', feedbackSchema)
};

