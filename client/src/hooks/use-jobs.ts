import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Job {
  id: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pagesProcessed: number;
  creditsUsed: number;
  error?: string;
  fileUrl?: string;
  resultUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export function useJobs() {
  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await api.get('/jobs');
      return data;
    },
  });
}

export function useJob(jobId: string) {
  return useQuery<Job>({
    queryKey: ['jobs', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/jobs/${jobId}`);
      return data;
    },
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Poll while job is processing
      if (data?.status === 'queued' || data?.status === 'processing') {
        return 2000; // Poll every 2 seconds
      }
      return false;
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/jobs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });
}