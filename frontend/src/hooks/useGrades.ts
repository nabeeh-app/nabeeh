import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/client';
import { Grade, CreateGradeRequest, PaginatedResponse } from '@/types';

interface GetGradesParams {
  page?: number;
  limit?: number;
  student_id?: string;
  group_id?: string;
  subject?: string;
  assessment_type?: string;
  start_date?: string;
  end_date?: string;
}

export function useGrades(params?: GetGradesParams) {
  return useQuery<PaginatedResponse<Grade>>({
    queryKey: ['grades', params],
    queryFn: () => apiClient.getGrades(params),
    staleTime: 30 * 1000,
  });
}

export function useCreateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGradeRequest) => apiClient.createGrade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
  });
}

export function useUpdateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGradeRequest> }) =>
      apiClient.updateGrade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
  });
}

export function useDeleteGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteGrade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
  });
}
