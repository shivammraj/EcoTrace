'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Leaf, TrendingDown, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Quote data ───────────────────────────────────────────────────────────────

interface Quote {
  text: string;
  author: string;
  category: 'planet' | 'action' | 'progress';
}

const QUOTES: Quote[] = [
  {
    text: "The Earth does not belong to us — we belong to the Earth. Every gram of CO₂ we save is a debt repaid.",
    author: "Chief Seattle",
    category: 'planet',
  },
  {
    text: "We don't need a handful of people doing sustainability perfectly. We need millions doing it imperfectly.",
    author: "Anne-Marie Bonneau",
    category: 'action',
  },
  {
    text: "Small acts, when multiplied by millions of people, can transform the world.",
    author: "Howard Zinn",
    category: 'progress',
  },
  {
    text: "The greatest threat to our planet is the belief that someone else will save it.",
    author: "Robert Swan",
    category: 'action',
  },
  {
    text: "In every walk with nature, one receives far more than he seeks. Protect what gives you peace.",
    author: "John Muir",
    category: 'planet',
  },
  {
    text: "Progress is impossible without change, and those who cannot change their minds cannot change anything.",
    author: "George Bernard Shaw",
    category: 'progress',
  },
  {
    text: "What you do makes a difference, and you have to decide what kind of difference you want to make.",
    author: "Jane Goodall",
    category: 'action',
  },
  {
    text: "Sustainability is not a destination. It is a daily practice — tracked, improved, repeated.",
    author: "EcoTrace Ledger",
    category: 'progress',
  },
  {
    text: "The environment is where we all meet; where we all have a mutual interest — it is the one thing all of us share.",
    author: "Lady Bird Johnson",
    category: 'planet',
  },
  {
    text: "Act as if what you do makes a difference. It does.",
    author: "William James",
    category: 'action',
  },
];

// ─── Improvement tips by emission category ────────────────────────────────────

interface Tip {
  icon: string;
  title: string;
  description: string;
  saving: string;
}

export const IMPROVEMENT_TIPS: Record<string, Tip[]> = {
  transport: [
    {
      icon: '🚌',
      title: 'Switch to Public Transport',
      description: 'Replacing one car trip a week with a bus or metro reduces transport emissions significantly.',
      saving: 'Save up to 2.4 tonne CO₂/yr',
    },
    {
      icon: '🚲',
      title: 'Cycle Short Distances',
      description: 'For trips under 5 km, cycling produces zero emissions and improves health.',
      saving: 'Save ~800 kg CO₂/yr',
    },
    {
      icon: '⚡',
      title: 'Go Electric',
      description: 'An EV charged from renewables emits up to 70% less than a petrol car over its lifetime.',
      saving: 'Save ~1.5 tonne CO₂/yr',
    },
  ],
  energy: [
    {
      icon: '☀️',
      title: 'Install Rooftop Solar',
      description: 'A 3 kW rooftop system can offset 70% of household electricity emissions in India.',
      saving: 'Save ~1.2 tonne CO₂/yr',
    },
    {
      icon: '💡',
      title: 'Switch to LED Lighting',
      description: 'LED bulbs use up to 85% less energy than incandescent ones and last 25× longer.',
      saving: 'Save ~100 kg CO₂/yr',
    },
    {
      icon: '🌬️',
      title: 'Optimise AC Usage',
      description: 'Setting AC to 24°C instead of 18°C cuts cooling energy use by up to 24%.',
      saving: 'Save ~300 kg CO₂/yr',
    },
  ],
  diet: [
    {
      icon: '🥗',
      title: 'Try Meat-Free Mondays',
      description: 'Reducing meat consumption just one day a week has the same impact as not driving for a month.',
      saving: 'Save ~340 kg CO₂/yr',
    },
    {
      icon: '🛒',
      title: 'Buy Local & Seasonal',
      description: 'Locally sourced seasonal produce travels less distance, cutting food transport emissions.',
      saving: 'Save ~150 kg CO₂/yr',
    },
    {
      icon: '🌱',
      title: 'Reduce Food Waste',
      description: 'One-third of food is wasted globally. Planning meals prevents emissions at both ends.',
      saving: 'Save ~200 kg CO₂/yr',
    },
  ],
  waste: [
    {
      icon: '♻️',
      title: 'Segregate Waste at Source',
      description: 'Separating dry and wet waste enables composting and recycling — cutting landfill methane.',
      saving: 'Save ~250 kg CO₂/yr',
    },
    {
      icon: '🪣',
      title: 'Start Home Composting',
      description: 'Kitchen compost turns organic waste into soil — instead of methane in landfills.',
      saving: 'Save ~180 kg CO₂/yr',
    },
    {
      icon: '🛍️',
      title: 'Eliminate Single-Use Plastic',
      description: 'Carry a reusable bag and bottle. Plastic production is carbon-intensive at every stage.',
      saving: 'Save ~80 kg CO₂/yr',
    },
  ],
};

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<Quote['category'], { icon: React.ReactNode; cls: string }> = {
  planet: { icon: <Leaf className="h-3 w-3" />, cls: 'text-moss bg-moss/10 border-moss/20' },
  action: { icon: <TrendingDown className="h-3 w-3" />, cls: 'text-ledger-red bg-ledger-red/10 border-ledger-red/20' },
  progress: { icon: <Lightbulb className="h-3 w-3" />, cls: 'text-amber-flag bg-amber-flag/10 border-amber-flag/20' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface EcoQuotesProps {
  /** Highest-emission category — determines which tips to highlight */
  worstCategory?: 'transport' | 'energy' | 'diet' | 'waste';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EcoQuotes({ worstCategory = 'transport' }: EcoQuotesProps) {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [tipIdx, setTipIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tips = IMPROVEMENT_TIPS[worstCategory] ?? IMPROVEMENT_TIPS.transport;

  // Auto-rotate quotes every 8 seconds with a fade transition
  const goToQuote = (idx: number, animate = true) => {
    if (animate) {
      setVisible(false);
      setTimeout(() => {
        setQuoteIdx(idx);
        setVisible(true);
      }, 300);
    } else {
      setQuoteIdx(idx);
    }
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setQuoteIdx(prev => (prev + 1) % QUOTES.length);
        setVisible(true);
      }, 300);
    }, 8000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const q = QUOTES[quoteIdx];
  const { icon: catIcon, cls: catCls } = CATEGORY_ICON[q.category];

  return (
    <div className="space-y-4">
      {/* ── Quote card ── */}
      <div className="border border-graphite/10 rounded-lg bg-paper/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-graphite/10 bg-graphite/[0.03]">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-moss" />
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-graphite">
              Green Inspiration
            </h3>
          </div>
          {/* Nav arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToQuote((quoteIdx - 1 + QUOTES.length) % QUOTES.length)}
              className="p-1 rounded hover:bg-graphite/5 text-graphite/40 hover:text-graphite transition cursor-pointer"
              aria-label="Previous quote"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[9px] text-graphite/30 w-12 text-center">
              {quoteIdx + 1} / {QUOTES.length}
            </span>
            <button
              onClick={() => goToQuote((quoteIdx + 1) % QUOTES.length)}
              className="p-1 rounded hover:bg-graphite/5 text-graphite/40 hover:text-graphite transition cursor-pointer"
              aria-label="Next quote"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quote body */}
        <div
          className="px-5 py-5 transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {/* Category pill */}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold font-mono tracking-wider mb-3 ${catCls}`}>
            {catIcon}
            {q.category.toUpperCase()}
          </span>

          <blockquote className="font-sans text-sm text-graphite/80 leading-relaxed italic mb-3">
            &quot;{q.text}&quot;
          </blockquote>

          <p className="font-mono text-[10px] text-graphite/40 font-bold uppercase tracking-wider">
            — {q.author}
          </p>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pb-3">
          {QUOTES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToQuote(i)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                i === quoteIdx ? 'w-4 bg-moss' : 'w-1.5 bg-graphite/15 hover:bg-graphite/30'
              }`}
              aria-label={`Quote ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── Improvement tips ── */}
      <div className="border border-graphite/10 rounded-lg bg-paper/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-graphite/10 bg-graphite/[0.03]">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-flag" />
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-graphite">
              Reduce Your {worstCategory.charAt(0).toUpperCase() + worstCategory.slice(1)} Footprint
            </h3>
          </div>
          <span className="font-mono text-[9px] text-graphite/35 uppercase">Top area to improve</span>
        </div>

        <div className="divide-y divide-graphite/5">
          {tips.map((tip, i) => (
            <div
              key={i}
              className={`px-5 py-4 flex items-start gap-3 cursor-pointer transition-all group ${
                tipIdx === i ? 'bg-moss/[0.04]' : 'hover:bg-graphite/[0.02]'
              }`}
              onClick={() => setTipIdx(i)}
            >
              <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="font-display font-bold text-xs text-graphite group-hover:text-graphite/90">
                    {tip.title}
                  </p>
                  <span className="font-mono text-[9px] text-moss font-bold shrink-0">{tip.saving}</span>
                </div>
                {/* Expand description when selected */}
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: tipIdx === i ? '80px' : '0px' }}
                >
                  <p className="font-sans text-[11px] text-graphite/55 leading-relaxed pt-1">
                    {tip.description}
                  </p>
                </div>
                {tipIdx !== i && (
                  <p className="font-sans text-[11px] text-graphite/40 truncate">{tip.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
