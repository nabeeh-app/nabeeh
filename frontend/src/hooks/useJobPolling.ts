'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface JobState {
  status: JobStatus;
  result: unknown;
  error: string | null;
}

export function useJobPolling(jobId: string | null, intervalMs = 2000) {
  const [job, setJob] = useState<JobState>({ status: 'pending', result: null, error: null });
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!jobId) {
      queueMicrotask(() => setJob({ status: 'pending', result: null, error: null }));
      return;
    }

    queueMicrotask(() => setIsPolling(true));

    const poll = async () => {
      try {
        const res = await apiClient.getJobStatus(jobId);
        if (res.success && res.data) {
          setJob({
            status: res.data.status as JobStatus,
            result: res.data.result,
            error: res.data.error,
          });

          if (res.data.status === 'completed' || res.data.status === 'failed') {
            stopPolling();
          }
        }
      } catch {
        // keep polling on transient errors
      }
    };

    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => stopPolling();
  }, [jobId, intervalMs, stopPolling]);

  return { ...job, isPolling, stopPolling };
}
