import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/client';
import { DashboardStats } from '@/types';

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.getDashboardStats(),
    staleTime: 60 * 1000,
  });
}
