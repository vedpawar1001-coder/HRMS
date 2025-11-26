const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const HR = require('../models/HR');
const User = require('../models/User');
const router = express.Router();

// Helper function to mask sensitive data
function maskHRData(hr, viewerRole) {
  // Handle both Mongoose documents and plain objects
  let masked;
  if (hr && typeof hr.toObject === 'function') {
    masked = hr.toObject();
  } else if (hr && typeof hr === 'object') {
    masked = JSON.parse(JSON.stringify(hr)); // Deep clone
  } else {
    console.error('[HR_PROFILE] Invalid HR data passed to maskHRData:', hr);
    return {};
  }
  
  // Mask ID proofs
  if (masked.idProofs) {
    if (masked.idProofs.aadhaar) {
      const aadhaar = masked.idProofs.aadhaar;
      if (aadhaar.includes(':')) {
        // Encrypted - show masked
        masked.idProofs.aadhaar = 'XXXX-XXXX-' + aadhaar.slice(-4);
      } else if (aadhaar.length >= 4) {
        masked.idProofs.aadhaar = 'XXXX-XXXX-' + aadhaar.slice(-4);
      }
    }
    if (masked.idProofs.pan) {
      const pan = masked.idProofs.pan;
      if (pan.includes(':')) {
        // Encrypted - show masked
        masked.idProofs.pan = 'XXXXX' + pan.slice(-4) + 'X';
      } else if (pan.length >= 4) {
        masked.idProofs.pan = 'XXXXX' + pan.slice(-4) + 'X';
      }
    }
  }
  
  // Mask bank account number
  if (masked.bankDetails?.accountNumber) {
    const account = masked.bankDetails.accountNumber;
    if (account.includes(':')) {
      // Encrypted - show last 4 digits
      masked.bankDetails.accountNumber = 'XXXX' + account.slice(-4);
    } else if (account.length >= 4) {
      masked.bankDetails.accountNumber = 'XXXX' + account.slice(-4);
    }
  }
  
  return masked;
}

// @route   GET /api/hr-profile/my-profile
// @desc    Get current HR's profile
// @access  Private (HR, Admin)
router.get('/my-profile', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    console.log(`[HR_PROFILE] Fetching profile for user: ${req.user.email}, userId: ${req.user._id}, role: ${req.user.role}`);
    
    // Check if HR profile exists
    let hr = await HR.findOne({ userId: req.user._id });
    console.log(`[HR_PROFILE] HR profile lookup result:`, hr ? `Found (${hr._id})` : 'Not found');
    
    // For admin users, also check if they have an Employee profile
    if (!hr && req.user.role === 'admin') {
      console.log(`[HR_PROFILE] Checking for Employee profile for admin user`);
      const Employee = require('../models/Employee');
      const adminEmployee = await Employee.findOne({ userId: req.user._id });
      if (adminEmployee) {
        console.log(`[HR_PROFILE] Found Employee profile for admin: ${adminEmployee._id}, name: ${adminEmployee.personalInfo?.fullName || 'N/A'}`);
        if (adminEmployee.personalInfo?.fullName) {
          // Convert Employee profile to HR profile format for response
          const response = {
            ...adminEmployee.toObject(),
            personalInfo: {
              ...adminEmployee.personalInfo,
              fullName: adminEmployee.personalInfo.fullName
            }
          };
          console.log(`[HR_PROFILE] Returning Employee profile as HR profile for admin`);
          return res.json(response);
        }
      } else {
        console.log(`[HR_PROFILE] No Employee profile found for admin user`);
      }
    }
    
    if (!hr) {
      // Auto-create HR profile if it doesn't exist
      const roleLabel = req.user.role === 'admin' ? 'Admin' : 'HR User';
      console.log(`[HR_PROFILE] ${roleLabel} profile not found, auto-creating for user: ${req.user.email}`);
      
      try {
        // Extract name from email (part before @)
        const emailParts = req.user.email.split('@');
        let defaultName = roleLabel;
        if (emailParts[0]) {
          // Clean up the name - remove numbers and special chars, capitalize
          defaultName = emailParts[0]
            .replace(/[0-9]/g, '')
            .replace(/[^a-zA-Z]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .trim() || roleLabel;
        }
        
        // Ensure we have valid data
        const hrData = {
          userId: req.user._id,
          personalInfo: {
            fullName: defaultName,
            email: req.user.email || (req.user.role === 'admin' ? 'admin@company.com' : 'hr@company.com')
          },
          companyDetails: {
            department: req.user.role === 'admin' ? 'Administration' : 'Human Resources',
            employmentStatus: 'Active'
          }
        };
        
        console.log(`[HR_PROFILE] Creating HR profile with data:`, {
          userId: hrData.userId,
          fullName: hrData.personalInfo.fullName,
          email: hrData.personalInfo.email
        });
        
        hr = await HR.create(hrData);
        
        console.log(`[HR_PROFILE] HR profile created successfully: ${hr._id}, HR ID: ${hr.hrId}`);
        
        // Update user with HR profile reference
        try {
          await User.findByIdAndUpdate(req.user._id, { 
            $set: { hrId: hr._id } 
          });
          console.log(`[HR_PROFILE] User updated with hrId: ${hr._id}`);
        } catch (userUpdateError) {
          console.error('[HR_PROFILE] Error updating user with hrId:', userUpdateError);
          // Continue - profile is created, user update is not critical
        }
      } catch (createError) {
        console.error('[HR_PROFILE] Error creating HR profile:', createError);
        console.error('[HR_PROFILE] Create error details:', {
          name: createError.name,
          message: createError.message,
          errors: createError.errors
        });
        
        // Try to find if profile was created despite error
        hr = await HR.findOne({ userId: req.user._id });
        
        if (!hr) {
          return res.status(500).json({ 
            message: 'Failed to create HR profile. Please try again or contact administrator.',
            error: createError.message,
            details: process.env.NODE_ENV === 'development' ? createError.stack : undefined
          });
        }
      }
    } else {
      console.log(`[HR_PROFILE] Found existing HR profile: ${hr._id}, HR ID: ${hr.hrId || 'N/A'}, name: ${hr.personalInfo?.fullName || 'N/A'}`);
    }
    
    // Ensure hr exists before proceeding
    if (!hr) {
      console.error(`[HR_PROFILE] ERROR: HR profile is null after creation attempt`);
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    // Calculate profile completion
    if (hr && typeof hr.calculateProfileCompletion === 'function') {
      hr.calculateProfileCompletion();
      await hr.save();
    }
    
    // Decrypt sensitive fields for editing (only for the owner)
    const maskedData = maskHRData(hr, req.user.role);
    const { decrypt } = require('../utils/encryption');
    
    // Decrypt for editing
    if (maskedData.idProofs) {
      if (maskedData.idProofs.aadhaar && hr.idProofs?.aadhaar?.includes(':')) {
        try {
          maskedData.idProofs.aadhaar = decrypt(hr.idProofs.aadhaar) || '';
        } catch (decryptError) {
          console.error('[HR_PROFILE] Error decrypting Aadhaar:', decryptError);
          maskedData.idProofs.aadhaar = '';
        }
      }
      if (maskedData.idProofs.pan && hr.idProofs?.pan?.includes(':')) {
        try {
          maskedData.idProofs.pan = decrypt(hr.idProofs.pan) || '';
        } catch (decryptError) {
          console.error('[HR_PROFILE] Error decrypting PAN:', decryptError);
          maskedData.idProofs.pan = '';
        }
      }
    }
    
    if (maskedData.bankDetails && maskedData.bankDetails.accountNumber && hr.bankDetails?.accountNumber?.includes(':')) {
      try {
        maskedData.bankDetails.accountNumber = decrypt(hr.bankDetails.accountNumber) || '';
      } catch (decryptError) {
        console.error('[HR_PROFILE] Error decrypting bank account:', decryptError);
        maskedData.bankDetails.accountNumber = '';
      }
    }
    
    // Ensure personalInfo.fullName exists
    if (!maskedData.personalInfo) {
      maskedData.personalInfo = {};
    }
    if (!maskedData.personalInfo.fullName) {
      // Extract name from email if not set
      const emailParts = req.user.email.split('@');
      let defaultName = req.user.role === 'admin' ? 'Admin' : 'HR User';
      if (emailParts[0]) {
        defaultName = emailParts[0]
          .replace(/[0-9]/g, '')
          .replace(/[^a-zA-Z]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
          .trim() || defaultName;
      }
      maskedData.personalInfo.fullName = defaultName;
      console.log(`[HR_PROFILE] Setting default name: ${defaultName}`);
    }
    
    console.log(`[HR_PROFILE] Returning profile with name: ${maskedData.personalInfo.fullName}`);
    
    const responseData = {
      ...maskedData,
      profileCompletion: hr.profileCompletion || 0
    };
    
    // Ensure response is always sent
    if (!res.headersSent) {
      res.json(responseData);
      console.log(`[HR_PROFILE] Response sent successfully`);
    } else {
      console.error(`[HR_PROFILE] WARNING: Response already sent, cannot send again`);
    }
  } catch (error) {
    console.error('[HR_PROFILE] Get HR profile error:', error);
    console.error('[HR_PROFILE] Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// @route   PUT /api/hr-profile/my-profile
// @desc    Update HR's own profile
// @access  Private (HR)
router.put('/my-profile', protect, authorize('hr'), async (req, res) => {
  try {
    let hr = await HR.findOne({ userId: req.user._id });
    
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    const updates = req.body;
    const oldValues = {};
    
    const { validateMobile, validateAadhaar, validatePAN, validatePincode } = require('../utils/validation');
    const { encrypt } = require('../utils/encryption');
    
    // Update Personal Information
    if (updates.personalInfo) {
      if (updates.personalInfo.fullName !== undefined) {
        const fullNameValue = updates.personalInfo.fullName;
        if (fullNameValue && typeof fullNameValue === 'string' && fullNameValue.trim()) {
          oldValues['personalInfo.fullName'] = hr.personalInfo.fullName;
          hr.personalInfo.fullName = fullNameValue.trim();
        } else if (fullNameValue === null || fullNameValue === '') {
          // Don't update if empty or null
        }
      }
      
      if (updates.personalInfo.mobile !== undefined) {
        if (updates.personalInfo.mobile && !validateMobile(updates.personalInfo.mobile)) {
          return res.status(400).json({ message: 'Invalid mobile number format' });
        }
        oldValues['personalInfo.mobile'] = hr.personalInfo.mobile;
        hr.personalInfo.mobile = updates.personalInfo.mobile;
      }
      
      if (updates.personalInfo.dateOfBirth !== undefined) {
        const dob = new Date(updates.personalInfo.dateOfBirth);
        if (dob > new Date()) {
          return res.status(400).json({ message: 'Date of birth cannot be in the future' });
        }
        oldValues['personalInfo.dateOfBirth'] = hr.personalInfo.dateOfBirth;
        hr.personalInfo.dateOfBirth = dob;
      }
      
      if (updates.personalInfo.gender !== undefined) {
        if (updates.personalInfo.gender && !['Male', 'Female', 'Other'].includes(updates.personalInfo.gender)) {
          return res.status(400).json({ message: 'Invalid gender selection' });
        }
        oldValues['personalInfo.gender'] = hr.personalInfo.gender;
        hr.personalInfo.gender = updates.personalInfo.gender;
      }
      
      if (updates.personalInfo.bloodGroup !== undefined) {
        oldValues['personalInfo.bloodGroup'] = hr.personalInfo.bloodGroup;
        hr.personalInfo.bloodGroup = updates.personalInfo.bloodGroup;
      }
      
      if (updates.personalInfo.maritalStatus !== undefined) {
        oldValues['personalInfo.maritalStatus'] = hr.personalInfo.maritalStatus;
        hr.personalInfo.maritalStatus = updates.personalInfo.maritalStatus;
      }
      
      // Address
      if (updates.personalInfo.address) {
        const address = updates.personalInfo.address;
        oldValues['personalInfo.address'] = JSON.parse(JSON.stringify(hr.personalInfo.address));
        
        if (address.permanent) {
          if (address.permanent.pincode && !validatePincode(address.permanent.pincode)) {
            return res.status(400).json({ message: 'Invalid permanent address pincode' });
          }
          hr.personalInfo.address.permanent = {
            ...hr.personalInfo.address.permanent,
            ...address.permanent
          };
        }
        if (address.present) {
          if (address.present.pincode && !validatePincode(address.present.pincode)) {
            return res.status(400).json({ message: 'Invalid present address pincode' });
          }
          hr.personalInfo.address.present = {
            ...hr.personalInfo.address.present,
            ...address.present
          };
        }
      }
      
      // Emergency Contact
      if (updates.personalInfo.emergencyContact) {
        oldValues['personalInfo.emergencyContact'] = JSON.parse(JSON.stringify(hr.personalInfo.emergencyContact));
        if (updates.personalInfo.emergencyContact.number && !validateMobile(updates.personalInfo.emergencyContact.number)) {
          return res.status(400).json({ message: 'Invalid emergency contact number format' });
        }
        hr.personalInfo.emergencyContact = {
          ...hr.personalInfo.emergencyContact,
          ...updates.personalInfo.emergencyContact
        };
      }
    }
    
    // ID Proofs
    if (updates.idProofs) {
      oldValues['idProofs'] = JSON.parse(JSON.stringify(hr.idProofs));
      
      if (!hr.idProofs) {
        hr.idProofs = {};
      }
      
      if (updates.idProofs.aadhaar !== undefined) {
        const aadhaarValue = updates.idProofs.aadhaar?.toString().trim() || '';
        if (aadhaarValue) {
          const cleanedAadhaar = aadhaarValue.replace(/\D/g, '');
          if (!validateAadhaar(cleanedAadhaar)) {
            return res.status(400).json({ message: 'Invalid Aadhaar number (must be 12 digits)' });
          }
          hr.idProofs.aadhaar = encrypt(cleanedAadhaar);
        }
      }
      
      if (updates.idProofs.pan !== undefined) {
        const panValue = updates.idProofs.pan?.toString().trim() || '';
        if (panValue) {
          const cleanedPAN = panValue.toUpperCase().replace(/\s/g, '');
          if (!validatePAN(cleanedPAN)) {
            return res.status(400).json({ message: 'Invalid PAN format' });
          }
          hr.idProofs.pan = encrypt(cleanedPAN);
        }
      }
      
      if (updates.idProofs.passport !== undefined) {
        const passportValue = updates.idProofs.passport;
        hr.idProofs.passport = (passportValue && typeof passportValue === 'string') 
          ? passportValue.trim() 
          : (passportValue || hr.idProofs.passport || '');
      }
      
      if (updates.idProofs.drivingLicense !== undefined) {
        const licenseValue = updates.idProofs.drivingLicense;
        hr.idProofs.drivingLicense = (licenseValue && typeof licenseValue === 'string') 
          ? licenseValue.trim() 
          : (licenseValue || hr.idProofs.drivingLicense || '');
      }
    }
    
    // Company Details
    if (updates.companyDetails) {
      if (!hr.companyDetails) {
        hr.companyDetails = {
          department: 'Human Resources',
          employmentStatus: 'Active'
        };
      }
      
      oldValues.companyDetails = JSON.parse(JSON.stringify(hr.companyDetails));
      
      if (updates.companyDetails.department !== undefined) {
        // Ensure department is not empty string - set to default if empty
        const deptValue = updates.companyDetails.department;
        hr.companyDetails.department = (deptValue && typeof deptValue === 'string' && deptValue.trim()) 
          ? deptValue.trim() 
          : 'Human Resources';
      }
      
      if (updates.companyDetails.designation !== undefined) {
        // Allow empty designation or set to null
        const desigValue = updates.companyDetails.designation;
        hr.companyDetails.designation = (desigValue && typeof desigValue === 'string' && desigValue.trim()) 
          ? desigValue.trim() 
          : null;
      }
      
      if (updates.companyDetails.workType !== undefined) {
        if (updates.companyDetails.workType && !['WFH', 'WFO', 'Hybrid'].includes(updates.companyDetails.workType)) {
          return res.status(400).json({ message: 'Invalid work type' });
        }
        hr.companyDetails.workType = updates.companyDetails.workType || 'WFO';
      }
      
      if (updates.companyDetails.location !== undefined) {
        const locValue = updates.companyDetails.location;
        hr.companyDetails.location = (locValue && typeof locValue === 'string' && locValue.trim()) 
          ? locValue.trim() 
          : null;
      }
      
      if (updates.companyDetails.employeeCode !== undefined) {
        const codeValue = updates.companyDetails.employeeCode;
        hr.companyDetails.employeeCode = (codeValue && typeof codeValue === 'string' && codeValue.trim()) 
          ? codeValue.trim() 
          : null;
      }
      
      // Ensure employmentStatus is set
      if (!hr.companyDetails.employmentStatus) {
        hr.companyDetails.employmentStatus = 'Active';
      }
    }
    
    // Employment Information
    if (updates.employmentInfo) {
      if (!hr.employmentInfo) {
        hr.employmentInfo = {
          previousCompanies: [],
          previousSalary: null
        };
      }
      
      if (updates.employmentInfo.previousCompanies !== undefined) {
        oldValues['employmentInfo.previousCompanies'] = JSON.parse(JSON.stringify(hr.employmentInfo.previousCompanies || []));
        // Ensure previousCompanies is an array
        if (Array.isArray(updates.employmentInfo.previousCompanies)) {
          hr.employmentInfo.previousCompanies = updates.employmentInfo.previousCompanies.map((company) => {
            // Safely handle null/undefined values - convert to empty string or null as appropriate
            const safeString = (val) => {
              if (val === null || val === undefined) return '';
              if (typeof val === 'string') return val.trim();
              return String(val).trim();
            };
            
            return {
              companyName: safeString(company.companyName),
              position: safeString(company.position),
              startDate: company.startDate ? new Date(company.startDate) : null,
              endDate: company.endDate ? new Date(company.endDate) : null,
              experience: safeString(company.experience),
              experienceLetter: company.experienceLetter || null,
              salarySlip: company.salarySlip || null
            };
          });
        } else {
          hr.employmentInfo.previousCompanies = [];
        }
      }
      
      if (updates.employmentInfo.previousSalary !== undefined) {
        oldValues['employmentInfo.previousSalary'] = hr.employmentInfo.previousSalary;
        hr.employmentInfo.previousSalary = updates.employmentInfo.previousSalary || null;
      }
    }
    
    // Bank Details
    if (updates.bankDetails) {
      if (!hr.bankDetails) {
        hr.bankDetails = {};
      }
      
      oldValues.bankDetails = JSON.parse(JSON.stringify(hr.bankDetails));
      
      if (updates.bankDetails.accountNumber !== undefined) {
        const accountValue = updates.bankDetails.accountNumber?.toString().trim() || '';
        if (accountValue) {
          hr.bankDetails.accountNumber = encrypt(accountValue);
        }
      }
      
      if (updates.bankDetails.ifscCode !== undefined) {
        hr.bankDetails.ifscCode = updates.bankDetails.ifscCode?.toString().trim().toUpperCase() || '';
      }
      
      if (updates.bankDetails.bankName !== undefined) {
        hr.bankDetails.bankName = updates.bankDetails.bankName?.toString().trim() || '';
      }
      
      if (updates.bankDetails.branchName !== undefined) {
        hr.bankDetails.branchName = updates.bankDetails.branchName?.toString().trim() || '';
      }
      
      if (updates.bankDetails.accountHolderName !== undefined) {
        hr.bankDetails.accountHolderName = updates.bankDetails.accountHolderName?.toString().trim() || '';
      }
    }
    
    // Log changes - handle nested field paths properly
    Object.keys(oldValues).forEach(field => {
      try {
        // For nested fields like 'personalInfo.fullName', get the actual value from hr object
        let newValue;
        if (field.includes('.')) {
          const fieldParts = field.split('.');
          let current = hr;
          for (const part of fieldParts) {
            current = current?.[part];
          }
          newValue = current;
        } else {
          newValue = hr[field] || updates[field];
        }
        hr.addActivityLog('Profile Updated', field, oldValues[field], newValue, req.user._id);
      } catch (logError) {
        console.error(`[HR_PROFILE_UPDATE] Error logging change for field ${field}:`, logError);
        // Continue with other fields even if logging fails
      }
    });
    
    // Recalculate profile completion
    hr.calculateProfileCompletion();
    
    // Mark modified fields to ensure Mongoose detects nested changes
    hr.markModified('personalInfo');
    hr.markModified('idProofs');
    hr.markModified('companyDetails');
    hr.markModified('employmentInfo');
    hr.markModified('bankDetails');
    
    // Specifically mark nested objects
    if (hr.personalInfo?.address) {
      hr.markModified('personalInfo.address');
    }
    if (hr.personalInfo?.emergencyContact) {
      hr.markModified('personalInfo.emergencyContact');
    }
    if (hr.employmentInfo?.previousCompanies) {
      hr.markModified('employmentInfo.previousCompanies');
    }
    
    // Save to database
    try {
      await hr.save();
      console.log('[HR_PROFILE_UPDATE] HR profile saved successfully to database');
      console.log('[HR_PROFILE_UPDATE] Saved company details:', {
        department: hr.companyDetails?.department,
        designation: hr.companyDetails?.designation,
        workType: hr.companyDetails?.workType,
        location: hr.companyDetails?.location
      });
    } catch (saveError) {
      console.error('[HR_PROFILE_UPDATE] Error saving HR profile:', saveError);
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.keys(saveError.errors || {}).map(key => ({
          field: key,
          message: saveError.errors[key].message
        }));
        return res.status(400).json({ 
          message: 'Validation error while saving profile',
          errors: validationErrors
        });
      }
      throw saveError;
    }
    
    // Reload from database
    const updatedHR = await HR.findById(hr._id);
    
    // Decrypt sensitive fields for response
    const maskedData = maskHRData(updatedHR, req.user.role);
    const { decrypt } = require('../utils/encryption');
    
    if (maskedData.idProofs) {
      if (maskedData.idProofs.aadhaar && updatedHR.idProofs?.aadhaar?.includes(':')) {
        maskedData.idProofs.aadhaar = decrypt(updatedHR.idProofs.aadhaar) || '';
      }
      if (maskedData.idProofs.pan && updatedHR.idProofs?.pan?.includes(':')) {
        maskedData.idProofs.pan = decrypt(updatedHR.idProofs.pan) || '';
      }
    }
    
    if (maskedData.bankDetails && updatedHR.bankDetails?.accountNumber && updatedHR.bankDetails.accountNumber.includes(':')) {
      maskedData.bankDetails.accountNumber = decrypt(updatedHR.bankDetails.accountNumber) || '';
    }
    
    res.json({
      ...maskedData,
      profileCompletion: updatedHR.profileCompletion,
      message: 'HR profile updated successfully'
    });
  } catch (error) {
    console.error('Update HR profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/hr-profile/upload-document
// @desc    Upload document for HR profile
// @access  Private (HR)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/hr', req.user._id.toString());
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post('/upload-document', protect, authorize('hr'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const hr = await HR.findOne({ userId: req.user._id });
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    const documentType = req.body.documentType;
    if (!documentType) {
      return res.status(400).json({ message: 'Document type is required' });
    }
    
    const fileUrl = `/uploads/hr/${req.user._id}/${req.file.filename}`;
    
    hr.documents.push({
      type: documentType,
      url: fileUrl,
      uploadedAt: new Date()
    });
    
    hr.addActivityLog('Document Uploaded', 'documents', null, documentType, req.user._id);
    hr.calculateProfileCompletion();
    await hr.save();
    
    res.json({
      message: 'Document uploaded successfully',
      document: {
        type: documentType,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload HR document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/hr-profile/timeline
// @desc    Get HR profile timeline (activity logs)
// @access  Private (HR)
router.get('/timeline', protect, authorize('hr'), async (req, res) => {
  try {
    const hr = await HR.findOne({ userId: req.user._id });
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    // Get activity logs as timeline
    const timeline = hr.activityLog.map(log => ({
      type: 'activity',
      action: log.action,
      field: log.field,
      oldValue: log.oldValue,
      newValue: log.newValue,
      updatedBy: log.updatedBy,
      updatedAt: log.updatedAt
    })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    res.json(timeline);
  } catch (error) {
    console.error('Get HR timeline error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/hr-profile/submit
// @desc    Submit HR profile for review (only when 100% complete)
// @access  Private (HR)
router.post('/submit', protect, authorize('hr'), async (req, res) => {
  try {
    const hr = await HR.findOne({ userId: req.user._id });
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    // Check if profile is 100% complete
    hr.calculateProfileCompletion();
    if (hr.profileCompletion < 100) {
      return res.status(400).json({ 
        message: `Profile must be 100% complete before submission. Current completion: ${hr.profileCompletion}%`,
        completion: hr.profileCompletion
      });
    }
    
    // Check if already submitted
    if (hr.profileStatus === 'Submitted' || hr.profileStatus === 'Under Review' || hr.profileStatus === 'Approved') {
      return res.status(400).json({ 
        message: `Profile has already been submitted. Current status: ${hr.profileStatus}`,
        status: hr.profileStatus,
        submittedAt: hr.profileSubmittedAt
      });
    }
    
    // Update status to Submitted
    hr.profileStatus = 'Submitted';
    hr.profileSubmittedAt = new Date();
    
    // Add activity log
    hr.addActivityLog('Profile Submitted', 'profileStatus', 'Draft', 'Submitted', req.user._id);
    
    await hr.save();
    
    res.json({
      message: 'HR profile submitted successfully',
      profileStatus: hr.profileStatus,
      submittedAt: hr.profileSubmittedAt,
      completion: hr.profileCompletion
    });
  } catch (error) {
    console.error('Submit HR profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/hr-profile/recalculate
// @desc    Force recalculate HR profile completion
// @access  Private (HR)
router.post('/recalculate', protect, authorize('hr'), async (req, res) => {
  try {
    const hr = await HR.findOne({ userId: req.user._id });
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    const oldCompletion = hr.profileCompletion || 0;
    hr.calculateProfileCompletion();
    const newCompletion = hr.profileCompletion;
    await hr.save();
    
    res.json({
      message: 'HR profile completion recalculated',
      oldCompletion,
      newCompletion,
      completion: newCompletion,
      profileCompletion: newCompletion
    });
  } catch (error) {
    console.error('Recalculate HR profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/hr-profile/completion-status
// @desc    Get HR profile completion status with missing fields
// @access  Private (HR)
router.get('/completion-status', protect, authorize('hr'), async (req, res) => {
  try {
    const hr = await HR.findOne({ userId: req.user._id });
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    const hasValue = (val) => val !== null && val !== undefined && val !== '';
    
    const status = {
      personalInfo: {
        fullName: hasValue(hr.personalInfo?.fullName),
        email: hasValue(hr.personalInfo?.email),
        mobile: hasValue(hr.personalInfo?.mobile),
        dateOfBirth: hasValue(hr.personalInfo?.dateOfBirth),
        gender: hasValue(hr.personalInfo?.gender),
        bloodGroup: hasValue(hr.personalInfo?.bloodGroup),
        maritalStatus: hasValue(hr.personalInfo?.maritalStatus),
        emergencyContactName: hasValue(hr.personalInfo?.emergencyContact?.name),
        emergencyContactNumber: hasValue(hr.personalInfo?.emergencyContact?.number),
        address: hasValue(hr.personalInfo?.address?.permanent?.city) || hasValue(hr.personalInfo?.address?.present?.city)
      },
      companyDetails: {
        department: hasValue(hr.companyDetails?.department),
        designation: hasValue(hr.companyDetails?.designation),
        workType: hasValue(hr.companyDetails?.workType),
        location: hasValue(hr.companyDetails?.location)
      },
      documents: {
        aadhaarDoc: hr.documents?.some(doc => doc?.type === 'Aadhaar'),
        panDoc: hr.documents?.some(doc => doc?.type === 'PAN'),
        photoDoc: hr.documents?.some(doc => doc?.type === 'Photo')
      },
      bankDetails: {
        ifscCode: hasValue(hr.bankDetails?.ifscCode),
        bankName: hasValue(hr.bankDetails?.bankName),
        branchName: hasValue(hr.bankDetails?.branchName),
        accountHolderName: hasValue(hr.bankDetails?.accountHolderName)
      }
    };
    
    const missingFields = [];
    if (!status.personalInfo.fullName) missingFields.push('Full Name');
    if (!status.personalInfo.mobile) missingFields.push('Mobile');
    if (!status.personalInfo.dateOfBirth) missingFields.push('Date of Birth');
    if (!status.personalInfo.gender) missingFields.push('Gender');
    if (!status.personalInfo.bloodGroup) missingFields.push('Blood Group');
    if (!status.personalInfo.maritalStatus) missingFields.push('Marital Status');
    if (!status.personalInfo.emergencyContactName) missingFields.push('Emergency Contact Name');
    if (!status.personalInfo.emergencyContactNumber) missingFields.push('Emergency Contact Number');
    if (!status.personalInfo.address) missingFields.push('Address');
    if (!status.companyDetails.department) missingFields.push('Department');
    if (!status.companyDetails.designation) missingFields.push('Designation');
    if (!status.companyDetails.workType) missingFields.push('Work Type');
    if (!status.companyDetails.location) missingFields.push('Location');
    if (!status.documents.aadhaarDoc) missingFields.push('Aadhaar Document');
    if (!status.documents.panDoc) missingFields.push('PAN Document');
    if (!status.documents.photoDoc) missingFields.push('Photo Document');
    if (!status.bankDetails.ifscCode) missingFields.push('IFSC Code');
    if (!status.bankDetails.bankName) missingFields.push('Bank Name');
    if (!status.bankDetails.branchName) missingFields.push('Branch Name');
    if (!status.bankDetails.accountHolderName) missingFields.push('Account Holder Name');
    
    hr.calculateProfileCompletion();
    
    res.json({
      completion: hr.profileCompletion,
      status,
      missingFields,
      totalFields: 21,
      completedFields: 21 - missingFields.length
    });
  } catch (error) {
    console.error('Get HR completion status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

