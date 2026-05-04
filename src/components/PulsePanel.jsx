import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Newspaper, Sparkles } from 'lucide-react';
import api from '../services/api';

const fallbackTopics = [
  {
    id: 'fallback-ai-collab',
    title: 'AI copilots are becoming default tools in team communication products',
    source: 'ChatApp Pulse',
    summary:
      'Teams now expect summaries, writing help, and decision prompts directly inside conversation flows.',
    tags: ['AI', 'Product'],
    ai_spark: {
      debate_prompt: 'Should every chat app include AI assist by default, or should it stay optional?',
      agree_point: 'Supporters will argue AI reduces friction and helps teams move faster.',
      counter_point: 'Critics will argue too much automation can weaken trust and introduce noise.',
    },
  },
  {
    id: 'fallback-realtime',
    title: 'Realtime apps are shifting from simple messaging toward richer collaboration surfaces',
    source: 'ChatApp Pulse',
    summary:
      'Voice notes, invite identity, contextual feeds, and calling are becoming baseline user expectations.',
    tags: ['Realtime', 'UX'],
    ai_spark: {
      debate_prompt: 'What matters more for retention: more features, or a cleaner realtime experience?',
      agree_point: 'One view is that richer collaboration keeps users inside one product longer.',
      counter_point: 'Another view is that too many surfaces can reduce clarity and slow core chat usage.',
    },
  },
];

export default function PulsePanel() {
  const [topics, setTopics] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  useEffect(() => {
    let active = true;

    const enableFallback = () => {
      if (!active) return;
      setTopics(fallbackTopics);
      setActiveIndex(0);
      setIsFallbackMode(true);
    };

    const isPulseSupported = async () => {
      try {
        const response = await api.get('/health');
        return response.data?.capabilities?.pulse === true;
      } catch (error) {
        return false;
      }
    };

    const loadPulse = async () => {
      try {
        const pulseSupported = await isPulseSupported();
        if (!pulseSupported) {
          enableFallback();
          return;
        }

        const response = await api.get('/pulse');
        if (!active) return;
        setTopics(response.data?.topics || []);
        setIsFallbackMode(false);
      } catch (error) {
        enableFallback();
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPulse();
    const interval = setInterval(loadPulse, 180000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const activeTopic = topics[activeIndex] || null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,26,0.96),rgba(13,19,37,0.94))] p-4 shadow-[0_20px_70px_rgba(8,15,30,0.5)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-fuchsia-500/15 p-3 text-fuchsia-300">
          <Newspaper className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Live Pulse</p>
          <p className="text-xs text-slate-400">
            {isFallbackMode ? 'Fallback topics are showing until the backend pulse API is live.' : 'What people are discussing right now.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-2">
          {isLoading && !topics.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
              Loading live topics...
            </div>
          ) : null}

          {topics.map((topic, index) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                activeIndex === index
                  ? 'border-cyan-400/40 bg-cyan-400/10'
                  : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex flex-wrap gap-2">
                {topic.tags?.map((tag) => (
                  <span key={`${topic.id}-${tag}`} className="rounded-full bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="mt-2 text-sm font-semibold text-white">{topic.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{topic.summary}</p>
            </button>
          ))}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTopic?.id || 'empty'}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {activeTopic ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{activeTopic.source}</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{activeTopic.title}</h3>
                    </div>
                    {activeTopic.link ? (
                      <a
                        href={activeTopic.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                      >
                        Open
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-300">{activeTopic.summary}</p>

                  <div className="mt-4 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4">
                    <div className="flex items-center gap-2 text-fuchsia-200">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.22em]">AI Debate Starter</span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">{activeTopic.ai_spark?.debate_prompt}</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      <p>{activeTopic.ai_spark?.agree_point}</p>
                      <p>{activeTopic.ai_spark?.counter_point}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-400">
                  No live topics available yet.
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
