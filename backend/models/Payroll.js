const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  payPeriod: {
    month: { type: Number, required: true },
    year: { type: Number, required: true }
  },
  salaryStructure: {
    basic: { type: Number, required: true },
    monthlySalary: Number,
    hra: Number,
    da: Number,
    specialAllowance: Number,
    medicalAllowance: Number,
    travelAllowance: Number
  },
  earnings: {
    grossSalary: Number,
    bonus: Number,
    incentives: Number,
    shiftAllowance: Number,
    overtimePay: Number,
    performancePay: Number,
    totalEarnings: Number
  },
  deductions: {
    pfEmployee: Number,
    pfEmployer: Number,
    esi: Number,
    professionalTax: Number,
    tds: Number,
    loanRecovery: Number,
    customDeductions: Number,
    lop: Number,
    unpaidLeaveDeduction: Number,
    otherDeductions: Number,
    totalDeductions: Number
  },
  netSalary: {
    type: Number,
    required: true
  },
  attendance: {
    totalDays: Number,
    presentDays: Number,
    leaveDays: Number,
    paidLeaveDays: Number,
    unpaidLeaveDays: Number,
    lopDays: Number
  },
  payslipGenerated: {
    type: Boolean,
    default: false
  },
  payslipUrl: String,
  status: {
    type: String,
    enum: ['Draft', 'Processed', 'Paid'],
    default: 'Draft'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date
}, {
  timestamps: true
});

payrollSchema.index({ employeeId: 1, 'payPeriod.month': 1, 'payPeriod.year': 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);

