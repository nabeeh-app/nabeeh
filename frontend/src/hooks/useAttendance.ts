import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/client';
import { AttendanceSummary, BulkAttendanceRequest } from '@/types';

interface GetAttendanceParams {
  page?: number;
  limit?: number;
  student_id?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  group_id?: string;
}

export function useAttendanceRecords(params?: GetAttendanceParams) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => apiClient.getAttendance(params),
    staleTime: 30 * 1000,
  });
}

export function useAttendanceSummary(params?: {
  start_date?: string;
  end_date?: string;
  student_id?: string;
  group_id?: string;
}) {
  return useQuery<AttendanceSummary>({
    queryKey: ['attendance-summary', params],
    queryFn: () => apiClient.getAttendanceSummary(params),
    staleTime: 30 * 1000,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkAttendanceRequest) => apiClient.createAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
    },
  });
}
