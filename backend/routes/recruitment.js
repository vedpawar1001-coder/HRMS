const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const Application = require('../models/Application');
const Job = require('../models/Job');
const OfferTemplate = require('../models/OfferTemplate');
const Onboarding = require('../models/Onboarding');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Lifecycle = require('../models/Lifecycle');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { parseResume } = require('../utils/resumeParser');

const router = express.Router();

// Configure multer for recruitment uploads
const recruitmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    if (file.fieldname === 'resume') {
      uploadPath = path.join(__dirname, '../uploads/recruitment/resumes');
    } else if (file.fieldname === 'template') {
      uploadPath = path.join(__dirname, '../uploads/recruitment/templates');
    } else if (file.fieldname === 'onboardingDocument') {
      uploadPath = path.join(__dirname, '../uploads/recruitment/onboarding');
    } else {
      uploadPath = path.join(__dirname, '../uploads/recruitment');
    }
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const recruitmentUpload = multer({
  storage: recruitmentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for resumes and documents
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, JPEG, PNG are allowed.'));
    }
  }
});

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Helper function to send email
async function sendEmail(to, subject, html, attachments = []) {
  try {
    // Validate email address
    if (!to || !to.includes('@')) {
      console.error('Invalid email address:', to);
      throw new Error('Invalid email address');
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP not configured. Email would be sent to:', to);
      console.warn('⚠️ Please configure SMTP_USER and SMTP_PASS in .env file');
      console.warn('⚠️ Email details:', { to, subject, hasAttachments: attachments.length > 0 });
      // In development, we might want to still return success but log it
      // In production, this should throw an error
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP not configured. Cannot send emails in production.');
      }
      return { success: false, message: 'SMTP not configured', simulated: true };
    }

    // Verify transporter is ready
    await transporter.verify();

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'HR Team'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments: attachments.map(att => {
        if (att.path) {
          return {
            filename: att.filename || path.basename(att.path),
            path: att.path
          };
        }
        return att;
      })
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully to:', to);
    console.log('📧 Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('Error details:', {
      to,
      subject,
      errorMessage: error.message,
      errorCode: error.code
    });
    throw error; // Re-throw to let caller handle it
  }
}

// Helper function for automated screening
function calculateScreeningScore(candidate, job) {
  let score = 0;
  let maxScore = 0;
  const details = {
    skillsMatch: { matched: [], missing: [], score: 0 },
    experienceMatch: { score: 0, details: '' },
    educationMatch: { score: 0, details: '' },
    certificationsMatch: { matched: [], missing: [], score: 0 },
    domainMatch: { score: 0, details: '' },
    locationMatch: { score: 0, details: '' }
  };

  // Skills matching (40% weight)
  maxScore += 40;
  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const requiredSkills = (job.requirements?.skills || []).map(s => s.toLowerCase());
  const matchedSkills = candidateSkills.filter(s => requiredSkills.some(rs => s.includes(rs) || rs.includes(s)));
  const skillMatchPercentage = requiredSkills.length > 0 
    ? (matchedSkills.length / requiredSkills.length) * 100 
    : 0;
  details.skillsMatch.matched = matchedSkills;
  details.skillsMatch.missing = requiredSkills.filter(rs => !matchedSkills.some(ms => ms.includes(rs) || rs.includes(ms)));
  details.skillsMatch.score = skillMatchPercentage;
  score += (skillMatchPercentage / 100) * 40;

  // Experience matching (25% weight)
  maxScore += 25;
  const candidateExp = parseFloat(candidate.experience) || 0;
  const requiredExp = job.requirements?.minExperience || 0;
  if (candidateExp >= requiredExp) {
    details.experienceMatch.score = 100;
    details.experienceMatch.details = `Candidate has ${candidateExp} years, required ${requiredExp} years`;
    score += 25;
  } else {
    const expMatch = (candidateExp / requiredExp) * 100;
    details.experienceMatch.score = Math.min(expMatch, 100);
    details.experienceMatch.details = `Candidate has ${candidateExp} years, required ${requiredExp} years (${expMatch.toFixed(0)}% match)`;
    score += (expMatch / 100) * 25;
  }

  // Education matching (15% weight)
  maxScore += 15;
  const candidateEdu = (candidate.education || '').toLowerCase();
  const requiredEdu = (job.requirements?.education || '').toLowerCase();
  if (candidateEdu.includes(requiredEdu) || requiredEdu.includes(candidateEdu) || !requiredEdu) {
    details.educationMatch.score = 100;
    details.educationMatch.details = 'Education requirement met';
    score += 15;
  } else {
    details.educationMatch.score = 50;
    details.educationMatch.details = 'Education may not fully match';
    score += 7.5;
  }

  // Certifications (10% weight)
  maxScore += 10;
  const candidateCerts = (candidate.certifications || []).map(c => c.toLowerCase());
  const requiredCerts = (job.requirements?.certifications || []).map(c => c.toLowerCase());
  const matchedCerts = candidateCerts.filter(c => requiredCerts.some(rc => c.includes(rc) || rc.includes(c)));
  const certMatchPercentage = requiredCerts.length > 0 
    ? (matchedCerts.length / requiredCerts.length) * 100 
    : 100;
  details.certificationsMatch.matched = matchedCerts;
  details.certificationsMatch.missing = requiredCerts.filter(rc => !matchedCerts.some(mc => mc.includes(rc) || rc.includes(mc)));
  details.certificationsMatch.score = certMatchPercentage;
  score += (certMatchPercentage / 100) * 10;

  // Domain relevance (5% weight)
  maxScore += 5;
  if (job.requirements?.domain) {
    const candidateDomain = (candidate.experience || '').toLowerCase();
    if (candidateDomain.includes(job.requirements.domain.toLowerCase())) {
      details.domainMatch.score = 100;
      details.domainMatch.details = 'Domain experience found';
      score += 5;
    } else {
      details.domainMatch.score = 0;
      details.domainMatch.details = 'No domain experience mentioned';
    }
  } else {
    details.domainMatch.score = 100;
    score += 5;
  }

  // Location (5% weight)
  maxScore += 5;
  if (job.requirements?.location) {
    // Assume location match if not specified in candidate profile
    details.locationMatch.score = 50;
    details.locationMatch.details = 'Location preference not specified';
    score += 2.5;
  } else {
    details.locationMatch.score = 100;
    score += 5;
  }

  const overallMatchPercentage = (score / maxScore) * 100;
  
  let result = 'Not Fit';
  let priorityScore = 'Low';
  
  if (overallMatchPercentage >= 80) {
    result = 'Fit';
    priorityScore = 'High';
  } else if (overallMatchPercentage >= 60) {
    result = 'Partially Fit';
    priorityScore = 'Medium';
  } else if (overallMatchPercentage >= 40) {
    result = 'Needs Manual Review';
    priorityScore = 'Medium';
  }

  return {
    result,
    skillMatchPercentage: details.skillsMatch.score,
    overallMatchPercentage,
    priorityScore,
    details
  };
}

// ==================== JOB ROUTES ====================

// @route   GET /api/recruitment/jobs
// @desc    Get all jobs (public for candidates, filtered for HR)
// @access  Public for viewing, Private for management
router.get('/jobs', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    } else if (!req.user || (req.user.role !== 'hr' && req.user.role !== 'admin' && req.user.role !== 'manager')) {
      // Public view only shows open jobs
      filter.status = 'Open';
    }
    
    if (req.query.department) {
      filter.department = req.query.department;
    }

    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { department: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(filter)
      .populate('postedBy', 'email')
      .sort({ postedDate: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/recruitment/jobs/:id
// @desc    Get single job
// @access  Public
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'email');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/jobs
// @desc    Create new job posting
// @access  Private (HR/Admin/Manager)
router.post('/jobs', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const job = new Job({
      ...req.body,
      postedBy: req.user._id
    });
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/recruitment/jobs/:id
// @desc    Update job
// @access  Private (HR/Admin)
router.put('/jobs/:id', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/recruitment/jobs/:id
// @desc    Delete job
// @access  Private (HR/Admin)
router.delete('/jobs/:id', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== APPLICATION ROUTES ====================
// IMPORTANT: Specific routes (like /hr-upload) must come BEFORE generic routes (like /applications)

// Test route to verify server is running
router.get('/applications/test', (req, res) => {
  res.json({ message: 'Recruitment routes are working', timestamp: new Date() });
});

// Test route for hr-upload endpoint (GET to verify route exists)
router.get('/applications/hr-upload/test', protect, authorize('hr', 'admin', 'manager'), (req, res) => {
  res.json({ message: 'HR upload route is accessible', timestamp: new Date() });
});

// @route   POST /api/recruitment/applications/hr-upload
// @desc    HR/Manager manually uploads application with resume parsing
// @access  Private (HR/Admin/Manager)
// IMPORTANT: This route MUST come before router.post('/applications') to avoid route conflicts
router.post('/applications/hr-upload', 
  protect, 
  (req, res, next) => {
    console.log('[HR_UPLOAD_MIDDLEWARE] User authenticated:', req.user?.role, req.user?.email);
    next();
  },
  authorize('hr', 'admin', 'manager'), 
  (req, res, next) => {
    console.log('[HR_UPLOAD_MIDDLEWARE] Authorization passed for role:', req.user?.role);
    next();
  },
  (req, res, next) => {
    // Multer error handling middleware
    recruitmentUpload.single('resume')(req, res, (err) => {
      if (err) {
        console.error('[HR_UPLOAD] Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size exceeds 10MB limit' });
        }
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: `File upload error: ${err.message || 'Unknown error'}` });
      }
      next();
    });
  },
  async (req, res) => {
  try {
    console.log('[HR_UPLOAD] Request received from:', req.user.role, req.user.email);
    console.log('[HR_UPLOAD] Request body:', req.body);
    console.log('[HR_UPLOAD] Request file:', req.file ? { filename: req.file.filename, size: req.file.size } : 'No file');
    
    const { 
      fullName, 
      email, 
      phone, 
      coverLetter, 
      expectedSalary, 
      skills, 
      experience, 
      education, 
      certifications, 
      jobId,
      appliedJobRole 
    } = req.body;

    if (!jobId || jobId === 'undefined' || jobId === 'null') {
      console.error('HR Upload - Missing or invalid jobId:', jobId);
      return res.status(400).json({ message: 'Job ID is required. Please select a job position.' });
    }

    // Validate jobId is a valid MongoDB ObjectId format
    if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('HR Upload - Invalid jobId format:', jobId);
      return res.status(400).json({ message: 'Invalid job ID format. Please select a valid job position.' });
    }

    if (!req.file) {
      console.error('HR Upload - Missing resume file');
      return res.status(400).json({ message: 'Resume is required' });
    }

    const resumeFilePath = req.file.path;
    let parsedData = {};

    // Parse resume to extract information
    try {
      if (fs.existsSync(resumeFilePath)) {
        parsedData = await parseResume(resumeFilePath);
        console.log('Parsed resume data:', parsedData);
      } else {
        console.warn('Resume file not found at path:', resumeFilePath);
      }
    } catch (parseError) {
      console.error('Error parsing resume:', parseError);
      // Continue even if parsing fails
      parsedData = {};
    }

    // Merge parsed data with provided data (provided data takes precedence)
    const candidateInfo = {
      fullName: fullName || parsedData.fullName || '',
      email: (email || parsedData.email || '').toLowerCase(),
      phone: phone || parsedData.phone || '',
      resume: `/uploads/recruitment/resumes/${req.file.filename}`,
      coverLetter: coverLetter || '',
      expectedSalary: expectedSalary ? parseFloat(expectedSalary) : undefined,
      skills: skills 
        ? (Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(s => s))
        : (parsedData.skills || []),
      experience: experience || parsedData.experience || '',
      education: education || parsedData.education || '',
      certifications: certifications
        ? (Array.isArray(certifications) ? certifications : certifications.split(',').map(c => c.trim()).filter(c => c))
        : (parsedData.certifications || []),
      appliedJobRole: appliedJobRole || '',
      appliedDate: new Date()
    };

    // Validate required fields
    if (!candidateInfo.fullName || !candidateInfo.email || !candidateInfo.phone) {
      return res.status(400).json({ 
        message: 'Missing required fields. Please provide Full Name, Email, and Phone.',
        parsedData: parsedData // Return parsed data so HR can see what was extracted
      });
    }

    // Check for duplicate applications (by email or phone)
    const existingApp = await Application.findOne({
      $or: [
        { 'candidateInfo.email': candidateInfo.email },
        { 'candidateInfo.phone': candidateInfo.phone }
      ],
      jobId: jobId
    });

    if (existingApp) {
      return res.status(400).json({ 
        message: 'Duplicate application detected. A candidate with this email or phone has already applied for this position.',
        isDuplicate: true,
        existingApplicationId: existingApp._id,
        parsedData: parsedData
      });
    }

    const application = new Application({
      candidateInfo,
      jobId,
      status: 'Application'
    });

    // Get job details for screening
    let job = null;
    try {
      job = await Job.findById(jobId);
      if (!job) {
        console.error('HR Upload - Job not found with ID:', jobId);
        return res.status(404).json({ message: 'Job not found. Please select a valid job position.' });
      }
      
      try {
        // Convert job to plain object if it's a Mongoose document
        const jobData = job.toObject ? job.toObject() : job;
        const screeningResult = calculateScreeningScore(application.candidateInfo, jobData);
        application.screening = {
          ...screeningResult,
          screeningDate: new Date()
        };
      } catch (screeningError) {
        console.error('HR Upload - Error calculating screening score:', screeningError);
        console.error('Screening error details:', {
          message: screeningError.message,
          stack: screeningError.stack
        });
        // Continue without screening if calculation fails
        application.screening = {
          result: 'Needs Manual Review',
          skillMatchPercentage: 0,
          overallMatchPercentage: 0,
          priorityScore: 'Medium',
          screeningDate: new Date()
        };
      }
    } catch (jobError) {
      console.error('HR Upload - Error fetching job:', jobError);
      return res.status(400).json({ message: 'Invalid job ID. Please select a valid job position.' });
    }

    // Add initial status to history
    const uploadedBy = req.user.role === 'manager' ? 'Manager' : 'HR';
    application.statusHistory.push({
      status: 'Application',
      updatedBy: req.user._id,
      updatedDate: new Date(),
      comments: `Application uploaded by ${uploadedBy}`,
      timestamp: new Date()
    });

    try {
      await application.save();
      console.log('HR Upload - Application saved successfully:', application._id);
      
      res.status(201).json({
        message: 'Application uploaded successfully',
        application,
        parsedData: parsedData // Return parsed data for reference
      });
    } catch (saveError) {
      console.error('HR Upload - Error saving application:', saveError);
      throw saveError;
    }
  } catch (error) {
    console.error('HR upload application error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors
    });
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map(err => err.message).join(', ');
      return res.status(400).json({ 
        message: `Validation error: ${validationErrors || error.message}`,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      return res.status(400).json({ message: `File upload error: ${error.message}` });
    }
    
    // Handle MongoDB errors
    if (error.name === 'MongoError' || error.code === 11000) {
      return res.status(400).json({ 
        message: 'Duplicate entry detected. This application may already exist.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error occurred while processing your request. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/recruitment/applications
// @desc    Submit job application (public)
// @access  Public
router.post('/applications', recruitmentUpload.single('resume'), async (req, res) => {
  try {
    const { fullName, email, phone, coverLetter, expectedSalary, skills, experience, education, certifications, jobId } = req.body;

    if (!fullName || !email || !phone || !jobId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Resume is required' });
    }

    // Check for duplicate applications
    const existingApp = await Application.findOne({
      $or: [
        { 'candidateInfo.email': email.toLowerCase() },
        { 'candidateInfo.phone': phone }
      ],
      jobId: jobId
    });

    if (existingApp) {
      return res.status(400).json({ 
        message: 'You have already applied for this position',
        isDuplicate: true,
        existingApplicationId: existingApp._id
      });
    }

    const resumeUrl = `/uploads/recruitment/resumes/${req.file.filename}`;

    const application = new Application({
      candidateInfo: {
        fullName,
        email: email.toLowerCase(),
        phone,
        resume: resumeUrl,
        coverLetter,
        expectedSalary: expectedSalary ? parseFloat(expectedSalary) : undefined,
        skills: skills ? (Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim())) : [],
        experience: experience || '',
        education: education || '',
        certifications: certifications ? (Array.isArray(certifications) ? certifications : certifications.split(',').map(c => c.trim())) : [],
        appliedDate: new Date()
      },
      jobId,
      status: 'Application'
    });

    // Get job details for screening
    const job = await Job.findById(jobId);
    if (job) {
      const screeningResult = calculateScreeningScore(application.candidateInfo, job);
      application.screening = {
        ...screeningResult,
        screeningDate: new Date()
      };
    }

    // Add initial status to history
    application.statusHistory.push({
      status: 'Application',
      updatedBy: null, // Public application
      updatedDate: new Date(),
      comments: 'Application submitted',
      timestamp: new Date()
    });

    await application.save();

    // Send confirmation email to candidate
    await sendEmail(
      email,
      'Application Received - ' + (job?.title || 'Job Position'),
      `
        <h2>Thank you for your application!</h2>
        <p>Dear ${fullName},</p>
        <p>We have received your application for the position of <strong>${job?.title || 'the job position'}</strong>.</p>
        <p>Our team will review your application and get back to you soon.</p>
        <p>Best regards,<br>HR Team</p>
      `
    );

    res.status(201).json(application);
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/convert-to-employee
// @desc    Convert selected candidate to employee with unique employee ID
// @access  Private (HR/Admin)
router.post('/applications/:id/convert-to-employee', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('jobId');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'Selected' && application.status !== 'Onboarding') {
      return res.status(400).json({ 
        message: 'Only selected candidates can be converted to employees',
        currentStatus: application.status
      });
    }

    // Check if employee already exists with this email
    const existingEmployee = await Employee.findOne({
      'personalInfo.email': application.candidateInfo.email.toLowerCase()
    });

    if (existingEmployee) {
      return res.status(400).json({ 
        message: 'Employee with this email already exists',
        employeeId: existingEmployee.employeeId,
        employee: existingEmployee._id
      });
    }

    // Generate unique employee ID
    const year = new Date().getFullYear();
    const employeesWithId = await Employee.find({
      employeeId: { $regex: new RegExp(`^EMP-${year}-`) }
    }).select('employeeId').sort({ employeeId: -1 }).limit(1);

    let count = 0;
    if (employeesWithId.length > 0 && employeesWithId[0].employeeId) {
      const match = employeesWithId[0].employeeId.match(/-(\d+)$/);
      if (match) {
        count = parseInt(match[1], 10);
      }
    } else {
      count = await Employee.countDocuments();
    }

    let generatedEmployeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
    
    // Ensure uniqueness
    let exists = await Employee.findOne({ employeeId: generatedEmployeeId });
    let attempts = 0;
    while (exists && attempts < 100) {
      count++;
      generatedEmployeeId = `EMP-${year}-${String(count + 1).padStart(5, '0')}`;
      exists = await Employee.findOne({ employeeId: generatedEmployeeId });
      attempts++;
    }

    // Get offer letter details if available
    const offerLetter = application.offerLetter || {};
    const job = application.jobId || {};

    // Create employee profile
    const employee = new Employee({
      employeeId: generatedEmployeeId,
      personalInfo: {
        fullName: application.candidateInfo.fullName,
        email: application.candidateInfo.email.toLowerCase(),
        mobile: application.candidateInfo.phone
      },
      companyDetails: {
        joiningDate: offerLetter.joiningDate || new Date(),
        department: offerLetter.department || job.department || 'General',
        designation: offerLetter.jobTitle || job.title || 'Employee',
        workType: offerLetter.workType || 'WFO',
        location: offerLetter.workLocation || '',
        employmentStatus: 'Active',
        reportingManager: offerLetter.reportingManager || null
      },
      employmentInfo: {
        previousSalary: application.candidateInfo.expectedSalary || offerLetter.salary || null,
        totalExperience: application.candidateInfo.experience || ''
      },
      documents: [{
        type: 'Resume',
        url: application.candidateInfo.resume,
        uploadedAt: new Date(),
        status: 'Verified'
      }]
    });

    // Calculate profile completion
    employee.calculateProfileCompletion();
    await employee.save();

    // Create lifecycle record for joining
    const lifecycle = new Lifecycle({
      employeeId: employee._id,
      currentStage: 'Joining',
      status: 'Active',
      stages: [{
        stage: 'Joining',
        performedBy: req.user._id,
        comments: `Converted from recruitment application. Application ID: ${application._id}`,
        stageDate: new Date()
      }]
    });
    await lifecycle.save();

    // Update application status
    application.status = 'Onboarding';
    application.statusHistory.push({
      status: 'Onboarding',
      updatedBy: req.user._id,
      updatedDate: new Date(),
      comments: `Candidate converted to employee. Employee ID: ${generatedEmployeeId}`,
      timestamp: new Date()
    });
    await application.save();

    // Update onboarding record if exists
    const onboarding = await Onboarding.findOne({ applicationId: application._id });
    if (onboarding) {
      onboarding.candidateId = employee._id;
      onboarding.checklist.profileCreated = true;
      await onboarding.save();
    }

    res.status(201).json({
      message: 'Candidate successfully converted to employee',
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        fullName: employee.personalInfo.fullName,
        email: employee.personalInfo.email,
        department: employee.companyDetails.department,
        designation: employee.companyDetails.designation
      },
      application: {
        _id: application._id,
        status: application.status
      }
    });
  } catch (error) {
    console.error('Convert to employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/recruitment/applications
// @desc    Get all applications (HR/Admin/Manager only)
// @access  Private (HR/Admin/Manager)
router.get('/applications', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const filter = {};
    
    // For managers, only show applications where they are the reporting manager
    let managerReportingManagerFilter = null;
    if (req.user.role === 'manager') {
      if (!req.user.employeeId) {
        console.log('[RECRUITMENT] Manager has no employeeId, returning empty array');
        return res.json([]);
      }
      
      const manager = await Employee.findById(req.user.employeeId);
      if (!manager) {
        console.log('[RECRUITMENT] Manager profile not found for employeeId:', req.user.employeeId);
        return res.json([]);
      }
      
      const mongoose = require('mongoose');
      const managerEmployeeId = manager._id;
      let managerObjectId;
      
      if (managerEmployeeId instanceof mongoose.Types.ObjectId) {
        managerObjectId = managerEmployeeId;
      } else if (mongoose.Types.ObjectId.isValid(managerEmployeeId)) {
        managerObjectId = new mongoose.Types.ObjectId(managerEmployeeId);
      } else {
        managerObjectId = managerEmployeeId;
      }
      
      // Filter to only show applications where manager is the reporting manager
      managerReportingManagerFilter = {
        $or: [
          { 'offerLetter.reportingManager': managerObjectId },
          { 'offerLetter.reportingManager': managerEmployeeId.toString() },
          { 'offerLetter.reportingManager': String(managerEmployeeId) }
        ],
        'offerLetter': { $exists: true, $ne: null }
      };
      
      console.log(`[RECRUITMENT] Manager ${req.user.email} fetching applications with reportingManager: ${managerEmployeeId}`);
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.jobId) {
      filter.jobId = req.query.jobId;
    }

    if (req.query.search) {
      filter.$or = [
        { 'candidateInfo.fullName': { $regex: req.query.search, $options: 'i' } },
        { 'candidateInfo.email': { $regex: req.query.search, $options: 'i' } },
        { 'candidateInfo.phone': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (req.query.screeningResult) {
      filter['screening.result'] = req.query.screeningResult;
    }

    if (req.query.priorityScore) {
      filter['screening.priorityScore'] = req.query.priorityScore;
    }

    if (req.query.inTalentPool === 'true') {
      filter.inTalentPool = true;
    }

    // Combine manager filter with other filters
    let finalFilter = { ...filter };
    if (managerReportingManagerFilter) {
      // Merge the manager filter conditions
      finalFilter = {
        ...filter,
        $and: [
          { $or: managerReportingManagerFilter.$or },
          { 'offerLetter': managerReportingManagerFilter['offerLetter'] }
        ]
      };
      
      // If there's a search $or, we need to handle it properly
      if (filter.$or) {
        // Search $or should be combined with manager filter using $and
        finalFilter.$and.push({ $or: filter.$or });
        delete finalFilter.$or;
      }
    }

    const applications = await Application.find(finalFilter)
      .populate('jobId', 'title department')
      .populate('interviewRounds.evaluator', 'email')
      .populate('offerLetter.reportingManager', 'personalInfo.fullName employeeId')
      .sort({ 'offerLetter.generatedDate': -1, 'candidateInfo.appliedDate': -1 })
      .lean();

    console.log(`[RECRUITMENT] Found ${applications.length} applications for ${req.user.role} ${req.user.email}`);
    
    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/recruitment/applications/:id
// @desc    Get single application
// @access  Private (HR/Admin/Manager)
router.get('/applications/:id', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('jobId')
      .populate('interviewRounds.evaluator', 'email personalInfo.fullName')
      .populate('offerLetter.reportingManager', 'personalInfo.fullName employeeId')
      .populate('statusHistory.updatedBy', 'email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/recruitment/applications/:id/status
// @desc    Update application status
// @access  Private (HR/Admin)
router.put('/applications/:id/status', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { status, comments, rejectionReason, inTalentPool, currentRound } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const oldStatus = application.status;
    application.status = status;

    if (inTalentPool !== undefined) {
      application.inTalentPool = inTalentPool;
    }

    // Update current round if provided
    if (currentRound !== undefined) {
      application.currentRound = currentRound;
    }

    // Add to status history
    application.statusHistory.push({
      status,
      updatedBy: req.user._id,
      updatedDate: new Date(),
      comments,
      rejectionReason,
      timestamp: new Date()
    });

    await application.save();

    // Send email notification
    await sendEmail(
      application.candidateInfo.email,
      `Application Status Update - ${status}`,
      `
        <h2>Application Status Update</h2>
        <p>Dear ${application.candidateInfo.fullName},</p>
        <p>Your application status has been updated to: <strong>${status}</strong></p>
        ${comments ? `<p>Comments: ${comments}</p>` : ''}
        ${rejectionReason ? `<p>Reason: ${rejectionReason}</p>` : ''}
        <p>Best regards,<br>HR Team</p>
      `
    );

    res.json(application);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/screening
// @desc    Run or update screening
// @access  Private (HR/Admin)
router.post('/applications/:id/screening', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('jobId');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (!application.jobId) {
      return res.status(400).json({ message: 'Job not found for this application' });
    }

    const screeningResult = calculateScreeningScore(application.candidateInfo, application.jobId);
    application.screening = {
      ...screeningResult,
      screeningDate: new Date()
    };

    await application.save();
    res.json(application);
  } catch (error) {
    console.error('Screening error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== INTERVIEW ROUTES ====================

// @route   POST /api/recruitment/applications/:id/interviews
// @desc    Schedule interview
// @access  Private (HR/Admin/Manager)
router.post('/applications/:id/interviews', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const { roundType, scheduledDate, scheduledTime, evaluator, mode, meetingLink, venue } = req.body;

    if (!roundType || !scheduledDate || !scheduledTime || !evaluator) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check for calendar conflicts
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const conflictingInterviews = await Application.find({
      'interviewRounds.evaluator': evaluator,
      'interviewRounds.status': { $in: ['Scheduled', 'Rescheduled'] },
      'interviewRounds.scheduledDate': scheduledDateTime
    });

    if (conflictingInterviews.length > 0) {
      return res.status(400).json({ 
        message: 'Interviewer has a conflicting interview at this time',
        conflict: true
      });
    }

    const interviewRound = {
      roundType,
      status: 'Scheduled',
      scheduledDate: scheduledDateTime,
      scheduledTime,
      evaluator,
      mode: mode || 'Online',
      meetingLink,
      venue
    };

    application.interviewRounds.push(interviewRound);
    // Update current round
    application.currentRound = roundType;
    await application.save();

    // Get evaluator and candidate details for email
    const evaluatorUser = await User.findById(evaluator);
    const applicationWithJob = await Application.findById(req.params.id).populate('jobId', 'title');

    // Send email to candidate
    await sendEmail(
      application.candidateInfo.email,
      `Interview Scheduled - ${roundType}`,
      `
        <h2>Interview Scheduled</h2>
        <p>Dear ${application.candidateInfo.fullName},</p>
        <p>Your interview for the position of <strong>${applicationWithJob.jobId?.title || 'the job position'}</strong> has been scheduled.</p>
        <p><strong>Round:</strong> ${roundType}</p>
        <p><strong>Date:</strong> ${new Date(scheduledDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${scheduledTime}</p>
        <p><strong>Mode:</strong> ${mode || 'Online'}</p>
        ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
        ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ''}
        <p>Please be on time for the interview.</p>
        <p>Best regards,<br>HR Team</p>
      `
    );

    // Send email to evaluator
    if (evaluatorUser?.email) {
      await sendEmail(
        evaluatorUser.email,
        `Interview Scheduled - ${roundType}`,
        `
          <h2>Interview Scheduled</h2>
          <p>You have been assigned to conduct an interview.</p>
          <p><strong>Candidate:</strong> ${application.candidateInfo.fullName}</p>
          <p><strong>Position:</strong> ${applicationWithJob.jobId?.title || 'N/A'}</p>
          <p><strong>Round:</strong> ${roundType}</p>
          <p><strong>Date:</strong> ${new Date(scheduledDate).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${scheduledTime}</p>
          <p><strong>Mode:</strong> ${mode || 'Online'}</p>
          ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
          ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ''}
        `
      );
    }

    // Send notification to HR, Admin, and Manager
    try {
      const hrAdminManagerUsers = await User.find({
        role: { $in: ['hr', 'admin', 'manager'] }
      }).select('email');

      const notificationEmails = hrAdminManagerUsers
        .map(user => user.email)
        .filter(email => email && email !== evaluatorUser?.email); // Exclude evaluator if they're HR/Admin/Manager

      if (notificationEmails.length > 0) {
        const emailPromises = notificationEmails.map(email =>
          sendEmail(
            email,
            `Upcoming Interview Scheduled - ${roundType}`,
            `
              <h2>Interview Scheduled - Notification</h2>
              <p>An interview has been scheduled in the recruitment system.</p>
              <p><strong>Candidate:</strong> ${application.candidateInfo.fullName}</p>
              <p><strong>Email:</strong> ${application.candidateInfo.email}</p>
              <p><strong>Phone:</strong> ${application.candidateInfo.phone || 'N/A'}</p>
              <p><strong>Position:</strong> ${applicationWithJob.jobId?.title || 'N/A'}</p>
              <p><strong>Round:</strong> ${roundType}</p>
              <p><strong>Date:</strong> ${new Date(scheduledDate).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${scheduledTime}</p>
              <p><strong>Mode:</strong> ${mode || 'Online'}</p>
              <p><strong>Evaluator:</strong> ${evaluatorUser?.email || 'N/A'}</p>
              ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
              ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ''}
              <p>You can view all interviews in the Recruitment module.</p>
              <p>Best regards,<br>HRMS System</p>
            `
          )
        );
        await Promise.all(emailPromises);
        console.log(`Sent interview notifications to ${notificationEmails.length} HR/Admin/Manager users`);
      }
    } catch (notificationError) {
      console.error('Error sending notifications to HR/Admin/Manager:', notificationError);
      // Don't fail the request if notification fails
    }

    res.status(201).json(application);
  } catch (error) {
    console.error('Schedule interview error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/recruitment/applications/:id/current-round
// @desc    Update current round for application
// @access  Private (HR/Admin)
router.put('/applications/:id/current-round', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { currentRound } = req.body;

    if (!currentRound) {
      return res.status(400).json({ message: 'Current round is required' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.currentRound = currentRound;
    await application.save();

    res.json(application);
  } catch (error) {
    console.error('Update current round error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/recruitment/applications/:id/interviews/:interviewId
// @desc    Update interview (reschedule, complete, add feedback)
// @access  Private (HR/Admin/Manager)
router.put('/applications/:id/interviews/:interviewId', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const { status, feedback, rating, scheduledDate, scheduledTime, meetingLink, venue, noShowReason } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const interview = application.interviewRounds.id(req.params.interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (status) {
      interview.status = status;
      if (status === 'Completed' || status === 'Passed' || status === 'Failed') {
        interview.completedAt = new Date();
      }
      if (status === 'No Show') {
        interview.noShowReason = noShowReason;
      }
    }

    if (feedback !== undefined) interview.feedback = feedback;
    if (rating !== undefined) interview.rating = rating;

    // Reschedule
    if (scheduledDate && scheduledTime && (status === 'Rescheduled' || interview.status === 'Scheduled')) {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      
      // Check conflicts
      const conflictingInterviews = await Application.find({
        'interviewRounds.evaluator': interview.evaluator,
        'interviewRounds.status': { $in: ['Scheduled', 'Rescheduled'] },
        'interviewRounds.scheduledDate': scheduledDateTime,
        _id: { $ne: application._id }
      });

      if (conflictingInterviews.length > 0) {
        return res.status(400).json({ 
          message: 'Interviewer has a conflicting interview at this time',
          conflict: true
        });
      }

      interview.scheduledDate = scheduledDateTime;
      interview.scheduledTime = scheduledTime;
      interview.status = 'Rescheduled';
    }

    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (venue !== undefined) interview.venue = venue;

    await application.save();

    // Send notification if rescheduled
    if (status === 'Rescheduled' || (scheduledDate && scheduledTime)) {
      const applicationWithJob = await Application.findById(req.params.id).populate('jobId', 'title');
      const evaluatorUser = await User.findById(interview.evaluator);
      
      // Send to candidate
      await sendEmail(
        application.candidateInfo.email,
        'Interview Rescheduled',
        `
          <h2>Interview Rescheduled</h2>
          <p>Dear ${application.candidateInfo.fullName},</p>
          <p>Your interview has been rescheduled.</p>
          <p><strong>New Date:</strong> ${new Date(scheduledDate || interview.scheduledDate).toLocaleDateString()}</p>
          <p><strong>New Time:</strong> ${scheduledTime || interview.scheduledTime}</p>
          ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
          ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ''}
          <p>Best regards,<br>HR Team</p>
        `
      );

      // Send notification to HR, Admin, and Manager about rescheduled interview
      try {
        const hrAdminManagerUsers = await User.find({
          role: { $in: ['hr', 'admin', 'manager'] }
        }).select('email');

        const notificationEmails = hrAdminManagerUsers
          .map(user => user.email)
          .filter(email => email && email !== evaluatorUser?.email);

        if (notificationEmails.length > 0) {
          const emailPromises = notificationEmails.map(email =>
            sendEmail(
              email,
              `Interview Rescheduled - ${interview.roundType}`,
              `
                <h2>Interview Rescheduled - Notification</h2>
                <p>An interview has been rescheduled in the recruitment system.</p>
                <p><strong>Candidate:</strong> ${application.candidateInfo.fullName}</p>
                <p><strong>Position:</strong> ${applicationWithJob.jobId?.title || 'N/A'}</p>
                <p><strong>Round:</strong> ${interview.roundType}</p>
                <p><strong>New Date:</strong> ${new Date(scheduledDate || interview.scheduledDate).toLocaleDateString()}</p>
                <p><strong>New Time:</strong> ${scheduledTime || interview.scheduledTime}</p>
                <p><strong>Mode:</strong> ${interview.mode || 'Online'}</p>
                <p><strong>Evaluator:</strong> ${evaluatorUser?.email || 'N/A'}</p>
                ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
                ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ''}
                <p>You can view all interviews in the Recruitment module.</p>
                <p>Best regards,<br>HRMS System</p>
              `
            )
          );
          await Promise.all(emailPromises);
          console.log(`Sent reschedule notifications to ${notificationEmails.length} HR/Admin/Manager users`);
        }
      } catch (notificationError) {
        console.error('Error sending reschedule notifications to HR/Admin/Manager:', notificationError);
      }
    }

    res.json(application);
  } catch (error) {
    console.error('Update interview error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== OFFER LETTER ROUTES ====================

// @route   POST /api/recruitment/offer-templates
// @desc    Upload offer letter template
// @access  Private (HR/Admin)
router.post('/offer-templates', protect, authorize('hr', 'admin'), recruitmentUpload.single('template'), async (req, res) => {
  try {
    const { name, description, placeholders } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Template file is required' });
    }

    const templateUrl = `/uploads/recruitment/templates/${req.file.filename}`;
    const fileType = path.extname(req.file.originalname).toLowerCase() === '.pdf' ? 'PDF' : 'DOCX';

    const template = new OfferTemplate({
      name,
      description,
      templateFile: templateUrl,
      fileType,
      placeholders: placeholders ? JSON.parse(placeholders) : [],
      createdBy: req.user._id
    });

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/recruitment/offer-templates
// @desc    Get all offer templates
// @access  Private (HR/Admin)
router.get('/offer-templates', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const templates = await OfferTemplate.find({ isActive: true })
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/recruitment/offer-templates/:id
// @desc    Delete offer template
// @access  Private (HR/Admin)
router.delete('/offer-templates/:id', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const template = await OfferTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if template is being used in any offers
    const applicationsUsingTemplate = await Application.find({
      'offerLetter.templateId': req.params.id
    });

    if (applicationsUsingTemplate.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete template. It is being used in ${applicationsUsingTemplate.length} offer letter(s).`,
        inUse: true,
        usageCount: applicationsUsingTemplate.length
      });
    }

    // Delete the template file from filesystem if it exists
    if (template.templateFile) {
      const filePath = path.join(__dirname, '..', template.templateFile);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('Template file deleted:', filePath);
        } catch (fileError) {
          console.warn('Error deleting template file:', fileError);
          // Continue with template deletion even if file deletion fails
        }
      }
    }

    // Delete the template from database
    await OfferTemplate.findByIdAndDelete(req.params.id);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/generate-offer
// @desc    Generate offer letter
// @access  Private (HR/Admin)
router.post('/applications/:id/generate-offer', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const {
      templateId,
      candidateName,
      jobTitle,
      salary,
      joiningDate,
      reportingManager,
      department,
      workType,
      workLocation,
      probationPeriod,
      noticePeriod,
      additionalTerms,
      expiryDate
    } = req.body;

    if (!templateId || !candidateName || !jobTitle || !salary || !joiningDate || !department) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const template = await OfferTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // For now, create a simple PDF offer letter
    // In production, you'd use a library like docx or pdf-lib to fill template placeholders
    const doc = new PDFDocument();
    const fileName = `offer-${application._id}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../uploads/recruitment/offers', fileName);
    
    // Ensure directory exists
    const offersDir = path.dirname(filePath);
    if (!fs.existsSync(offersDir)) {
      fs.mkdirSync(offersDir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Generate PDF content
    doc.fontSize(20).text('OFFER LETTER', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Dear ${candidateName},`);
    doc.moveDown();
    doc.text(`We are pleased to offer you the position of ${jobTitle} in our ${department} department.`);
    doc.moveDown();
    doc.text(`Salary (CTC): ₹${salary.toLocaleString('en-IN')}`);
    doc.text(`Joining Date: ${new Date(joiningDate).toLocaleDateString()}`);
    doc.text(`Work Type: ${workType || 'WFO'}`);
    doc.text(`Work Location: ${workLocation || 'N/A'}`);
    if (probationPeriod) doc.text(`Probation Period: ${probationPeriod}`);
    if (noticePeriod) doc.text(`Notice Period: ${noticePeriod}`);
    if (additionalTerms) {
      doc.moveDown();
      doc.text('Additional Terms:');
      doc.text(additionalTerms);
    }
    doc.moveDown();
    doc.text('We look forward to welcoming you to our team.');
    doc.moveDown();
    doc.text('Best regards,');
    doc.text('HR Team');

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const offerUrl = `/uploads/recruitment/offers/${fileName}`;

    // Ensure reportingManager is stored as ObjectId if provided
    const mongoose = require('mongoose');
    let reportingManagerId = null;
    if (reportingManager) {
      if (mongoose.Types.ObjectId.isValid(reportingManager)) {
        reportingManagerId = new mongoose.Types.ObjectId(reportingManager);
      } else {
        console.warn('[GENERATE_OFFER] Invalid reportingManager ID:', reportingManager);
      }
    }

    application.offerLetter = {
      templateId,
      generatedDate: new Date(),
      candidateName,
      jobTitle,
      salary: parseFloat(salary),
      joiningDate: new Date(joiningDate),
      reportingManager: reportingManagerId,
      department,
      workType,
      workLocation,
      probationPeriod,
      noticePeriod,
      additionalTerms,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      status: 'Pending',
      documentUrl: offerUrl
    };

    await application.save();
    
    console.log(`[GENERATE_OFFER] Offer letter generated for application ${application._id}, reportingManager: ${reportingManagerId || 'Not set'}`);

    res.json({
      message: 'Offer letter generated successfully',
      offerLetter: application.offerLetter,
      previewUrl: offerUrl
    });
  } catch (error) {
    console.error('Generate offer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/send-offer-reminder
// @desc    Send reminder for pending offer
// @access  Private (HR/Admin)
router.post('/applications/:id/send-offer-reminder', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application || !application.offerLetter) {
      return res.status(404).json({ message: 'Offer letter not found' });
    }

    const offer = application.offerLetter;
    const offerFilePath = path.join(__dirname, '..', offer.documentUrl);

    // Send reminder email
    await sendEmail(
      application.candidateInfo.email,
      'Reminder: Job Offer Letter - Action Required',
      `
        <h2>Reminder: Job Offer Letter</h2>
        <p>Dear ${offer.candidateName},</p>
        <p>This is a friendly reminder about your job offer for the position of <strong>${offer.jobTitle}</strong>.</p>
        <p>Please review the offer letter and respond at your earliest convenience.</p>
        <p>${offer.expiryDate ? `This offer expires on ${new Date(offer.expiryDate).toLocaleDateString()}.` : ''}</p>
        <p>You can accept or reject the offer through the link provided in the original email.</p>
        <p>Best regards,<br>HR Team</p>
      `,
      fs.existsSync(offerFilePath) ? [{ path: offerFilePath }] : []
    );

    res.json({ message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Send offer reminder error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/send-offer
// @desc    Send offer letter to candidate
// @access  Private (HR/Admin)
router.post('/applications/:id/send-offer', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application || !application.offerLetter) {
      return res.status(404).json({ message: 'Offer letter not found' });
    }

    const offer = application.offerLetter;
    const offerFilePath = path.join(__dirname, '..', offer.documentUrl);

    // Generate accept and reject links (using public frontend pages)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const acceptLink = `${frontendUrl}/offer/${application._id}/accept?email=${encodeURIComponent(application.candidateInfo.email)}`;
    const rejectLink = `${frontendUrl}/offer/${application._id}/reject?email=${encodeURIComponent(application.candidateInfo.email)}`;

    // Prepare email HTML with offer details and action buttons
    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
          .offer-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: 600; color: #6b7280; }
          .detail-value { color: #111827; }
          .action-buttons { text-align: center; margin: 30px 0; }
          .btn { display: inline-block; padding: 12px 30px; margin: 10px; text-decoration: none; border-radius: 5px; font-weight: 600; }
          .btn-accept { background-color: #10b981; color: white; }
          .btn-reject { background-color: #ef4444; color: white; }
          .btn-view { background-color: #3b82f6; color: white; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
          .expiry-notice { background-color: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Job Offer Letter</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${offer.candidateName}</strong>,</p>
            
            <p>Congratulations! We are delighted to extend a job offer to you for the position of <strong>${offer.jobTitle}</strong> at our organization.</p>
            
            <div class="offer-details">
              <h3 style="margin-top: 0; color: #4F46E5;">Offer Details</h3>
              <div class="detail-row">
                <span class="detail-label">Position:</span>
                <span class="detail-value">${offer.jobTitle}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${offer.department || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Salary (CTC):</span>
                <span class="detail-value">₹${offer.salary?.toLocaleString('en-IN') || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Joining Date:</span>
                <span class="detail-value">${offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Work Type:</span>
                <span class="detail-value">${offer.workType || 'WFO'}</span>
              </div>
              ${offer.workLocation ? `
              <div class="detail-row">
                <span class="detail-label">Work Location:</span>
                <span class="detail-value">${offer.workLocation}</span>
              </div>
              ` : ''}
              ${offer.probationPeriod ? `
              <div class="detail-row">
                <span class="detail-label">Probation Period:</span>
                <span class="detail-value">${offer.probationPeriod}</span>
              </div>
              ` : ''}
              ${offer.noticePeriod ? `
              <div class="detail-row">
                <span class="detail-label">Notice Period:</span>
                <span class="detail-value">${offer.noticePeriod}</span>
              </div>
              ` : ''}
            </div>

            ${offer.expiryDate ? `
            <div class="expiry-notice">
              <strong>⏰ Important:</strong> This offer expires on <strong>${new Date(offer.expiryDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>. Please respond before this date.
            </div>
            ` : ''}

            ${offer.additionalTerms ? `
            <div style="background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h4 style="margin-top: 0;">Additional Terms:</h4>
              <p style="white-space: pre-wrap;">${offer.additionalTerms}</p>
            </div>
            ` : ''}

            <p>Please find the detailed offer letter attached to this email. We request you to review all the terms and conditions carefully.</p>

            <div class="action-buttons">
              <p style="font-weight: 600; margin-bottom: 15px;">Please respond to this offer:</p>
              <a href="${acceptLink}?email=${encodeURIComponent(application.candidateInfo.email)}" class="btn btn-accept">✓ Accept Offer</a>
              <a href="${rejectLink}?email=${encodeURIComponent(application.candidateInfo.email)}" class="btn btn-reject">✗ Reject Offer</a>
            </div>

            <p style="margin-top: 30px;">If you have any questions or need clarification on any aspect of this offer, please feel free to contact our HR team.</p>

            <p>We look forward to welcoming you to our team!</p>

            <p>Best regards,<br>
            <strong>HR Team</strong><br>
            ${process.env.COMPANY_NAME || 'Your Organization'}</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
            <p>If you have any questions, please contact our HR department.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Validate candidate email
    if (!application.candidateInfo.email || !application.candidateInfo.email.includes('@')) {
      return res.status(400).json({ 
        message: 'Invalid candidate email address. Cannot send offer letter.',
        candidateEmail: application.candidateInfo.email
      });
    }

    // Check if file exists before attaching
    const attachments = [];
    if (fs.existsSync(offerFilePath)) {
      attachments.push({
        filename: `Offer_Letter_${offer.candidateName.replace(/\s+/g, '_')}.pdf`,
        path: offerFilePath
      });
      console.log('✅ Offer letter file found and will be attached:', offerFilePath);
    } else {
      console.warn(`⚠️ Offer letter file not found at: ${offerFilePath}`);
      console.warn('⚠️ Email will be sent without attachment');
    }

    // Send email with offer letter attachment
    try {
      const emailResult = await sendEmail(
        application.candidateInfo.email,
        `Job Offer Letter - ${offer.jobTitle} Position`,
        emailHTML,
        attachments
      );

      // Check if email was actually sent (not just simulated)
      if (!emailResult || (emailResult.simulated && process.env.NODE_ENV === 'production')) {
        return res.status(500).json({ 
          message: 'Failed to send email. SMTP is not configured properly.',
          error: 'Please configure SMTP_USER and SMTP_PASS in your .env file',
          candidateEmail: application.candidateInfo.email
        });
      }

      if (emailResult.simulated) {
        console.warn('⚠️ Email was simulated (SMTP not configured). In production, this would fail.');
        // Still update status but warn the user
      }

      console.log('✅ Offer letter email sent successfully to:', application.candidateInfo.email);
    } catch (emailError) {
      console.error('❌ Failed to send offer letter email:', emailError);
      return res.status(500).json({ 
        message: 'Failed to send email to candidate',
        error: emailError.message,
        candidateEmail: application.candidateInfo.email,
        details: 'Please check SMTP configuration and try again'
      });
    }

    // Update offer status only if email was actually sent
    offer.status = 'Sent';
    offer.sentAt = new Date();
    await application.save();

    // Update application status
    application.status = 'Offer';
    application.statusHistory.push({
      status: 'Offer',
      updatedBy: req.user._id,
      updatedDate: new Date(),
      comments: 'Offer letter sent to candidate via email',
      timestamp: new Date()
    });
    await application.save();

    res.json({ 
      message: 'Offer letter sent successfully to candidate email', 
      application,
      emailSent: true,
      candidateEmail: application.candidateInfo.email,
      offerDetails: {
        position: offer.jobTitle,
        salary: offer.salary,
        joiningDate: offer.joiningDate
      }
    });
  } catch (error) {
    console.error('Send offer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/accept-offer
// @desc    Accept offer (public endpoint for candidates)
// @access  Public
router.post('/applications/:id/accept-offer', async (req, res) => {
  try {
    const { candidateEmail } = req.body;
    const application = await Application.findById(req.params.id);
    
    if (!application || !application.offerLetter) {
      return res.status(404).json({ message: 'Offer letter not found' });
    }

    if (application.candidateInfo.email.toLowerCase() !== candidateEmail.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (application.offerLetter.status === 'Accepted') {
      return res.status(400).json({ message: 'Offer already accepted' });
    }

    if (application.offerLetter.expiryDate && new Date(application.offerLetter.expiryDate) < new Date()) {
      application.offerLetter.status = 'Expired';
      await application.save();
      return res.status(400).json({ message: 'Offer has expired' });
    }

    application.offerLetter.status = 'Accepted';
    application.offerLetter.acceptedAt = new Date();
    application.offerLetter.acceptedBy = candidateEmail;

    // Create onboarding record
    const onboarding = new Onboarding({
      applicationId: application._id,
      candidateName: application.candidateInfo.fullName,
      jobTitle: application.offerLetter.jobTitle,
      joiningDate: application.offerLetter.joiningDate,
      onboardingStatus: 'Pending',
      onboardingLink: `/onboarding/${application._id}-${Date.now()}`
    });
    await onboarding.save();

    application.status = 'Onboarding';
    application.statusHistory.push({
      status: 'Onboarding',
      updatedBy: null,
      updatedDate: new Date(),
      comments: 'Offer accepted by candidate',
      timestamp: new Date()
    });

    await application.save();

    // Send onboarding link to candidate
    await sendEmail(
      application.candidateInfo.email,
      'Welcome! Onboarding Process',
      `
        <h2>Congratulations on Accepting the Offer!</h2>
        <p>Dear ${application.candidateInfo.fullName},</p>
        <p>Thank you for accepting our offer. We're excited to have you join our team!</p>
        <p>Please complete your onboarding by visiting: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${onboarding.onboardingLink}">Onboarding Portal</a></p>
        <p>Best regards,<br>HR Team</p>
      `
    );

    res.json({ message: 'Offer accepted successfully', onboarding });
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/applications/:id/reject-offer
// @desc    Reject offer (public endpoint for candidates)
// @access  Public
router.post('/applications/:id/reject-offer', async (req, res) => {
  try {
    const { candidateEmail, reason } = req.body;
    const application = await Application.findById(req.params.id);
    
    if (!application || !application.offerLetter) {
      return res.status(404).json({ message: 'Offer letter not found' });
    }

    if (application.candidateInfo.email.toLowerCase() !== candidateEmail.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    application.offerLetter.status = 'Rejected';
    application.offerLetter.rejectedAt = new Date();
    application.status = 'Rejected';
    application.statusHistory.push({
      status: 'Rejected',
      updatedBy: null,
      updatedDate: new Date(),
      comments: reason || 'Offer rejected by candidate',
      rejectionReason: reason,
      timestamp: new Date()
    });

    await application.save();
    res.json({ message: 'Offer rejected' });
  } catch (error) {
    console.error('Reject offer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ONBOARDING ROUTES ====================

// @route   GET /api/recruitment/onboarding/:linkId
// @desc    Get onboarding details by link
// @access  Public (for candidates)
router.get('/onboarding/:linkId', async (req, res) => {
  try {
    // Extract application ID from link
    const applicationId = req.params.linkId.split('-')[0];
    const onboarding = await Onboarding.findOne({ applicationId }).populate('applicationId');
    
    if (!onboarding) {
      return res.status(404).json({ message: 'Onboarding not found' });
    }

    res.json(onboarding);
  } catch (error) {
    console.error('Get onboarding error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/onboarding/:id/upload-document
// @desc    Upload onboarding document
// @access  Public (for candidates)
router.post('/onboarding/:id/upload-document', recruitmentUpload.single('document'), async (req, res) => {
  try {
    const { documentName } = req.body;
    const onboarding = await Onboarding.findById(req.params.id);
    
    if (!onboarding) {
      return res.status(404).json({ message: 'Onboarding not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Document file is required' });
    }

    const documentUrl = `/uploads/recruitment/onboarding/${req.file.filename}`;
    
    const existingDoc = onboarding.documents.find(d => d.name === documentName);
    if (existingDoc) {
      existingDoc.documentUrl = documentUrl;
      existingDoc.uploadedAt = new Date();
      existingDoc.status = 'Pending';
    } else {
      onboarding.documents.push({
        name: documentName,
        documentUrl,
        uploadedAt: new Date(),
        status: 'Pending'
      });
    }

    // Check if all required documents are uploaded
    const allUploaded = onboarding.documents.every(doc => doc.documentUrl);
    if (allUploaded) {
      onboarding.checklist.documentsUploaded = true;
      onboarding.onboardingStatus = 'Documents Submitted';
    }

    await onboarding.save();
    res.json(onboarding);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/recruitment/onboarding/:id/verify-document/:docId
// @desc    Verify/reject document (HR only)
// @access  Private (HR/Admin)
router.put('/onboarding/:id/verify-document/:docId', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const onboarding = await Onboarding.findById(req.params.id);
    
    if (!onboarding) {
      return res.status(404).json({ message: 'Onboarding not found' });
    }

    const document = onboarding.documents.id(req.params.docId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    document.status = status;
    document.verifiedBy = req.user._id;
    document.verifiedAt = new Date();
    if (status === 'Rejected' && rejectionReason) {
      document.rejectionReason = rejectionReason;
    }

    // Check if all documents are verified
    const allVerified = onboarding.documents.every(doc => doc.status === 'Verified');
    if (allVerified && onboarding.checklist.documentsUploaded) {
      onboarding.checklist.documentsVerified = true;
      onboarding.onboardingStatus = 'Documents Verified';
    }

    await onboarding.save();
    res.json(onboarding);
  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/recruitment/onboarding
// @desc    Get all onboarding records (HR/Admin)
// @access  Private (HR/Admin)
router.get('/onboarding', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.onboardingStatus = req.query.status;
    }

    const onboardings = await Onboarding.find(filter)
      .populate('applicationId', 'candidateInfo jobId status')
      .populate('hrAssigned', 'email')
      .sort({ createdAt: -1 });

    res.json(onboardings);
  } catch (error) {
    console.error('Get onboardings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== EMPLOYEE LIFECYCLE ROUTES ====================

// @route   GET /api/recruitment/lifecycle
// @desc    Get employee lifecycle records
// @access  Private (HR/Admin/Manager)
router.get('/lifecycle', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const filter = {};
    
    if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      // Search by employee details
      const employees = await Employee.find({
        $or: [
          { employeeId: { $regex: req.query.search, $options: 'i' } },
          { 'personalInfo.fullName': { $regex: req.query.search, $options: 'i' } },
          { 'personalInfo.email': { $regex: req.query.search, $options: 'i' } },
          { 'personalInfo.mobile': { $regex: req.query.search, $options: 'i' } }
        ]
      }).select('_id');
      
      filter.employeeId = { $in: employees.map(e => e._id) };
    }

    const lifecycles = await Lifecycle.find(filter)
      .populate('employeeId', 'employeeId personalInfo.fullName personalInfo.email personalInfo.mobile companyDetails.department companyDetails.employmentStatus')
      .populate('stages.performedBy', 'email')
      .sort({ updatedAt: -1 });

    res.json(lifecycles);
  } catch (error) {
    console.error('Get lifecycle error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/recruitment/lifecycle
// @desc    Add lifecycle stage
// @access  Private (HR/Admin)
router.post('/lifecycle', protect, authorize('hr', 'admin'), async (req, res) => {
  try {
    const { employeeId, stage, comments, reason, supportingDocuments, newRole, newDepartment, oldDepartment, exitDate, exitType } = req.body;

    if (!employeeId || !stage) {
      return res.status(400).json({ message: 'Employee ID and stage are required' });
    }

    let lifecycle = await Lifecycle.findOne({ employeeId });
    
    if (!lifecycle) {
      lifecycle = new Lifecycle({
        employeeId,
        status: 'Active',
        currentStage: stage
      });
    }

    lifecycle.stages.push({
      stage,
      performedBy: req.user._id,
      comments,
      reason,
      supportingDocuments: supportingDocuments || [],
      newRole,
      newDepartment,
      oldDepartment,
      exitDate: exitDate ? new Date(exitDate) : undefined,
      exitType
    });

    lifecycle.currentStage = stage;

    // Update status based on stage
    if (stage === 'Resignation') {
      lifecycle.status = 'On Notice Period';
    } else if (stage === 'Exit') {
      lifecycle.status = 'Resigned';
    } else if (stage === 'Joining') {
      lifecycle.status = 'Active';
    }

    // Update employee status if needed
    const employee = await Employee.findById(employeeId);
    if (employee) {
      if (stage === 'Transfer' && newDepartment) {
        employee.companyDetails.department = newDepartment;
      }
      if (stage === 'Promotion' && newRole) {
        employee.companyDetails.designation = newRole;
      }
      if (stage === 'Resignation' || stage === 'Exit') {
        employee.companyDetails.employmentStatus = stage === 'Exit' ? 'Resigned' : 'On Notice Period';
      }
      await employee.save();
    }

    await lifecycle.save();
    res.status(201).json(lifecycle);
  } catch (error) {
    console.error('Add lifecycle stage error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/recruitment/lifecycle/:id
// @desc    Get single lifecycle record
// @access  Private (HR/Admin/Manager)
router.get('/lifecycle/:id', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const lifecycle = await Lifecycle.findById(req.params.id)
      .populate('employeeId')
      .populate('stages.performedBy', 'email personalInfo.fullName');

    if (!lifecycle) {
      return res.status(404).json({ message: 'Lifecycle not found' });
    }

    res.json(lifecycle);
  } catch (error) {
    console.error('Get lifecycle error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== EVALUATORS ROUTE ====================

// @route   GET /api/recruitment/evaluators
// @desc    Get all evaluators (users with manager, hr, or admin roles)
// @access  Private (HR/Admin/Manager)
router.get('/evaluators', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const evaluators = await User.find({
      role: { $in: ['manager', 'hr', 'admin'] },
      isActive: true
    })
    .select('_id email role')
    .populate('employeeId', 'personalInfo.fullName personalInfo.email')
    .lean();

    // Map to include employee info if available
    const evaluatorsWithInfo = evaluators.map(eval => ({
      _id: eval._id,
      email: eval.email,
      role: eval.role,
      personalInfo: {
        fullName: eval.employeeId?.personalInfo?.fullName || eval.email.split('@')[0],
        email: eval.email
      }
    }));

    res.json(evaluatorsWithInfo);
  } catch (error) {
    console.error('Get evaluators error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== NOTIFICATION ROUTES ====================

// @route   POST /api/recruitment/send-interview-reminders
// @desc    Send reminder notifications for upcoming interviews (can be called by cron job)
// @access  Private (HR/Admin/Manager) or can be made public for cron
router.post('/send-interview-reminders', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Find interviews scheduled for tomorrow
    const applications = await Application.find({
      'interviewRounds.status': { $in: ['Scheduled', 'Rescheduled'] },
      'interviewRounds.scheduledDate': {
        $gte: tomorrow,
        $lt: dayAfter
      }
    })
      .populate('jobId', 'title')
      .populate('interviewRounds.evaluator', 'email');

    let reminderCount = 0;

    for (const app of applications) {
      for (const interview of app.interviewRounds) {
        if (interview.status === 'Scheduled' || interview.status === 'Rescheduled') {
          const interviewDate = new Date(interview.scheduledDate);
          if (interviewDate >= tomorrow && interviewDate < dayAfter) {
            // Get HR, Admin, and Manager users
            const hrAdminManagerUsers = await User.find({
              role: { $in: ['hr', 'admin', 'manager'] }
            }).select('email');

            const evaluatorUser = await User.findById(interview.evaluator);
            const notificationEmails = hrAdminManagerUsers
              .map(user => user.email)
              .filter(email => email && email !== evaluatorUser?.email);

            if (notificationEmails.length > 0) {
              const emailPromises = notificationEmails.map(email =>
                sendEmail(
                  email,
                  `Reminder: Upcoming Interview Tomorrow - ${interview.roundType}`,
                  `
                    <h2>Interview Reminder</h2>
                    <p>This is a reminder about an upcoming interview scheduled for tomorrow.</p>
                    <p><strong>Candidate:</strong> ${app.candidateInfo.fullName}</p>
                    <p><strong>Email:</strong> ${app.candidateInfo.email}</p>
                    <p><strong>Phone:</strong> ${app.candidateInfo.phone || 'N/A'}</p>
                    <p><strong>Position:</strong> ${app.jobId?.title || 'N/A'}</p>
                    <p><strong>Round:</strong> ${interview.roundType}</p>
                    <p><strong>Date:</strong> ${interviewDate.toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${interview.scheduledTime}</p>
                    <p><strong>Mode:</strong> ${interview.mode || 'Online'}</p>
                    <p><strong>Evaluator:</strong> ${evaluatorUser?.email || 'N/A'}</p>
                    ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${interview.meetingLink}">${interview.meetingLink}</a></p>` : ''}
                    ${interview.venue ? `<p><strong>Venue:</strong> ${interview.venue}</p>` : ''}
                    <p>Please ensure all arrangements are in place for the interview.</p>
                    <p>You can view all interviews in the Recruitment module.</p>
                    <p>Best regards,<br>HRMS System</p>
                  `
                )
              );
              await Promise.all(emailPromises);
              reminderCount += notificationEmails.length;
            }
          }
        }
      }
    }

    res.json({
      message: `Sent ${reminderCount} reminder notifications for upcoming interviews`,
      interviewsFound: applications.length,
      remindersSent: reminderCount
    });
  } catch (error) {
    console.error('Send interview reminders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== DASHBOARD/STATS ROUTES ====================

// @route   GET /api/recruitment/stats
// @desc    Get recruitment statistics
// @access  Private (HR/Admin/Manager)
router.get('/stats', protect, authorize('hr', 'admin', 'manager'), async (req, res) => {
  try {
    const totalApplications = await Application.countDocuments();
    const applicationsByStatus = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const interviewsByStatus = await Application.aggregate([
      { $unwind: '$interviewRounds' },
      { $group: { _id: '$interviewRounds.status', count: { $sum: 1 } } }
    ]);

    const screeningStats = await Application.aggregate([
      { $group: { 
        _id: '$screening.result', 
        count: { $sum: 1 },
        avgScore: { $avg: '$screening.overallMatchPercentage' }
      } }
    ]);

    const jobsByStatus = await Job.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      totalApplications,
      applicationsByStatus,
      interviewsByStatus,
      screeningStats,
      jobsByStatus
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

