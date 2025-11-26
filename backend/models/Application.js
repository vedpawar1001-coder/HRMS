const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  candidateInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    resume: { type: String, required: true },
    coverLetter: String,
    appliedJobRole: String, // Store the job role/title at time of application
    expectedSalary: Number,
    skills: [String],
    experience: String,
    education: String, // Extracted from resume or provided
    certifications: [String], // Extracted from resume or provided
    appliedDate: { type: Date, default: Date.now }
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  status: {
    type: String,
    enum: ['Application', 'Shortlisted', 'Interview', 'Selected', 'Offer', 'Onboarding', 'Rejected'],
    default: 'Application'
  },
  currentRound: {
    type: String,
    enum: ['Aptitude Test', 'Technical Round', 'Interview Round', 'HR Round', 'None'],
    default: 'None'
  },
  screening: {
    result: { type: String, enum: ['Fit', 'Partially Fit', 'Not Fit', 'Needs Manual Review'] },
    skillMatchPercentage: Number,
    overallMatchPercentage: Number,
    priorityScore: { type: String, enum: ['Low', 'Medium', 'High'] },
    screeningDate: Date,
    details: {
      skillsMatch: Object,
      experienceMatch: Object,
      educationMatch: Object,
      certificationsMatch: Object,
      domainMatch: Object,
      locationMatch: Object
    }
  },
  interviewRounds: [{
    roundType: { type: String, enum: ['Aptitude Test', 'Technical Round', 'Interview Round', 'HR Round'], required: true },
    status: { type: String, enum: ['Scheduled', 'Completed', 'Passed', 'Failed', 'No Show', 'Rescheduled'], default: 'Scheduled' },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },
    evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    feedback: String,
    rating: { type: Number, min: 1, max: 5 },
    mode: { type: String, enum: ['Online', 'Offline'], default: 'Online' },
    meetingLink: String,
    venue: String,
    notes: String,
    completedAt: Date,
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: Date,
    noShowReason: String
  }],
  statusHistory: [{
    status: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Allow null for public applications
    updatedDate: { type: Date, default: Date.now },
    comments: String,
    rejectionReason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  offerLetter: {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OfferTemplate' },
    generatedDate: Date,
    candidateName: String,
    jobTitle: String,
    salary: Number,
    joiningDate: Date,
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    department: String,
    workType: { type: String, enum: ['WFH', 'WFO', 'Hybrid'] },
    workLocation: String,
    probationPeriod: String,
    noticePeriod: String,
    additionalTerms: String,
    expiryDate: Date,
    status: { type: String, enum: ['Pending', 'Sent', 'Accepted', 'Rejected', 'Expired'], default: 'Pending' },
    documentUrl: String,
    sentAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
    acceptedBy: String // Candidate email or ID
  },
  isDuplicate: {
    type: Boolean,
    default: false
  },
  inTalentPool: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for duplicate detection
applicationSchema.index({ 'candidateInfo.email': 1, 'candidateInfo.phone': 1 });

module.exports = mongoose.model('Application', applicationSchema);

