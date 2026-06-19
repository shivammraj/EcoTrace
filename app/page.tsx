'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Car, Zap, Flame, Trash2, ArrowRight, Mail, Lock, User, 
  Check, AlertCircle, Sparkles, RefreshCw, ChevronRight, Users, Database, TrendingUp, Activity
} from 'lucide-react';
import CarbonReceipt from '@/components/ui/CarbonReceipt';
import AuditFeed from '@/components/ui/AuditFeed';
import { CalculatorInput, calculateFootprint } from '@/lib/calculator';

export default function LandingPage() {
  // Calculator inputs state
  const [inputs, setInputs] = useState<CalculatorInput>({
    transport: {
      mode: 'car_petrol',
      weeklyKm: 80,
      flightsPerYear: 1,
    },
    energy: {
      monthlyKwh: 120,
      cookingFuel: 'lpg',
      hasSolar: false,
    },
    diet: 'moderate_meat',
    waste: 'some_recycling',
  });

  // Calculate footprint locally for sub-millisecond updates
  const [calcResult, setCalcResult] = useState(() => calculateFootprint(inputs));
  
  // Active tab in calculator questionnaire
  const [activeStep, setActiveStep] = useState<'transport' | 'energy' | 'diet' | 'waste'>('transport');
  
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Global Ledger Stats — starts at 0 until real data loads
  const [globalStats, setGlobalStats] = useState({
    totalUsers: 0,
    totalEntries: 0,
    totalTrackedKg: 0,
    avgFootprintKg: 0,
    entriesToday: 0,
    usersThisWeek: 0,
    loaded: false,
  });
  const [statsRefreshedAt, setStatsRefreshedAt] = useState<Date | null>(null);

  // Re-calculate when inputs change
  useEffect(() => {
    setCalcResult(calculateFootprint(inputs));
  }, [inputs]);

  // Fetch live stats from API — refresh every 30 s
  const fetchStats = () => {
    fetch('/api/stats/global')
      .then(res => res.json())
      .then(data => {
        setGlobalStats({
          totalUsers: data.totalUsers ?? 0,
          totalEntries: data.totalEntries ?? 0,
          totalTrackedKg: data.totalTrackedKg ?? 0,
          avgFootprintKg: data.avgFootprintKg ?? 0,
          entriesToday: data.entriesToday ?? 0,
          usersThisWeek: data.usersThisWeek ?? 0,
          loaded: true,
        });
        setStatsRefreshedAt(new Date());
      })
      .catch(err => console.warn('Could not fetch global stats:', err));
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (category: string, field: string, value: any) => {
    setInputs(prev => {
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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register' ? { email, password, name } : { email, password };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (authMode === 'register') {
        setAuthSuccess('Account created successfully! Logging in...');
        // Auto-login after registration
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.error);
        
        // Save access token
        localStorage.setItem('access_token', loginData.accessToken);
        await saveCalculatorResult(loginData.accessToken);
      } else {
        localStorage.setItem('access_token', data.accessToken);
        await saveCalculatorResult(data.accessToken);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred');
      setAuthLoading(false);
    }
  };

  const saveCalculatorResult = async (token: string) => {
    try {
      const saveRes = await fetch('/api/carbon/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inputs)
      });

      if (saveRes.ok) {
        setAuthSuccess('Footprint saved! Redirecting to your dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1200);
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      window.location.href = '/dashboard';
    }
  };

  const startGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="max-w-6xl mx-auto w-full px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-ledger-red"></div>
          <span className="font-display font-bold text-lg uppercase tracking-wider text-graphite">
            EcoTrace
          </span>
        </div>
        <button
          onClick={() => {
            setAuthMode('login');
            setShowAuthModal(true);
          }}
          className="text-xs font-display font-medium px-4 py-2 bg-graphite text-paper hover:bg-graphite/90 active:scale-95 rounded transition cursor-pointer focus-ring"
        >
          LOG IN / REGISTER
        </button>
      </header>

      {/* Hero / Main Section */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8 md:py-16 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Headline and Question Form */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold tracking-widest text-ledger-red bg-ledger-red/10 px-2.5 py-1 rounded">
              PHASE 1 ACTIVE
            </span>
            <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-graphite leading-tight tracking-tight uppercase">
              Know your footprint in 60 seconds — <span className="text-ledger-red">then start shrinking it.</span>
            </h1>
            <p className="font-sans text-base sm:text-lg text-graphite/70 max-w-xl">
              An activity-based carbon accountability ledger. Answer 4 questions to print your itemized footprint receipt. Save it to set your reduction targets.
            </p>
          </div>

          {/* Calculator Step Cards */}
          <div className="border border-graphite/10 rounded-lg overflow-hidden bg-paper/60 backdrop-blur-sm">
            <div className="bg-paper border-b border-graphite/10 flex divide-x divide-graphite/10 text-xs font-display">
              {(['transport', 'energy', 'diet', 'waste'] as const).map((step) => (
                <button
                  key={step}
                  onClick={() => setActiveStep(step)}
                  className={`flex-1 py-3.5 text-center font-bold tracking-wider uppercase transition cursor-pointer focus-ring ${
                    activeStep === step 
                      ? 'bg-graphite text-paper' 
                      : 'text-graphite/60 hover:bg-graphite/5'
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Transport questionnaire */}
              {activeStep === 'transport' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold font-display uppercase tracking-wider block text-graphite/80">
                      Primary Transport Mode
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'car_petrol', label: 'Car (Petrol)', icon: Car },
                        { id: 'car_diesel', label: 'Car (Diesel)', icon: Car },
                        { id: 'car_electric', label: 'Electric Car', icon: Car },
                        { id: 'motorbike', label: 'Motorbike', icon: Car },
                        { id: 'bus', label: 'Bus', icon: Car },
                        { id: 'train', label: 'Train/Metro', icon: Car },
                        { id: 'flight', label: 'Air Flight', icon: Car },
                        { id: 'walk_cycle', label: 'Walk / Cycle', icon: Car },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleInputChange('transport', 'mode', item.id)}
                          className={`p-3 border rounded text-left transition flex flex-col justify-between h-20 cursor-pointer focus-ring ${
                            inputs.transport.mode === item.id
                              ? 'border-graphite bg-graphite/5 font-bold'
                              : 'border-graphite/15 bg-paper/40 hover:border-graphite/30'
                          }`}
                        >
                          <span className="text-[10px] text-graphite/50 font-mono">01.{item.id.slice(0, 3).toUpperCase()}</span>
                          <span className="text-xs text-graphite font-medium leading-tight">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {inputs.transport.mode !== 'walk_cycle' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold font-display uppercase tracking-wider">
                        <span>Weekly Travel Distance</span>
                        <span className="font-mono text-ledger-red">{inputs.transport.weeklyKm} km</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={inputs.transport.weeklyKm ?? 0}
                        onChange={(e) => handleInputChange('transport', 'weeklyKm', parseInt(e.target.value))}
                        className="w-full accent-ledger-red cursor-pointer h-1.5 bg-graphite/10 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] text-graphite/40 font-mono">
                        <span>0 km</span>
                        <span>250 km</span>
                        <span>500 km</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold font-display uppercase tracking-wider">
                      <span>Flights Taken (Per Year)</span>
                      <span className="font-mono text-ledger-red">{inputs.transport.flightsPerYear} flights</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="1"
                      value={inputs.transport.flightsPerYear ?? 0}
                      onChange={(e) => handleInputChange('transport', 'flightsPerYear', parseInt(e.target.value))}
                      className="w-full accent-ledger-red cursor-pointer h-1.5 bg-graphite/10 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-graphite/40 font-mono">
                      <span>0 flights</span>
                      <span>6 flights</span>
                      <span>12 flights</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Energy Questionnaire */}
              {activeStep === 'energy' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold font-display uppercase tracking-wider">
                      <span>Monthly Electricity Usage</span>
                      <span className="font-mono text-ledger-red">{inputs.energy.monthlyKwh} kWh</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="800"
                      step="20"
                      value={inputs.energy.monthlyKwh}
                      onChange={(e) => handleInputChange('energy', 'monthlyKwh', parseInt(e.target.value))}
                      className="w-full accent-ledger-red cursor-pointer h-1.5 bg-graphite/10 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-graphite/40 font-mono">
                      <span>0 kWh</span>
                      <span>400 kWh</span>
                      <span>800 kWh</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold font-display uppercase tracking-wider block text-graphite/80">
                      Primary Cooking Fuel
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'lpg', label: 'LPG Gas', desc: 'Liquid Petroleum' },
                        { id: 'png', label: 'PNG Gas', desc: 'Piped Natural' },
                        { id: 'electric', label: 'Electric', desc: 'Grid powered' },
                      ].map((fuel) => (
                        <button
                          key={fuel.id}
                          onClick={() => handleInputChange('energy', 'cookingFuel', fuel.id)}
                          className={`p-3 border rounded text-left transition flex flex-col justify-between h-20 cursor-pointer focus-ring ${
                            inputs.energy.cookingFuel === fuel.id
                              ? 'border-graphite bg-graphite/5 font-bold'
                              : 'border-graphite/15 bg-paper/40 hover:border-graphite/30'
                          }`}
                        >
                          <span className="text-[10px] text-graphite/50 font-mono">02.{fuel.id.toUpperCase()}</span>
                          <div>
                            <span className="text-xs text-graphite block font-medium leading-tight">{fuel.label}</span>
                            <span className="text-[9px] text-graphite/40 font-sans mt-0.5 block">{fuel.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border border-graphite/10 rounded p-4 bg-paper/40 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold font-display uppercase tracking-wider block">Rooftop Solar Array</span>
                      <span className="text-[10px] text-graphite/50 font-sans block">Reduces grid-tied electricity emissions by 70%</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inputs.energy.hasSolar ?? false}
                        onChange={(e) => handleInputChange('energy', 'hasSolar', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-graphite/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-paper after:border-graphite/30 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-moss"></div>
                    </label>
                  </div>
                </motion.div>
              )}

              {/* Diet Questionnaire */}
              {activeStep === 'diet' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <label className="text-xs font-bold font-display uppercase tracking-wider block text-graphite/80">
                    Dietary habits (Primary Intake)
                  </label>
                  <div className="space-y-2.5">
                    {[
                      { id: 'high_meat', title: 'High Meat', desc: 'Frequent red meat, poultry, and dairy consumption (~7.2 kg CO2e/day)' },
                      { id: 'moderate_meat', title: 'Moderate Meat', desc: 'Occasional meat, balanced with vegetables, grains, and dairy (~5.6 kg CO2e/day)' },
                      { id: 'vegetarian', title: 'Vegetarian', desc: 'Zero meat or fish; consumes eggs, cheese, and dairy (~3.8 kg CO2e/day)' },
                      { id: 'vegan', title: 'Vegan', desc: '100% plant-based diet; zero animal products (~2.9 kg CO2e/day)' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleInputChange('diet', '', item.id)}
                        className={`w-full p-4 border rounded text-left transition flex items-center justify-between cursor-pointer focus-ring ${
                          inputs.diet === item.id
                            ? 'border-graphite bg-graphite/5 font-bold'
                            : 'border-graphite/15 bg-paper/40 hover:border-graphite/30'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs text-graphite block font-semibold">{item.title}</span>
                          <span className="text-[10px] text-graphite/50 block font-sans leading-normal">{item.desc}</span>
                        </div>
                        {inputs.diet === item.id && (
                          <div className="h-4 w-4 rounded-full bg-graphite text-paper flex items-center justify-center">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Waste Questionnaire */}
              {activeStep === 'waste' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <label className="text-xs font-bold font-display uppercase tracking-wider block text-graphite/80">
                    Recycling & Composting Habit
                  </label>
                  <div className="space-y-2.5">
                    {[
                      { id: 'low_recycling', title: 'Low Recycling / No Sorting', desc: 'Most waste goes directly to the landfill bin (0% reduction)' },
                      { id: 'some_recycling', title: 'Some Sorting & Recycling', desc: 'Sort plastics, metal, paper occasionally; basic waste awareness (5% offset credit)' },
                      { id: 'high_recycling', title: 'Active Recycling & Composting', desc: 'Consistently compost food scraps, separate recyclables, minimize single-use plastics (12% offset credit)' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleInputChange('waste', '', item.id)}
                        className={`w-full p-4 border rounded text-left transition flex items-center justify-between cursor-pointer focus-ring ${
                          inputs.waste === item.id
                            ? 'border-graphite bg-graphite/5 font-bold'
                            : 'border-graphite/15 bg-paper/40 hover:border-graphite/30'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs text-graphite block font-semibold">{item.title}</span>
                          <span className="text-[10px] text-graphite/50 block font-sans leading-normal">{item.desc}</span>
                        </div>
                        {inputs.waste === item.id && (
                          <div className="h-4 w-4 rounded-full bg-graphite text-paper flex items-center justify-center">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Form Nav Buttons */}
            <div className="bg-paper/40 border-t border-graphite/10 px-6 py-4 flex justify-between items-center text-xs font-display font-bold">
              <span className="text-graphite/50">
                {activeStep === 'transport' ? '1 / 4' : activeStep === 'energy' ? '2 / 4' : activeStep === 'diet' ? '3 / 4' : '4 / 4'}
              </span>
              <button
                onClick={() => {
                  const steps: ('transport' | 'energy' | 'diet' | 'waste')[] = ['transport', 'energy', 'diet', 'waste'];
                  const currentIndex = steps.indexOf(activeStep);
                  if (currentIndex < 3) {
                    setActiveStep(steps[currentIndex + 1]);
                  } else {
                    // Triggers the signup modal
                    setShowAuthModal(true);
                    setAuthMode('register');
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-graphite text-paper rounded hover:bg-graphite/90 transition cursor-pointer focus-ring"
              >
                <span>{activeStep === 'waste' ? 'SAVE TO LEDGER' : 'NEXT STEP'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Signature Carbon Receipt */}
        <div className="lg:col-span-5 flex justify-center items-start lg:sticky lg:top-8">
          <CarbonReceipt
            input={inputs}
            result={calcResult}
            showSaveButton={true}
            onSave={() => {
              setAuthMode('register');
              setShowAuthModal(true);
            }}
          />
        </div>
      </main>

      {/* How it works Section */}
      <section className="bg-paper py-16 md:py-24 border-y border-graphite/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl space-y-2 mb-16">
            <span className="text-xs font-mono font-bold tracking-widest text-ledger-red uppercase">
              Operational Protocol
            </span>
            <h2 className="font-display font-bold text-3xl uppercase tracking-tight text-graphite">
              A 3-Step Accountability Framework
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 font-sans">
            <div className="space-y-3">
              <span className="font-mono text-3xl text-ledger-red font-bold">01.</span>
              <h3 className="font-display font-bold text-lg uppercase text-graphite">Measure Actively</h3>
              <p className="text-sm text-graphite/70 leading-relaxed">
                Provide estimates across your weekly travel distance, home electricity meter data, cooking fuel type, and daily diet details. No generic profiles.
              </p>
            </div>
            <div className="space-y-3">
              <span className="font-mono text-3xl text-ledger-red font-bold">02.</span>
              <h3 className="font-display font-bold text-lg uppercase text-graphite">Inspect the Invoice</h3>
              <p className="text-sm text-graphite/70 leading-relaxed">
                Review your itemized carbon receipt instantly. See exactly where your highest emissions originate and compare your footprint against India's target.
              </p>
            </div>
            <div className="space-y-3">
              <span className="font-mono text-3xl text-ledger-red font-bold">03.</span>
              <h3 className="font-display font-bold text-lg uppercase text-graphite">Maintain the Ledger</h3>
              <p className="text-sm text-graphite/70 leading-relaxed">
                Create a secure account to save your records, track changes, append daily activities, and monitor your carbon reduction progress over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Collective Impact Ledger Section */}
      <section className="py-16 md:py-24 max-w-6xl mx-auto px-6 w-full">
        <div className="bg-graphite text-paper rounded-lg p-8 md:p-12 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 h-64 w-64 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-40 w-40 bg-ledger-red/[0.08] rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold tracking-widest text-ledger-red uppercase">
                Live Network Feed
              </span>
              <h2 className="font-display font-bold text-3xl uppercase tracking-tight leading-tight">
                Our Collective Ledger Impact
              </h2>
              <p className="font-sans text-sm text-paper/60 leading-relaxed max-w-md">
                Real numbers pulled directly from our database — updated every 30 seconds.
              </p>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-moss opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-moss" />
              </span>
              <span className="font-mono text-[10px] text-paper/40 uppercase tracking-wider">
                {globalStats.loaded
                  ? statsRefreshedAt
                    ? `Synced ${statsRefreshedAt.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Live'
                  : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-paper/10 rounded-lg overflow-hidden border border-paper/10">
            {[
              {
                icon: <Users className="h-4 w-4" />,
                label: 'Registered Users',
                value: globalStats.totalUsers,
                suffix: '',
                color: 'text-paper',
              },
              {
                icon: <Database className="h-4 w-4" />,
                label: 'Emission Entries Logged',
                value: globalStats.totalEntries,
                suffix: '',
                color: 'text-paper',
              },
              {
                icon: <TrendingUp className="h-4 w-4" />,
                label: 'Total CO₂ Tracked',
                value: globalStats.totalTrackedKg,
                suffix: ' kg',
                color: 'text-ledger-red',
              },
              {
                icon: <Activity className="h-4 w-4" />,
                label: 'Avg Footprint / Entry',
                value: globalStats.avgFootprintKg,
                suffix: ' kg CO₂e',
                color: 'text-amber-flag',
              },
              {
                icon: <Zap className="h-4 w-4" />,
                label: 'Entries Saved Today',
                value: globalStats.entriesToday,
                suffix: '',
                color: 'text-moss',
              },
              {
                icon: <Sparkles className="h-4 w-4" />,
                label: 'New Users This Week',
                value: globalStats.usersThisWeek,
                suffix: '',
                color: 'text-moss',
              },
            ].map((stat, i) => (
              <div key={i} className="bg-graphite/80 px-5 py-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-paper/40">
                  {stat.icon}
                  <span className="font-mono text-[9px] uppercase tracking-wider text-paper/40">{stat.label}</span>
                </div>
                <div className={`font-display font-bold text-2xl tracking-tight ${stat.color} transition-all duration-700`}>
                  {globalStats.loaded
                    ? stat.value.toLocaleString() + stat.suffix
                    : <span className="animate-pulse text-paper/20">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Audits Real Reports — Live Feed */}
      <section className="bg-paper py-16 md:py-24 border-t border-graphite/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-4 space-y-3">
              <span className="text-xs font-mono font-bold tracking-widest text-ledger-red uppercase">
                Client Audits
              </span>
              <h2 className="font-display font-bold text-3xl uppercase tracking-tight text-graphite">
                Real Reports
              </h2>
              <p className="font-sans text-sm text-graphite/60 leading-relaxed">
                Every audit event in our network is logged in real time — client syncs, data validations, and ledger updates stream live below.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                {[
                  { dot: 'bg-moss', label: 'Successful ledger sync' },
                  { dot: 'bg-amber-flag', label: 'Pending validation queue' },
                  { dot: 'bg-ledger-red', label: 'Failed or rejected event' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs font-mono text-graphite/50">
                    <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-8">
              <AuditFeed />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-32 max-w-3xl mx-auto px-6 text-center space-y-8">
        <div className="space-y-4">
          <h2 className="font-display font-bold text-4xl uppercase tracking-tight text-graphite">
            Start maintaining your ledger today.
          </h2>
          <p className="font-sans text-base text-graphite/70 max-w-xl mx-auto">
            Create an account in 30 seconds. Link your live carbon calculations, save your history, and join the network.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => {
              setAuthMode('register');
              setShowAuthModal(true);
            }}
            className="w-full sm:w-auto px-8 py-3.5 bg-graphite text-paper hover:bg-graphite/95 active:scale-95 font-display font-bold text-sm tracking-wider uppercase rounded transition cursor-pointer focus-ring"
          >
            CREATE FREE LEDGER
          </button>
          <button
            onClick={startGoogleLogin}
            className="w-full sm:w-auto px-8 py-3.5 border border-graphite/20 hover:border-graphite bg-paper hover:bg-paper/80 font-display font-bold text-sm tracking-wider uppercase rounded transition flex items-center justify-center gap-2 cursor-pointer focus-ring"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.48 0-6.3-2.82-6.3-6.3s2.82-6.3 6.3-6.3c1.482 0 2.839.516 3.905 1.371l3.138-3.138C19.043 2.378 15.932 1 12.24 1C6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.48 0 10.785-4.56 10.785-11.24 0-.765-.082-1.332-.2-1.955H12.24z" />
            </svg>
            <span>CONTINUE WITH GOOGLE</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-graphite/10 py-8 bg-paper">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-graphite/50 font-mono">
          <span>&copy; 2026 ECOTRACE. ALL RIGHTS RESERVED.</span>
          <div className="flex gap-6">
            <span>PHASE 1 LEDGER V1.0</span>
            <span className="text-ledger-red font-bold">IN REGION CODE</span>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-paper text-graphite p-6 md:p-8 rounded-lg border border-graphite/10 max-w-md w-full relative shadow-2xl space-y-6"
            >
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="absolute top-4 right-4 text-graphite/50 hover:text-graphite cursor-pointer focus-ring"
              >
                ✕
              </button>

              <div className="text-center space-y-1">
                <h3 className="font-display font-bold text-xl uppercase tracking-wider">
                  {authMode === 'register' ? 'CREATE ACCOUNT' : 'USER LOGIN'}
                </h3>
                <p className="text-xs text-graphite/50">
                  {authMode === 'register' 
                    ? 'Save your carbon receipts and tracking history.' 
                    : 'Access your saved calculations and dashboard.'}
                </p>
              </div>

              {authError && (
                <div className="bg-ledger-red/10 border border-ledger-red/20 text-ledger-red rounded p-3 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="bg-moss/10 border border-moss/20 text-moss rounded p-3 text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider block text-graphite/60">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-graphite/40" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-paper border border-graphite/15 rounded pl-10 pr-4 py-2.5 text-sm focus-ring"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider block text-graphite/60">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-graphite/40" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-paper border border-graphite/15 rounded pl-10 pr-4 py-2.5 text-sm focus-ring"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider block text-graphite/60">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-graphite/40" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-paper border border-graphite/15 rounded pl-10 pr-4 py-2.5 text-sm focus-ring"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-graphite hover:bg-graphite/95 active:scale-98 text-paper font-display font-bold text-xs tracking-widest uppercase rounded transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
                >
                  {authLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-paper" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>TRANSMITTING...</span>
                    </>
                  ) : (
                    <span>{authMode === 'register' ? 'REGISTER LEDGER' : 'LOGIN TO ACCOUNT'}</span>
                  )}
                </button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-graphite/10"></div>
                <span className="flex-shrink mx-4 text-[10px] font-mono text-graphite/40 uppercase">OR CONTINUE WITH</span>
                <div className="flex-grow border-t border-graphite/10"></div>
              </div>

              <button
                onClick={startGoogleLogin}
                className="w-full py-3 border border-graphite/20 bg-paper hover:bg-paper/80 text-graphite font-display font-bold text-xs tracking-wider uppercase rounded transition flex items-center justify-center gap-2 cursor-pointer focus-ring"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.48 0-6.3-2.82-6.3-6.3s2.82-6.3 6.3-6.3c1.482 0 2.839.516 3.905 1.371l3.138-3.138C19.043 2.378 15.932 1 12.24 1C6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.48 0 10.785-4.56 10.785-11.24 0-.765-.082-1.332-.2-1.955H12.24z" />
                </svg>
                <span>SIGN IN WITH GOOGLE</span>
              </button>

              <div className="text-center text-xs">
                {authMode === 'register' ? (
                  <p className="text-graphite/60">
                    Already have an account?{' '}
                    <button
                      onClick={() => setAuthMode('login')}
                      className="font-bold text-graphite underline hover:text-ledger-red cursor-pointer focus-ring"
                    >
                      Log in here
                    </button>
                  </p>
                ) : (
                  <p className="text-graphite/60">
                    Don&apos;t have an account?{' '}
                    <button
                      onClick={() => setAuthMode('register')}
                      className="font-bold text-graphite underline hover:text-ledger-red cursor-pointer focus-ring"
                    >
                      Create one here
                    </button>
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
