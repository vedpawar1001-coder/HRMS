// Validation utilities for employee data

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateMobile(mobile) {
  // Indian mobile number validation (10 digits, starts with 6-9)
  const re = /^[6-9]\d{9}$/;
  return re.test(mobile.replace(/\D/g, ''));
}

function validateAadhaar(aadhaar) {
  // Aadhaar: 12 digits
  const cleaned = aadhaar.replace(/\D/g, '');
  return cleaned.length === 12 && /^\d{12}$/.test(cleaned);
}

function validatePAN(pan) {
  // PAN: AAAAA1234A format
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(pan.toUpperCase());
}

function validatePincode(pincode) {
  // Indian pincode: 6 digits
  const cleaned = pincode.replace(/\D/g, '');
  return cleaned.length === 6 && /^\d{6}$/.test(cleaned);
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateWorkAnniversary(joiningDate) {
  if (!joiningDate) return null;
  const today = new Date();
  const joinDate = new Date(joiningDate);
  let years = today.getFullYear() - joinDate.getFullYear();
  const monthDiff = today.getMonth() - joinDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < joinDate.getDate())) {
    years--;
  }
  return years;
}

function calculateTotalExperience(previousCompanies) {
  if (!previousCompanies || previousCompanies.length === 0) return '0 years';
  
  let totalMonths = 0;
  previousCompanies.forEach(company => {
    if (company.startDate && company.endDate) {
      const start = new Date(company.startDate);
      const end = new Date(company.endDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      totalMonths += months;
    }
  });
  
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  
  if (years === 0) return `${months} months`;
  if (months === 0) return `${years} years`;
  return `${years} years ${months} months`;
}

module.exports = {
  validateEmail,
  validateMobile,
  validateAadhaar,
  validatePAN,
  validatePincode,
  calculateAge,
  calculateWorkAnniversary,
  calculateTotalExperience
};

