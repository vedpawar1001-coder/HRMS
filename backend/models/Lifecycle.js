const mongoose = require('mongoose');

const lifecycleSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  stages: [{
    stage: {
      type: String,
      enum: ['Joining', 'Confirmation', 'Transfer', 'Promotion', 'Resignation', 'Exit', 'Other'],
      required: true
    },
    stageDate: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comments: String,
    reason: String,
    supportingDocuments: [{
      type: String, // Document URL
      description: String
    }],
    newRole: String, // For promotion/transfer
    newDepartment: String, // For transfer
    oldDepartment: String, // For transfer
    exitDate: Date, // For resignation/exit
    exitType: { type: String, enum: ['Voluntary', 'Involuntary', 'Retirement'] } // For exit
  }],
  status: {
    type: String,
    enum: ['Active', 'On Notice Period', 'Resigned', 'Terminated', 'Retired', 'Inactive'],
    default: 'Active'
  },
  currentStage: {
    type: String,
    enum: ['Joining', 'Confirmation', 'Transfer', 'Promotion', 'Resignation', 'Exit', 'Other'],
    default: 'Joining'
  }
}, {
  timestamps: true
});

// Index for search
lifecycleSchema.index({ employeeId: 1 });
lifecycleSchema.index({ 'stages.stage': 1 });
lifecycleSchema.index({ currentStatus: 1 });

module.exports = mongoose.model('Lifecycle', lifecycleSchema);

