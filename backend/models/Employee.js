const mongoose = require('mongoose');
const crypto = require('crypto');

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true
  },
  employeeId: {
    type: String,
    unique: true,
    required: false // Will be auto-generated in pre-save hook or manually
  },
  personalInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
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
    aadhaar:  String , // Will be encrypted
    pan: String , // Will be encrypted
    passport: String,
    drivingLicense: String,
    documents: [{
      type: { type: String },
      url: String,
      uploadedAt: Date
    }]
  },
  bankDetails: {
    accountNumber:  String , // Encrypted
    ifscCode: String,
    bankName: String,
    branchName: String,
    accountHolderName: String,
    chequeImage: String, // URL to uploaded cheque/passbook
    passbookImage: String // URL to passbook image
  },
  exitData: {
    exitDate: Date,
    reason: String,
    fullAndFinal: {
      amount: Number,
      status: { type: String, enum: ['Pending', 'Processing', 'Completed'], default: 'Pending' },
      completedDate: Date
    },
    relievingLetter: String, // URL to uploaded document
    exitInterview: {
      conducted: { type: Boolean, default: false },
      conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      conductedDate: Date,
      feedback: String
    }
  },
  companyDetails: {
    joiningDate: { type: Date, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    workType: { type: String, enum: ['WFH', 'WFO', 'Hybrid'], default: 'WFO' },
    location: String,
    employmentStatus: {
      type: String,
      enum: ['Active', 'Resigned', 'Terminated', 'On Notice Period'],
      default: 'Active'
    },
    monthlySalary: { type: Number, default: 0 },
    salaryStatus: {
      type: String,
      enum: ['Active', 'On Hold', 'Suspended'],
      default: 'Active'
    },
    salaryLastUpdated: Date,
    salaryUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  employmentInfo: {
    previousCompanies: [{
      companyName: String,
      position: String,
      startDate: Date,
      endDate: Date,
      experience: String,
      experienceLetter: String, // URL to uploaded experience letter document
      salarySlip: String // URL to uploaded salary slip document
    }],
    totalExperience: String,
    previousSalary: Number,
    experienceCertificates: [String]
  },
  salaryRevisionHistory: [{
    effectiveDate: Date,
    oldSalary: Number,
    newSalary: Number,
    reason: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: Date
  }],
  documents: [{
    type: { type: String },
    url: String,
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
    uploadedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    rejectionReason: String
  }],
  lifecycleStages: [{
    stage: { type: String, enum: ['Joining', 'Confirmation', 'Transfer', 'Promotion', 'Resignation', 'Exit'] },
    date: Date,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comments: String,
    documents: [String],
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
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
    action: String, // e.g., 'Profile Updated', 'Document Uploaded', 'Salary Revised'
    field: String, // Field that was changed
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Virtual for age (calculated on the fly)
employeeSchema.virtual('age').get(function() {
  if (!this.personalInfo?.dateOfBirth) return null;
  const { calculateAge } = require('../utils/validation');
  return calculateAge(this.personalInfo.dateOfBirth);
});

// Virtual for work anniversary (calculated on the fly)
employeeSchema.virtual('workAnniversary').get(function() {
  if (!this.companyDetails?.joiningDate) return null;
  const { calculateWorkAnniversary } = require('../utils/validation');
  return calculateWorkAnniversary(this.companyDetails.joiningDate);
});

// Encrypt sensitive fields before saving
employeeSchema.pre('save', async function(next) {
  // Calculate total experience
  if (this.employmentInfo.previousCompanies && this.employmentInfo.previousCompanies.length > 0) {
    const { calculateTotalExperience } = require('../utils/validation');
    this.employmentInfo.totalExperience = calculateTotalExperience(this.employmentInfo.previousCompanies);
  }
  
  // Note: Encryption will be handled in routes before saving
  next();
});

// Helper function to generate unique employee ID
async function generateUniqueEmployeeId() {
  const year = new Date().getFullYear();
  const EmployeeModel = mongoose.model('Employee');
  
  try {
    // Find the highest employee ID number for the current year
    const employeesWithId = await EmployeeModel.find({
      employeeId: { $regex: new RegExp(`^EMP-${year}-`) }
    }).select('employeeId').sort({ employeeId: -1 }).limit(1);
    
    let count = 0;
    
    if (employeesWithId.length > 0 && employeesWithId[0].employeeId) {
      // Extract number from latest employee ID (format: EMP-2025-00001)
      const match = employeesWithId[0].employeeId.match(/-(\d+)$/);
      if (match) {
        count = parseInt(match[1], 10);
      }
    } else {
      // Fallback: count all employees
      count = await EmployeeModel.countDocuments();
    }
    
    // Generate new employee ID with increment
    let newEmployeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
    
    // Ensure uniqueness - check if exists and increment if needed
    let exists = await EmployeeModel.findOne({ employeeId: newEmployeeId });
    let attempts = 0;
    const maxAttempts = 100; // Increased for safety
    
    while (exists && attempts < maxAttempts) {
      count++;
      newEmployeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
      exists = await EmployeeModel.findOne({ employeeId: newEmployeeId });
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      // Last resort: use timestamp-based ID
      const timestamp = Date.now().toString().slice(-6);
      newEmployeeId = `EMP-${year}-${timestamp}`;
      console.warn(`[EMPLOYEE_ID] Used timestamp-based ID after ${maxAttempts} attempts: ${newEmployeeId}`);
    }
    
    return newEmployeeId;
  } catch (error) {
    console.error('[EMPLOYEE_ID] Error generating employeeId:', error);
    // Fallback employeeId with timestamp
    const timestamp = Date.now().toString().slice(-6);
    return `EMP-${year}-${timestamp}`;
  }
}

// Auto-generate Employee ID - runs before validation to ensure it's set
employeeSchema.pre('validate', async function(next) {
  // Only generate if employeeId is missing
  if (!this.employeeId) {
    try {
      this.employeeId = await generateUniqueEmployeeId();
      console.log(`[EMPLOYEE_ID] Auto-generated employeeId: ${this.employeeId}`);
    } catch (error) {
      console.error('[EMPLOYEE_ID] Error in pre-validate hook:', error);
      // Fallback employeeId with timestamp
      const year = new Date().getFullYear();
      const timestamp = Date.now().toString().slice(-6);
      this.employeeId = `EMP-${year}-${timestamp}`;
    }
  }
  next();
});

// Calculate profile completion on save
employeeSchema.pre('save', async function(next) {
  // Calculate profile completion
  if (typeof this.calculateProfileCompletion === 'function') {
    this.calculateProfileCompletion();
  }
  next();
});

// Method to get masked sensitive data
employeeSchema.methods.getMaskedData = function() {
  return this.toObject(); // Masking will be done in routes
};

// Calculate profile completion
employeeSchema.methods.calculateProfileCompletion = function() {
  let completed = 0;
  let total = 0;

  // Helper function to check if field has value
  const hasValue = (value) => {
    if (!value) return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0;
    }
    return true;
  };

  // Personal Info (10 fields) - Core information
  total += 10;
  if (hasValue(this.personalInfo?.fullName)) completed++;
  if (hasValue(this.personalInfo?.email)) completed++;
  if (hasValue(this.personalInfo?.mobile)) completed++;
  if (this.personalInfo?.dateOfBirth) completed++;
  if (hasValue(this.personalInfo?.gender)) completed++;
  if (hasValue(this.personalInfo?.bloodGroup)) completed++;
  if (hasValue(this.personalInfo?.maritalStatus)) completed++;
  if (hasValue(this.personalInfo?.emergencyContact?.name)) completed++;
  if (hasValue(this.personalInfo?.emergencyContact?.number)) completed++;
  if (hasValue(this.personalInfo?.address?.permanent?.city) || hasValue(this.personalInfo?.address?.present?.city)) completed++;

  // ID Proofs - Aadhaar and PAN are optional and NOT included in completion calculation
  // These fields are encrypted but don't count towards profile completion

  // Company Details (4 fields) - Employee can edit these
  total += 4;
  if (hasValue(this.companyDetails?.department)) completed++;
  if (hasValue(this.companyDetails?.designation)) completed++;
  if (hasValue(this.companyDetails?.workType)) completed++;
  if (hasValue(this.companyDetails?.location)) completed++;
  // Note: reportingManager is HR-managed, not counted

  // Documents (3 key documents) - Count if uploaded (Pending status is OK)
  total += 3;
  const docTypes = ['Aadhaar', 'PAN', 'Photo'];
  docTypes.forEach(docType => {
    if (this.documents && this.documents.some(doc => doc && doc.type === docType)) {
      completed++; // Count if uploaded, even if Pending
    }
  });

  // Bank Details (4 fields) - Account number is encrypted and optional, NOT included in completion
  // Only other bank details count towards completion
  total += 4;
  if (hasValue(this.bankDetails?.ifscCode)) completed++;
  if (hasValue(this.bankDetails?.bankName)) completed++;
  if (hasValue(this.bankDetails?.branchName)) completed++;
  if (hasValue(this.bankDetails?.accountHolderName)) completed++;
  // Note: accountNumber is optional and doesn't count towards completion

  this.profileCompletion = Math.round((completed / total) * 100);
  return this.profileCompletion;
};

// Add activity log entry
employeeSchema.methods.addActivityLog = function(action, field, oldValue, newValue, updatedBy) {
  this.activityLog.push({
    action,
    field,
    oldValue,
    newValue,
    updatedBy,
    updatedAt: new Date()
  });
  // Keep only last 100 entries
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(-100);
  }
};

module.exports = mongoose.model('Employee', employeeSchema);

