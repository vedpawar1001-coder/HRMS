const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    unique: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // Will be linked after onboarding
    required: false
  },
  candidateName: String,
  jobTitle: String,
  joiningDate: Date,
  documents: [{
    name: {
      type: String,
      enum: ['Aadhaar', 'PAN', 'Address Proof', 'Bank Details', 'Education Certificate', 'Experience Letter', 'Photo', 'Resume'],
      required: true
    },
    required: { type: Boolean, default: true },
    documentUrl: String,
    uploadedAt: Date,
    status: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: String
  }],
  checklist: {
    documentsUploaded: { type: Boolean, default: false },
    documentsVerified: { type: Boolean, default: false },
    profileCreated: { type: Boolean, default: false },
    accountActivated: { type: Boolean, default: false }
  },
  onboardingLink: {
    type: String,
    unique: true
  },
  onboardingStatus: {
    type: String,
    enum: ['Pending', 'Started', 'Documents Submitted', 'Documents Verified', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  hrAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startDate: Date,
  endDate: Date,
  startedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Onboarding', onboardingSchema);

