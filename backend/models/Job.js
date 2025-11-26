const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    skills: [String],
    minExperience: Number,
    education: String,
    certifications: [String],
    domain: String,
    location: String
  },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'On Hold'],
    default: 'Open'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  postedDate: {
    type: Date,
    default: Date.now
  },
  closingDate: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', jobSchema);

