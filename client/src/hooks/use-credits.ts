import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CreditsData {
  balance: number;
  usage: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export function useCredits() {
  return useQuery<CreditsData>({
    queryKey: ['credits'],
    queryFn: async () => {
      const { data } = await api.get('/user/credits');
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}