# Recruitment Module Implementation - Complete Guide

## Overview
A comprehensive recruitment and employee lifecycle management module has been implemented for the HR panel. This module covers the entire recruitment process from application submission to employee onboarding and lifecycle management.

## Features Implemented

### 1. Application Tracking System (ATS)

#### 1.1 Job Application Management
- ✅ Candidates can apply for open job positions
- ✅ HR can manually upload applications with resume parsing
- ✅ Stores all candidate details:
  - Full Name
  - Email
  - Phone
  - Resume (PDF/DOCX)
  - Cover Letter (optional)
  - Applied Job Role
  - Expected Salary (optional)
  - Skills & Experience
  - Application Date
  - Application Status
- ✅ Automatic resume parsing to extract candidate information
- ✅ Duplicate detection using email and phone number
- ✅ Manual field filling for data not extracted from resume

#### 1.2 Multi-Round Evaluation Workflow
- ✅ Four recruitment rounds:
  1. Aptitude Test
  2. Technical Round
  3. Interview Round
  4. HR Round
- ✅ Each round supports:
  - Status: Scheduled / Completed / Passed / Failed / No Show / Rescheduled
  - Feedback notes
  - Ratings (1–5)
  - Evaluator details
  - Date and Time of the interview
  - Mode: Online/Offline
  - Meeting link or venue
- ✅ Current round tracking with dropdown selection (HR can manually set)
- ✅ Visibility only to HR, Manager, and Admin (no employee access)

### 2. Candidate Screening & Eligibility Check

#### 2.1 Automated Screening System
- ✅ Compares candidate profile with Job Description
- ✅ Screening parameters:
  - Required Skills (40% weight)
  - Minimum Experience (25% weight)
  - Education (15% weight)
  - Certifications (10% weight)
  - Domain relevance (5% weight)
  - Preferred location (5% weight)
- ✅ Screening result options:
  - Fit
  - Partially Fit
  - Not Fit
  - Needs Manual Review
- ✅ Additional outputs:
  - Skill match percentage
  - Candidate priority score (Low/Medium/High)
  - Overall match percentage

#### 2.2 Interview Scheduling (HR Only)
- ✅ HR schedules interviews with:
  - Candidate
  - Interviewer (Evaluator)
  - Date
  - Time
  - Mode: Online/Offline
  - Meeting link or venue
- ✅ Automatic notifications to:
  - Candidate
  - Interviewer
- ✅ Calendar conflict checking to avoid double-booking
- ✅ HR can reschedule interviews with auto notifications
- ⚠️ Auto-reminder notifications: Backend structure ready, requires scheduled job/cron implementation

### 3. Recruitment Status Flow

#### Status Pipeline
Application → Shortlisted → Interview → Selected → Offer → Onboarding

#### Status Tracking Features
- ✅ Timestamp for each status change
- ✅ Tracks:
  - Updated by
  - Updated date
  - Comments
  - Rejection reasons (skill mismatch, salary mismatch, failed test, etc.)
- ✅ Talent Pool:
  - Add rejected but promising candidates for future roles

### 4. Offer Letter Management

#### 4.1 Template Management
- ✅ HR can upload multiple offer letter templates (PDF/DOCX)
- ✅ Templates stored in database/cloud
- ✅ Dynamic placeholders support:
  - {{candidate_name}}
  - {{salary}}
  - {{joining_date}}
  - {{department}}
  - And more

#### 4.2 Offer Letter Auto-Generation
- ✅ Mandatory fields for HR before generating offer:
  - Candidate Name
  - Job Title
  - Salary (CTC)
  - Joining Date
  - Reporting Manager
  - Department
  - Work Type (WFH/WFO/Hybrid)
  - Work Location
  - Probation Period
  - Notice Period
  - Additional Terms (optional)
- ✅ System functionality:
  - Auto-generate offer letter PDF using selected template
  - Allow HR preview before sending
  - Email offer letter to candidate
  - Store generated offer in database
  - Support offer expiry date
  - Candidate gets Accept/Reject option
  - HR gets an Offer Acceptance Report

### 5. Onboarding & Document Submission

#### 5.1 After Offer Acceptance
- ✅ Candidate receives onboarding portal link

#### 5.2 Candidate Document Upload
- ✅ Documents to upload:
  - Aadhaar
  - PAN
  - Address Proof
  - Bank Details
  - Education Certificates
  - Experience Letters
  - Photo
  - Updated Resume
- ✅ System features:
  - Mandatory checklist
  - Validate document formats
  - Store documents in secure cloud storage

#### 5.3 HR Verification
- ✅ HR reviews each document
- ✅ Status: Pending / Verified / Rejected
- ✅ Add rejection reason (if any)

### 6. Employee Lifecycle Management

#### Lifecycle Stages
1. Joining
2. Confirmation
3. Transfer
4. Promotion
5. Resignation
6. Exit

#### Lifecycle Data to Store
- ✅ Stage Name
- ✅ Updated Date
- ✅ Performed By
- ✅ Comments / Reason
- ✅ Supporting Documents
- ✅ Status Tracking (Active / Inactive / Resigned)

#### Search Capability
- ✅ Search employee details using:
  - Employee Unique ID
  - Name
  - Email
  - Mobile
  - Department
  - Current Status

#### UI/UX Enhancement
- ✅ Timeline view of complete employee journey
- ✅ Exit checklist (Assets, NOC, Payroll clearance)

### 7. Candidate to Employee Conversion
- ✅ When candidate is selected, they can be converted to employee
- ✅ Unique employee ID generation (format: EMP-YYYY-NNNNN)
- ✅ Automatic employee profile creation from application data
- ✅ Lifecycle record created for "Joining" stage

## Technical Implementation

### Backend Structure

#### Models
- `Application.js` - Candidate applications with all details
- `Job.js` - Job postings
- `OfferTemplate.js` - Offer letter templates
- `Onboarding.js` - Onboarding records and document tracking
- `Lifecycle.js` - Employee lifecycle stages

#### Routes (`backend/routes/recruitment.js`)
- `/api/recruitment/jobs` - Job management
- `/api/recruitment/applications` - Application management
- `/api/recruitment/applications/hr-upload` - HR manual upload with resume parsing
- `/api/recruitment/applications/:id/status` - Update application status
- `/api/recruitment/applications/:id/current-round` - Update current round
- `/api/recruitment/applications/:id/screening` - Run screening
- `/api/recruitment/applications/:id/interviews` - Schedule interviews
- `/api/recruitment/applications/:id/interviews/:interviewId` - Update interviews
- `/api/recruitment/applications/:id/generate-offer` - Generate offer letter
- `/api/recruitment/applications/:id/send-offer` - Send offer to candidate
- `/api/recruitment/applications/:id/accept-offer` - Accept offer (public)
- `/api/recruitment/applications/:id/reject-offer` - Reject offer (public)
- `/api/recruitment/applications/:id/convert-to-employee` - Convert to employee
- `/api/recruitment/offer-templates` - Template management
- `/api/recruitment/onboarding` - Onboarding management
- `/api/recruitment/lifecycle` - Lifecycle management
- `/api/recruitment/evaluators` - Get evaluators list
- `/api/recruitment/stats` - Recruitment statistics

### Frontend Structure

#### Pages
- `Recruitment.jsx` - Public job listings and application form
- `RecruitmentDashboard.jsx` - Main recruitment dashboard with tabs
- `RecruitmentATS.jsx` - Application Tracking System (HR/Manager/Admin)
- `InterviewScheduling.jsx` - Interview scheduling and management
- `OfferManagement.jsx` - Offer letter generation and management
- `OnboardingPortal.jsx` - Candidate onboarding document upload
- `EmployeeLifecycle.jsx` - Employee lifecycle management

#### Routes (in `App.jsx`)
- `/recruitment` - Public job listings
- `/recruitment/ats` - Application Tracking System
- `/recruitment/interviews` - Interview Scheduling
- `/recruitment/offers` - Offer Management
- `/recruitment/lifecycle` - Employee Lifecycle
- `/onboarding/:linkId` - Onboarding Portal (public link)

## Access Control

### HR Role
- Full access to all recruitment features
- Can upload applications
- Can schedule interviews
- Can generate and send offer letters
- Can verify onboarding documents
- Can manage employee lifecycle

### Manager Role
- Can view applications
- Can view interview schedules
- Can view offer letters
- Can view employee lifecycle
- Cannot modify (read-only access)

### Admin Role
- Full access (same as HR)

### Employee Role
- No access to recruitment module
- Can only view public job listings and apply

## Key Features

### Resume Parsing
- Automatic extraction of:
  - Name
  - Email
  - Phone
  - Skills
  - Experience
  - Education
  - Certifications
- Manual override for any field
- Supports PDF and DOCX formats

### Duplicate Detection
- Checks by email and phone number
- Prevents duplicate applications for same job
- Shows existing application if duplicate found

### Interview Management
- Calendar conflict detection
- Email notifications to candidate and interviewer
- Rescheduling support
- Status tracking (Scheduled, Completed, Passed, Failed, No Show, Rescheduled)
- Feedback and rating system

### Screening Algorithm
- Weighted scoring system
- Automatic comparison with job requirements
- Detailed breakdown of match scores
- Priority scoring for candidate ranking

### Offer Letter Generation
- Template-based system
- Dynamic placeholder replacement
- PDF generation
- Email delivery
- Acceptance tracking

### Onboarding Workflow
- Secure document upload portal
- Document verification workflow
- Status tracking
- Checklist completion

### Employee Conversion
- One-click conversion from candidate to employee
- Automatic employee ID generation
- Profile creation from application data
- Lifecycle record initialization

## Future Enhancements

1. **Interview Reminders**: Implement scheduled job/cron to send automatic reminders 24 hours and 1 hour before interviews
2. **Advanced Resume Parsing**: Integrate with cloud services (AWS Textract, Google Document AI) for better accuracy
3. **Analytics Dashboard**: Advanced reporting and analytics
4. **Bulk Operations**: Bulk application upload, bulk status updates
5. **Integration**: Integration with job boards, LinkedIn, etc.
6. **Video Interviews**: Integration with video conferencing platforms
7. **Assessment Tests**: Online test integration for aptitude tests

## Usage Instructions

### For HR Users

1. **Upload Application**:
   - Go to Recruitment → Application Tracking
   - Click "Upload Application"
   - Select job, upload resume
   - Fill in missing fields (auto-filled from resume parsing)
   - Submit

2. **Review Applications**:
   - View all applications in the table
   - Filter by status, job, screening result, priority
   - Click eye icon to view details

3. **Run Screening**:
   - Click "Run Screening" on any application
   - System automatically compares with job requirements
   - View screening results and match percentage

4. **Set Current Round**:
   - Open application details
   - Select current round from dropdown
   - System tracks which round candidate is in

5. **Schedule Interview**:
   - Go to Recruitment → Interview Scheduling
   - Select application
   - Fill interview details
   - System checks for conflicts
   - Sends notifications automatically

6. **Generate Offer**:
   - Go to Recruitment → Offer Management
   - Select selected candidate
   - Choose template
   - Fill offer details
   - Generate and send

7. **Convert to Employee**:
   - When candidate accepts offer
   - Go to application details
   - Click "Convert to Employee"
   - System creates employee profile with unique ID

### For Managers

- View all recruitment data (read-only)
- Monitor team hiring
- View interview schedules
- Track employee lifecycle

## Database Schema

### Application Collection
- Candidate information
- Job reference
- Status and status history
- Screening results
- Interview rounds
- Offer letter details
- Current round tracking
- Talent pool flag

### Job Collection
- Job details
- Requirements (skills, experience, education, etc.)
- Status (Open, Closed, On Hold)

### OfferTemplate Collection
- Template file path
- Template metadata
- Placeholders

### Onboarding Collection
- Application reference
- Document tracking
- Verification status
- Checklist completion

### Lifecycle Collection
- Employee reference
- Stage history
- Current stage
- Status

## Notes

- All file uploads are stored in `backend/uploads/recruitment/`
- Email notifications require SMTP configuration in environment variables
- Resume parsing uses basic text extraction (can be enhanced with cloud services)
- Interview reminders need scheduled job implementation
- All routes are protected with authentication and authorization middleware

## Environment Variables Required

```env
# SMTP for email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL for onboarding links
FRONTEND_URL=http://localhost:3000
```

## Support

For issues or questions, check:
- Backend logs: `backend/server.js`
- Frontend console: Browser developer tools
- Database: MongoDB connection in `backend/config/db.js`

