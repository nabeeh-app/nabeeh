jest.mock('axios');
jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const axios = require('axios');
const logger = require('../logger');

describe('aiResponder', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadModuleWithKey(key) {
    if (key === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = key;
    }
    jest.resetModules();
    jest.mock('axios');
    jest.mock('../logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
    return require('../aiResponder');
  }

  it('should return null when GEMINI_API_KEY is missing', async () => {
    const { generateResponse } = loadModuleWithKey(undefined);
    const log = require('../logger');
    const result = await generateResponse('hello', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'en' });
    expect(result).toBeNull();
    expect(log.error).toHaveBeenCalledWith('GEMINI_API_KEY not configured');
  });

  it('should return formatted response on success', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({
      data: { candidates: [{ content: { parts: [{ text: 'Hello! How can I help?' }] } }] }
    });

    const result = await generateResponse('hello', {
      parentName: 'Ahmed', studentName: 'Sara', teacherName: 'Mr. Ali',
      subjects: 'Math, English', language: 'en', businessName: 'Bright Academy'
    });

    expect(result).toEqual({
      text: 'Hello! How can I help?',
      intent: 'general',
      confidence: 0.6
    });
    expect(ax.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ contents: [{ parts: [{ text: expect.stringContaining('Ahmed') }] }] }),
      expect.objectContaining({ headers: { 'x-goog-api-key': 'test-key', 'Content-Type': 'application/json' } })
    );
  });

  it('should return null when candidates array is empty', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({ data: { candidates: [] } });

    const result = await generateResponse('hello', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'en' });
    expect(result).toBeNull();
  });

  it('should return null when response has no candidates field', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({ data: {} });

    const result = await generateResponse('hello', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'en' });
    expect(result).toBeNull();
  });

  it('should return null and log error on network failure', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    const log = require('../logger');
    ax.post.mockRejectedValue(new Error('Network timeout'));

    const result = await generateResponse('hello', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'en' });
    expect(result).toBeNull();
    expect(log.error).toHaveBeenCalledWith('AI response error', { error: 'Network timeout' });
  });

  it('should build Arabic language label when language is ar', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: 'مرحبا' }] } }] } });

    await generateResponse('مرحبا', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'ar' });

    const prompt = ax.post.mock.calls[0][1].contents[0].parts[0].text;
    expect(prompt).toContain('Arabic');
  });

  it('should use businessName fallback to teacherName when not provided', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } });

    await generateResponse('hi', { parentName: 'P', studentName: 'S', teacherName: 'Mr. Teacher', language: 'en' });

    const prompt = ax.post.mock.calls[0][1].contents[0].parts[0].text;
    expect(prompt).toContain('Mr. Teacher');
  });

  it('should use businessName when provided', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } });

    await generateResponse('hi', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'en', businessName: 'Bright Academy' });

    const prompt = ax.post.mock.calls[0][1].contents[0].parts[0].text;
    expect(prompt).toContain('Bright Academy');
  });

  it('should handle null subjects gracefully', async () => {
    const { generateResponse } = loadModuleWithKey('test-key');
    const ax = require('axios');
    ax.post.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } });

    await generateResponse('hi', { parentName: 'P', studentName: 'S', teacherName: 'T', language: 'en' });

    const prompt = ax.post.mock.calls[0][1].contents[0].parts[0].text;
    expect(prompt).toContain('various subjects');
  });
});
