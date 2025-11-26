const mongoose = require('mongoose');
const crypto = require('crypto');

const hrSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true
  },
  hrId: {
    type: String,
    unique: true,
    required: false // Will be auto-generated
  },
  personalInfo: {
    fullName: { type: String, required: false }, // Make optional for auto-creation
    email: { type: String, required: false, unique: true }, // Make optional for auto-creation
    mobile: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    bloodGroup: String,
    maritalStatus: String,
    emergencyContact: {
      name: String,
      number: String
    },
    address: {
      permanent: {
        street: String,
        city: String,
        state: String,
        pincode: String
      },
      present: {
        street: String,
        city: String,
        state: String,
        pincode: String
      }
    }
  },
  idProofs: {
    aadhaar: String, // Will be encrypted
    pan: String, // Will be encrypted
    passport: String,
    drivingLicense: String,
    documents: [{
      type: { type: String },
      url: String,
      uploadedAt: Date
    }]
  },
  companyDetails: {
    joiningDate: { type: Date },
    department: { type: String, default: 'Human Resources' },
    designation: { type: String },
    workType: { type: String, enum: ['WFH', 'WFO', 'Hybrid'], default: 'WFO' },
    location: String,
    employmentStatus: {
      type: String,
      enum: ['Active', 'Resigned', 'Terminated', 'On Notice Period'],
      default: 'Active'
    },
    employeeCode: String
  },
  bankDetails: {
    accountNumber: String, // Encrypted
    ifscCode: String,
    bankName: String,
    branchName: String,
    accountHolderName: String,
    chequeImage: String,
    passbookImage: String
  },
  employmentInfo: {
    previousCompanies: [{
      companyName: String,
      position: String,
      startDate: Date,
      endDate: Date,
      experience: String,
      experienceLetter: String,
      salarySlip: String
    }],
    previousSalary: Number
  },
  documents: [{
    type: { type: String, enum: ['Aadhaar', 'PAN', 'Photo', 'Resume', 'Other'] },
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  profileStatus: {
    type: String,
    enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'],
    default: 'Draft'
  },
  profileSubmittedAt: {
    type: Date
  },
  activityLog: [{
    action: String,
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  collection: 'hrprofiles' // Separate collection name
});

// Generate unique HR ID
hrSchema.methods.generateUniqueHRId = async function() {
  const currentYear = new Date().getFullYear();
  const prefix = `HR-${currentYear}-`;
  
  // Find the highest HR ID for current year
  const lastHR = await mongoose.model('HR').findOne({
    hrId: { $regex: `^${prefix}` }
  }).sort({ hrId: -1 });
  
  let sequence = 1;
  if (lastHR && lastHR.hrId) {
    const lastSequence = parseInt(lastHR.hrId.split('-')[2]) || 0;
    sequence = lastSequence + 1;
  }
  
  // Format: HR-YYYY-NNNNN
  const hrId = `${prefix}${String(sequence).padStart(5, '0')}`;
  
  // Ensure uniqueness
  const exists = await mongoose.model('HR').findOne({ hrId });
  if (exists) {
    // If duplicate, try with timestamp
    return `${prefix}${Date.now().toString().slice(-5)}`;
  }
  
  return hrId;
};

// Pre-save hook to generate HR ID
hrSchema.pre('validate', async function(next) {
  if (!this.hrId) {
    try {
      this.hrId = await this.generateUniqueHRId();
      console.log(`[HR_MODEL] Generated HR ID: ${this.hrId}`);
    } catch (error) {
      console.error('[HR_MODEL] Error generating HR ID:', error);
      // Fallback to timestamp-based ID
      this.hrId = `HR-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    }
  }
  next();
});

// Calculate profile completion
hrSchema.methods.calculateProfileCompletion = function() {
  const hasValue = (val) => val !== null && val !== undefined && val !== '';
  
  let completedFields = 0;
  const totalFields = 21; // Total fields to track
  
  // Personal Info (7 fields)
  if (hasValue(this.personalInfo?.fullName)) completedFields++;
  if (hasValue(this.personalInfo?.email)) completedFields++;
  if (hasValue(this.personalInfo?.mobile)) completedFields++;
  if (hasValue(this.personalInfo?.dateOfBirth)) completedFields++;
  if (hasValue(this.personalInfo?.gender)) completedFields++;
  if (hasValue(this.personalInfo?.bloodGroup)) completedFields++;
  if (hasValue(this.personalInfo?.maritalStatus)) completedFields++;
  
  // Address (at least one address)
  if (hasValue(this.personalInfo?.address?.permanent?.city) || 
      hasValue(this.personalInfo?.address?.present?.city)) completedFields++;
  
  // Emergency Contact
  if (hasValue(this.personalInfo?.emergencyContact?.name)) completedFields++;
  if (hasValue(this.personalInfo?.emergencyContact?.number)) completedFields++;
  
  // Company Details (4 fields)
  if (hasValue(this.companyDetails?.department)) completedFields++;
  if (hasValue(this.companyDetails?.designation)) completedFields++;
  if (hasValue(this.companyDetails?.workType)) completedFields++;
  if (hasValue(this.companyDetails?.location)) completedFields++;
  
  // Documents (3 fields)
  if (this.documents?.some(doc => doc?.type === 'Aadhaar')) completedFields++;
  if (this.documents?.some(doc => doc?.type === 'PAN')) completedFields++;
  if (this.documents?.some(doc => doc?.type === 'Photo')) completedFields++;
  
  // Bank Details (4 fields - account number is optional)
  if (hasValue(this.bankDetails?.ifscCode)) completedFields++;
  if (hasValue(this.bankDetails?.bankName)) completedFields++;
  if (hasValue(this.bankDetails?.branchName)) completedFields++;
  if (hasValue(this.bankDetails?.accountHolderName)) completedFields++;
  
  this.profileCompletion = Math.round((completedFields / totalFields) * 100);
  return this.profileCompletion;
};

// Add activity log
hrSchema.methods.addActivityLog = function(action, field, oldValue, newValue, updatedBy) {
  this.activityLog.push({
    action,
    field,
    oldValue,
    newValue,
    updatedBy,
    updatedAt: new Date()
  });
  
  // Keep only last 100 activity logs
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(-100);
  }
};

// Virtual for age
hrSchema.virtual('age').get(function() {
  if (!this.personalInfo?.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.personalInfo.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for work anniversary
hrSchema.virtual('workAnniversary').get(function() {
  if (!this.companyDetails?.joiningDate) return null;
  const today = new Date();
  const joiningDate = new Date(this.companyDetails.joiningDate);
  let years = today.getFullYear() - joiningDate.getFullYear();
  const monthDiff = today.getMonth() - joiningDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < joiningDate.getDate())) {
    years--;
  }
  return years;
});

module.exports = mongoose.model('HR', hrSchema);

