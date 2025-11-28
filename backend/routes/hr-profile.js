const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const HR = require('../models/HR');
const User = require('../models/User');
const Employee = require('../models/Employee');
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
    
    // Get all fields from request body (multer parses FormData)
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
    
    // Check if this is a company document upload (Experience Letter or Salary Slip)
    const hasCompanyIndexField = companyIndexStr !== null && companyIndexStr !== undefined;
    const hasCategoryField = documentCategoryStr !== null && documentCategoryStr !== undefined;
    
    const isValidCompanyIndex = hasCompanyIndexField && 
                                companyIndexStr !== '' && 
                                !isNaN(parseInt(companyIndexStr, 10)) && 
                                parseInt(companyIndexStr, 10) >= 0;
    const isValidCategory = hasCategoryField && 
                            documentCategoryStr !== '' &&
                            (documentCategoryStr === 'experienceLetter' || documentCategoryStr === 'salarySlip');
    
    const isCompanyDocument = isValidCompanyIndex && isValidCategory;
    
    // PROCESS COMPANY DOCUMENT UPLOAD (Experience Letter or Salary Slip)
    if (isCompanyDocument) {
      const companyIdx = parseInt(companyIndexStr, 10);
      
      // Ensure previousCompanies array exists
      if (!hr.employmentInfo.previousCompanies) {
        hr.employmentInfo.previousCompanies = [];
      }
      
      // Ensure the company exists at this index
      if (companyIdx >= hr.employmentInfo.previousCompanies.length) {
        return res.status(400).json({ 
          message: 'Failed to create company entry. Please add the company information first and save it before uploading documents.' 
        });
      }
      
      const fileUrl = `/uploads/hr/${req.user._id}/${req.file.filename}`;
      
      // Update the specific company document
      if (documentCategoryStr === 'experienceLetter') {
        hr.employmentInfo.previousCompanies[companyIdx].experienceLetter = fileUrl;
      } else if (documentCategoryStr === 'salarySlip') {
        hr.employmentInfo.previousCompanies[companyIdx].salarySlip = fileUrl;
      } else {
        return res.status(400).json({ message: 'Invalid document category. Use experienceLetter or salarySlip' });
      }
      
      hr.addActivityLog('Company Document Uploaded', `previousCompanies[${companyIdx}].${documentCategoryStr}`, null, documentCategoryStr, req.user._id);
      await hr.save();
      
      const updatedCompany = hr.employmentInfo.previousCompanies[companyIdx];
      
      return res.json({
        message: `${documentCategoryStr === 'experienceLetter' ? 'Experience Letter' : 'Salary Slip'} uploaded and saved successfully`,
        url: fileUrl,
        companyIndex: companyIdx,
        documentCategory: documentCategoryStr,
        company: {
          companyName: updatedCompany?.companyName,
          experienceLetter: updatedCompany?.experienceLetter || '',
          salarySlip: updatedCompany?.salarySlip || ''
        }
      });
    }
    
    // REGULAR DOCUMENT UPLOAD (general documents)
    // Only require documentType if this is NOT a company document upload
    if (!documentType) {
      return res.status(400).json({ 
        message: 'Document type is required. If uploading for a company, ensure companyIndex and documentCategory are provided correctly.'
      });
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
    
    // Update status to Submitted (waiting for manager approval)
    hr.profileStatus = 'Submitted';
    hr.profileSubmittedAt = new Date();
    
    // Add activity log
    hr.addActivityLog('Profile Submitted', 'profileStatus', 'Draft', 'Submitted', req.user._id);
    
    await hr.save();
    
    // Check if HR has a reporting manager (via Employee profile)
    let hrEmployee = await Employee.findOne({ userId: req.user._id });
    if (hrEmployee && hrEmployee.companyDetails?.reportingManager) {
      console.log(`[HR_PROFILE_SUBMIT] HR profile submitted, waiting for manager approval. Manager ID: ${hrEmployee.companyDetails.reportingManager}`);
    } else {
      console.log(`[HR_PROFILE_SUBMIT] HR profile submitted but no reporting manager assigned. Admin/HR approval required.`);
    }
    
    // Automatically create/update Employee profile from HR profile for attendance tracking
    try {
      
      // Check if employee already exists
      const normalizedEmail = req.user.email.toLowerCase().trim();
      let employee = await Employee.findOne({ 
        'personalInfo.email': { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
      });
      
      // Preserve existing reportingManager if employee exists
      let existingReportingManager = null;
      if (employee && employee.companyDetails?.reportingManager) {
        existingReportingManager = employee.companyDetails.reportingManager;
        console.log(`[HR_PROFILE_SUBMIT] Preserving existing reportingManager: ${existingReportingManager}`);
      }
      
      if (!employee) {
        // Create employee profile from HR profile data
        const year = new Date().getFullYear();
        let count = await Employee.countDocuments();
        let employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
        
        // Check if employeeId already exists
        let exists = await Employee.findOne({ employeeId });
        let attempts = 0;
        while (exists && attempts < 10) {
          count++;
          employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
          exists = await Employee.findOne({ employeeId });
          attempts++;
        }
        
        employee = new Employee({
          employeeId: employeeId,
          userId: req.user._id,
          personalInfo: {
            fullName: hr.personalInfo?.fullName || req.user.email.split('@')[0],
            email: hr.personalInfo?.email || normalizedEmail,
            mobile: hr.personalInfo?.mobile,
            dateOfBirth: hr.personalInfo?.dateOfBirth,
            gender: hr.personalInfo?.gender,
            bloodGroup: hr.personalInfo?.bloodGroup,
            maritalStatus: hr.personalInfo?.maritalStatus,
            address: hr.personalInfo?.address,
            emergencyContact: hr.personalInfo?.emergencyContact
          },
          companyDetails: {
            joiningDate: hr.companyDetails?.joiningDate || new Date(),
            department: hr.companyDetails?.department || 'Human Resources',
            designation: hr.companyDetails?.designation || 'HR',
            workType: hr.companyDetails?.workType || 'WFO',
            location: hr.companyDetails?.location,
            employmentStatus: hr.companyDetails?.employmentStatus || 'Active',
            // Preserve reportingManager if it was set before
            reportingManager: existingReportingManager
          },
          bankDetails: hr.bankDetails || {},
          employmentInfo: hr.employmentInfo || {}
        });
        
        employee.calculateProfileCompletion();
        await employee.save();
        
        // Link employee to user
        await User.findByIdAndUpdate(req.user._id, { employeeId: employee._id });
        
        console.log(`[HR_PROFILE_SUBMIT] Created Employee profile from HR profile: ${employee._id}, employeeId: ${employee.employeeId}, reportingManager: ${employee.companyDetails?.reportingManager || 'Not set'}`);
      } else {
        // Employee exists - update it with latest HR profile data but preserve reportingManager
        if (existingReportingManager) {
          employee.companyDetails.reportingManager = existingReportingManager;
        }
        
        // Update employee profile with latest HR data
        employee.personalInfo = {
          fullName: hr.personalInfo?.fullName || employee.personalInfo?.fullName || req.user.email.split('@')[0],
          email: hr.personalInfo?.email || normalizedEmail,
          mobile: hr.personalInfo?.mobile || employee.personalInfo?.mobile,
          dateOfBirth: hr.personalInfo?.dateOfBirth || employee.personalInfo?.dateOfBirth,
          gender: hr.personalInfo?.gender || employee.personalInfo?.gender,
          bloodGroup: hr.personalInfo?.bloodGroup || employee.personalInfo?.bloodGroup,
          maritalStatus: hr.personalInfo?.maritalStatus || employee.personalInfo?.maritalStatus,
          address: hr.personalInfo?.address || employee.personalInfo?.address,
          emergencyContact: hr.personalInfo?.emergencyContact || employee.personalInfo?.emergencyContact
        };
        
        employee.companyDetails = {
          ...employee.companyDetails,
          joiningDate: hr.companyDetails?.joiningDate || employee.companyDetails?.joiningDate || new Date(),
          department: hr.companyDetails?.department || employee.companyDetails?.department || 'Human Resources',
          designation: hr.companyDetails?.designation || employee.companyDetails?.designation || 'HR',
          workType: hr.companyDetails?.workType || employee.companyDetails?.workType || 'WFO',
          location: hr.companyDetails?.location || employee.companyDetails?.location,
          employmentStatus: hr.companyDetails?.employmentStatus || employee.companyDetails?.employmentStatus || 'Active',
          // Preserve reportingManager
          reportingManager: existingReportingManager || employee.companyDetails?.reportingManager
        };
        
        employee.bankDetails = hr.bankDetails || employee.bankDetails || {};
        employee.employmentInfo = hr.employmentInfo || employee.employmentInfo || {};
        
        employee.markModified('personalInfo');
        employee.markModified('companyDetails');
        employee.markModified('bankDetails');
        employee.markModified('employmentInfo');
        
        employee.calculateProfileCompletion();
        await employee.save();
        
        // Link employee to user if not already linked
        if (!req.user.employeeId || req.user.employeeId.toString() !== employee._id.toString()) {
          await User.findByIdAndUpdate(req.user._id, { employeeId: employee._id });
        }
        
        console.log(`[HR_PROFILE_SUBMIT] Updated Employee profile from HR profile: ${employee._id}, employeeId: ${employee.employeeId}, reportingManager: ${employee.companyDetails?.reportingManager || 'Not set'}`);
      }
    } catch (employeeError) {
      console.error('[HR_PROFILE_SUBMIT] Error creating/updating Employee profile:', employeeError);
      console.error('[HR_PROFILE_SUBMIT] Error stack:', employeeError.stack);
      // Don't fail the submission if Employee profile creation fails
      // It will be created when HR tries to punch in
    }
    
    // Check if Employee profile has reportingManager set (re-query after potential creation/update)
    hrEmployee = await Employee.findOne({ userId: req.user._id });
    const hasReportingManager = hrEmployee && hrEmployee.companyDetails?.reportingManager;
    
    res.json({
      message: 'HR profile submitted successfully',
      profileStatus: hr.profileStatus,
      submittedAt: hr.profileSubmittedAt,
      completion: hr.profileCompletion,
      employeeProfileCreated: !!hrEmployee,
      reportingManagerSet: hasReportingManager,
      note: !hasReportingManager ? 'Note: To appear in your manager\'s employee section, please set your reporting manager in your Employee profile.' : undefined
    });
  } catch (error) {
    console.error('Submit HR profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/hr-profile/sync-employee-profile
// @desc    Sync HR profile to Employee profile for attendance tracking
// @access  Private (HR)
router.post('/sync-employee-profile', protect, authorize('hr'), async (req, res) => {
  try {
    const hr = await HR.findOne({ userId: req.user._id });
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found. Please complete your HR profile first.' });
    }
    
    // Check if employee already exists
    const normalizedEmail = req.user.email.toLowerCase().trim();
    let employee = await Employee.findOne({ 
      'personalInfo.email': { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });
    
    if (employee) {
      // Employee exists, just link if not already linked
      if (!req.user.employeeId || req.user.employeeId.toString() !== employee._id.toString()) {
        await User.findByIdAndUpdate(req.user._id, { employeeId: employee._id });
        return res.json({
          message: 'Employee profile already exists and has been linked',
          employeeId: employee._id,
          employeeProfileId: employee.employeeId
        });
      }
      return res.json({
        message: 'Employee profile already linked',
        employeeId: employee._id,
        employeeProfileId: employee.employeeId
      });
    }
    
    // Create employee profile from HR profile data
    const year = new Date().getFullYear();
    let count = await Employee.countDocuments();
    let employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
    
    // Check if employeeId already exists
    let exists = await Employee.findOne({ employeeId });
    let attempts = 0;
    while (exists && attempts < 10) {
      count++;
      employeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
      exists = await Employee.findOne({ employeeId });
      attempts++;
    }
    
    employee = new Employee({
      employeeId: employeeId,
      userId: req.user._id,
      personalInfo: {
        fullName: hr.personalInfo?.fullName || req.user.email.split('@')[0],
        email: hr.personalInfo?.email || normalizedEmail,
        mobile: hr.personalInfo?.mobile,
        dateOfBirth: hr.personalInfo?.dateOfBirth,
        gender: hr.personalInfo?.gender,
        bloodGroup: hr.personalInfo?.bloodGroup,
        maritalStatus: hr.personalInfo?.maritalStatus,
        address: hr.personalInfo?.address,
        emergencyContact: hr.personalInfo?.emergencyContact
      },
      companyDetails: {
        joiningDate: hr.companyDetails?.joiningDate || new Date(),
        department: hr.companyDetails?.department || 'Human Resources',
        designation: hr.companyDetails?.designation || 'HR',
        workType: hr.companyDetails?.workType || 'WFO',
        location: hr.companyDetails?.location,
        employmentStatus: hr.companyDetails?.employmentStatus || 'Active'
      },
      bankDetails: hr.bankDetails || {},
      employmentInfo: hr.employmentInfo || {}
    });
    
    employee.calculateProfileCompletion();
    await employee.save();
    
    // Link employee to user
    await User.findByIdAndUpdate(req.user._id, { employeeId: employee._id });
    
    console.log(`[HR_SYNC] Created Employee profile from HR profile: ${employee._id}, employeeId: ${employee.employeeId}`);
    
    res.json({
      message: 'Employee profile created successfully from HR profile',
      employeeId: employee._id,
      employeeProfileId: employee.employeeId,
      employee: {
        fullName: employee.personalInfo?.fullName,
        email: employee.personalInfo?.email,
        department: employee.companyDetails?.department,
        designation: employee.companyDetails?.designation
      }
    });
  } catch (error) {
    console.error('Sync HR to Employee profile error:', error);
    res.status(500).json({ 
      message: 'Failed to sync Employee profile. Please try again or contact administrator.',
      error: error.message 
    });
  }
});

// @route   PUT /api/hr-profile/:id/approve
// @desc    Approve/reject HR profile (Manager/Admin)
// @access  Private (Manager/Admin)
router.put('/:id/approve', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const hr = await HR.findById(req.params.id);
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    const { status, comments } = req.body;
    
    // Check if profile is submitted
    if (hr.profileStatus !== 'Submitted') {
      return res.status(400).json({ 
        message: `Profile must be in 'Submitted' status to be approved. Current status: ${hr.profileStatus}`,
        currentStatus: hr.profileStatus
      });
    }
    
    if (req.user.role === 'manager') {
      // Managers can approve all HR profiles
      const managerEmployee = await Employee.findById(req.user.employeeId);
      
      if (!managerEmployee) {
        return res.status(404).json({ 
          message: 'Manager profile not found. Please contact HR.',
          error: 'MANAGER_NOT_FOUND'
        });
      }
      
      // Manager approval
      hr.managerApproval = {
        approvedBy: req.user._id,
        approvedAt: new Date(),
        comments: comments || ''
      };
      hr.profileStatus = status === 'Approved' ? 'Manager Approved' : 'Manager Rejected';
      
      hr.addActivityLog(
        status === 'Approved' ? 'Profile Manager Approved' : 'Profile Manager Rejected',
        'profileStatus',
        'Submitted',
        hr.profileStatus,
        req.user._id
      );
      
    } else if (req.user.role === 'admin') {
      // Admin can approve directly (skip manager approval if needed)
      hr.profileStatus = status === 'Approved' ? 'Approved' : 'Rejected';
      
      hr.addActivityLog(
        status === 'Approved' ? 'Profile Approved by Admin' : 'Profile Rejected by Admin',
        'profileStatus',
        hr.profileStatus === 'Approved' ? 'Submitted' : 'Manager Approved',
        hr.profileStatus,
        req.user._id
      );
    }
    
    await hr.save();
    
    res.json({
      message: `HR profile ${status === 'Approved' ? 'approved' : 'rejected'} successfully`,
      profile: hr,
      status: hr.profileStatus
    });
  } catch (error) {
    console.error('Approve HR profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/hr-profile/all
// @desc    Get all HR profiles (Manager/Admin)
// @access  Private (Manager/Admin)
router.get('/all', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    console.log(`[HR_PROFILE_ALL] Fetching all HR profiles for ${req.user.role} ${req.user.email}`);
    const hrProfiles = await HR.find({})
      .populate('userId', 'email role')
      .sort({ profileSubmittedAt: -1, createdAt: -1 })
      .select('-idProofs.aadhaar -idProofs.pan -bankDetails.accountNumber');
    
    console.log(`[HR_PROFILE_ALL] Found ${hrProfiles.length} HR profiles`);
    
    // Filter out admin users - only show HR users (not admins)
    // For managers, exclude admin users from HR profiles list
    let filteredProfiles = hrProfiles;
    if (req.user.role === 'manager') {
      // If userId is not populated correctly, fetch user roles
      const User = require('../models/User');
      const userIdsToCheck = hrProfiles
        .filter(hr => !hr.userId || typeof hr.userId === 'string' || !hr.userId.role)
        .map(hr => hr.userId?._id || hr.userId);
      
      let userRolesMap = {};
      if (userIdsToCheck.length > 0) {
        const users = await User.find({ _id: { $in: userIdsToCheck } }).select('_id role').lean();
        users.forEach(user => {
          userRolesMap[user._id.toString()] = user.role;
        });
      }
      
      filteredProfiles = hrProfiles.filter(hr => {
        // Check if the populated userId has role 'hr' (not 'admin')
        let userRole = null;
        
        // Handle different formats of populated userId
        if (hr.userId) {
          if (typeof hr.userId === 'object' && hr.userId.role) {
            userRole = hr.userId.role;
          } else {
            // Try to get role from map if userId is an ObjectId
            const userIdStr = hr.userId._id?.toString() || hr.userId.toString();
            userRole = userRolesMap[userIdStr];
          }
        }
        
        // Only include if role is 'hr', exclude 'admin' and any other roles
        const isHR = userRole === 'hr';
        if (!isHR) {
          console.log(`[HR_PROFILE_ALL] Excluding HR profile ${hr._id} (${hr.hrId || 'no-id'}) - User role: ${userRole || 'unknown'}`);
        }
        return isHR;
      });
      console.log(`[HR_PROFILE_ALL] Filtered to ${filteredProfiles.length} HR profiles (admin excluded) out of ${hrProfiles.length} total`);
    }
    
    // Mask sensitive data for managers
    const maskedProfiles = filteredProfiles.map(hr => maskHRData(hr, req.user.role));
    
    res.json(maskedProfiles);
  } catch (error) {
    console.error('[HR_PROFILE_ALL] Get all HR profiles error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/hr-profile/pending-approvals
// @desc    Get HR profiles pending manager approval
// @access  Private (Manager/Admin)
// NOTE: This route must come before /:id to avoid route conflicts
router.get('/pending-approvals', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    // Managers and Admin can see all HR profiles pending approval
    const filter = { profileStatus: 'Submitted' };
    
    const pendingProfiles = await HR.find(filter)
      .populate('userId', 'email role')
      .sort({ profileSubmittedAt: -1 });
    
    // Filter out admin users for managers - only show HR users
    let filteredProfiles = pendingProfiles;
    if (req.user.role === 'manager') {
      filteredProfiles = pendingProfiles.filter(hr => {
        // Check if the populated userId has role 'hr' (not 'admin')
        let userRole = null;
        
        // Handle different formats of populated userId
        if (hr.userId) {
          if (typeof hr.userId === 'object' && hr.userId.role) {
            userRole = hr.userId.role;
          } else if (typeof hr.userId === 'string') {
            // If userId is just an ID string, skip this profile
            console.log(`[HR_PROFILE_PENDING] Warning: userId is string, cannot determine role for HR profile ${hr._id}`);
            return false;
          }
        }
        
        // Only include if role is 'hr', exclude 'admin' and any other roles
        const isHR = userRole === 'hr';
        if (!isHR) {
          console.log(`[HR_PROFILE_PENDING] Excluding HR profile ${hr._id} - User role: ${userRole || 'unknown'}`);
        }
        return isHR;
      });
      console.log(`[HR_PROFILE_PENDING] Filtered to ${filteredProfiles.length} pending HR profiles (admin excluded) out of ${pendingProfiles.length} total`);
    }
    
    res.json(filteredProfiles);
  } catch (error) {
    console.error('Get pending HR approvals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/hr-profile/:id
// @desc    Get HR profile by ID (Manager/Admin)
// @access  Private (Manager/Admin)
// NOTE: This route must come after /all and /pending-approvals to avoid route conflicts
router.get('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    // Check if the ID is a valid ObjectId to avoid matching other routes
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid HR profile ID' });
    }
    
    console.log(`[HR_PROFILE_BY_ID] Fetching HR profile ${req.params.id} for ${req.user.role} ${req.user.email}`);
    const hr = await HR.findById(req.params.id).populate('userId', 'email role');
    
    if (!hr) {
      return res.status(404).json({ message: 'HR profile not found' });
    }
    
    // Mask sensitive data for managers
    const maskedData = maskHRData(hr, req.user.role);
    
    res.json(maskedData);
  } catch (error) {
    console.error('[HR_PROFILE_BY_ID] Get HR profile by ID error:', error);
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

