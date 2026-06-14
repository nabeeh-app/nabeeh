'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

interface LinkedTeacher {
  id: string;
  name: string;
  email: string;
}

export function TeacherSwitcher() {
  const t = useTranslations('assistants');
  const { teacher } = useAuth();
  const [teachers, setTeachers] = useState<LinkedTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<LinkedTeacher | null>(null);

  const fetchLinkedTeachers = useCallback(async () => {
    if (teacher?.role !== 'assistant') return;

    setLoading(true);
    try {
      const token = localStorage.getItem('nabeeh_token');
      const res = await fetch('/api/assistants/linked-teachers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTeachers(data.data);
        const current = data.data.find((t: LinkedTeacher) => t.id === teacher.teacherId);
        if (current) setCurrentTeacher(current);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [teacher]);

  useEffect(() => {
    fetchLinkedTeachers();
  }, [fetchLinkedTeachers]);

  const handleSwitch = async (targetTeacher: LinkedTeacher) => {
    try {
      const token = localStorage.getItem('nabeeh_token');
      await fetch('/api/assistants/switch-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teacher_id: targetTeacher.id }),
      });
      setCurrentTeacher(targetTeacher);
      window.location.reload();
    } catch {
      // silently handle
    }
  };

  if (teacher?.role !== 'assistant' || teachers.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-ink/70">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="font-body text-sm truncate max-w-[120px]">
            {currentTeacher?.name || t('switchTeacher')}
          </span>
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {teachers.map(tItem => (
          <DropdownMenuItem
            key={tItem.id}
            onClick={() => handleSwitch(tItem)}
            className="flex items-center gap-2"
          >
            {currentTeacher?.id === tItem.id && <Check className="w-4 h-4 text-primary" />}
            <div className={currentTeacher?.id === tItem.id ? '' : 'ml-6'}>
              <p className="font-body text-sm">{tItem.name}</p>
              <p className="font-body text-xs text-ink/50">{tItem.email}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
