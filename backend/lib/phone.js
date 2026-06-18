function normalizePhoneNumber(phone = '') {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);

  const countryCodes = { '20': 'EG', '966': 'SA', '971': 'AE', '965': 'KW', '973': 'BH', '974': 'QA', '968': 'OM', '962': 'JO', '961': 'LB', '216': 'TN', '212': 'MA', '213': 'DZ' };

  for (const [code, country] of Object.entries(countryCodes)) {
    if (cleaned.startsWith(code)) {
      const rest = cleaned.substring(code.length);
      if (rest.startsWith('0') && country === 'EG') {
        return code + rest.substring(1);
      }
      return cleaned;
    }
  }

  if (cleaned.startsWith('01')) return `20${cleaned.substring(1)}`;
  if (cleaned.startsWith('0')) return `20${cleaned.substring(1)}`;

  return cleaned;
}

module.exports = { normalizePhoneNumber };
