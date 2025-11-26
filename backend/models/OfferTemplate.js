const mongoose = require('mongoose');

const offerTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  templateFile: {
    type: String, // URL or path to template file (PDF/DOCX)
    required: true
  },
  fileType: {
    type: String,
    enum: ['PDF', 'DOCX'],
    required: true
  },
  placeholders: [{
    key: String, // e.g., 'candidate_name', 'salary'
    label: String, // e.g., 'Candidate Name', 'Salary'
    required: { type: Boolean, default: false }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OfferTemplate', offerTemplateSchema);

