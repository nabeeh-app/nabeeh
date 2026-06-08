import { describe, it, expect } from 'vitest';
import { cn, getStatusBadge, formatPhoneNumber, validateEmail, validatePhoneNumber } from '@/lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'active', false && 'hidden');
      expect(result).toContain('base');
      expect(result).toContain('active');
      expect(result).not.toContain('hidden');
    });
  });

  describe('getStatusBadge', () => {
    it('should return correct badge for active status (EN)', () => {
      const result = getStatusBadge('active', 'en');
      expect(result.label).toBe('Active');
      expect(result.variant).toBe('default');
    });

    it('should return correct badge for active status (AR)', () => {
      const result = getStatusBadge('active', 'ar');
      expect(result.label).toBe('نشط');
      expect(result.variant).toBe('default');
    });

    it('should return correct badge for absent status', () => {
      const result = getStatusBadge('absent', 'en');
      expect(result.label).toBe('Absent');
      expect(result.variant).toBe('destructive');
    });

    it('should return correct badge for present status', () => {
      const result = getStatusBadge('present', 'en');
      expect(result.label).toBe('Present');
      expect(result.variant).toBe('default');
    });

    it('should handle unknown status gracefully', () => {
      const result = getStatusBadge('unknown_status', 'en');
      expect(result.label).toBe('unknown_status');
      expect(result.variant).toBe('outline');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format Egyptian number with leading 0', () => {
      const result = formatPhoneNumber('01234567890');
      expect(result).toBe('+201234567890');
    });

    it('should format Egyptian number without country code', () => {
      const result = formatPhoneNumber('1234567890');
      expect(result).toBe('+201234567890');
    });

    it('should keep already formatted number', () => {
      const result = formatPhoneNumber('+201234567890');
      expect(result).toBe('+201234567890');
    });

    it('should handle number with country code 20', () => {
      const result = formatPhoneNumber('201234567890');
      expect(result).toBe('+201234567890');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    it('should reject invalid email without @', () => {
      expect(validateEmail('testexample.com')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(validateEmail('test@')).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct Egyptian phone number', () => {
      expect(validatePhoneNumber('+201234567890')).toBe(true);
    });

    it('should validate phone number without country code', () => {
      expect(validatePhoneNumber('01234567890')).toBe(true);
    });

    it('should reject invalid phone number', () => {
      expect(validatePhoneNumber('12345')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validatePhoneNumber('')).toBe(false);
    });
  });
});
