const mongoose = require('mongoose');

const grievanceSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  type: {
    type: String,
    enum: ['Grievance', 'Complaint', 'Query', 'Suggestion'],
    required: true
  },
  category: {
    type: String,
    enum: ['HR Issues', 'Salary Issues', 'IT Support', 'Workplace Complaints', 'Policy Queries', 'Facilities/Maintenance'],
    required: true
  },
  subCategory: String,
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  attachments: [String],
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  comments: [{
    commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: String,
    attachments: [String],
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  statusHistory: [{
    status: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: Date,
    comments: String
  }],
  escalation: {
    level: { type: Number, default: 0 },
    escalatedAt: Date,
    escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  sla: {
    hours: Number,
    deadline: Date,
    breached: { type: Boolean, default: false }
  },
  tags: [String],
  resolution: {
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionDetails: String
  },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    submittedAt: Date
  }
}, {
  timestamps: true
});

// Auto-generate ticket number
grievanceSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await mongoose.model('Grievance').countDocuments();
    this.ticketNumber = `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Grievance', grievanceSchema);

