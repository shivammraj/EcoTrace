'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Wifi, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

// ─── Data generation helpers ─────────────────────────────────────────────────

const CLIENT_NAMES = [
  'Arjun Sharma', 'Priya Menon', 'Rahul Verma', 'Sneha Iyer', 'Dev Kapoor',
  'Ananya Pillai', 'Vikram Singh', 'Kavya Nair', 'Rohan Gupta', 'Meera Joshi',
  'Suresh Patil', 'Deepa Krishnan', 'Aditya Rao', 'Tanvi Shah', 'Nikhil Bose',
];

const REGIONS = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata'];

const ACTIONS = [
  'FOOTPRINT_SYNC',
  'EMISSION_AUDIT',
  'CARBON_SUBMIT',
  'LEDGER_UPDATE',
  'DATA_VALIDATE',
  'FACTOR_FETCH',
  'SESSION_VERIFY',
  'REPORT_EXPORT',
];

type AuditStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface AuditEntry {
  id: string;
  clientName: string;
  ipAddress: string;
  region: string;
  action: string;
  status: AuditStatus;
  /** Data transferred in KB */
  dataKb: number;
  /** Round-trip latency in ms */
  latencyMs: number;
  timestamp: Date;
  isNew?: boolean;
}

/** Weighted random pick — SUCCESS is most common */
function randomStatus(): AuditStatus {
  const r = Math.random();
  if (r < 0.68) return 'SUCCESS';
  if (r < 0.88) return 'PENDING';
  return 'FAILED';
}

function randomIp(): string {
  return [
    Math.floor(Math.random() * 223) + 1,
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 254) + 1,
  ].join('.');
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEntry(): AuditEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clientName: pick(CLIENT_NAMES),
    ipAddress: randomIp(),
    region: pick(REGIONS),
    action: pick(ACTIONS),
    status: randomStatus(),
    dataKb: Math.round(Math.random() * 480 + 20),   // 20–500 KB
    latencyMs: Math.round(Math.random() * 290 + 10), // 10–300 ms
    timestamp: new Date(),
    isNew: true,
  };
}

function generateInitialFeed(count = 6): AuditEntry[] {
  return Array.from({ length: count }, () => {
    const e = generateEntry();
    // Back-date initial entries so they look like an existing log
    e.timestamp = new Date(Date.now() - Math.random() * 60_000);
    e.isNew = false;
    return e;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AuditStatus }) {
  const map: Record<AuditStatus, { icon: React.ReactNode; cls: string; label: string }> = {
    SUCCESS: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      cls: 'text-moss bg-moss/10 border-moss/20',
      label: 'SUCCESS',
    },
    FAILED: {
      icon: <XCircle className="h-3 w-3" />,
      cls: 'text-ledger-red bg-ledger-red/10 border-ledger-red/20',
      label: 'FAILED',
    },
    PENDING: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      cls: 'text-amber-flag bg-amber-flag/10 border-amber-flag/20',
      label: 'PENDING',
    },
  };
  const { icon, cls, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold font-mono tracking-wider ${cls}`}>
      {icon}{label}
    </span>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function LatencyBar({ ms }: { ms: number }) {
  // 0–100 ms = green, 100–200 = amber, 200+ = red
  const pct = Math.min(100, (ms / 300) * 100);
  const color = ms < 100 ? 'bg-moss' : ms < 200 ? 'bg-amber-flag' : 'bg-ledger-red';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 bg-graphite/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-graphite/50">{ms}ms</span>
    </div>
  );
}

// ─── Main AuditFeed component ─────────────────────────────────────────────────

const MAX_ENTRIES = 12; // cap visible log rows

export default function AuditFeed() {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>(() => generateInitialFeed());
  const [liveCount, setLiveCount] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const pushEntry = useCallback(() => {
    const newEntry = generateEntry();
    setEntries(prev => {
      // Strip isNew flag from all existing, prepend new entry, cap at MAX_ENTRIES
      const updated = prev.map(e => ({ ...e, isNew: false }));
      return [newEntry, ...updated].slice(0, MAX_ENTRIES);
    });
    setLiveCount(c => c + 1);
  }, []);

  // Start/stop live feed
  useEffect(() => {
    if (!isLive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Random interval between 2 000 – 4 000 ms
    const schedule = () => {
      const delay = 2000 + Math.random() * 2000;
      intervalRef.current = setTimeout(() => {
        pushEntry();
        schedule(); // reschedule with a new random delay each time
      }, delay);
    };
    schedule();
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [isLive, pushEntry]);

  // Auto-scroll to top when new entry arrives
  const latestEntryId = entries[0]?.id;
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [latestEntryId]);

  if (!mounted) {
    return (
      <div className="border border-graphite/10 rounded-lg bg-paper/40 h-[380px] flex items-center justify-center font-mono text-xs text-graphite/40">
        INITIALIZING SECURE AUDIT FEED...
      </div>
    );
  }

  const successCount = entries.filter(e => e.status === 'SUCCESS').length;
  const failedCount  = entries.filter(e => e.status === 'FAILED').length;
  const pendingCount = entries.filter(e => e.status === 'PENDING').length;

  return (
    <div className="border border-graphite/10 rounded-lg bg-paper/40 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-graphite/10 bg-graphite/[0.03]">
        <div className="flex items-center gap-2.5">
          <Activity className="h-4 w-4 text-ledger-red" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-graphite">
            Client Audit Real-Time Feed
          </h3>
          {/* Pulse indicator */}
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-moss opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-moss" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Mini stats */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[9px]">
            <span className="text-moss font-bold">{successCount} OK</span>
            <span className="text-amber-flag font-bold">{pendingCount} WAIT</span>
            <span className="text-ledger-red font-bold">{failedCount} ERR</span>
          </div>
          {/* Live toggle */}
          <button
            onClick={() => setIsLive(v => !v)}
            aria-label="Toggle real-time audit feed"
            aria-pressed={isLive}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold border transition-all cursor-pointer ${
              isLive
                ? 'bg-moss/10 border-moss/30 text-moss hover:bg-moss/20'
                : 'bg-graphite/5 border-graphite/15 text-graphite/40 hover:bg-graphite/10'
            }`}
          >
            <Wifi className="h-2.5 w-2.5" />
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* ── Ticker bar ── */}
      <div className="px-5 py-1.5 border-b border-graphite/5 bg-graphite/[0.015] flex items-center gap-2 text-[9px] font-mono text-graphite/40">
        <Clock className="h-2.5 w-2.5 shrink-0" />
        <span>{liveCount} events received this session &nbsp;·&nbsp; max {MAX_ENTRIES} rows displayed &nbsp;·&nbsp; newest first</span>
      </div>

      {/* ── Feed rows ── */}
      <div ref={feedRef} role="log" aria-live="polite" className="divide-y divide-graphite/5 overflow-y-auto" style={{ maxHeight: '340px' }}>
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className={`px-5 py-3 transition-all duration-500 ${
              entry.isNew
                ? 'bg-moss/[0.06] border-l-2 border-moss animate-[fadeSlideIn_0.4s_ease_forwards]'
                : 'hover:bg-graphite/[0.02]'
            }`}
            style={{ animationDelay: `${idx * 20}ms` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-y-1.5 gap-x-3">
              {/* Left: client info */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <span className="font-display font-bold text-[10px] text-graphite truncate">
                    {entry.clientName}
                  </span>
                  {entry.isNew && (
                    <span className="text-[8px] font-mono font-bold text-moss uppercase tracking-widest animate-pulse">
                      NEW
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono text-[9px] text-graphite/45">
                  <span>{entry.ipAddress}</span>
                  <span className="text-graphite/25">·</span>
                  <span>{entry.region}</span>
                  <span className="text-graphite/25">·</span>
                  <span className="font-bold text-graphite/60">{entry.action}</span>
                </div>
              </div>

              {/* Right: metrics */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-2 font-mono text-[9px]">
                  <span className="text-graphite/40">{entry.dataKb} KB</span>
                  <LatencyBar ms={entry.latencyMs} />
                </div>
                <span className="font-mono text-[9px] text-graphite/35">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-2 border-t border-graphite/10 bg-graphite/[0.02] flex justify-between items-center">
        <span className="font-mono text-[9px] text-graphite/35 uppercase tracking-wide">
          Encrypted Audit Channel &nbsp;·&nbsp; TLS 1.3
        </span>
        {!isLive && (
          <span className="font-mono text-[9px] text-amber-flag font-bold animate-pulse">
            ⏸ FEED PAUSED
          </span>
        )}
      </div>
    </div>
  );
}
