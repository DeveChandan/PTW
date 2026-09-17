import React, { useState } from 'react';
import { PermitType, RiskLevel } from '../../core/types/ptw.types';
import { Shield, AlertTriangle, HardHat, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

export const PermitsModule: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [permitType, setPermitType] = useState<PermitType>('HOT');
  const [severity, setSeverity] = useState<number>(3);
  const [likelihood, setLikelihood] = useState<number>(3);

  const riskScore = severity * likelihood;
  const getRiskLevel = (score: number): { label: RiskLevel; color: string } => {
    if (score <= 4) return { label: 'LOW', color: 'bg-green-100 text-green-800 border-green-300' };
    if (score <= 9) return { label: 'MED', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    if (score <= 14) return { label: 'HIGH', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: 'CRIT', color: 'bg-red-100 text-red-800 border-red-300' };
  };

  const risk = getRiskLevel(riskScore);

  return (
    <div className="space-y-6">
      {/* Developer Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-md flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-blue-900 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Developer 1 Module: PTW Core & Lifecycle Management</span>
          </h2>
          <p className="text-xs text-blue-700 mt-0.5">
            Owns: Multi-Step Permit Wizard, Hazard Checklist, PPE Grid, 5x5 Risk Assessment Matrix, and OData V4 Deep Insert.
          </p>
        </div>
        <span className="text-xs bg-blue-200 text-blue-800 px-2.5 py-1 rounded font-mono font-medium">
          src/features/permits/
        </span>
      </div>

      {/* Step Indicator */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {[
            { step: 1, title: '1. Work Details', icon: Shield },
            { step: 2, title: '2. Hazards & Controls', icon: AlertTriangle },
            { step: 3, title: '3. PPE Selection', icon: HardHat },
            { step: 4, title: '4. 5x5 Risk Matrix', icon: CheckCircle2 }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentStep === item.step;
            const isCompleted = currentStep > item.step;
            return (
              <button
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-sap-accent text-white shadow'
                    : isCompleted
                    ? 'text-green-700 bg-green-50 border border-green-200'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wizard Content Step */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Step 1: General Work Details & Equipment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Permit Type</label>
                <select
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value as PermitType)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="HOT">Hot Work (Welding / Cutting)</option>
                  <option value="COLD">Cold Work (Maintenance)</option>
                  <option value="CONF">Confined Space Entry</option>
                  <option value="ELEC">Electrical / High Voltage</option>
                  <option value="HGHT">Work at Height (&gt; 2m)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Plant Location</label>
                <input
                  type="text"
                  defaultValue="Plant 1000 - Refinery North"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Equipment / Tag ID</label>
                <input
                  type="text"
                  placeholder="e.g. PUMP-4021-B"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Work Description & Scope</label>
              <textarea
                rows={3}
                placeholder="Detailed description of hazardous work to be executed..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Step 2: Hazard Identification & Safety Measures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Flammable Atmosphere', cat: 'Thermal' },
                { title: 'Pressurized Pipe / Line Breaking', cat: 'Mechanical' },
                { title: 'Live Electrical Contact (> 440V)', cat: 'Electrical' },
                { title: 'Toxic Vapor (H2S / CO)', cat: 'Chemical' }
              ].map((h, idx) => (
                <div key={idx} className="border border-gray-200 p-3 rounded-lg flex items-start space-x-3 bg-gray-50">
                  <input type="checkbox" className="mt-1 h-4 w-4 text-blue-600 rounded" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{h.title}</p>
                    <p className="text-xs text-gray-500">Category: {h.cat}</p>
                    <input
                      type="text"
                      placeholder="Specify control measure / mitigation..."
                      className="mt-2 w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Step 3: Personal Protective Equipment (PPE)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                'Hard Hat', 'Safety Glasses', 'Ear Defenders', 'Steel Toe Boots',
                'Fire-Resistant Suit', 'Chemical Gloves', 'Respirator Mask', 'Safety Harness'
              ].map((ppe, idx) => (
                <label key={idx} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-blue-50 cursor-pointer">
                  <input type="checkbox" defaultChecked={idx < 4} className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">{ppe}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Step 4: Interactive 5x5 Risk Assessment Matrix</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Consequence / Severity (1 to 5)</span>
                    <span className="text-blue-600 font-bold">{severity}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>1: Negligible</span>
                    <span>3: Moderate</span>
                    <span>5: Catastrophic</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Likelihood / Probability (1 to 5)</span>
                    <span className="text-blue-600 font-bold">{likelihood}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={likelihood}
                    onChange={(e) => setLikelihood(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>1: Rare</span>
                    <span>3: Possible</span>
                    <span>5: Almost Certain</span>
                  </div>
                </div>
              </div>

              {/* Calculated Score Display */}
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Calculated Risk Level</p>
                <div className={`mt-2 inline-block px-4 py-2 rounded-full border text-lg font-bold ${risk.color}`}>
                  {risk.label} (Score: {riskScore} / 25)
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {riskScore >= 15 ? '⚠️ Mandatory Safety Officer & Area Lead sign-off required prior to issuance.' : 'Standard clearance protocol applies.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex justify-between border-t border-gray-200 pt-4 mt-6">
          <button
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(prev => Math.max(prev - 1, 1))}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 disabled:opacity-40"
          >
            Previous Step
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(prev => Math.min(prev + 1, 4))}
              className="px-4 py-2 bg-sap-accent text-white rounded text-sm flex items-center space-x-1 hover:bg-sap-hover"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => alert('OData V4 Mutation: POST /Permits with deep insert payload')}
              className="px-5 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700 shadow"
            >
              Submit Permit to SAP OData V4
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
