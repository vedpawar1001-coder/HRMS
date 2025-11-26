const nodemailer = require('nodemailer');
const Employee = require('../models/Employee');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Send email notification
async function sendEmailNotification(employeeId, subject, message) {
  try {
    const employee = await Employee.findById(employeeId);
    if (!employee || !employee.personalInfo?.email) {
      console.log('No email found for employee:', employeeId);
      return false;
    }

    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@hrms.com',
      to: employee.personalInfo.email,
      subject: subject,
      html: message
    };

    // If SMTP is not configured, just log the email
    if (!process.env.SMTP_USER) {
      console.log('Email would be sent:', mailOptions);
      return true;
    }

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', employee.personalInfo.email);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Send SMS notification (placeholder - integrate with SMS gateway)
async function sendSMSNotification(employeeId, message) {
  try {
    const employee = await Employee.findById(employeeId);
    if (!employee || !employee.personalInfo?.mobile) {
      console.log('No mobile found for employee:', employeeId);
      return false;
    }

    // TODO: Integrate with SMS gateway (Twilio, AWS SNS, etc.)
    console.log(`SMS would be sent to ${employee.personalInfo.mobile}: ${message}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

// Notify employee about running out of time
async function notifyRunningOutOfTime(attendance) {
  try {
    const employee = await Employee.findById(attendance.employeeId);
    if (!employee) return;

    const hoursWorked = attendance.totalWorkingHours;
    const hoursRemaining = (9 - hoursWorked).toFixed(2);

    const subject = '⚠️ Running Out of Time - Complete Your 9 Hours';
    const emailMessage = `
      <h2>Attendance Alert</h2>
      <p>Dear ${employee.personalInfo?.fullName || 'Employee'},</p>
      <p>You have worked <strong>${hoursWorked} hours</strong> today.</p>
      <p>You need to work <strong>${hoursRemaining} more hours</strong> to complete your required 9 hours.</p>
      <p>Please ensure you complete your working hours before leaving.</p>
      <p>Thank you!</p>
    `;

    const smsMessage = `Alert: You've worked ${hoursWorked}hrs today. Need ${hoursRemaining}hrs more to complete 9hrs.`;

    await sendEmailNotification(attendance.employeeId, subject, emailMessage);
    await sendSMSNotification(attendance.employeeId, smsMessage);

    return true;
  } catch (error) {
    console.error('Error notifying running out of time:', error);
    return false;
  }
}

// Notify employee about short hours at end of day
async function notifyShortHours(attendance) {
  try {
    const employee = await Employee.findById(attendance.employeeId);
    if (!employee) return;

    const hoursWorked = attendance.totalWorkingHours;
    const hoursShort = (9 - hoursWorked).toFixed(2);

    const subject = '⚠️ Short Working Hours Alert';
    const emailMessage = `
      <h2>Short Working Hours Alert</h2>
      <p>Dear ${employee.personalInfo?.fullName || 'Employee'},</p>
      <p>You have worked only <strong>${hoursWorked} hours</strong> today, which is <strong>${hoursShort} hours short</strong> of the required 9 hours.</p>
      <p>Please note that short working hours may affect your attendance record.</p>
      <p>If this was unintentional, please contact HR.</p>
      <p>Thank you!</p>
    `;

    const smsMessage = `Alert: You worked only ${hoursWorked}hrs today (${hoursShort}hrs short). Contact HR if unintentional.`;

    await sendEmailNotification(attendance.employeeId, subject, emailMessage);
    await sendSMSNotification(attendance.employeeId, smsMessage);

    return true;
  } catch (error) {
    console.error('Error notifying short hours:', error);
    return false;
  }
}

module.exports = {
  sendEmailNotification,
  sendSMSNotification,
  notifyRunningOutOfTime,
  notifyShortHours
};

