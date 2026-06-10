import { ApiClient } from './api';

function shouldUseMock(): boolean {
  // NEXT_PUBLIC_ vars are inlined at build time, so this works in dev mode
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return true;

  // For production (npm run start), check localStorage flag
  if (typeof window !== 'undefined') {
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
