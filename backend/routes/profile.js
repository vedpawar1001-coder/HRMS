const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Employee = require('../models/Employee');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { maskAadhaar, maskPAN, maskMobile } = require('../utils/encryption');
const { decrypt } = require('../utils/encryption');
const { calculateAge, calculateWorkAnniversary } = require('../utils/validation');

const router = express.Router();

// Helper to mask employee data based on role
function maskEmployeeData(emp, userRole) {
  // Clone the employee object
  const masked = emp.toObject ? emp.toObject() : { ...emp };
  
  // Add calculated fields
  if (emp.personalInfo?.dateOfBirth) {
    masked.age = calculateAge(emp.personalInfo.dateOfBirth);
  }
  
  if (emp.companyDetails?.joiningDate) {
    masked.workAnniversary = calculateWorkAnniversary(emp.companyDetails.joiningDate);
  }
  
  return masked;
}

// @route   GET /api/profile/my-profile
// @desc    Get current user's profile
// @access  Private
router.get('/my-profile', protect, async (req, res) => {
  try {
    // Refresh user from DB to get latest data
    let user = await User.findById(req.user._id);
    if (!user) {
      console.error(`[PROFILE] User not found in database: ${req.user._id}, email: ${req.user.email}`);
      return res.status(401).json({ 
        message: 'User session expired or account not found. Please login again.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Auto-create profile if doesn't exist (for employees and managers)
    // Skip HR users - they have their own profile route
    if (!user.employeeId && (user.role === 'employee' || user.role === 'manager')) {
      console.log(`[PROFILE] Auto-creating employee profile for user: ${user.email}`);
      try {
        const { createOrGetEmployeeProfile } = require('../utils/createEmployeeProfile');
        const employee = await createOrGetEmployeeProfile(user);
        // Refresh user after creating profile
        user = await User.findById(req.user._id);
        console.log(`[PROFILE] Employee profile created: ${employee._id}`);
      } catch (error) {
        console.error('[PROFILE] Error auto-creating employee profile:', error);
        // Continue - might already exist
      }
    }
    
    // If user is HR, redirect them to HR profile route
    if (user.role === 'hr') {
      return res.status(400).json({ 
        message: 'HR users should use /api/hr-profile/my-profile endpoint',
        redirectTo: '/hr-profile'
      });
    }
    
    // SECURITY: Ensure employees can only access their own profile
    // Managers can access their own profile (editable) - team members are accessed via /:id route
    if (user.role === 'employee' && user.employeeId) {
      const employeeCheck = await Employee.findById(user.employeeId);
      if (employeeCheck && employeeCheck.userId && employeeCheck.userId.toString() !== user._id.toString()) {
        console.error(`[PROFILE] Security violation: User ${user._id} tried to access profile ${user.employeeId} which belongs to ${employeeCheck.userId}`);
        return res.status(403).json({ 
          message: 'Access denied. You can only view your own profile.',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // Get employee profile
    let employee = await Employee.findById(user.employeeId);
    
    // If employee doesn't exist but employeeId is set, create it
    if (!employee && user.employeeId) {
      console.log(`[PROFILE] Employee ID exists but profile not found, creating new profile...`);
      try {
        const { createOrGetEmployeeProfile } = require('../utils/createEmployeeProfile');
        employee = await createOrGetEmployeeProfile(user);
        user = await User.findById(req.user._id);
      } catch (error) {
        console.error('[PROFILE] Error creating missing employee profile:', error);
        return res.status(500).json({ 
          message: 'Employee profile exists but data is missing. Please contact HR.',
          error: error.message
        });
      }
    }
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    // SECURITY: Final check - ensure the employee profile belongs to the logged-in user (for employees)
    // Managers can edit their own profile, but view team members via /:id route (view-only)
    if (user.role === 'employee' && employee.userId) {
      if (employee.userId.toString() !== user._id.toString()) {
        console.error(`[PROFILE] Security violation: User ${user._id} tried to access employee profile ${employee._id} which belongs to ${employee.userId}`);
        return res.status(403).json({ 
          message: 'Access denied. You can only view your own profile.',
          error: 'FORBIDDEN'
        });
      }
    }
    
    // For managers, allow editing only their own profile (accessed via /my-profile)
    // Team members are accessed via /:id route which is view-only
    if (user.role === 'manager' && employee.userId && employee.userId.toString() !== user._id.toString()) {
      console.error(`[PROFILE] Manager ${user._id} tried to access employee profile ${employee._id} via /my-profile route`);
      return res.status(403).json({ 
        message: 'Access denied. Managers can edit their own profile via this route. To view team members, use the employee list.',
        error: 'FORBIDDEN'
      });
    }
    
    // Force recalculation of profile completion (in case fields were updated)
    const oldCompletion = employee.profileCompletion || 0;
    employee.calculateProfileCompletion();
    const newCompletion = employee.profileCompletion;
    
    // Always save if completion changed to ensure accurate data
    if (newCompletion !== oldCompletion || !employee.profileCompletion) {
      await employee.save();
      console.log(`[PROFILE_GET] Completion recalculated: ${oldCompletion}% -> ${newCompletion}%`);
    }
    
    // Decrypt sensitive fields for editing (only for the owner)
    const maskedData = maskEmployeeData(employee, user.role);
    
    // If it's the employee's own profile, decrypt fields for editing
    if (employee.userId && employee.userId.toString() === user._id.toString()) {
      const { decrypt } = require('../utils/encryption');
      
      // Decrypt ID proofs for editing
      if (maskedData.idProofs) {
        if (maskedData.idProofs.aadhaar && maskedData.idProofs.aadhaar.includes(':')) {
          maskedData.idProofs.aadhaar = decrypt(maskedData.idProofs.aadhaar) || '';
        }
        if (maskedData.idProofs.pan && maskedData.idProofs.pan.includes(':')) {
          maskedData.idProofs.pan = decrypt(maskedData.idProofs.pan) || '';
        }
      }
      
      // Decrypt bank account for editing
      if (maskedData.bankDetails && maskedData.bankDetails.accountNumber && maskedData.bankDetails.accountNumber.includes(':')) {
        maskedData.bankDetails.accountNumber = decrypt(maskedData.bankDetails.accountNumber) || '';
      }
    }
    
    // Populate reporting manager name if it exists
    let reportingManagerInfo = null;
    if (employee.companyDetails?.reportingManager) {
      try {
        const reportingManager = await Employee.findById(employee.companyDetails.reportingManager)
          .select('personalInfo.fullName employeeId companyDetails.designation')
          .lean();
        if (reportingManager) {
          reportingManagerInfo = {
            _id: reportingManager._id,
            fullName: reportingManager.personalInfo?.fullName || 'Unknown',
            employeeId: reportingManager.employeeId,
            designation: reportingManager.companyDetails?.designation || 'Manager'
          };
        }
      } catch (error) {
        console.error('[PROFILE] Error fetching reporting manager info:', error);
      }
    }
    
    res.json({
      ...maskedData,
      profileCompletion: employee.profileCompletion,
      reportingManagerInfo: reportingManagerInfo
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/profile/completion-status
// @desc    Get detailed profile completion status showing missing fields
// @access  Private
router.get('/completion-status', protect, async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const hasValue = (value) => {
      if (!value) return false;
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return true;
    };
    
    const status = {
      personalInfo: {
        fullName: hasValue(employee.personalInfo?.fullName),
        email: hasValue(employee.personalInfo?.email),
        mobile: hasValue(employee.personalInfo?.mobile),
        dateOfBirth: !!employee.personalInfo?.dateOfBirth,
        gender: hasValue(employee.personalInfo?.gender),
        bloodGroup: hasValue(employee.personalInfo?.bloodGroup),
        maritalStatus: hasValue(employee.personalInfo?.maritalStatus),
        emergencyContactName: hasValue(employee.personalInfo?.emergencyContact?.name),
        emergencyContactNumber: hasValue(employee.personalInfo?.emergencyContact?.number),
        address: hasValue(employee.personalInfo?.address?.permanent?.city) || hasValue(employee.personalInfo?.address?.present?.city)
      },
      idProofs: {
        // Aadhaar and PAN are optional and not included in completion calculation
        aadhaar: !!(employee.idProofs?.aadhaar && employee.idProofs.aadhaar.trim().length > 0),
        pan: !!(employee.idProofs?.pan && employee.idProofs.pan.trim().length > 0)
      },
      companyDetails: {
        department: hasValue(employee.companyDetails?.department),
        designation: hasValue(employee.companyDetails?.designation),
        workType: hasValue(employee.companyDetails?.workType),
        location: hasValue(employee.companyDetails?.location)
      },
      documents: {
        aadhaarDoc: employee.documents?.some(doc => doc?.type === 'Aadhaar'),
        panDoc: employee.documents?.some(doc => doc?.type === 'PAN'),
        photoDoc: employee.documents?.some(doc => doc?.type === 'Photo')
      },
      bankDetails: {
        // Account Number is optional and not included in completion calculation
        accountNumber: !!(employee.bankDetails?.accountNumber && employee.bankDetails.accountNumber.trim().length > 0),
        ifscCode: hasValue(employee.bankDetails?.ifscCode),
        bankName: hasValue(employee.bankDetails?.bankName),
        branchName: hasValue(employee.bankDetails?.branchName),
        accountHolderName: hasValue(employee.bankDetails?.accountHolderName)
      }
    };
    
    // Calculate missing fields
    const missingFields = [];
    
    if (!status.personalInfo.fullName) missingFields.push('Full Name');
    if (!status.personalInfo.email) missingFields.push('Email');
    if (!status.personalInfo.mobile) missingFields.push('Mobile');
    if (!status.personalInfo.dateOfBirth) missingFields.push('Date of Birth');
    if (!status.personalInfo.gender) missingFields.push('Gender');
    if (!status.personalInfo.bloodGroup) missingFields.push('Blood Group');
    if (!status.personalInfo.maritalStatus) missingFields.push('Marital Status');
    if (!status.personalInfo.emergencyContactName) missingFields.push('Emergency Contact Name');
    if (!status.personalInfo.emergencyContactNumber) missingFields.push('Emergency Contact Number');
    if (!status.personalInfo.address) missingFields.push('Address (Permanent or Present)');
    
    // Aadhaar and PAN are optional - not included in completion or missing fields
    
    if (!status.companyDetails.department) missingFields.push('Department');
    if (!status.companyDetails.designation) missingFields.push('Designation');
    if (!status.companyDetails.workType) missingFields.push('Work Type');
    if (!status.companyDetails.location) missingFields.push('Location');
    
    if (!status.documents.aadhaarDoc) missingFields.push('Aadhaar Document Upload');
    if (!status.documents.panDoc) missingFields.push('PAN Document Upload');
    if (!status.documents.photoDoc) missingFields.push('Photo Document Upload');
    
    // Bank Account Number is optional - not included in completion or missing fields
    if (!status.bankDetails.ifscCode) missingFields.push('IFSC Code');
    if (!status.bankDetails.bankName) missingFields.push('Bank Name');
    if (!status.bankDetails.branchName) missingFields.push('Branch Name');
    if (!status.bankDetails.accountHolderName) missingFields.push('Account Holder Name');
    
    employee.calculateProfileCompletion();
    
    res.json({
      completion: employee.profileCompletion,
      status,
      missingFields,
      totalFields: 21, // Reduced from 24 (removed Aadhaar, PAN, Bank Account Number)
      completedFields: 21 - missingFields.length
    });
  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/profile/my-profile
// @desc    Update own profile (Employee self-service)
// @access  Private
router.put('/my-profile', protect, async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const updates = req.body;
    const oldValues = {};
    
    const { validateMobile, validateAadhaar, validatePAN, validatePincode } = require('../utils/validation');
    const { encrypt } = require('../utils/encryption');
    
    // Employees can update most personal fields (except email which is tied to user account)
    // Company details, salary, and employment status are HR-only
    
    // Validate and update Personal Information
    if (updates.personalInfo) {
      // Full Name
      if (updates.personalInfo.fullName !== undefined && updates.personalInfo.fullName.trim()) {
        oldValues['personalInfo.fullName'] = employee.personalInfo.fullName;
        employee.personalInfo.fullName = updates.personalInfo.fullName.trim();
      }
      
      // Mobile
      if (updates.personalInfo.mobile !== undefined) {
        if (updates.personalInfo.mobile && !validateMobile(updates.personalInfo.mobile)) {
          return res.status(400).json({ message: 'Invalid mobile number format. Please use 10 digits starting with 6-9' });
        }
        oldValues['personalInfo.mobile'] = employee.personalInfo.mobile;
        employee.personalInfo.mobile = updates.personalInfo.mobile;
      }
      
      // Date of Birth
      if (updates.personalInfo.dateOfBirth !== undefined) {
        const dob = new Date(updates.personalInfo.dateOfBirth);
        if (dob > new Date()) {
          return res.status(400).json({ message: 'Date of birth cannot be in the future' });
        }
        oldValues['personalInfo.dateOfBirth'] = employee.personalInfo.dateOfBirth;
        employee.personalInfo.dateOfBirth = dob;
      }
      
      // Gender
      if (updates.personalInfo.gender !== undefined) {
        if (updates.personalInfo.gender && !['Male', 'Female', 'Other'].includes(updates.personalInfo.gender)) {
          return res.status(400).json({ message: 'Invalid gender selection' });
        }
        oldValues['personalInfo.gender'] = employee.personalInfo.gender;
        employee.personalInfo.gender = updates.personalInfo.gender;
      }
      
      // Blood Group
      if (updates.personalInfo.bloodGroup !== undefined) {
        oldValues['personalInfo.bloodGroup'] = employee.personalInfo.bloodGroup;
        employee.personalInfo.bloodGroup = updates.personalInfo.bloodGroup;
      }
      
      // Marital Status
      if (updates.personalInfo.maritalStatus !== undefined) {
        oldValues['personalInfo.maritalStatus'] = employee.personalInfo.maritalStatus;
        employee.personalInfo.maritalStatus = updates.personalInfo.maritalStatus;
      }
      
      // Address
      if (updates.personalInfo.address) {
        const address = updates.personalInfo.address;
        oldValues['personalInfo.address'] = JSON.parse(JSON.stringify(employee.personalInfo.address));
        
        if (address.permanent) {
          if (address.permanent.pincode && !validatePincode(address.permanent.pincode)) {
            return res.status(400).json({ message: 'Invalid permanent address pincode (must be 6 digits)' });
          }
          employee.personalInfo.address.permanent = {
            ...employee.personalInfo.address.permanent,
            ...address.permanent
          };
        }
        if (address.present) {
          if (address.present.pincode && !validatePincode(address.present.pincode)) {
            return res.status(400).json({ message: 'Invalid present address pincode (must be 6 digits)' });
          }
          employee.personalInfo.address.present = {
            ...employee.personalInfo.address.present,
            ...address.present
          };
        }
      }
      
      // Emergency Contact
      if (updates.personalInfo.emergencyContact) {
        oldValues['personalInfo.emergencyContact'] = JSON.parse(JSON.stringify(employee.personalInfo.emergencyContact));
        if (updates.personalInfo.emergencyContact.number && !validateMobile(updates.personalInfo.emergencyContact.number)) {
          return res.status(400).json({ message: 'Invalid emergency contact number format' });
        }
        employee.personalInfo.emergencyContact = {
          ...employee.personalInfo.emergencyContact,
          ...updates.personalInfo.emergencyContact
        };
      }
    }
    
    // ID Proofs - Allow employees to add/update (will be verified by HR)
    if (updates.idProofs) {
      oldValues['idProofs'] = JSON.parse(JSON.stringify(employee.idProofs));
      
      // Initialize idProofs if it doesn't exist
      if (!employee.idProofs) {
        employee.idProofs = {};
      }
      
      // Aadhaar - only update if value is provided and not empty
      if (updates.idProofs.aadhaar !== undefined) {
        const aadhaarValue = updates.idProofs.aadhaar?.toString().trim() || '';
        if (aadhaarValue) {
          const cleanedAadhaar = aadhaarValue.replace(/\D/g, '');
          if (!validateAadhaar(cleanedAadhaar)) {
            return res.status(400).json({ message: 'Invalid Aadhaar number (must be 12 digits)' });
          }
          // Encrypt Aadhaar before storing
          employee.idProofs.aadhaar = encrypt(cleanedAadhaar);
          console.log('[PROFILE_UPDATE] Aadhaar encrypted and saved');
        }
      }
      
      // PAN - only update if value is provided and not empty
      if (updates.idProofs.pan !== undefined) {
        const panValue = updates.idProofs.pan?.toString().trim() || '';
        if (panValue) {
          const cleanedPAN = panValue.toUpperCase().replace(/\s/g, '');
          if (!validatePAN(cleanedPAN)) {
            return res.status(400).json({ message: 'Invalid PAN format (e.g., ABCDE1234F)' });
          }
          // Encrypt PAN before storing
          employee.idProofs.pan = encrypt(cleanedPAN);
          console.log('[PROFILE_UPDATE] PAN encrypted and saved');
        }
      }
      
      if (updates.idProofs.passport !== undefined) {
        employee.idProofs.passport = updates.idProofs.passport?.toString().trim() || employee.idProofs.passport;
      }
      
      if (updates.idProofs.drivingLicense !== undefined) {
        employee.idProofs.drivingLicense = updates.idProofs.drivingLicense?.toString().trim() || employee.idProofs.drivingLicense;
      }
    }
    
    // Employment Information - Allow employees to add previous companies
    if (updates.employmentInfo) {
      if (updates.employmentInfo.previousCompanies) {
        oldValues['employmentInfo.previousCompanies'] = JSON.parse(JSON.stringify(employee.employmentInfo.previousCompanies || []));
        // Preserve existing document URLs when updating companies
        employee.employmentInfo.previousCompanies = updates.employmentInfo.previousCompanies.map((company, index) => {
          const existingCompany = employee.employmentInfo.previousCompanies?.[index];
          return {
            companyName: company.companyName || '',
            position: company.position || '',
            startDate: company.startDate ? new Date(company.startDate) : null,
            endDate: company.endDate ? new Date(company.endDate) : null,
            experience: company.experience || '',
            experienceLetter: company.experienceLetter || existingCompany?.experienceLetter || '',
            salarySlip: company.salarySlip || existingCompany?.salarySlip || ''
          };
        });
      }
      
      if (updates.employmentInfo.previousSalary !== undefined) {
        oldValues['employmentInfo.previousSalary'] = employee.employmentInfo.previousSalary;
        employee.employmentInfo.previousSalary = updates.employmentInfo.previousSalary;
      }
    }
    
    // Company Details - Allow employees to update department, designation, workType, location
    // Joining date and employment status remain HR-only
    if (updates.companyDetails) {
      // Initialize companyDetails if it doesn't exist
      if (!employee.companyDetails) {
        employee.companyDetails = {};
        console.log('[PROFILE_UPDATE] Initialized companyDetails object');
      }
      
      // Store old values for logging (handle null/undefined)
      oldValues.companyDetails = employee.companyDetails ? JSON.parse(JSON.stringify(employee.companyDetails)) : {};
      
      // Update department (required field - must have a value)
      if (updates.companyDetails.department !== undefined) {
        const deptValue = updates.companyDetails.department?.trim() || '';
        if (deptValue) {
          employee.companyDetails.department = deptValue;
          console.log(`[PROFILE_UPDATE] Department updated: ${deptValue}`);
        } else {
          // If empty string is sent, keep existing value or set a default
          if (!employee.companyDetails.department) {
            return res.status(400).json({ message: 'Department is required and cannot be empty' });
          }
          console.log(`[PROFILE_UPDATE] Department not updated (empty value), keeping existing: ${employee.companyDetails.department}`);
        }
      }
      
      // Update designation (required field - must have a value)
      if (updates.companyDetails.designation !== undefined) {
        const desigValue = updates.companyDetails.designation?.trim() || '';
        if (desigValue) {
          employee.companyDetails.designation = desigValue;
          console.log(`[PROFILE_UPDATE] Designation updated: ${desigValue}`);
        } else {
          // If empty string is sent, keep existing value or set a default
          if (!employee.companyDetails.designation) {
            return res.status(400).json({ message: 'Designation is required and cannot be empty' });
          }
          console.log(`[PROFILE_UPDATE] Designation not updated (empty value), keeping existing: ${employee.companyDetails.designation}`);
        }
      }
      
      // Update workType
      if (updates.companyDetails.workType !== undefined) {
        if (updates.companyDetails.workType && !['WFH', 'WFO', 'Hybrid'].includes(updates.companyDetails.workType)) {
          return res.status(400).json({ message: 'Invalid work type. Must be WFH, WFO, or Hybrid' });
        }
        employee.companyDetails.workType = updates.companyDetails.workType || null;
        console.log(`[PROFILE_UPDATE] WorkType updated: ${updates.companyDetails.workType}`);
      }
      
      // Update location
      if (updates.companyDetails.location !== undefined) {
        employee.companyDetails.location = updates.companyDetails.location || null;
        console.log(`[PROFILE_UPDATE] Location updated: ${updates.companyDetails.location}`);
      }
      
      // Reporting Manager - Allow employees to set their reporting manager
      if (updates.companyDetails.reportingManager !== undefined) {
        if (updates.companyDetails.reportingManager) {
          // Validate that the reporting manager exists
          const reportingManager = await Employee.findById(updates.companyDetails.reportingManager);
          if (!reportingManager) {
            return res.status(400).json({ message: 'Invalid reporting manager selected' });
          }
          // Ensure reportingManager is stored as ObjectId for consistent querying
          const mongoose = require('mongoose');
          employee.companyDetails.reportingManager = mongoose.Types.ObjectId.isValid(updates.companyDetails.reportingManager) 
            ? new mongoose.Types.ObjectId(updates.companyDetails.reportingManager)
            : updates.companyDetails.reportingManager;
          
          console.log(`[PROFILE_UPDATE] Reporting Manager updated: ${employee.companyDetails.reportingManager} (${reportingManager.personalInfo?.fullName || reportingManager.employeeId})`);
        } else {
          // Allow clearing the reporting manager (set to null/undefined)
          employee.companyDetails.reportingManager = undefined;
          console.log(`[PROFILE_UPDATE] Reporting Manager cleared`);
        }
      }
      
      // Mark companyDetails as modified to ensure it's saved
      employee.markModified('companyDetails');
      console.log('[PROFILE_UPDATE] Company details marked as modified');
      
      // Joining date and employment status cannot be updated by employees (HR-only)
    }
    
    if (updates.bankDetails) {
      oldValues.bankDetails = JSON.parse(JSON.stringify(employee.bankDetails));
      
      // Initialize bankDetails if it doesn't exist
      if (!employee.bankDetails) {
        employee.bankDetails = {};
      }
      
      // Account Number - only update if value is provided and not empty
      if (updates.bankDetails.accountNumber !== undefined) {
        const accountValue = updates.bankDetails.accountNumber?.toString().trim() || '';
        if (accountValue) {
          // Encrypt account number
          const encrypted = encrypt(accountValue);
          employee.bankDetails.accountNumber = encrypted;
          console.log('[PROFILE_UPDATE] Bank account number encrypted and saved');
        }
      }
      
      if (updates.bankDetails.ifscCode !== undefined) {
        const ifscValue = updates.bankDetails.ifscCode?.toString().trim() || '';
        if (ifscValue) {
          employee.bankDetails.ifscCode = ifscValue.toUpperCase();
        }
      }
      
      if (updates.bankDetails.bankName !== undefined) {
        const bankNameValue = updates.bankDetails.bankName?.toString().trim() || '';
        if (bankNameValue) {
          employee.bankDetails.bankName = bankNameValue;
        }
      }
      
      if (updates.bankDetails.branchName !== undefined) {
        const branchValue = updates.bankDetails.branchName?.toString().trim() || '';
        if (branchValue) {
          employee.bankDetails.branchName = branchValue;
        }
      }
      
      if (updates.bankDetails.accountHolderName !== undefined) {
        const holderValue = updates.bankDetails.accountHolderName?.toString().trim() || '';
        if (holderValue) {
          employee.bankDetails.accountHolderName = holderValue;
        }
      }
    }
    
    // Log changes
    Object.keys(oldValues).forEach(field => {
      employee.addActivityLog('Profile Updated', field, oldValues[field], updates[field] || employee[field], req.user._id);
    });
    
    // Debug: Log what's being saved
    console.log('[PROFILE_UPDATE] Fields being saved:', {
      hasIdProofs: !!employee.idProofs,
      hasAadhaar: !!employee.idProofs?.aadhaar,
      hasPAN: !!employee.idProofs?.pan,
      hasBankAccount: !!employee.bankDetails?.accountNumber,
      hasCompanyDetails: !!employee.companyDetails,
      companyDepartment: employee.companyDetails?.department,
      companyDesignation: employee.companyDetails?.designation,
      companyWorkType: employee.companyDetails?.workType,
      companyLocation: employee.companyDetails?.location,
      aadhaarLength: employee.idProofs?.aadhaar?.length || 0,
      panLength: employee.idProofs?.pan?.length || 0,
      accountLength: employee.bankDetails?.accountNumber?.length || 0
    });
    
    // Recalculate profile completion BEFORE saving
    const completionBeforeSave = employee.profileCompletion || 0;
    employee.calculateProfileCompletion();
    const completionAfterCalc = employee.profileCompletion;
    console.log('[PROFILE_UPDATE] Calculated completion BEFORE save:', completionBeforeSave + '% -> ' + completionAfterCalc + '%');
    
    // Ensure all modified fields are marked
    if (employee.isModified('companyDetails')) {
      console.log('[PROFILE_UPDATE] Company details has been modified, will be saved');
    }
    
    // Validate required fields before saving
    if (!employee.companyDetails?.department) {
      return res.status(400).json({ message: 'Department is required. Please select a department.' });
    }
    if (!employee.companyDetails?.designation) {
      return res.status(400).json({ message: 'Designation is required. Please select a designation.' });
    }
    if (!employee.companyDetails?.joiningDate) {
      // Set a default joining date if not set (should be set by HR, but allow update to proceed)
      if (!employee.companyDetails.joiningDate) {
        employee.companyDetails.joiningDate = new Date();
        console.log('[PROFILE_UPDATE] Set default joining date');
      }
    }
    
    // Save to database
    try {
      await employee.save();
      console.log('[PROFILE_UPDATE] Employee saved successfully to database');
      console.log('[PROFILE_UPDATE] Saved company details:', {
        department: employee.companyDetails?.department,
        designation: employee.companyDetails?.designation,
        workType: employee.companyDetails?.workType,
        location: employee.companyDetails?.location,
        reportingManager: employee.companyDetails?.reportingManager
      });
    } catch (saveError) {
      console.error('[PROFILE_UPDATE] Error saving employee:', saveError);
      console.error('[PROFILE_UPDATE] Save error details:', {
        name: saveError.name,
        message: saveError.message,
        errors: saveError.errors
      });
      
      // Return more specific error messages
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.keys(saveError.errors || {}).map(key => ({
          field: key,
          message: saveError.errors[key].message
        }));
        return res.status(400).json({ 
          message: 'Validation error while saving profile',
          errors: validationErrors,
          error: saveError.message
        });
      }
      
      throw saveError;
    }
    
    // Reload from database to ensure we have the latest data
    const saved = await Employee.findById(employee._id);
    
    // Force recalculation after save to ensure accuracy
    saved.calculateProfileCompletion();
    const finalCompletion = saved.profileCompletion;
    
    // Save again if completion changed
    if (finalCompletion !== saved.profileCompletion || saved.isModified('profileCompletion')) {
      await saved.save();
      console.log('[PROFILE_UPDATE] Final completion after save:', finalCompletion + '%');
    }
    
    // Debug: Log completion calculation details
    console.log('[PROFILE_UPDATE] Completion details:', {
      before: completionBeforeSave,
      afterCalc: completionAfterCalc,
      final: finalCompletion,
      totalFields: 21, // Updated total after removing 3 optional fields
      calculatedFields: Math.round((finalCompletion / 100) * 21)
    });
    
    // Refresh employee from database to get latest state
    const updatedEmployee = await Employee.findById(req.user.employeeId);
    
    // Decrypt sensitive fields for response (for the owner)
    const maskedData = maskEmployeeData(updatedEmployee, req.user.role);
    const { decrypt } = require('../utils/encryption');
    
    if (maskedData.idProofs) {
      if (maskedData.idProofs.aadhaar && maskedData.idProofs.aadhaar.includes(':')) {
        maskedData.idProofs.aadhaar = decrypt(maskedData.idProofs.aadhaar) || '';
      }
      if (maskedData.idProofs.pan && maskedData.idProofs.pan.includes(':')) {
        maskedData.idProofs.pan = decrypt(maskedData.idProofs.pan) || '';
      }
    }
    
    if (maskedData.bankDetails && maskedData.bankDetails.accountNumber && maskedData.bankDetails.accountNumber.includes(':')) {
      maskedData.bankDetails.accountNumber = decrypt(maskedData.bankDetails.accountNumber) || '';
    }
    
    // Populate reporting manager info if it exists
    let reportingManagerInfo = null;
    if (updatedEmployee.companyDetails?.reportingManager) {
      try {
        const reportingManager = await Employee.findById(updatedEmployee.companyDetails.reportingManager)
          .select('personalInfo.fullName employeeId companyDetails.designation')
          .lean();
        if (reportingManager) {
          reportingManagerInfo = {
            _id: reportingManager._id,
            fullName: reportingManager.personalInfo?.fullName || 'Unknown',
            employeeId: reportingManager.employeeId,
            designation: reportingManager.companyDetails?.designation || 'Manager'
          };
        }
      } catch (error) {
        console.error('[PROFILE_UPDATE] Error fetching reporting manager info:', error);
      }
    }
    
    // Verify company details were saved
    console.log('[PROFILE_UPDATE] Verifying saved company details in response:', {
      department: maskedData.companyDetails?.department,
      designation: maskedData.companyDetails?.designation,
      workType: maskedData.companyDetails?.workType,
      location: maskedData.companyDetails?.location
    });
    
    res.json({
      ...maskedData,
      reportingManagerInfo: reportingManagerInfo,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/profile/upload-document
// @desc    Upload document
// @access  Private
router.post('/upload-document', protect, upload.single('document'), async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    // Get all fields from request body (multer parses FormData)
    // Multer stores text fields in req.body, file in req.file
    const documentType = req.body?.documentType;
    const companyIndexRaw = req.body?.companyIndex;
    const documentCategoryRaw = req.body?.documentCategory;
    
    // Convert to strings and trim - FormData sends everything as strings
    const companyIndexStr = companyIndexRaw !== undefined && companyIndexRaw !== null 
                            ? String(companyIndexRaw).trim() 
                            : null;
    const documentCategoryStr = documentCategoryRaw !== undefined && documentCategoryRaw !== null
                                ? String(documentCategoryRaw).trim()
                                : null;
    
    // Debug: Log everything we receive
    console.log('[UPLOAD] ========== UPLOAD DEBUG START ==========');
    console.log('[UPLOAD] Has file:', !!req.file);
    console.log('[UPLOAD] File name:', req.file?.filename);
    console.log('[UPLOAD] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[UPLOAD] Body keys:', Object.keys(req.body || {}));
    console.log('[UPLOAD] Body type:', typeof req.body);
    console.log('[UPLOAD] documentType:', documentType);
    console.log('[UPLOAD] companyIndexRaw:', companyIndexRaw, typeof companyIndexRaw);
    console.log('[UPLOAD] companyIndexStr:', companyIndexStr);
    console.log('[UPLOAD] documentCategoryRaw:', documentCategoryRaw, typeof documentCategoryRaw);
    console.log('[UPLOAD] documentCategoryStr:', documentCategoryStr);
    console.log('[UPLOAD] ========== UPLOAD DEBUG END ==========');
    
    // If uploading for a specific company (Experience Letter or Salary Slip)
    // Check if companyIndex and documentCategory are provided
    // companyIndex can be "0" (string) which is valid - handle explicitly
    
    // First, check if we have both fields (even if empty string, we check)
    const hasCompanyIndexField = companyIndexStr !== null && companyIndexStr !== undefined;
    const hasCategoryField = documentCategoryStr !== null && documentCategoryStr !== undefined;
    
    // Then validate the values
    const isValidCompanyIndex = hasCompanyIndexField && 
                                companyIndexStr !== '' && 
                                !isNaN(parseInt(companyIndexStr, 10)) && 
                                parseInt(companyIndexStr, 10) >= 0;
    const isValidCategory = hasCategoryField && 
                            documentCategoryStr !== '' &&
                            (documentCategoryStr === 'experienceLetter' || documentCategoryStr === 'salarySlip');
    
    const isCompanyDocument = isValidCompanyIndex && isValidCategory;
    
    console.log('[UPLOAD] Document type check:', {
      isCompanyDocument,
      hasCompanyIndexField,
      hasCategoryField,
      isValidCompanyIndex,
      isValidCategory,
      companyIndexStr,
      companyIndexStrType: typeof companyIndexStr,
      companyIndexStrValue: JSON.stringify(companyIndexStr),
      documentCategoryStr,
      documentCategoryStrType: typeof documentCategoryStr,
      documentCategoryStrValue: JSON.stringify(documentCategoryStr),
      parsedCompanyIndex: companyIndexStr !== null ? parseInt(companyIndexStr, 10) : 'N/A',
      willProcessAsCompanyDocument: isCompanyDocument
    });
    
    // PROCESS COMPANY DOCUMENT UPLOAD
    if (isCompanyDocument) {
      const companyIdx = parseInt(companyIndexStr, 10);
      
      // Additional validation (should already be checked above)
      if (isNaN(companyIdx) || companyIdx < 0) {
        console.error('[UPLOAD] Invalid company index after parsing:', companyIndexStr);
        return res.status(400).json({ message: 'Invalid company index provided' });
      }
      
      // Ensure employmentInfo.previousCompanies array exists
      if (!employee.employmentInfo) {
        employee.employmentInfo = {};
      }
      if (!employee.employmentInfo.previousCompanies) {
        employee.employmentInfo.previousCompanies = [];
      }
      
      // If company doesn't exist at this index, create an empty one
      if (!employee.employmentInfo.previousCompanies[companyIdx]) {
        console.log('[UPLOAD] Company not found at index:', companyIdx, 'Creating empty company entry. Total companies:', employee.employmentInfo.previousCompanies?.length || 0);
        
        // Create empty company entries up to the required index
        while (employee.employmentInfo.previousCompanies.length <= companyIdx) {
          employee.employmentInfo.previousCompanies.push({
            companyName: '',
            position: '',
            startDate: null,
            endDate: null,
            experience: '',
            experienceLetter: '',
            salarySlip: ''
          });
        }
        
        // Save the empty company structure first
        try {
          await employee.save();
          console.log('[UPLOAD] Created empty company entry at index:', companyIdx);
        } catch (saveError) {
          console.error('[UPLOAD] Error creating company entry:', saveError);
          return res.status(500).json({ 
            message: 'Failed to create company entry. Please add the company information first and save it before uploading documents.' 
          });
        }
      }
      
      const fileUrl = `/uploads/${req.user._id}/${req.file.filename}`;
      
      // Update the specific company's document
      if (documentCategoryStr === 'experienceLetter') {
        employee.employmentInfo.previousCompanies[companyIdx].experienceLetter = fileUrl;
      } else if (documentCategoryStr === 'salarySlip') {
        employee.employmentInfo.previousCompanies[companyIdx].salarySlip = fileUrl;
      } else {
        return res.status(400).json({ message: 'Invalid document category. Use experienceLetter or salarySlip' });
      }
      
      try {
        employee.addActivityLog('Company Document Uploaded', `previousCompanies[${companyIdx}].${documentCategoryStr}`, null, documentCategoryStr, req.user._id);
        
        // Recalculate profile completion
        employee.calculateProfileCompletion();
        
        // Save the employee document
        await employee.save();
        
        console.log(`[UPLOAD] Company document saved: ${documentCategoryStr} for company ${companyIdx}, URL: ${fileUrl}`);
        
        // Fetch the updated employee to ensure we have the latest data
        const updatedEmployee = await Employee.findById(req.user.employeeId);
        
        if (!updatedEmployee) {
          console.error('[UPLOAD] Failed to fetch updated employee after save');
          return res.status(500).json({ message: 'Document uploaded but failed to refresh profile data. Please refresh the page.' });
        }
        
        // Get the updated company data
        const updatedCompany = updatedEmployee.employmentInfo?.previousCompanies?.[companyIdx];
        
        if (!updatedCompany) {
          console.error('[UPLOAD] Company not found after save at index:', companyIdx);
          return res.status(500).json({ message: 'Document uploaded but company data not found. Please refresh the page.' });
        }
        
        console.log(`[UPLOAD] Updated company data:`, {
          companyName: updatedCompany?.companyName,
          experienceLetter: updatedCompany?.experienceLetter,
          salarySlip: updatedCompany?.salarySlip,
          companyIndex: companyIdx,
          documentCategory: documentCategoryStr
        });
        
        // Verify the document was saved correctly
        const savedDocumentUrl = documentCategoryStr === 'experienceLetter' 
          ? updatedCompany?.experienceLetter 
          : updatedCompany?.salarySlip;
        
        if (!savedDocumentUrl || savedDocumentUrl !== fileUrl) {
          console.error('[UPLOAD] Document URL mismatch!', {
            expected: fileUrl,
            actual: savedDocumentUrl,
            companyIndex: companyIdx,
            documentCategory: documentCategoryStr
          });
          return res.status(500).json({ 
            message: 'Document uploaded but failed to save to database. Please try again.' 
          });
        }
        
        console.log('[UPLOAD] Document successfully saved to database:', {
          fileUrl: savedDocumentUrl,
          companyIndex: companyIdx,
          documentCategory: documentCategoryStr,
          employeeId: req.user.employeeId
        });
        
        return res.json({
          message: `${documentCategoryStr === 'experienceLetter' ? 'Experience Letter' : 'Salary Slip'} uploaded and saved successfully`,
          url: fileUrl,
          companyIndex: companyIdx,
          documentCategory: documentCategoryStr,
          companyName: updatedCompany?.companyName || 'Unknown Company',
          company: {
            experienceLetter: updatedCompany?.experienceLetter || '',
            salarySlip: updatedCompany?.salarySlip || ''
          }
        });
      } catch (saveError) {
        console.error('[UPLOAD] Error saving employee document:', saveError);
        console.error('[UPLOAD] Save error details:', {
          message: saveError.message,
          stack: saveError.stack,
          name: saveError.name,
          errors: saveError.errors
        });
        
        // Check if it's a validation error
        if (saveError.name === 'ValidationError') {
          const validationErrors = Object.values(saveError.errors || {}).map(err => err.message).join(', ');
          return res.status(400).json({ 
            message: `Validation error: ${validationErrors || saveError.message}`,
            error: process.env.NODE_ENV === 'development' ? saveError.message : undefined
          });
        }
        
        return res.status(500).json({ 
          message: 'Failed to save document. Please try again.',
          error: process.env.NODE_ENV === 'development' ? saveError.message : undefined
        });
      }
    }
    
    // Regular document upload (general documents)
    // Only require documentType if this is NOT a company document upload
    if (!documentType) {
      console.error('[UPLOAD] ========== ERROR: Document type missing ==========');
      console.error('[UPLOAD] This should have been a company document upload but validation failed!');
      console.error('[UPLOAD] Received values:', {
        documentType,
        companyIndexRaw,
        companyIndexStr,
        documentCategoryRaw,
        documentCategoryStr,
        bodyKeys: Object.keys(req.body || {}),
        fullBody: JSON.stringify(req.body, null, 2)
      });
      console.error('[UPLOAD] Validation results:', {
        hasCompanyIndexField,
        hasCategoryField,
        isValidCompanyIndex,
        isValidCategory,
        isCompanyDocument
      });
      console.error('[UPLOAD] ========== END ERROR ==========');
      return res.status(400).json({ 
        message: 'Document type is required. If uploading for a company, ensure companyIndex and documentCategory are provided correctly.',
        received: { 
          documentType, 
          companyIndex: companyIndexStr,
          documentCategory: documentCategoryStr,
          bodyKeys: Object.keys(req.body || {})
        },
        debug: {
          hasCompanyIndexField,
          hasCategoryField,
          isValidCompanyIndex,
          isValidCategory,
          isCompanyDocument
        }
      });
    }
    
    const fileUrl = `/uploads/${req.user._id}/${req.file.filename}`;
    
    employee.documents.push({
      type: documentType,
      url: fileUrl,
      status: 'Pending',
      uploadedAt: new Date()
    });
    
    employee.addActivityLog('Document Uploaded', 'documents', null, documentType, req.user._id);
    
    employee.calculateProfileCompletion();
    await employee.save();
    
    res.json({
      message: 'Document uploaded successfully',
      document: {
        type: documentType,
        url: fileUrl,
        status: 'Pending'
      }
    });
  } catch (error) {
    console.error('[UPLOAD] Upload document error:', error);
    console.error('[UPLOAD] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      errors: error.errors
    });
    
    // Check if it's a multer error (file upload error)
    if (error.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 5MB limit' });
      }
      return res.status(400).json({ message: `File upload error: ${error.message}` });
    }
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map(err => err.message).join(', ');
      return res.status(400).json({ 
        message: `Validation error: ${validationErrors || error.message}`
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to upload document. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/profile/recalculate
// @desc    Force recalculate profile completion
// @access  Private
router.post('/recalculate', protect, async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const oldCompletion = employee.profileCompletion || 0;
    employee.calculateProfileCompletion();
    const newCompletion = employee.profileCompletion;
    await employee.save();
    
    res.json({
      message: 'Profile completion recalculated',
      oldCompletion,
      newCompletion,
      completion: newCompletion
    });
  } catch (error) {
    console.error('Recalculate profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/profile/submit
// @desc    Submit profile for review (only when 100% complete)
// @access  Private
router.post('/submit', protect, async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    // Check if profile is 100% complete
    employee.calculateProfileCompletion();
    if (employee.profileCompletion < 100) {
      return res.status(400).json({ 
        message: `Profile must be 100% complete before submission. Current completion: ${employee.profileCompletion}%`,
        completion: employee.profileCompletion
      });
    }
    
    // Check if already submitted
    if (employee.profileStatus === 'Submitted' || employee.profileStatus === 'Under Review' || employee.profileStatus === 'Approved') {
      return res.status(400).json({ 
        message: `Profile has already been submitted. Current status: ${employee.profileStatus}`,
        status: employee.profileStatus,
        submittedAt: employee.profileSubmittedAt
      });
    }
    
    // Update status to Submitted
    employee.profileStatus = 'Submitted';
    employee.profileSubmittedAt = new Date();
    
    // Add activity log
    employee.addActivityLog('Profile Submitted', 'profileStatus', 'Draft', 'Submitted', req.user._id);
    
    await employee.save();
    
    res.json({
      message: 'Profile submitted successfully for HR review',
      profileStatus: employee.profileStatus,
      submittedAt: employee.profileSubmittedAt,
      completion: employee.profileCompletion
    });
  } catch (error) {
    console.error('Submit profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/profile/timeline
// @desc    Get employee activity timeline (own profile or employee profile for HR)
// @access  Private
router.get('/timeline', protect, async (req, res) => {
  try {
    let employeeId = req.user.employeeId;
    
    // HR can view timeline for specific employee via query parameter
    if (req.user.role === 'hr' || req.user.role === 'admin') {
      if (req.query.employeeId) {
        employeeId = req.query.employeeId;
      }
    }
    
    if (!employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    // Security check: employees can only view their own timeline
    if (req.user.role === 'employee' && employee._id.toString() !== req.user.employeeId?.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only view your own timeline.' });
    }
    
    // Combine activity logs and lifecycle stages
    const timeline = [
      ...employee.activityLog.map(log => ({
        type: 'activity',
        action: log.action,
        field: log.field,
        updatedBy: log.updatedBy,
        updatedAt: log.updatedAt
      })),
      ...employee.lifecycleStages.map(stage => ({
        type: 'lifecycle',
        stage: stage.stage,
        date: stage.date,
        performedBy: stage.performedBy,
        comments: stage.comments
      }))
    ].sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
    
    res.json(timeline);
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// IMPORTANT: Document verification routes must come BEFORE /:id route to avoid route conflicts
// @route   PUT /api/profile/:id/documents/:docIndex/verify
// @desc    Verify a document (HR only)
// @access  Private (HR, Admin)
router.put('/:id/documents/:docIndex/verify', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    console.log('[VERIFY_DOCUMENT] Route hit:', {
      employeeId: req.params.id,
      docIndex: req.params.docIndex,
      user: req.user?.email,
      role: req.user?.role
    });
    const employeeId = req.params.id;
    const docIndex = parseInt(req.params.docIndex);
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    if (!employee.documents || !employee.documents[docIndex]) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Update document status
    employee.documents[docIndex].status = 'Verified';
    employee.documents[docIndex].verifiedBy = req.user._id;
    employee.documents[docIndex].verifiedAt = new Date();
    employee.documents[docIndex].rejectionReason = undefined; // Clear rejection reason if any
    
    await employee.save();
    
    res.json({
      message: 'Document verified successfully',
      document: employee.documents[docIndex]
    });
  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   PUT /api/profile/:id/documents/:docIndex/reject
// @desc    Reject a document (HR only)
// @access  Private (HR, Admin)
router.put('/:id/documents/:docIndex/reject', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    console.log('[REJECT_DOCUMENT] Route hit:', {
      employeeId: req.params.id,
      docIndex: req.params.docIndex,
      user: req.user?.email,
      role: req.user?.role
    });
    const employeeId = req.params.id;
    const docIndex = parseInt(req.params.docIndex);
    const { rejectionReason } = req.body;
    
    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    if (!employee.documents || !employee.documents[docIndex]) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Update document status
    employee.documents[docIndex].status = 'Rejected';
    employee.documents[docIndex].verifiedBy = req.user._id;
    employee.documents[docIndex].verifiedAt = new Date();
    employee.documents[docIndex].rejectionReason = rejectionReason.trim();
    
    await employee.save();
    
    res.json({
      message: 'Document rejected successfully',
      document: employee.documents[docIndex]
    });
  } catch (error) {
    console.error('Reject document error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   GET /api/profile/:id
// @desc    Get employee profile by ID (for managers to view team members - view-only)
// @access  Private (Manager, HR, Admin)
router.get('/:id', protect, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const employee = await Employee.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    // SECURITY: Check access permissions
    if (req.user.role === 'employee') {
      // Employees can only view their own profile
      if (!req.user.employeeId || employee._id.toString() !== req.user.employeeId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view your own profile.',
          error: 'FORBIDDEN'
        });
      }
    } else if (req.user.role === 'manager') {
      // Managers can view their own profile OR their team members' profiles
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        return res.status(404).json({ 
          message: 'Manager profile not found.',
          error: 'NOT_FOUND'
        });
      }
      
      const isTeamMember = employee.companyDetails?.reportingManager?.toString() === manager._id?.toString() ||
                           employee.companyDetails?.reportingManager?.toString() === manager.employeeId?.toString();
      const isOwnProfile = employee._id.toString() === req.user.employeeId?.toString();
      
      console.log('[PROFILE_GET_BY_ID] Manager access check:', {
        managerId: manager._id,
        employeeId: employee._id,
        employeeReportingManager: employee.companyDetails?.reportingManager,
        isTeamMember,
        isOwnProfile
      });
      
      if (!isTeamMember && !isOwnProfile) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view your team members\' profiles.',
          error: 'FORBIDDEN'
        });
      }
    }
    // HR/Admin can view all profiles
    
    // Mask sensitive data based on role (managers viewing team members get masked data)
    const isOwnProfile = employee.userId && employee.userId.toString() === req.user._id.toString();
    const maskedData = maskEmployeeData(employee, isOwnProfile ? req.user.role : 'viewer');
    
    // Recalculate profile completion
    employee.calculateProfileCompletion();
    
    // Populate reporting manager name if it exists
    let reportingManagerInfo = null;
    if (employee.companyDetails?.reportingManager) {
      try {
        const reportingManager = await Employee.findById(employee.companyDetails.reportingManager)
          .select('personalInfo.fullName employeeId companyDetails.designation')
          .lean();
        if (reportingManager) {
          reportingManagerInfo = {
            _id: reportingManager._id,
            fullName: reportingManager.personalInfo?.fullName || 'Unknown',
            employeeId: reportingManager.employeeId,
            designation: reportingManager.companyDetails?.designation || 'Manager'
          };
        }
      } catch (error) {
        console.error('[PROFILE] Error fetching reporting manager info:', error);
      }
    }
    
    res.json({
      ...maskedData,
      profileCompletion: employee.profileCompletion,
      isViewOnly: !isOwnProfile, // Flag to indicate if this is view-only mode
      reportingManagerInfo: reportingManagerInfo
    });
  } catch (error) {
    console.error('Get profile by ID error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;