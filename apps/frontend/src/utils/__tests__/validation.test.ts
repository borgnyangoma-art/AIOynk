import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateRequired,
  validateMinLength,
  validateMaxLength,
} from '../validation';

describe('validation utilities', () => {
  describe('validateEmail', () => {
    it('should validate valid email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid email without @', () => {
      const result = validateEmail('testexample.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('should reject email without domain', () => {
      const result = validateEmail('test@');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });
  });

  describe('validatePassword', () => {
    it('should accept strong password', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject weak password (too short)', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject password without number', () => {
      const result = validatePassword('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('should reject password without special character', () => {
      const result = validatePassword('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('special character');
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });
  });

  describe('validateRequired', () => {
    it('should validate non-empty value', () => {
      const result = validateRequired('test', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty value', () => {
      const result = validateRequired('', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should reject whitespace only', () => {
      const result = validateRequired('   ', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });
  });

  describe('validateMinLength', () => {
    it('should accept value above minimum length', () => {
      const result = validateMinLength('test value', 5, 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should reject value below minimum length', () => {
      const result = validateMinLength('test', 10, 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be at least 10 characters');
    });
  });

  describe('validateMaxLength', () => {
    it('should accept value below maximum length', () => {
      const result = validateMaxLength('test', 10, 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should reject value above maximum length', () => {
      const result = validateMaxLength('test value', 5, 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be at most 5 characters');
    });
  });

  describe('combined validation', () => {
    it('should validate email and password together', () => {
      const email = validateEmail('test@example.com');
      const password = validatePassword('StrongPass123!');

      expect(email.isValid).toBe(true);
      expect(password.isValid).toBe(true);
    });

    it('should validate all fields and return first error', () => {
      const email = validateEmail('invalid');
      const password = validatePassword('weak');
      const required = validateRequired('', 'Name');

      expect(email.isValid).toBe(false);
      expect(password.isValid).toBe(false);
      expect(required.isValid).toBe(false);
    });
  });
});
