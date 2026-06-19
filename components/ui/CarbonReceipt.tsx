'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { NATIONAL_AVG_KG, GLOBAL_AVG_KG } from '@/lib/calculator';

interface CarbonReceiptProps {
  input: {
    transport: {
      mode: string;
      weeklyKm?: number;
      flightsPerYear?: number;
    };
    energy: {
      monthlyKwh: number;
      cookingFuel: string;
      hasSolar?: boolean;
    };
    diet: string;
    waste: string;
  };
  result: {
    totalAnnualCo2Kg: number;
    breakdown: {
      transport: number;
      energy: number;
      diet: number;
      waste: number;
    };
    comparison: {
      nationalAvgKg: number;
      globalAvgKg: number;
      percentVsNational: number;
    };
  };
  userName?: string;
  date?: string;
  isSaving?: boolean;
  onSave?: () => void;
  showSaveButton?: boolean;
}

export default function CarbonReceipt({
  input,
  result,
  userName = 'GUEST VISITOR',
  date,
  isSaving = false,
  onSave,
  showSaveButton = false,
}: CarbonReceiptProps) {
  const formatNum = (val: number) => {
    return Math.abs(val).toLocaleString('en-US');
  };

  const getTransportModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      car_petrol: 'Car (Petrol)',
      car_diesel: 'Car (Diesel)',
      car_electric: 'Car (Electric)',
      motorbike: 'Motorbike',
      bus: 'Public Bus',
      train: 'Train/Metro',
      flight: 'Domestic Flight',
      walk_cycle: 'Walk / Cycle',
    };
    return labels[mode] || mode;
  };

  const getCookingFuelLabel = (fuel: string) => {
    const labels: Record<string, string> = {
      lpg: 'LPG Gas Cylinder',
      png: 'PNG Piped Gas',
      electric: 'Electric Range',
    };
    return labels[fuel] || fuel;
  };

  const getDietLabel = (diet: string) => {
    const labels: Record<string, string> = {
      high_meat: 'High Meat Diet',
      moderate_meat: 'Moderate Meat',
      vegetarian: 'Vegetarian',
      vegan: 'Vegan Diet',
    };
    return labels[diet] || diet;
  };

  const getWasteLabel = (waste: string) => {
    const labels: Record<string, string> = {
      low_recycling: 'Minimal Recycling',
      some_recycling: 'Partial Recycling',
      high_recycling: 'Active Recycling',
    };
    return labels[waste] || waste;
  };

  const currentDate = date || new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const [receiptId, setReceiptId] = React.useState('ET-000000');

  React.useEffect(() => {
    setReceiptId(`ET-${Math.floor(100000 + Math.random() * 900000)}`);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="perforated-top perforated-bottom bg-paper text-graphite p-6 md:p-8 shadow-xl max-w-md w-full relative flex flex-col font-mono text-sm border-x border-dashed border-graphite/10"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="font-display font-bold text-xl tracking-tight text-graphite uppercase">
          EcoTrace Receipt
        </h2>
        <p className="text-xs text-graphite/60 mt-1">CARBON FOOTPRINT ACCOUNTABILITY</p>
        <div className="border-t border-dashed border-graphite/20 my-3"></div>
        <div className="flex justify-between text-xs text-graphite/60 px-1">
          <span>TICKET: {receiptId}</span>
          <span>{currentDate}</span>
        </div>
        <div className="flex justify-between text-xs text-graphite/60 px-1 mt-1">
          <span>CLIENT: {userName.toUpperCase()}</span>
          <span>REGION: IN (CEA/DEFRA)</span>
        </div>
        <div className="border-b border-dashed border-graphite/20 mt-3"></div>
      </div>

      {/* Line Items */}
      <div className="flex-1 space-y-4">
        {/* Category: Transport */}
        <div>
          <div className="flex justify-between font-bold text-xs uppercase text-graphite/80 mb-1">
            <span>01 / TRANSPORT EMISSIONS</span>
          </div>
          <div className="space-y-1">
            {input.transport.weeklyKm !== undefined && input.transport.weeklyKm > 0 && (
              <div className="flex items-end justify-between">
                <span className="text-xs text-graphite/70 truncate mr-2">
                  {getTransportModeLabel(input.transport.mode)} ({input.transport.weeklyKm} km/wk)
                </span>
                <span className="flex-1 border-b border-dotted border-graphite/30 mx-2 mb-1"></span>
                <span className="text-graphite font-bold font-mono">
                  +{formatNum(Math.round(result.breakdown.transport - (input.transport.flightsPerYear || 0) * 250))} kg
                </span>
              </div>
            )}
            {input.transport.flightsPerYear !== undefined && input.transport.flightsPerYear > 0 && (
              <div className="flex items-end justify-between">
                <span className="text-xs text-graphite/70 truncate mr-2">
                  Air Travel ({input.transport.flightsPerYear} flights/yr)
                </span>
                <span className="flex-1 border-b border-dotted border-graphite/30 mx-2 mb-1"></span>
                <span className="text-graphite font-bold font-mono">
                  +{formatNum(input.transport.flightsPerYear * 250)} kg
                </span>
              </div>
            )}
            {result.breakdown.transport === 0 && (
              <div className="flex items-end justify-between">
                <span className="text-xs text-graphite/70">No vehicle usage</span>
                <span className="flex-1 border-b border-dotted border-graphite/30 mx-2 mb-1"></span>
                <span className="text-graphite font-bold font-mono">0 kg</span>
              </div>
            )}
          </div>
        </div>

        {/* Category: Energy */}
        <div>
          <div className="flex justify-between font-bold text-xs uppercase text-graphite/80 mb-1">
            <span>02 / HOUSEHOLD ENERGY</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-end justify-between">
              <span className="text-xs text-graphite/70 truncate mr-2">
                Grid Electricity ({input.energy.monthlyKwh} kWh/mo)
              </span>
              <span className="flex-1 border-b border-dotted border-graphite/30 mx-2 mb-1"></span>
              <span className="text-graphite font-bold font-mono">
                +{formatNum(Math.round(input.energy.monthlyKwh * 0.82 * 12))} kg
              </span>
            </div>
            {input.energy.cookingFuel !== 'electric' && (
              <div className="flex items-end justify-between">
                <span className="text-xs text-graphite/70 truncate mr-2">
                  Cooking: {getCookingFuelLabel(input.energy.cookingFuel)}
                </span>
                <span className="flex-1 border-b border-dotted border-graphite/30 mx-2 mb-1"></span>
                <span className="text-graphite font-bold font-mono">
                  +{formatNum(Math.round(input.energy.cookingFuel === 'lpg' ? 10 * 3.0 * 12 : 12 * 2.02 * 12))} kg
                </span>
              </div>
            )}
            {input.energy.hasSolar && (
              <div className="flex items-end justify-between text-moss">
                <span className="text-xs truncate mr-2">Solar offset credit (70%)</span>
                <span className="flex-1 border-b border-dotted border-moss/40 mx-2 mb-1"></span>
                <span className="font-bold font-mono">
                  -{formatNum(Math.round(input.energy.monthlyKwh * 0.82 * 12 * 0.70))} kg
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Category: Diet */}
        <div>
          <div className="flex justify-between font-bold text-xs uppercase text-graphite/80 mb-1">
            <span>03 / DIETARY PROFILE</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-end justify-between">
              <span className="text-xs text-graphite/70 truncate mr-2">
                {getDietLabel(input.diet)}
              </span>
              <span className="flex-1 border-b border-dotted border-graphite/30 mx-2 mb-1"></span>
              <span className="text-graphite font-bold font-mono">
                +{formatNum(result.breakdown.diet)} kg
              </span>
            </div>
          </div>
        </div>

        {/* Category: Waste */}
        <div>
          <div className="flex justify-between font-bold text-xs uppercase text-graphite/80 mb-1">
            <span>04 / WASTE REDUCTION</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-end justify-between text-moss">
              <span className="text-xs truncate mr-2">
                {getWasteLabel(input.waste)}
              </span>
              <span className="flex-1 border-b border-dotted border-moss/40 mx-2 mb-1"></span>
              <span className="font-bold font-mono">
                -{formatNum(Math.abs(result.breakdown.waste))} kg
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-double border-graphite/40 my-4"></div>

      {/* Footer Totals */}
      <div className="relative pb-4">
        <div className="flex justify-between items-center">
          <span className="font-display font-bold text-sm tracking-wide">ANNUAL EMISSIONS:</span>
          <span className="font-mono text-xl font-bold tracking-tight text-graphite">
            {formatNum(result.totalAnnualCo2Kg)} kg CO2e
          </span>
        </div>
        <p className="text-right text-[10px] text-graphite/50 mt-0.5">
          ({(result.totalAnnualCo2Kg / 1000).toFixed(2)} metric tonnes / year)
        </p>

        {/* Stamped total in brick-red */}
        <div className="absolute right-2 -bottom-2 pointer-events-none select-none opacity-90 stamp-animation z-10">
          <div className="border-4 border-double border-ledger-red/70 rounded px-3 py-1.5 text-center transform -rotate-12 bg-paper/50 backdrop-blur-[1px]">
            <span className="text-[10px] font-bold text-ledger-red/70 block uppercase tracking-widest leading-none">
              Accountability
            </span>
            <span className="font-display font-extrabold text-[16px] text-ledger-red tracking-wider block uppercase leading-tight mt-0.5">
              {result.totalAnnualCo2Kg < NATIONAL_AVG_KG ? 'Moss Green' : 'Ledger Red'}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-dashed border-graphite/20 mt-4"></div>

      {/* Compare Info */}
      <div className="text-center mt-4 text-[10px] text-graphite/60 space-y-1">
        <p>National average: {formatNum(NATIONAL_AVG_KG)} kg | Global average: {formatNum(GLOBAL_AVG_KG)} kg</p>
        <p className="font-bold">
          {result.comparison.percentVsNational > 0 ? (
            <span className="text-ledger-red">
              +{result.comparison.percentVsNational}% above India&apos;s national per-capita target
            </span>
          ) : result.comparison.percentVsNational < 0 ? (
            <span className="text-moss">
              {result.comparison.percentVsNational}% below India&apos;s national per-capita target
            </span>
          ) : (
            <span>On par with India&apos;s national per-capita target</span>
          )}
        </p>
      </div>

      {/* Action button if requested */}
      {showSaveButton && onSave && (
        <button
          onClick={onSave}
          disabled={isSaving}
          className="mt-6 w-full py-2.5 px-4 bg-graphite hover:bg-graphite/95 active:bg-graphite text-paper font-display font-medium rounded transition duration-200 focus-ring cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-paper" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>SAVING RECORD...</span>
            </>
          ) : (
            <span>SAVE TO PERSONAL LEDGER</span>
          )}
        </button>
      )}
    </motion.div>
  );
}
