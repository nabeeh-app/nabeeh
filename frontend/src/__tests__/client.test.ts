import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldUseMock } from '@/lib/client';

describe('shouldUseMock gating', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.NEXT_PUBLIC_USE_MOCK;
    delete process.env.NEXT_PUBLIC_ALLOW_MOCK_OVERRIDE;
    localStorage.clear();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('ignores localStorage in production builds without the override flag', () => {
    localStorage.setItem('nabeeh_use_mock', 'true');
    expect(shouldUseMock()).toBe(false);
  });

  it('honors localStorage only when the build allows the override', () => {
    process.env.NEXT_PUBLIC_ALLOW_MOCK_OVERRIDE = 'true';
    localStorage.setItem('nabeeh_use_mock', 'true');
    expect(shouldUseMock()).toBe(true);
  });

  it('uses mocks when NEXT_PUBLIC_USE_MOCK is true', () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true';
    expect(shouldUseMock()).toBe(true);
  });

  it('defaults to the real client', () => {
    expect(shouldUseMock()).toBe(false);
  });
});
