const logger = require('./logger');

const HEADER_MAPPINGS = {
  name: ['name', 'اسم', 'student name', 'اسم الطالب', 'الاسم', 'student_name', 'full name', 'الاسم الكامل'],
  phone: ['phone', 'هاتف', 'mobile', 'جوال', ' telephone', 'رقم الهاتف', 'student_phone'],
  student_code: ['code', 'كود', 'رقم', 'student code', 'كود الطالب', 'student_id', 'id', 'رقم الطالب', 'code'],
  parent_phone: ['parent phone', 'هاتف ولي الأمر', 'guardian phone', 'parent_phone', 'guardian_phone', 'هاتف ولي الامر', 'رقم ولي الأمر'],
  parent_name: ['parent name', 'اسم ولي الأمر', 'guardian name', 'parent_name', 'guardian_name', 'اسم ولي الامر'],
  grade_level: ['grade', 'فصل', 'level', 'المستوى', 'grade_level', 'الصف', 'stage'],
  date_of_birth: ['date of birth', 'dob', 'تاريخ الميلاد', 'birth_date', 'birthday'],
  gender: ['gender', 'جنس', 'نوع', 'sex', 'الجنس'],
  notes: ['notes', 'ملاحظات', 'comments', 'ملاحظة'],
  email: ['email', 'بريد', 'البريد الإلكتروني', 'e-mail'],
  address: ['address', 'عنوان', 'العنوان', 'location'],
  emergency_contact: ['emergency', 'طوارئ', 'رقم الطوارئ', 'emergency_contact'],
  subjects: ['subjects', 'مواد', 'المواد', 'subject', 'المادة']
};

const REQUIRED_FIELDS = ['name', 'student_code'];

const EGYPTIAN_PHONE_REGEX = /^(?:\+20|0020)?1[0125]\d{8}$/;
const GENERIC_PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

function normalizeHeader(header) {
  return String(header).trim().toLowerCase().replace(/[\s_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectColumnType(header) {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_MAPPINGS)) {
    for (const alias of aliases) {
      if (normalized === normalizeHeader(alias)) {
        return field;
      }
    }
  }
  return null;
}

function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return { valid: false, format: 'empty' };
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (EGYPTIAN_PHONE_REGEX.test(cleaned)) return { valid: true, format: 'egyptian' };
  if (GENERIC_PHONE_REGEX.test(cleaned)) return { valid: true, format: 'international' };
  return { valid: false, format: 'unknown' };
}

function validateRow(row, fieldMapping, requiredFields = REQUIRED_FIELDS) {
  const errors = [];
  const warnings = [];
  const data = {};

  for (const [csvColumn, targetField] of Object.entries(fieldMapping)) {
    const value = row[csvColumn];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      data[targetField] = String(value).trim();
    }
  }

  for (const field of requiredFields) {
    if (!data[field] || data[field].trim() === '') {
      errors.push(`${field} is required`);
    }
  }

  if (data.phone) {
    const phoneCheck = validatePhone(data.phone);
    if (!phoneCheck.valid) {
      if (phoneCheck.format === 'empty') {
        warnings.push('Phone number is empty');
      } else {
        errors.push('Invalid phone number format');
      }
    }
  }

  if (data.parent_phone) {
    const phoneCheck = validatePhone(data.parent_phone);
    if (!phoneCheck.valid && phoneCheck.format !== 'empty') {
      warnings.push('Parent phone number format is unknown');
    }
  }

  if (data.student_code && data.student_code.length > 50) {
    errors.push('Student code must be 50 characters or less');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Name must be 255 characters or less');
  }

  let status = 'ready';
  if (errors.length > 0) {
    status = 'error';
  } else if (warnings.length > 0) {
    status = 'warning';
  }

  return { data, status, errors, warnings };
}

function detectDuplicateCodes(rows) {
  const codeMap = new Map();
  const duplicates = new Set();

  rows.forEach((row, index) => {
    const code = row.data?.student_code;
    if (code) {
      const normalizedCode = code.trim().toLowerCase();
      if (codeMap.has(normalizedCode)) {
        duplicates.add(index);
        duplicates.add(codeMap.get(normalizedCode));
      } else {
        codeMap.set(normalizedCode, index);
      }
    }
  });

  return duplicates;
}

function validateImportData(rows, fieldMapping, requiredFields = REQUIRED_FIELDS) {
  if (!rows || rows.length === 0) {
    return {
      rows: [],
      stats: { total: 0, ready: 0, warning: 0, error: 0 }
    };
  }

  const validatedRows = rows.map((row) => validateRow(row, fieldMapping, requiredFields));

  const duplicateIndices = detectDuplicateCodes(validatedRows);
  duplicateIndices.forEach(idx => {
    validatedRows[idx].errors.push('Duplicate student code');
    validatedRows[idx].status = 'error';
  });

  const stats = {
    total: validatedRows.length,
    ready: validatedRows.filter(r => r.status === 'ready').length,
    warning: validatedRows.filter(r => r.status === 'warning').length,
    error: validatedRows.filter(r => r.status === 'error').length
  };

  return { rows: validatedRows, stats };
}

module.exports = {
  HEADER_MAPPINGS,
  REQUIRED_FIELDS,
  detectColumnType,
  validatePhone,
  validateRow,
  validateImportData,
  detectDuplicateCodes,
  normalizeHeader
};
