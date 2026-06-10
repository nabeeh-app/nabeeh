'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Send, CheckCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChildName = 'ahmed' | 'omar' | 'salma';
type ScenarioKey = 'attendance' | 'grades' | 'schedule';

interface ChatMessage {
  id: number;
  sender: 'parent' | 'bot';
  text: string;
  time: string;
}

const SCENARIO_ORDER: ScenarioKey[] = ['attendance', 'grades', 'schedule'];

const KEYWORD_MAP: Record<string, ScenarioKey> = {
  attendance: 'attendance',
  حضور: 'attendance',
  present: 'attendance',
  absent: 'attendance',
  grades: 'grades',
  grade: 'grades',
  exam: 'grades',
  درجات: 'grades',
  امتحان: 'grades',
  scores: 'grades',
  schedule: 'schedule',
  class: 'schedule',
  جدول: 'schedule',
  مواد: 'schedule',
};

function getNow() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function WhatsAppDemo() {
  const [selectedName, setSelectedName] = useState<ChildName | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgId = useRef(0);

  const t = useTranslations('landing.demo');
  const tScenarios = useTranslations('landing.demo.scenarios');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const scrollToBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const addMessage = useCallback((sender: 'parent' | 'bot', text: string) => {
    msgId.current += 1;
    setMessages((prev) => [...prev, { id: msgId.current, sender, text, time: getNow() }]);
  }, []);

  const playScenario = useCallback(
    async (index: number) => {
      if (index >= SCENARIO_ORDER.length) {
        setIsPlaying(false);
        return;
      }
      setIsPlaying(true);
      const key = SCENARIO_ORDER[index];
      const parentMsg = tScenarios(`${key}.parentMessage`);
      const botMsg = tScenarios(`${key}.botResponse`);

      await new Promise((r) => setTimeout(r, 800));
      addMessage('parent', parentMsg);

      await new Promise((r) => setTimeout(r, 1500));
      addMessage('bot', botMsg);

      await new Promise((r) => setTimeout(r, 1200));
      setScenarioIndex(index + 1);
      setIsPlaying(false);
    },
    [addMessage, tScenarios]
  );

  // Auto-play when selected
  useEffect(() => {
    if (selectedName && messages.length === 0 && !isPlaying) {
      playScenario(0);
    }
  }, [selectedName, messages.length, isPlaying, playScenario]);

  // Continue playing next scenario when previous finishes
  useEffect(() => {
    if (selectedName && scenarioIndex > 0 && scenarioIndex < SCENARIO_ORDER.length && !isPlaying) {
      playScenario(scenarioIndex);
    }
  }, [scenarioIndex, selectedName, isPlaying, playScenario]);

  const handleSend = () => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;

    addMessage('parent', input.trim());
    setInput('');

    const matched = KEYWORD_MAP[trimmed];
    if (matched) {
      setTimeout(() => {
        addMessage('bot', tScenarios(`${matched}.botResponse`));
      }, 1000);
    } else {
      setTimeout(() => {
        addMessage('bot', isRTL ? 'أهلاً! جرّب تسأل عن الحضور أو الدرجات أو الجدول.' : 'Hello! Try asking about attendance, grades, or schedule.');
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const nameOptions: { key: ChildName; label: string }[] = [
    { key: 'ahmed', label: t('ahmed') },
    { key: 'omar', label: t('omar') },
    { key: 'salma', label: t('salma') },
  ];

  // Name picker screen
  if (!selectedName) {
    return (
      <div className="w-full max-w-sm bg-canvas rounded-2xl border border-ink/10 shadow-lg overflow-hidden">
        {/* WhatsApp header */}
        <div className="bg-primary px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <svg viewBox="0 0 200 240" fill="none" className="w-6 h-7">
              <ellipse cx="100" cy="112" rx="74" ry="82" fill="white" opacity="0.3" />
              <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
              <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
              <ellipse cx="70" cy="112" rx="11" ry="12" fill="white" />
              <ellipse cx="130" cy="112" rx="11" ry="12" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium text-sm font-body">{t('botName')}</p>
            <p className="text-white/70 text-xs font-body">{isRTL ? 'متصل' : 'Online'}</p>
          </div>
        </div>

        {/* Name picker */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-ink/60 font-body text-center">{t('pickName')}</p>
          <div className="space-y-2">
            {nameOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedName(key)}
                className="w-full px-4 py-3 rounded-xl border border-ink/10 hover:border-primary/30 hover:bg-surface-sage/50 transition-all text-left font-body text-ink font-medium"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {label[0]}
                  </span>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-sm bg-canvas rounded-2xl border border-ink/10 shadow-lg overflow-hidden flex flex-col', isRTL && 'font-arabic')}>
      {/* WhatsApp header */}
      <div className="bg-primary px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <svg viewBox="0 0 200 240" fill="none" className="w-6 h-7">
            <ellipse cx="100" cy="112" rx="74" ry="82" fill="white" opacity="0.3" />
            <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
            <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
            <ellipse cx="70" cy="112" rx="11" ry="12" fill="white" />
            <ellipse cx="130" cy="112" rx="11" ry="12" fill="white" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm font-body">{t('botName')}</p>
          <p className="text-white/70 text-xs font-body">
            {isPlaying ? (isRTL ? 'يكتب...' : 'typing...') : (isRTL ? 'متصل' : 'Online')}
          </p>
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px] max-h-[400px]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23083d44\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex', msg.sender === 'parent' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start'))}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 shadow-sm',
                msg.sender === 'parent'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white border border-ink/5 text-ink rounded-bl-sm'
              )}
            >
              <p className="text-sm font-body whitespace-pre-line leading-relaxed">{msg.text}</p>
              <div className={cn('flex items-center gap-1 mt-1', msg.sender === 'parent' ? 'justify-end' : 'justify-start')}>
                <span className={cn('text-[10px]', msg.sender === 'parent' ? 'text-white/60' : 'text-ink/40')}>
                  {msg.time}
                </span>
                {msg.sender === 'parent' && (
                  <CheckCheck className="w-3 h-3 text-white/60" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className={cn('p-3 border-t border-ink/5 bg-canvas shrink-0', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typing')}
            className={cn(
              'flex-1 px-4 py-2 rounded-full bg-surface-cool text-sm font-body text-ink placeholder:text-ink/40 outline-none border border-ink/10 focus:border-primary/30',
              isRTL && 'text-right'
            )}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
