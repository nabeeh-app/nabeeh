const { normalizePhoneNumber } = require('../phone');

describe('normalizePhoneNumber', () => {
  test('normalizes Egyptian mobile number', () => {
    expect(normalizePhoneNumber('01012345678')).toBe('201012345678');
  });

  test('normalizes Egyptian number with + prefix', () => {
    expect(normalizePhoneNumber('+201012345678')).toBe('201012345678');
  });

  test('preserves Saudi number with country code', () => {
    expect(normalizePhoneNumber('966501234567')).toBe('966501234567');
  });

  test('preserves UAE number with country code', () => {
    expect(normalizePhoneNumber('971501234567')).toBe('971501234567');
  });

  test('preserves unknown country number', () => {
    expect(normalizePhoneNumber('+12025551234')).toBe('12025551234');
  });

  test('returns empty string for empty input', () => {
    expect(normalizePhoneNumber('')).toBe('');
  });

  test('strips 00 prefix', () => {
    expect(normalizePhoneNumber('00201012345678')).toBe('201012345678');
  });

  test('handles short numbers starting with 01', () => {
    expect(normalizePhoneNumber('0123')).toBe('20123');
  });

  test('handles numbers starting with 0 that do not match 01', () => {
    expect(normalizePhoneNumber('0501234567')).toBe('20501234567');
  });

  test('normalizes Egyptian number with +20 prefix and leading 0', () => {
    expect(normalizePhoneNumber('+2001211310357')).toBe('201211310357');
  });

  test('preserves Bahrain number', () => {
    expect(normalizePhoneNumber('97333012345')).toBe('97333012345');
  });

  test('preserves Qatar number', () => {
    expect(normalizePhoneNumber('97455012345')).toBe('97455012345');
  });

  test('preserves Oman number', () => {
    expect(normalizePhoneNumber('96891234567')).toBe('96891234567');
  });

  test('preserves Jordan number', () => {
    expect(normalizePhoneNumber('962791234567')).toBe('962791234567');
  });

  test('preserves Lebanon number', () => {
    expect(normalizePhoneNumber('96171123456')).toBe('96171123456');
  });

  test('preserves Tunisia number', () => {
    expect(normalizePhoneNumber('21621123456')).toBe('21621123456');
  });

  test('preserves Morocco number', () => {
    expect(normalizePhoneNumber('212612345678')).toBe('212612345678');
  });

  test('preserves Algeria number', () => {
    expect(normalizePhoneNumber('213551234567')).toBe('213551234567');
  });

  test('handles Egyptian number with 00 prefix', () => {
    expect(normalizePhoneNumber('00201012345678')).toBe('201012345678');
  });

  test('handles number with only zeros (00 prefix stripped, then 0 prefix triggers EG)', () => {
    expect(normalizePhoneNumber('0000')).toBe('200');
  });
});
