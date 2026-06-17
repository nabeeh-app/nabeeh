/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks/useStudents';

vi.mock('@/lib/client', () => ({
  apiClient: {
    getStudents: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn(),
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

describe('useStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return data after successful fetch', async () => {
    const mockData = { students: [], total: 0 };
    vi.mocked(apiClient.getStudents).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(apiClient.getStudents).toHaveBeenCalledWith(undefined);
  });

  it('should pass params to apiClient', async () => {
    const mockData = { students: [], total: 0 };
    vi.mocked(apiClient.getStudents).mockResolvedValue(mockData as any);
    const params = { page: 1, limit: 10 };

    renderHook(() => useStudents(params), { wrapper: createWrapper() });

    expect(apiClient.getStudents).toHaveBeenCalledWith(params);
  });
});

describe('useCreateStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.createStudent on mutate', async () => {
    const mockResult = { id: '1', name: 'Test' };
    vi.mocked(apiClient.createStudent).mockResolvedValue(mockResult as any);

    const { result } = renderHook(() => useCreateStudent(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'Test', phone: '+201234567890', student_code: 'T001' } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.createStudent).toHaveBeenCalled();
  });
});

describe('useUpdateStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.updateStudent on mutate', async () => {
    const mockResult = { id: '1', name: 'Updated' };
    vi.mocked(apiClient.updateStudent).mockResolvedValue(mockResult as any);

    const { result } = renderHook(() => useUpdateStudent(), { wrapper: createWrapper() });

    result.current.mutate({ id: '1', data: { name: 'Updated' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.updateStudent).toHaveBeenCalledWith('1', { name: 'Updated' });
  });
});

describe('useDeleteStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.deleteStudent on mutate', async () => {
    vi.mocked(apiClient.deleteStudent).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() });

    result.current.mutate('1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.deleteStudent).toHaveBeenCalledWith('1');
  });
});
