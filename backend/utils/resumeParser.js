const fs = require('fs');
const path = require('path');

/**
 * Parse resume PDF to extract candidate information
 * This is a basic parser - in production, you'd use a more sophisticated library
 * or service like AWS Textract, Google Cloud Document AI, etc.
 */
async function parseResume(filePath) {
  try {
    // For now, we'll use a simple text extraction approach
    // In production, use pdf-parse or a cloud service
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.pdf') {
      return await parsePDF(filePath);
    } else if (fileExtension === '.docx' || fileExtension === '.doc') {
      // DOCX parsing would require mammoth or docx library
      return await parseDOCX(filePath);
    }
    
    return {
      fullName: null,
      email: null,
      phone: null,
      skills: [],
      experience: null,
      education: null,
      certifications: []
    };
  } catch (error) {
    console.error('Error parsing resume:', error);
    return {
      fullName: null,
      email: null,
      phone: null,
      skills: [],
      experience: null,
      education: null,
      certifications: []
    };
  }
}

/**
 * Basic PDF text extraction
 * Note: This is a simplified version. For production, use pdf-parse library
 */
async function parsePDF(filePath) {
  try {
    // Try to use pdf-parse if available, otherwise return empty
    let pdfParse;
    try {
      pdfParse = require('pdf-parse');
    } catch (e) {
      console.log('pdf-parse not installed, using basic extraction');
      return extractBasicInfo(filePath);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    return extractInfoFromText(text);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return extractBasicInfo(filePath);
  }
}

/**
 * Basic DOCX text extraction
 */
async function parseDOCX(filePath) {
  try {
    // For DOCX, we'd need mammoth or docx library
    // For now, return empty structure
    return {
      fullName: null,
      email: null,
      phone: null,
      skills: [],
      experience: null,
      education: null,
      certifications: []
    };
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    return {
      fullName: null,
      email: null,
      phone: null,
      skills: [],
      experience: null,
      education: null,
      certifications: []
    };
  }
}

/**
 * Extract information from text content
 */
function extractInfoFromText(text) {
  const extracted = {
    fullName: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    skills: extractSkills(text),
    experience: extractExperience(text),
    education: extractEducation(text),
    certifications: extractCertifications(text)
  };

  return extracted;
}

/**
 * Extract name from resume text
 */
function extractName(text) {
  // Look for common name patterns at the beginning
  const lines = text.split('\n').slice(0, 5);
  for (const line of lines) {
    const trimmed = line.trim();
    // Check if line looks like a name (2-4 words, capitalized)
    if (trimmed && trimmed.split(/\s+/).length >= 2 && trimmed.split(/\s+/).length <= 4) {
      const words = trimmed.split(/\s+/);
      if (words.every(word => /^[A-Z][a-z]+$/.test(word) || /^[A-Z]+$/.test(word))) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * Extract email from text
 */
function extractEmail(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

/**
 * Extract phone number from text
 */
function extractPhone(text) {
  // Match various phone formats
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}/g;
  const matches = text.match(phoneRegex);
  if (matches) {
    // Clean up the phone number
    return matches[0].replace(/[-.\s()]/g, '');
  }
  return null;
}

/**
 * Extract skills from text
 */
function extractSkills(text) {
  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue.js',
    'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'Azure', 'Docker',
    'Kubernetes', 'Git', 'HTML', 'CSS', 'TypeScript', 'C++', 'C#', '.NET',
    'Spring', 'Django', 'Flask', 'Express', 'REST API', 'GraphQL',
    'Machine Learning', 'Data Science', 'AI', 'DevOps', 'CI/CD',
    'Project Management', 'Agile', 'Scrum', 'Sales', 'Marketing', 'HR',
    'Digital Marketing', 'SEO', 'Content Writing', 'Design', 'UI/UX',
    'Photoshop', 'Illustrator', 'Figma', 'Sketch'
  ];

  const foundSkills = [];
  const lowerText = text.toLowerCase();

  for (const skill of commonSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  }

  // Also look for skills section
  const skillsSectionRegex = /(?:skills?|technical skills?|competencies?)[:]\s*([^\n]+(?:\n[^\n]+)*)/i;
  const skillsMatch = text.match(skillsSectionRegex);
  if (skillsMatch) {
    const skillsText = skillsMatch[1];
    const skillsList = skillsText.split(/[,;|\n]/).map(s => s.trim()).filter(s => s);
    foundSkills.push(...skillsList);
  }

  // Remove duplicates and return
  return [...new Set(foundSkills)];
}

/**
 * Extract experience (years) from text
 */
function extractExperience(text) {
  // Look for experience patterns
  const experienceRegex = /(\d+)\s*(?:years?|yrs?|year|yr)\s*(?:of\s*)?(?:experience|exp)/i;
  const match = text.match(experienceRegex);
  if (match) {
    return parseInt(match[1]);
  }

  // Look for date ranges that might indicate experience
  const dateRangeRegex = /(\d{4})\s*[-–]\s*(\d{4}|\w+)/g;
  const dateMatches = [...text.matchAll(dateRangeRegex)];
  if (dateMatches.length > 0) {
    const years = dateMatches.map(match => {
      const start = parseInt(match[1]);
      const end = match[2] === 'Present' || match[2] === 'Current' 
        ? new Date().getFullYear() 
        : parseInt(match[2]);
      return end - start;
    });
    const totalYears = years.reduce((sum, y) => sum + y, 0);
    return totalYears;
  }

  return null;
}

/**
 * Extract education from text
 */
function extractEducation(text) {
  const educationKeywords = [
    'Bachelor', 'B.Tech', 'B.E.', 'B.Sc', 'B.Com', 'B.A.',
    'Master', 'M.Tech', 'M.Sc', 'M.Com', 'M.A.', 'MBA',
    'Ph.D', 'Doctorate', 'Diploma', 'Certificate'
  ];

  const educationRegex = new RegExp(
    `(${educationKeywords.join('|')})[^\\n]*(?:in|of)?[^\\n]*(?:[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)?`,
    'gi'
  );

  const matches = text.match(educationRegex);
  if (matches) {
    return matches[0].trim();
  }

  return null;
}

/**
 * Extract certifications from text
 */
function extractCertifications(text) {
  const certKeywords = [
    'Certified', 'Certification', 'Certificate', 'AWS', 'Azure', 'Google Cloud',
    'PMP', 'Scrum', 'Agile', 'Oracle', 'Microsoft', 'Cisco', 'CompTIA'
  ];

  const certRegex = new RegExp(
    `(${certKeywords.join('|')})[^\\n]*(?:Certified|Certification|Certificate)?[^\\n]*`,
    'gi'
  );

  const matches = text.match(certRegex);
  if (matches) {
    return matches.map(m => m.trim()).filter(m => m.length > 0);
  }

  return [];
}

/**
 * Basic info extraction when parsing fails
 */
function extractBasicInfo(filePath) {
  // Return empty structure
  return {
    fullName: null,
    email: null,
    phone: null,
    skills: [],
    experience: null,
    education: null,
    certifications: []
  };
}

module.exports = {
  parseResume,
  extractInfoFromText
};

