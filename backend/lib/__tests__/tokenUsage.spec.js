jest.mock('../../config/database', () => ({
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() }
}));

jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const { supabaseAdmin } = require('../../config/database');
const { trackTokenUsage } = require('../aiService');

function chainable(resolveWith) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    update: jest.fn().mockReturnThis(),
    then(onF, onR) { return Promise.resolve(resolveWith).then(onF, onR); }
  };
}

describe('trackTokenUsage fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the direct update when the RPC resolves an error object', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const selectChain = chainable({ data: { ai_tokens_used_this_month: 10 }, error: null });
    const updateChain = chainable({ data: null, error: null });
    supabaseAdmin.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    await trackTokenUsage('teacher-1', { output: 'hello world, more text here to count' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ ai_tokens_used_this_month: expect.any(Number) })
    );
  });

  it('skips the fallback when the RPC succeeds', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

    await trackTokenUsage('teacher-1', { output: 'hi' });

    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
