/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useAttendanceRecords, useAttendanceSummary, useCreateAttendance } from '@/hooks/useAttendance';

vi.mock('@/lib/client', () => ({
  apiClient: {
    getAttendance: vi.fn(),
    getAttendanceSummary: vi.fn(),
    createAttendance: vi.fn(),
  },
}));

import { apiClient } from '@/lib/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'Wrapper';
  return Wrapper;
};

describe('useAttendanceRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useAttendanceRecords(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return data after successful fetch', async () => {
    const mockData = { records: [], total: 0 };
    vi.mocked(apiClient.getAttendance).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useAttendanceRecords(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });

  it('should pass params to apiClient', async () => {
    const mockData = { records: [], total: 0 };
    vi.mocked(apiClient.getAttendance).mockResolvedValue(mockData as any);
    const params = { page: 1, limit: 10 };

    renderHook(() => useAttendanceRecords(params), { wrapper: createWrapper() });

    expect(apiClient.getAttendance).toHaveBeenCalledWith(params);
  });
});

describe('useAttendanceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data after successful fetch', async () => {
    const mockData = { attendance_rate: 85, present_count: 17, absent_count: 3 };
    vi.mocked(apiClient.getAttendanceSummary).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useAttendanceSummary(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });
});

describe('useCreateAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.createAttendance on mutate', async () => {
    const mockResult = { success: true };
    vi.mocked(apiClient.createAttendance).mockResolvedValue(mockResult as any);

    const { result } = renderHook(() => useCreateAttendance(), { wrapper: createWrapper() });

    result.current.mutate({ session_id: '1', attendance: [] } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.createAttendance).toHaveBeenCalled();
  });
});
