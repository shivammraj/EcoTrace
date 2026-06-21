'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, LogOut, Calendar, BarChart2, AlertCircle,
  RefreshCw, Check, Download, Trash2
} from 'lucide-react';
import CarbonReceipt from '@/components/ui/CarbonReceipt';
import EcoQuotes from '@/components/ui/EcoQuotes';
import { CalculatorInput, calculateFootprint } from '@/lib/calculator';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  points: number;
}

interface HistoricalSession {
  date: string;
  totalAnnualCo2Kg: number;
  breakdown: {
    transport: number;
    energy: number;
    diet: number;
    waste: number;
  };
  items: any[];
}

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<HistoricalSession[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  // Logging Form State
  const [showLogForm, setShowLogForm] = useState(false);
  const [formInputs, setFormInputs] = useState<CalculatorInput>({
    transport: { mode: 'car_petrol', weeklyKm: 80, flightsPerYear: 1 },
    energy: { monthlyKwh: 120, cookingFuel: 'lpg', hasSolar: false, lpgCylinderKg: 14.2 },
    diet: 'moderate_meat',
    waste: 'some_recycling',
  });
  const [savingLog, setSavingLog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null); // date string being deleted
  const [factors, setFactors] = useState<Record<string, number> | undefined>(undefined);



  const attemptTokenRefresh = async (): Promise<boolean> => {
    try {
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem('access_token', data.accessToken);
        setToken(data.accessToken);
        setUser(data.user);
        await fetchSummaryAndHistory(data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const fetchUserData = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (res.status === 401) {
        // Token might have expired, try refresh
        const refreshed = await attemptTokenRefresh();
        if (!refreshed) router.push('/');
        return;
      }

      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        await fetchSummaryAndHistory(authToken);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setErrorMsg('Failed to sync. Operating in offline/unsecured mode.');
      setLoading(false);
    }
  };

  const fetchSummaryAndHistory = async (authToken: string, targetPage = page) => {
    try {
      // Fetch summary
      const sumRes = await fetch('/api/carbon/summary', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const sumData = await sumRes.json();
      setSummary(sumData);

      // Populate input form with latest saved values if they exist
      if (sumData.latestCalculation?.items?.length) {
        const items = sumData.latestCalculation.items;
        const transItem = items.find((i: any) => i.category === 'transport');
        const energyItem = items.find((i: any) => i.category === 'energy');
        const dietItem = items.find((i: any) => i.category === 'diet');
        const wasteItem = items.find((i: any) => i.category === 'waste');

        setFormInputs({
          transport: {
            mode: transItem?.subcategory?.split('_flights_')[0] || 'car_petrol',
            weeklyKm: transItem?.inputValue || 0,
            flightsPerYear: transItem?.subcategory?.includes('_flights_')
              ? Number(transItem.subcategory.split('_flights_')[1])
              : Math.round((transItem?.co2Kg || 0) / 250),
          },
          energy: {
            monthlyKwh: energyItem?.inputValue || 120,
            cookingFuel: energyItem?.subcategory?.split('cooking_')[1]?.split('_')[0] || 'lpg',
            hasSolar: energyItem?.subcategory?.includes('solar') || false,
            lpgCylinderKg: energyItem?.subcategory?.includes('_lpgKg_')
              ? Number(energyItem.subcategory.split('_lpgKg_')[1])
              : undefined,
          },
          diet: (dietItem?.subcategory?.replace('diet_', '') || 'moderate_meat') as any,
          waste: (wasteItem?.subcategory || 'some_recycling') as any,
        });
      }

      // Fetch entries history
      const histRes = await fetch(`/api/carbon/entries?page=${targetPage}&limit=5`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const histData = await histRes.json();
      setHistory(histData.history || []);
      setHistoryCount(histData.totalCount || 0);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Authenticate and token setup
  useEffect(() => {
    const handleAuth = async () => {
      // 1. Check URL query params for redirect token from Google callback
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');

      let currentToken = urlToken;

      if (urlToken) {
        localStorage.setItem('access_token', urlToken);
        // Clean up URL parameters
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else {
        // 2. Read from localStorage
        currentToken = localStorage.getItem('access_token');
      }

      if (!currentToken) {
        // 3. Try to refresh using httpOnly cookie
        const refreshed = await attemptTokenRefresh();
        if (!refreshed) {
          router.push('/');
          return;
        }
      } else {
        setToken(currentToken);
        await fetchUserData(currentToken);
      }
    };

    handleAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Fetch emission factors on mount
  useEffect(() => {
    fetch('/api/carbon/factors')
      .then(res => res.json())
      .then(data => setFactors(data))
      .catch(err => console.warn('Could not fetch emission factors in dashboard:', err));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      console.warn('Logout endpoint failed, clearing localStorage anyway');
    }
    localStorage.removeItem('access_token');
    router.push('/');
  };

  const handleFormInputChange = (category: string, field: string, value: any) => {
    setFormInputs(prev => {
      if (category === 'diet' || category === 'waste') {
        return { ...prev, [category]: value };
      }
      return {
        ...prev,
        [category]: {
          ...prev[category as 'transport' | 'energy'],
          [field]: value
        }
      };
    });
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLog(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/carbon/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formInputs)
      });

      if (!res.ok) throw new Error('Failed to save calculation');

      setSaveSuccess(true);
      await fetchSummaryAndHistory(token!, page);
      // Don't auto-close form — user can review then click VIEW RECEIPT
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'An error occurred while saving.');
    } finally {
      setSavingLog(false);
    }
  };

  const changePage = async (newPage: number) => {
    setPage(newPage);
    if (token) {
      setLoading(true);
      await fetchSummaryAndHistory(token, newPage);
    }
  };

  const handleDeleteEntry = async (dateStr: string) => {
    if (!confirm('Are you sure you want to delete this receipt from your ledger?')) return;
    setDeletingEntry(dateStr);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/carbon/entries?date=${dateStr}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete ledger entry');
      }

      // Refresh summary and history
      await fetchSummaryAndHistory(token!, page);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete ledger entry.');
    } finally {
      setDeletingEntry(null);
    }
  };

  // Shared inspirational quote for all report exports
  const REPORT_QUOTE = {
    text: 'We do not inherit the Earth from our ancestors — we borrow it from our children.',
    author: 'Antoine de Saint-Exupéry',
  };

  // Download as PNG (Canvas-drawn report card)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadPNG = async () => {
    if (history.length === 0 && !summary?.latestCalculation) {
      alert('No data yet. Save at least one footprint entry first.');
      return;
    }
    setDownloading(true);
    setShowDownloadMenu(false);

    const W = 900;
    const rowCount = Math.min(history.length, 8);
    const H = 1060 + rowCount * 26 + 280; // dynamic height
    const canvas = document.createElement('canvas');
    canvas.width  = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);

    const hr = (yy: number, alpha = 0.10) => {
      ctx.save();
      ctx.strokeStyle = `rgba(32,38,43,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(36, yy); ctx.lineTo(W - 36, yy); ctx.stroke();
      ctx.restore();
    };
    const dottedHr = (yy: number) => {
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(32,38,43,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(36, yy); ctx.lineTo(W - 36, yy); ctx.stroke();
      ctx.restore();
    };

    // Background
    ctx.fillStyle = '#FAF6EE';
    ctx.fillRect(0, 0, W, H);

    // Header bar
    ctx.fillStyle = '#20262B';
    ctx.fillRect(0, 0, W, 76);
    ctx.fillStyle = '#B5482E';
    ctx.beginPath(); ctx.arc(36, 38, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FAF6EE';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('ECOTRACE', 56, 44);
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(250,246,238,0.38)';
    ctx.fillText('CARBON FOOTPRINT LEDGER', 56, 60);
    const docId = `ECO-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    ctx.textAlign = 'right';
    ctx.fillText(`REPORT DATE: ${new Date().toLocaleDateString('en-IN').toUpperCase()}`, W - 32, 36);
    ctx.fillText(`DOC ID: ${docId}`, W - 32, 54);
    ctx.textAlign = 'left';

    let y = 108;

    // User block
    ctx.fillStyle = '#20262B';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText((user?.name ?? 'User').toUpperCase(), 36, y); y += 22;
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(32,38,43,0.43)';
    ctx.fillText(`${user?.email ?? ''}  ·  ${historyCount} ledger entries`, 36, y); y += 30;
    hr(y); y += 28;

    // Latest snapshot
    const lc = summary?.latestCalculation;
    if (lc) {
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = 'rgba(32,38,43,0.42)';
      ctx.fillText('LATEST EMISSION SNAPSHOT', 36, y); y += 28;
      ctx.font = 'bold 50px system-ui';
      ctx.fillStyle = '#B5482E';
      ctx.fillText(`${lc.totalAnnualCo2Kg.toLocaleString()} kg CO\u2082e`, 36, y); y += 16;
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(32,38,43,0.34)';
      ctx.fillText('Estimated annual carbon footprint', 36, y); y += 34;

      const bars = [
        { label: 'TRANSPORT', value: lc.breakdown.transport, color: '#20262B' },
        { label: 'ENERGY',    value: lc.breakdown.energy,    color: '#B5482E' },
        { label: 'DIET',      value: lc.breakdown.diet,      color: '#5C7A5E' },
      ];
      const maxVal = Math.max(...bars.map(b => b.value), 1);
      const BAR_W = W - 72;
      for (const bar of bars) {
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = 'rgba(32,38,43,0.45)';
        ctx.fillText(bar.label, 36, y);
        ctx.textAlign = 'right';
        ctx.fillText(`${bar.value.toLocaleString()} kg`, W - 36, y);
        ctx.textAlign = 'left';
        y += 11;
        ctx.fillStyle = 'rgba(32,38,43,0.07)';
        ctx.beginPath(); ctx.roundRect(36, y, BAR_W, 12, 3); ctx.fill();
        ctx.fillStyle = bar.color;
        ctx.beginPath(); ctx.roundRect(36, y, Math.max(10, (bar.value / maxVal) * BAR_W), 12, 3); ctx.fill();
        y += 26;
      }
      if (lc.breakdown.waste < 0) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#5C7A5E';
        ctx.fillText(`\u267b  Recycling Offset: \u2212 ${Math.abs(lc.breakdown.waste).toLocaleString()} kg CO\u2082e`, 36, y);
        y += 24;
      }
    }

    y += 14; hr(y); y += 28;

    // History table
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(32,38,43,0.42)';
    ctx.fillText('ACCOUNTABILITY TIMELINE', 36, y); y += 20;
    ctx.fillStyle = '#F0EBE0';
    ctx.beginPath(); ctx.roundRect(36, y, W - 72, 26, 4); ctx.fill();

    const COLSL = [44,  210, 330, 445, 560, 695];
    const COLSR = [200, 320, 435, 550, 685, W - 36];
    const HEADS = ['DATE', 'TRANSPORT', 'ENERGY', 'DIET', 'WASTE', 'TOTAL CO\u2082e'];
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = 'rgba(32,38,43,0.40)';
    HEADS.forEach((h, i) => {
      ctx.textAlign = i === 0 ? 'left' : 'right';
      ctx.fillText(h, i === 0 ? COLSL[0] : COLSR[i], y + 17);
    });
    ctx.textAlign = 'left';
    y += 32;

    history.slice(0, rowCount).forEach((row, ri) => {
      if (ri % 2 === 0) {
        ctx.fillStyle = 'rgba(32,38,43,0.025)';
        ctx.fillRect(36, y - 4, W - 72, 24);
      }
      const cells = [
        new Date(row.date).toLocaleDateString('en-IN'),
        `${row.breakdown.transport.toLocaleString()} kg`,
        `${row.breakdown.energy.toLocaleString()} kg`,
        `${row.breakdown.diet.toLocaleString()} kg`,
        `\u2212 ${Math.abs(row.breakdown.waste).toLocaleString()} kg`,
        `${row.totalAnnualCo2Kg.toLocaleString()} kg`,
      ];
      ctx.font = '10px monospace';
      cells.forEach((c, i) => {
        ctx.fillStyle = i === 5 ? '#20262B' : i === 4 ? '#5C7A5E' : 'rgba(32,38,43,0.65)';
        ctx.textAlign = i === 0 ? 'left' : 'right';
        ctx.fillText(c, i === 0 ? COLSL[0] : COLSR[i], y + 12);
      });
      ctx.textAlign = 'left';
      y += 26;
    });

    y += 22; dottedHr(y); y += 32;

    // Verification block
    ctx.fillStyle = 'rgba(92,122,94,0.06)';
    ctx.beginPath(); ctx.roundRect(36, y, W - 72, 104, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(92,122,94,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(36, y, W - 72, 104, 8); ctx.stroke();

    // Stamp circle
    const sx = 90, sy = y + 52;
    ctx.strokeStyle = '#5C7A5E'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(sx, sy, 32, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.stroke();
    // Checkmark
    ctx.strokeStyle = '#5C7A5E'; ctx.lineWidth = 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 11, sy + 1);
    ctx.lineTo(sx - 2,  sy + 11);
    ctx.lineTo(sx + 13, sy - 10);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Verified label
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = '#5C7A5E';
    ctx.fillText('\u2736 VERIFIED BY ECOTRACE', 142, y + 36);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(32,38,43,0.42)';
    ctx.fillText('This report has been validated against the EcoTrace Ledger.', 142, y + 54);
    ctx.fillText(`Generated: ${new Date().toLocaleString('en-IN')}  ·  Doc: ${docId}`, 142, y + 70);

    // Signature (right)
    ctx.font = 'italic bold 18px Georgia, serif';
    ctx.fillStyle = '#20262B';
    ctx.textAlign = 'right';
    ctx.fillText('EcoTrace Ledger System', W - 52, y + 44);
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(32,38,43,0.35)';
    ctx.fillText('AUTHORISED SIGNATORY', W - 52, y + 60);
    ctx.strokeStyle = 'rgba(32,38,43,0.18)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(W - 220, y + 66); ctx.lineTo(W - 52, y + 66); ctx.stroke();
    ctx.textAlign = 'left';

    y += 120; dottedHr(y); y += 28;

    // Quote block
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillStyle = 'rgba(181,72,46,0.12)';
    ctx.fillText('\u201C', 30, y + 26);
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillStyle = 'rgba(32,38,43,0.58)';
    const words = REPORT_QUOTE.text.split(' ');
    let line = '', qy = y + 14;
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > W - 120 && line !== '') {
        ctx.fillText(line.trim(), 66, qy); line = word + ' '; qy += 20;
      } else { line = testLine; }
    }
    ctx.fillText(line.trim(), 66, qy); qy += 22;
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(32,38,43,0.35)';
    ctx.fillText(`\u2014 ${REPORT_QUOTE.author}`, 68, qy);
    y = qy + 24; dottedHr(y); y += 12;

    // Bottom footer bar
    ctx.fillStyle = '#20262B';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(250,246,238,0.38)';
    ctx.fillText('\u00a9 2026 ECOTRACE  \u00b7  SECURE ENCRYPTED LEDGER  \u00b7  ecotrace.app', 36, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText('CONFIDENTIAL \u2014 FOR PERSONAL USE ONLY', W - 36, H - 14);
    ctx.textAlign = 'left';

    const link = document.createElement('a');
    link.download = `ecotrace-report-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setDownloading(false);
  };

  const downloadPDF = () => {
    if (history.length === 0 && !summary?.latestCalculation) {
      alert('No data yet. Save at least one footprint entry first.');
      return;
    }
    setShowDownloadMenu(false);

    const lc = summary?.latestCalculation;
    const docId = `ECO-${Date.now().toString(36).toUpperCase().slice(-8)}`;

    const rowsHTML = history.slice(0, 20).map((row, ri) => `
      <tr style="background:${ri % 2 === 0 ? '#faf6ee' : '#fff'}">
        <td>${new Date(row.date).toLocaleDateString('en-IN')}</td>
        <td style="text-align:right">${row.breakdown.transport.toLocaleString()} kg</td>
        <td style="text-align:right">${row.breakdown.energy.toLocaleString()} kg</td>
        <td style="text-align:right">${row.breakdown.diet.toLocaleString()} kg</td>
        <td style="text-align:right;color:#5C7A5E">&#8722;${Math.abs(row.breakdown.waste).toLocaleString()} kg</td>
        <td style="text-align:right;font-weight:700">${row.totalAnnualCo2Kg.toLocaleString()} kg</td>
      </tr>
    `).join('');

    const barsHTML = lc ? (() => {
      const maxV = Math.max(lc.breakdown.transport, lc.breakdown.energy, lc.breakdown.diet, 1);
      return [
        { label: 'Transport', value: lc.breakdown.transport, color: '#20262B' },
        { label: 'Energy',    value: lc.breakdown.energy,    color: '#B5482E' },
        { label: 'Diet',      value: lc.breakdown.diet,      color: '#5C7A5E' },
      ].map(b => {
        const pct = Math.round((b.value / maxV) * 100);
        return `<div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-bottom:5px;font-family:monospace">
            <span style="font-weight:700;text-transform:uppercase">${b.label}</span>
            <span>${b.value.toLocaleString()} kg CO&#8322;e</span>
          </div>
          <div style="background:#e8e2d8;border-radius:4px;height:10px">
            <div style="background:${b.color};width:${pct}%;height:10px;border-radius:4px"></div>
          </div></div>`;
      }).join('');
    })() : '';

    const wasteHTML = lc && lc.breakdown.waste < 0
      ? `<p style="font-size:10px;font-family:monospace;color:#5C7A5E;margin-top:8px">&#9851; Recycling Offset: &#8722;${Math.abs(lc.breakdown.waste).toLocaleString()} kg CO&#8322;e saved</p>` : '';

    const html = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <title>EcoTrace Report &#8212; ${user?.name ?? 'User'}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:system-ui,sans-serif; color:#20262B; background:#FAF6EE; padding:40px 48px; }
      .header { background:#20262B; color:#FAF6EE; padding:20px 28px; border-radius:10px;
                display:flex; justify-content:space-between; align-items:center; margin-bottom:32px; }
      .header-left { display:flex; align-items:center; gap:12px; }
      .dot { width:12px; height:12px; border-radius:50%; background:#B5482E; flex-shrink:0; }
      .brand { font-size:19px; font-weight:800; letter-spacing:3px; }
      .subbrand { font-size:9px; font-family:monospace; opacity:.4; margin-top:2px; }
      .header-right { text-align:right; font-family:monospace; font-size:10px; opacity:.42; line-height:1.8; }
      .user { margin-bottom:28px; }
      .user h2 { font-size:21px; font-weight:800; text-transform:uppercase; letter-spacing:1px; }
      .user p { font-size:11px; font-family:monospace; color:#888; margin-top:5px; }
      .stitle { font-size:10px; font-family:monospace; color:#888; text-transform:uppercase;
                letter-spacing:2px; margin-bottom:16px; border-bottom:1px solid #e5e0d8;
                padding-bottom:8px; margin-top:28px; }
      .total-num { font-size:42px; font-weight:800; color:#B5482E; line-height:1; margin-bottom:5px; }
      .total-label { font-size:11px; font-family:monospace; color:#aaa; margin-bottom:20px; }
      table { width:100%; border-collapse:collapse; font-size:11px; font-family:monospace; margin-top:6px; }
      thead tr { background:#f0ebe0; }
      th { padding:9px 10px; font-size:8.5px; text-transform:uppercase; color:#888; font-weight:700; }
      td { padding:9px 10px; border-bottom:1px solid #f0ebe0; }
      .verify { margin-top:36px; padding:22px 26px; background:rgba(92,122,94,0.07);
                border:1px solid rgba(92,122,94,0.22); border-radius:10px;
                display:flex; justify-content:space-between; align-items:center; gap:20px; }
      .verify-left { display:flex; align-items:center; gap:16px; }
      .stamp { width:58px; height:58px; border-radius:50%; border:2.5px solid #5C7A5E;
               display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .vtext h3 { font-size:14px; font-weight:700; color:#5C7A5E; margin-bottom:4px; }
      .vtext p { font-size:10px; font-family:monospace; color:#666; line-height:1.65; }
      .sig { text-align:right; }
      .sig-name { font-family:Georgia,'Times New Roman',serif; font-style:italic;
                  font-size:20px; font-weight:700; color:#20262B; }
      .sig-label { font-size:8.5px; font-family:monospace; color:#aaa; margin-top:5px;
                   border-top:1px solid rgba(32,38,43,0.15); padding-top:4px; }
      .quote-block { margin-top:30px; padding:20px 26px;
                     border-top:1px dashed rgba(32,38,43,0.15);
                     border-bottom:1px dashed rgba(32,38,43,0.15); }
      .qmark { font-size:50px; font-family:Georgia,serif; color:rgba(181,72,46,0.14); line-height:0.6; margin-bottom:10px; }
      .qtext { font-size:13px; font-family:Georgia,'Times New Roman',serif; font-style:italic;
               color:rgba(32,38,43,0.58); line-height:1.8; }
      .qauthor { font-size:10px; font-family:monospace; color:rgba(32,38,43,0.38); margin-top:10px; font-weight:700; }
      .page-footer { margin-top:28px; background:#20262B; color:rgba(250,246,238,0.38);
                     font-family:monospace; font-size:9px; padding:12px 22px; border-radius:8px;
                     display:flex; justify-content:space-between; }
      @media print {
        body { padding:24px 32px; }
        .header, .page-footer, .verify { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      }
    </style></head><body>

    <div class="header">
      <div class="header-left">
        <div class="dot"></div>
        <div><div class="brand">ECOTRACE 🇮🇳</div><div class="subbrand">CARBON FOOTPRINT LEDGER</div></div>
      </div>
      <div class="header-right">
        <div>CARBON FOOTPRINT REPORT</div>
        <div>${new Date().toLocaleDateString('en-IN').toUpperCase()}</div>
        <div>DOC: ${docId}</div>
      </div>
    </div>

    <div class="user">
      <h2>${user?.name ?? 'User'}</h2>
      <p>${user?.email ?? ''} &nbsp;&#183;&nbsp; ${historyCount} ledger entries on record</p>
    </div>

    ${lc ? `<div class="stitle">Latest Emission Snapshot</div>
    <div class="total-num">${lc.totalAnnualCo2Kg.toLocaleString()} kg CO&#8322;e</div>
    <p class="total-label">Estimated annual carbon footprint</p>
    ${barsHTML}${wasteHTML}` : ''}

    <div class="stitle">Accountability Timeline</div>
    <table><thead><tr>
      <th>Date</th><th style="text-align:right">Transport</th><th style="text-align:right">Energy</th>
      <th style="text-align:right">Diet</th><th style="text-align:right">Waste Offset</th>
      <th style="text-align:right">Total CO&#8322;e</th>
    </tr></thead><tbody>${rowsHTML}</tbody></table>

    <div class="verify">
      <div class="verify-left">
        <div class="stamp">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#5C7A5E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13" cy="13" r="11.5"/>
            <polyline points="6,13 11,18 20,8"/>
          </svg>
        </div>
        <div class="vtext">
          <h3>&#10022; VERIFIED BY ECOTRACE</h3>
          <p>This report has been validated against the EcoTrace Ledger.<br>
             Generated: ${new Date().toLocaleString('en-IN')} &nbsp;&#183;&nbsp; Document: ${docId}</p>
        </div>
      </div>
      <div class="sig">
        <div class="sig-name">EcoTrace Ledger System</div>
        <div class="sig-label">AUTHORISED SIGNATORY</div>
      </div>
    </div>

    <div class="quote-block">
      <div class="qmark">&ldquo;</div>
      <div class="qtext">${REPORT_QUOTE.text}</div>
      <div class="qauthor">&mdash; ${REPORT_QUOTE.author}</div>
    </div>

    <div class="page-footer">
      <span>&#169; 2026 ECOTRACE &nbsp;&#183;&nbsp; SECURE ENCRYPTED LEDGER SESSION</span>
      <span>CONFIDENTIAL &#8212; FOR PERSONAL USE ONLY</span>
    </div>
    <script>
      // Wait for layout/styles to render completely before printing
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.print();
          // Automatically close the window/tab after print dialog is closed
          setTimeout(() => {
            window.close();
          }, 150);
        }, 350);
      });
    </script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Pop-up blocked! Please allow pop-ups for this website to print/download the PDF report.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-mist text-graphite font-mono text-sm space-y-4">
        <RefreshCw className="animate-spin h-6 w-6 text-ledger-red" />
        <span>SYNCHRONIZING SECURE LEDGER FEED...</span>
      </div>
    );
  }

  // Active calculation to render on receipt
  const latestCalc = summary?.latestCalculation;
  const showReceipt = !!latestCalc;

  // Build receipt input from saved DB items (now returned by summary API)
  const currentCalcInput = showReceipt && latestCalc.items?.length ? {
    transport: {
      mode: latestCalc.items.find((i: any) => i.category === 'transport')?.subcategory?.split('_flights_')[0] || 'car_petrol',
      weeklyKm: latestCalc.items.find((i: any) => i.category === 'transport')?.inputValue || 0,
      flightsPerYear: latestCalc.items.find((i: any) => i.category === 'transport')?.subcategory?.includes('_flights_')
        ? Number(latestCalc.items.find((i: any) => i.category === 'transport')?.subcategory.split('_flights_')[1])
        : Math.round((latestCalc.items.find((i: any) => i.category === 'transport')?.co2Kg || 0) / 250),
    },
    energy: {
      monthlyKwh: latestCalc.items.find((i: any) => i.category === 'energy')?.inputValue || 0,
      cookingFuel: latestCalc.items.find((i: any) => i.category === 'energy')?.subcategory?.split('cooking_')[1]?.split('_')[0] || 'electric',
      hasSolar: latestCalc.items.find((i: any) => i.category === 'energy')?.subcategory?.includes('solar') || false,
      lpgCylinderKg: latestCalc.items.find((i: any) => i.category === 'energy')?.subcategory?.includes('_lpgKg_')
        ? Number(latestCalc.items.find((i: any) => i.category === 'energy')?.subcategory.split('_lpgKg_')[1])
        : undefined,
    },
    diet: (latestCalc.items.find((i: any) => i.category === 'diet')?.subcategory?.replace('diet_', '') || 'moderate_meat') as any,
    waste: (latestCalc.items.find((i: any) => i.category === 'waste')?.subcategory || 'some_recycling') as any,
  } : formInputs;

  const receiptResult = showReceipt ? {
    totalAnnualCo2Kg: latestCalc.totalAnnualCo2Kg,
    breakdown: latestCalc.breakdown,
    comparison: summary.comparison,
  } : calculateFootprint(formInputs, factors);

  // Compute worst emission category for targeted tips
  const worstCategory = showReceipt
    ? (['transport', 'energy', 'diet'] as const).reduce((a, b) =>
        (receiptResult.breakdown[a] ?? 0) >= (receiptResult.breakdown[b] ?? 0) ? a : b
      )
    : 'transport';

  // Compute category ratios for visualization
  const breakdownTotal = showReceipt
    ? (Object.values(receiptResult.breakdown) as number[]).reduce((a, b) => a + Math.max(0, b), 0)
    : 1;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header bar */}
      <header className="border-b border-graphite/10 bg-paper/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-ledger-red"></div>
            <span className="font-display font-bold text-base uppercase tracking-wider text-graphite">
              EcoTrace 🇮🇳 Dashboard
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
              <span className="text-graphite/40">LEDGER PROFILE:</span>
              <span className="font-bold text-graphite">{user?.name.toUpperCase()}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-display font-bold py-2 px-3 border border-graphite/15 hover:border-graphite rounded transition cursor-pointer focus-ring"
            >
              <LogOut className="h-3.5 w-3.5 text-ledger-red" />
              <span className="hidden sm:inline">LOG OUT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 md:py-12 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Stamped Receipt / Form */}
        <div className="lg:col-span-5 space-y-6 flex flex-col items-center">
          {/* Add Log / Form Toggle */}
          <div className="w-full flex justify-between items-center">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider">
              {showLogForm ? 'LOG FOOTPRINT UPDATE' : 'ACTIVE EMISSION RECEIPT'}
            </h2>
            <button
              onClick={() => setShowLogForm(!showLogForm)}
              className="flex items-center gap-1.5 text-xs font-display font-bold py-2 px-3 bg-graphite text-paper hover:bg-graphite/95 rounded transition cursor-pointer focus-ring"
            >
              {showLogForm ? (
                <span>VIEW RECEIPT</span>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>LOG NEW ENTRY</span>
                </>
              )}
            </button>
          </div>

          {/* Rendering Receipt OR Logging Form */}
          {showLogForm ? (
            <form onSubmit={handleLogSubmit} className="w-full border border-graphite/10 rounded-lg p-6 bg-paper shadow-md space-y-6 font-mono text-xs">
              <div className="border-b border-graphite/10 pb-3 mb-4 text-center">
                <span className="font-display font-bold text-sm uppercase">FOOTPRINT LOGGER ENTRY</span>
              </div>

              {saveSuccess && (
                <div className="bg-moss/10 border border-moss/20 text-moss rounded p-3 text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Entry saved to ledger! Updating statistics...</span>
                </div>
              )}

              {/* Form content - similar to landing page */}
              <div className="space-y-4">
                {/* Transport */}
                <div className="space-y-2">
                  <span className="font-bold text-graphite/80 block uppercase border-b border-graphite/10 pb-1">01 / Transport</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formInputs.transport.mode}
                      onChange={(e) => handleFormInputChange('transport', 'mode', e.target.value)}
                      aria-label="Transport Mode"
                      className="bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono cursor-pointer"
                    >
                      <option value="car_petrol">Car (Petrol)</option>
                      <option value="car_diesel">Car (Diesel)</option>
                      <option value="car_electric">Car (Electric)</option>
                      <option value="motorbike">Motorbike</option>
                      <option value="bus">Public Bus</option>
                      <option value="train">Train/Metro</option>
                      <option value="flight">Domestic Flight</option>
                      <option value="walk_cycle">Walk / Cycle</option>
                    </select>
                    {formInputs.transport.mode !== 'walk_cycle' && (
                      <input
                        type="number"
                        min="0"
                        placeholder="Weekly Km"
                        aria-label="Weekly travel distance in kilometers"
                        value={formInputs.transport.weeklyKm ?? ''}
                        onChange={(e) => handleFormInputChange('transport', 'weeklyKm', parseInt(e.target.value) || 0)}
                        className="bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-graphite/50 uppercase">Flights/Year:</span>
                    <input
                      type="number"
                      min="0"
                      aria-label="Flights per year"
                      value={formInputs.transport.flightsPerYear ?? ''}
                      onChange={(e) => handleFormInputChange('transport', 'flightsPerYear', parseInt(e.target.value) || 0)}
                      className="bg-paper border border-graphite/20 p-1.5 w-16 rounded focus-ring text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Energy */}
                <div className="space-y-2">
                  <span className="font-bold text-graphite/80 block uppercase border-b border-graphite/10 pb-1">02 / Energy</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-graphite/50 uppercase">Monthly kWh:</span>
                      <input
                        type="number"
                        min="0"
                        aria-label="Monthly electricity usage in kilowatt-hours"
                        value={formInputs.energy.monthlyKwh}
                        onChange={(e) => handleFormInputChange('energy', 'monthlyKwh', parseInt(e.target.value) || 0)}
                        className="bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-graphite/50 uppercase">Cooking Fuel:</span>
                      <select
                        value={formInputs.energy.cookingFuel}
                        onChange={(e) => handleFormInputChange('energy', 'cookingFuel', e.target.value)}
                        aria-label="Cooking Fuel type"
                        className="bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono cursor-pointer"
                      >
                        <option value="lpg">LPG Cylinder</option>
                        <option value="png">PNG Piped</option>
                        <option value="electric">Electric</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={formInputs.energy.hasSolar ?? false}
                      onChange={(e) => handleFormInputChange('energy', 'hasSolar', e.target.checked)}
                      aria-label="Rooftop Solar Array Active"
                      className="accent-moss h-3.5 w-3.5"
                    />
                    <span className="text-[10px] text-graphite/70 uppercase">Rooftop Solar Array Active</span>
                  </label>

                  {/* LPG Cylinder Weight — shown only when LPG is selected */}
                  {formInputs.energy.cookingFuel === 'lpg' && (
                    <div className="mt-2 space-y-1">
                      <label htmlFor="lpg-cylinder-preset" className="text-[9px] text-graphite/50 uppercase block">LPG Cylinder Capacity:</label>
                      <div className="flex items-center gap-2">
                        <select
                          id="lpg-cylinder-preset"
                          value={
                            formInputs.energy.lpgCylinderKg === 14.2 ? '14.2'
                            : formInputs.energy.lpgCylinderKg === 15 ? '15'
                            : 'custom'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== 'custom') {
                              handleFormInputChange('energy', 'lpgCylinderKg', parseFloat(val));
                            }
                          }}
                          aria-label="LPG Cylinder Capacity Preset"
                          className="flex-1 bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono cursor-pointer"
                        >
                          <option value="14.2">14.2 kg (Standard)</option>
                          <option value="15">15 kg (Commercial)</option>
                          <option value="custom">Other (custom)</option>
                        </select>

                        {/* Custom weight input */}
                        {(formInputs.energy.lpgCylinderKg !== 14.2 && formInputs.energy.lpgCylinderKg !== 15) && (
                          <input
                            type="number"
                            min="1"
                            max="50"
                            step="0.1"
                            placeholder="kg"
                            aria-label="Custom LPG Cylinder Capacity in kilograms"
                            value={formInputs.energy.lpgCylinderKg ?? ''}
                            onChange={(e) =>
                              handleFormInputChange('energy', 'lpgCylinderKg', parseFloat(e.target.value) || 14.2)
                            }
                            className="w-20 bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono"
                          />
                        )}
                      </div>
                      <p className="text-[9px] text-graphite/40 leading-tight">
                        Used to calculate precise cooking CO₂e emissions based on cylinder refill weight.
                      </p>
                    </div>
                  )}
                </div>

                {/* Diet */}
                <div className="space-y-2">
                  <span className="font-bold text-graphite/80 block uppercase border-b border-graphite/10 pb-1">03 / Diet</span>
                  <select
                    value={formInputs.diet}
                    onChange={(e) => handleFormInputChange('diet', '', e.target.value)}
                    aria-label="Dietary Profile"
                    className="w-full bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono cursor-pointer"
                  >
                    <option value="high_meat">High Meat Diet</option>
                    <option value="moderate_meat">Moderate Meat</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan Diet</option>
                  </select>
                </div>

                {/* Waste */}
                <div className="space-y-2">
                  <span className="font-bold text-graphite/80 block uppercase border-b border-graphite/10 pb-1">04 / Waste Recycling</span>
                  <select
                    value={formInputs.waste}
                    onChange={(e) => handleFormInputChange('waste', '', e.target.value)}
                    aria-label="Waste Recycling Level"
                    className="w-full bg-paper border border-graphite/20 p-2 rounded focus-ring text-xs font-mono cursor-pointer"
                  >
                    <option value="low_recycling">Low Recycling</option>
                    <option value="some_recycling">Partial Recycling</option>
                    <option value="high_recycling">Active Recycling & Composting</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLog}
                className="w-full py-3 bg-graphite hover:bg-graphite/95 active:scale-98 text-paper font-display font-bold text-xs tracking-wider uppercase rounded transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
              >
                {savingLog ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-paper" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>WRITING DATABASE TRANSACTION...</span>
                  </>
                ) : (
                  <span>POST ENTRY TRANSACTION</span>
                )}
              </button>
            </form>
          ) : (
            <div className="w-full space-y-4 flex flex-col items-center">
              <CarbonReceipt
                input={currentCalcInput}
                result={receiptResult}
                userName={user?.name || 'GREEN CITIZEN'}
                date={latestCalc ? new Date(latestCalc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : undefined}
                showSaveButton={false}
                factors={factors}
              />
              
              {latestCalc && (
                <div className="w-full flex flex-col sm:flex-row gap-3 mt-2 animate-fade-in">
                  <button
                    onClick={() => {
                      setFormInputs({
                        transport: { mode: 'car_petrol', weeklyKm: 80, flightsPerYear: 1 },
                        energy: { monthlyKwh: 120, cookingFuel: 'lpg', hasSolar: false, lpgCylinderKg: 14.2 },
                        diet: 'moderate_meat',
                        waste: 'some_recycling',
                      });
                      setShowLogForm(true);
                    }}
                    className="flex-1 py-3 px-4 bg-graphite hover:bg-graphite/95 active:scale-98 text-paper font-display font-bold text-xs tracking-wider uppercase rounded transition cursor-pointer flex items-center justify-center gap-2 focus-ring shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>CREATE NEW RECEIPT</span>
                  </button>
                  
                  <button
                    onClick={() => handleDeleteEntry(latestCalc.date)}
                    disabled={deletingEntry !== null}
                    className="py-3 px-4 border border-ledger-red/35 hover:bg-ledger-red/5 active:scale-98 text-ledger-red font-display font-bold text-xs tracking-wider uppercase rounded transition cursor-pointer flex items-center justify-center gap-2 focus-ring disabled:opacity-50"
                  >
                    {deletingEntry === latestCalc.date ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>{deletingEntry === latestCalc.date ? 'DELETING...' : 'DELETE RECEIPT'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Visual analytics, timeline history */}
        <div className="lg:col-span-7 space-y-8">
          {errorMsg && (
            <div className="bg-ledger-red/10 border border-ledger-red/20 text-ledger-red rounded p-4 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Introduction for first-timers */}
          {!showReceipt && !showLogForm && (
            <div className="border border-graphite/10 rounded-lg p-6 bg-paper/50 space-y-4">
              <div className="flex items-center gap-2 text-ledger-red">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-display font-bold text-sm uppercase tracking-wide">NO ACTIVE LEDGER ENTRY FOUND</h3>
              </div>
              <p className="font-sans text-xs text-graphite/70 leading-relaxed">
                You have not saved any calculations to your profile yet! Your dashboard is currently showing estimates based on local parameters. 
                Click **&quot;LOG NEW ENTRY&quot;** above to enter your current transport, energy, and diet details and commit them to your personal ledger database.
              </p>
            </div>
          )}

          {/* Category Proportions visual card */}
          {showReceipt && (
            <div className="border border-graphite/10 rounded-lg p-6 bg-paper/40 space-y-6">
              <div className="flex items-center gap-2 border-b border-graphite/10 pb-3">
                <BarChart2 className="h-5 w-5 text-ledger-red" />
                <h3 className="font-display font-bold text-sm uppercase tracking-wide">EMISSION RATIO BREAKDOWN</h3>
              </div>

              <div className="space-y-4">
                {([
                  { key: 'transport', label: '01 / Transport Emissions', color: 'bg-graphite', text: 'text-graphite' },
                  { key: 'energy', label: '02 / Household Energy', color: 'bg-ledger-red', text: 'text-ledger-red' },
                  { key: 'diet', label: '03 / Dietary Footprint', color: 'bg-moss', text: 'text-moss' },
                ] as const).map((cat) => {
                  const val = receiptResult.breakdown[cat.key];
                  const percentage = breakdownTotal > 0 ? Math.max(0, Math.round((val / breakdownTotal) * 100)) : 0;
                  return (
                    <div key={cat.key} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="font-bold text-graphite/70">{cat.label}</span>
                        <span className="font-bold">{val.toLocaleString()} kg ({percentage}%)</span>
                      </div>
                      <div className="h-2.5 w-full bg-graphite/10 rounded-full overflow-hidden">
                        <div className={`h-full ${cat.color}`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {receiptResult.breakdown.waste < 0 && (
                  <div className="pt-2 border-t border-dashed border-graphite/10 flex justify-between items-center text-xs font-mono text-moss">
                    <span className="font-bold">04 / Waste Recycling Credit Offset</span>
                    <span className="font-bold">-{Math.abs(receiptResult.breakdown.waste).toLocaleString()} kg CO2e</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline audit log history */}
          <div className="border border-graphite/10 rounded-lg p-6 bg-paper/40 space-y-6">
            <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-ledger-red" />
                <h3 className="font-display font-bold text-sm uppercase tracking-wide">ACCOUNTABILITY TIMELINE</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-graphite/50 uppercase">TOTAL LOGS: {historyCount}</span>

                {/* Download dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowDownloadMenu(v => !v)}
                    title="Download your report"
                    disabled={downloading}
                    className="flex items-center gap-1.5 text-[10px] font-mono font-bold py-1.5 px-2.5 border border-graphite/20 hover:border-moss hover:text-moss rounded transition cursor-pointer disabled:opacity-50"
                  >
                    {downloading
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : <Download className="h-3 w-3" />}
                    <span className="hidden sm:inline">{downloading ? 'GENERATING...' : 'DOWNLOAD'}</span>
                    <svg className="h-2.5 w-2.5 ml-0.5" viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>
                  </button>

                  {showDownloadMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-paper border border-graphite/15 rounded shadow-lg z-30 min-w-[140px] overflow-hidden">
                      <button
                        onClick={downloadPNG}
                        className="w-full text-left px-3 py-2.5 text-[10px] font-mono font-bold hover:bg-graphite/5 flex items-center gap-2 cursor-pointer"
                      >
                        <span>🖼</span> Download PNG
                      </button>
                      <button
                        onClick={downloadPDF}
                        className="w-full text-left px-3 py-2.5 text-[10px] font-mono font-bold hover:bg-graphite/5 flex items-center gap-2 cursor-pointer border-t border-graphite/10"
                      >
                        <span>📄</span> Download PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-10 font-mono text-xs text-graphite/40">
                NO RECORDS SAVED TO TRANSACTION HISTORY
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-graphite/15 text-graphite/50 text-[10px] uppercase">
                        <th className="py-2.5 font-bold">LOG DATE</th>
                        <th className="py-2.5 text-right font-bold">TRANSPORT</th>
                        <th className="py-2.5 text-right font-bold">ENERGY</th>
                        <th className="py-2.5 text-right font-bold">DIET</th>
                        <th className="py-2.5 text-right font-bold">WASTE OFFSET</th>
                        <th className="py-2.5 text-right font-bold text-graphite font-display">TOTAL CO2e</th>
                        <th className="py-2.5 text-right font-bold">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite/5">
                      {history.map((row) => (
                        <tr key={row.date} className="hover:bg-graphite/[0.02] transition">
                          <td className="py-3 font-semibold text-graphite">
                            {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-3 text-right text-graphite/80">{row.breakdown.transport.toLocaleString()} kg</td>
                          <td className="py-3 text-right text-graphite/80">{row.breakdown.energy.toLocaleString()} kg</td>
                          <td className="py-3 text-right text-graphite/80">{row.breakdown.diet.toLocaleString()} kg</td>
                          <td className="py-3 text-right text-moss">-{Math.abs(row.breakdown.waste).toLocaleString()} kg</td>
                          <td className="py-3 text-right font-bold text-graphite">{row.totalAnnualCo2Kg.toLocaleString()} kg</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDeleteEntry(row.date)}
                              disabled={deletingEntry !== null}
                              title="Delete from ledger"
                              className="text-ledger-red hover:text-ledger-red/80 active:scale-95 transition cursor-pointer disabled:opacity-40 p-1 inline-flex items-center justify-center"
                            >
                              {deletingEntry === row.date ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyCount > 5 && (
                  <div className="flex justify-between items-center pt-4 border-t border-graphite/10 text-xs font-mono">
                    <button
                      disabled={page === 1}
                      onClick={() => changePage(page - 1)}
                      className="px-3 py-1.5 border border-graphite/20 hover:border-graphite rounded cursor-pointer disabled:opacity-40 disabled:hover:border-graphite/20"
                    >
                      PREVIOUS
                    </button>
                    <span>PAGE {page} OF {Math.ceil(historyCount / 5)}</span>
                    <button
                      disabled={page * 5 >= historyCount}
                      onClick={() => changePage(page + 1)}
                      className="px-3 py-1.5 border border-graphite/20 hover:border-graphite rounded cursor-pointer disabled:opacity-40 disabled:hover:border-graphite/20"
                    >
                      NEXT
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Eco Quotes & Improvement Tips */}
          <EcoQuotes worstCategory={worstCategory} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-graphite/10 py-6 bg-paper mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-graphite/50 font-mono">
          <span>&copy; 2026 ECOTRACE. SECURE ENCRYPTED LEDGER SESSION.</span>
          <div className="flex gap-6">
            <span>CLIENT APP V1.0</span>
            <span className="text-moss font-bold">DATABASE CONNECTED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
