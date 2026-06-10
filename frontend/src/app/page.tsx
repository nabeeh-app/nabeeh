'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/en');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary mb-4 font-display">نبيه - Nabeeh</h1>
        <p className="text-ink/70 mb-4 font-body">Smart Teaching Assistant</p>
        <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto"></div>
        <p className="text-sm text-ink/60 mt-4 font-mono uppercase tracking-wider">Loading...</p>
      </div>
    </div>
  );
}
