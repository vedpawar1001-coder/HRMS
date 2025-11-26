# HRMS - Human Resource Management System

A comprehensive HRMS built with MERN stack (MongoDB, Express.js, React.js, Node.js) featuring complete employee lifecycle management, attendance tracking, payroll, performance management, and more.

## Features

### Module 1: Recruitment & Employee Lifecycle Management
- Job application tracking system (ATS)
- Multi-round evaluation workflow
- Candidate screening & eligibility check
- Interview scheduling
- Offer letter management
- Onboarding & document submission
- Employee lifecycle tracking

### Module 2: Employee Data Management
- Personal information management
- Government/ID proof management
- Company details & employment information
- Document management
- Profile completion tracking

### Module 3: Attendance & Leave Management
- Punch In/Out system with geo-location tracking
- Daily work hours calculation
- Missing punch-out detection
- Leave application workflow
- Leave balance management
- Holiday calendar integration

### Module 4: Payroll Management
- Salary structure management
- Automated payroll calculation
- Payslip generation
- Deductions & allowances
- Salary revision history

### Module 5: Performance & Appraisal Management
- KPI & OKR tracking
- Performance review cycles
- Manager & HR reviews
- Feedback system
- Incentive calculation

### Module 6: Employee Engagement & Communication
- Announcements board
- Birthday & work anniversary notifications
- Polls & surveys
- Event calendar
- Feedback system

### Module 7: Grievance & Query Management
- Ticket creation & tracking
- Escalation management
- Two-way communication
- Full audit trail

### Module 8: Security & Access Control
- Role-based access control (Employee, Manager, HR, Admin)
- JWT authentication
- Data encryption
- Audit logging

## Tech Stack

- **Frontend:** React.js, Tailwind CSS, Recharts, Framer Motion
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Authentication:** JWT

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hrms
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
```

4. Start the backend server:
```bash
npm run dev
```

The backend server will run on http://localhost:5000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on http://localhost:3000

## Default Roles

- **Employee:** Can view only their own data
- **Manager:** Can view team members' data
- **HR:** Full access to all employee data
- **Admin:** Complete system control

## Getting Started

1. Make sure MongoDB is running
2. Start the backend server
3. Start the frontend server
4. Open http://localhost:3000 in your browser
5. Register a new account (choose your role)
6. Login and explore the system

## Project Structure

```
HR/
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Features Highlights

- **Beautiful UI:** Modern, responsive design with Tailwind CSS
- **Interactive Charts:** Data visualization with Recharts
- **Animations:** Smooth transitions with Framer Motion
- **Role-based Dashboards:** Customized views for each role
- **Secure Authentication:** JWT-based authentication
- **Real-time Updates:** Live data updates
- **Mobile Responsive:** Works on all devices

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.

