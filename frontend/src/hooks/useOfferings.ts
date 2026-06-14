import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/client';
import { Offering } from '@/types';

export function useOfferings() {
  return useQuery<Offering[]>({
    queryKey: ['offerings'],
    queryFn: () => apiClient.getOfferings(),
    staleTime: 60 * 1000,
  });
}

export function useDeleteOffering() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteOffering(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offeringId, data }: { offeringId: string; data: { name: string; schedule_description?: string | null } }) =>
      apiClient.createGroup(offeringId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
    },
  });
}
