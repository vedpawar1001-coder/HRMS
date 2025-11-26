const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  reviewCycle: {
    type: String,
    enum: ['Quarterly', 'Half-Yearly', 'Yearly'],
    required: true
  },
  period: {
    type: String,
    required: true // e.g., "Q1-2025", "H1-2025", "2025"
  },
  startDate: Date,
  endDate: Date,
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0
  },
  kpis: [{
    title: String,
    description: String,
    weightage: Number,
    targetValue: Number,
    achievedValue: Number,
    rating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ['Achieved', 'In Progress', 'Behind Target'] }
  }],
  okrs: [{
    objective: String,
    keyResults: [{
      description: String,
      target: String,
      current: String,
      completion: Number
    }],
    overallCompletion: Number
  }],
  selfAssessment: {
    achievements: String,
    challenges: String,
    trainingNeeds: String,
    completedAt: Date
  },
  managerReview: {
    overallRating: { type: Number, min: 1, max: 5 },
    feedback: String,
    improvementPlan: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date
  },
  hrReview: {
    approved: Boolean,
    adjustedRating: Number,
    comments: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date
  },
  incentives: {
    amount: Number,
    approved: Boolean
  },
  promotion: {
    recommended: Boolean,
    newDesignation: String,
    effectiveDate: Date
  },
  status: {
    type: String,
    enum: ['Draft', 'Self Assessment', 'Manager Review', 'HR Review', 'Completed', 'Locked'],
    default: 'Draft'
  },
  feedbacks: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    type: { type: String, enum: ['Manager', 'Employee', 'Continuous'] },
    message: String,
    createdAt: Date
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Performance', performanceSchema);

