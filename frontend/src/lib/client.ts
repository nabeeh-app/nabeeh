import { ApiClient } from './api';

export function shouldUseMock(): boolean {
  // NEXT_PUBLIC_ vars are inlined at build time, so this works in dev mode
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return true;

  // Runtime override exists only in builds that explicitly allow it.
  // Production builds omit NEXT_PUBLIC_ALLOW_MOCK_OVERRIDE, so the
  // localStorage branch compiles out and visitors can never flip it.
  if (process.env.NEXT_PUBLIC_ALLOW_MOCK_OVERRIDE === 'true' && typeof window !== 'undefined') {
    return localStorage.getItem('nabeeh_use_mock') === 'true';
  }

  return false;
}

let apiClient: ApiClient;

if (shouldUseMock()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: MockApiClient } = require('./mock-client') as { default: new () => ApiClient };
  apiClient = new MockApiClient();
} else {
  apiClient = new ApiClient();
}

export { apiClient };
export default apiClient;
