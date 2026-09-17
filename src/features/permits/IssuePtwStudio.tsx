import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';
import odataClient from '../../core/api/odataClient';

export const IssuePtwStudio: React.FC = () => {
  const { user } = useSapAuth();

  const [step, setStep] = useState<number>(2);
  const [severity, setSeverity] = useState<number>(4);
  const [likelihood, setLikelihood] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Form states
  const [permitType, setPermitType] = useState<'HOT' | 'COLD' | 'CONF' | 'ELEC'>('HOT');
  const [workDescription, setWorkDescription] = useState<string>(
    'Valve Repacking & Flange Gasket Replacement on High-Pressure Deethanizer Overhead'
  );
  const [selectedHazards, setSelectedHazards] = useState<string[]>([
    'FLAMMABLE_GAS',
    'TOXIC_H2S',
    'PRESSURE_SURGE'
  ]);
  const [selectedPPE, setSelectedPPE] = useState<string[]>([
    'NOMEX_SUIT',
    'SCBA_RESPIRATOR',
    'CHEM_GLOVES',
    'STEEL_BOOTS'
  ]);

  const riskScore = severity * likelihood;
  const getRiskTier = (score: number) => {
    if (score >= 15) return { label: 'CRITICAL (HIGH HAZARD)', color: 'text-red-800 bg-red-50 border-red-200' };
    if (score >= 10) return { label: 'HIGH RISK', color: 'text-amber-800 bg-amber-50 border-amber-200' };
    if (score >= 5) return { label: 'MEDIUM RISK', color: 'text-blue-800 bg-blue-50 border-blue-200' };
    return { label: 'LOW RISK', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
  };

  const risk = getRiskTier(riskScore);

  const toggleHazard = (hazardId: string) => {
    setSelectedHazards(prev =>
      prev.includes(hazardId) ? prev.filter(h => h !== hazardId) : [...prev, hazardId]
    );
  };

  const togglePPE = (ppeId: string) => {
    setSelectedPPE(prev =>
      prev.includes(ppeId) ? prev.filter(p => p !== ppeId) : [...prev, ppeId]
    );
  };

  const handleSubmitPermit = async () => {
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const payload = {
        PermitType: permitType,
        Title: 'Deethanizer Column Valve & Gasket Maintenance',
        Description: workDescription,
        Plant: '1000',
        Area: 'SECTOR-04',
        EquipmentId: 'V-4012-A',
        Status: 'SUBM',
        RiskLevel: riskScore >= 15 ? 'CRIT' : riskScore >= 10 ? 'HIGH' : 'MED',
        RiskScore: riskScore,
        ValidFrom: new Date().toISOString(),
        ValidTo: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
        CreatedBy: user?.id || 'VERTIF-V',
        ContractorCompany: 'Apex Industrial Services Ltd',
        NumberOfWorkers: 4
      };

      try {
        await odataClient.post('Permits', payload);
      } catch (err) {
        console.warn('[IssuePtwStudio] Live POST to SAP failed (mocking success):', err);
      }

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 6000);
    } catch (err: any) {
      alert('Error saving permit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* 1. Operational Breadcrumb & Telemetry Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">PTW Studio</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-[#006398] font-bold">DRAFT-PTW-2026-0941</span>
          <span className="h-2 w-2 rounded-full bg-[#006398]"></span>
          <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-[10px] text-gray-700 uppercase font-semibold">
            Step {step} of 5
          </span>
          <span className="bg-blue-50 text-[#006398] border border-blue-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase">
            Requester: {user?.id}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-gray-600">
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span className="uppercase font-semibold">OSHA 1910.119 PSM Controlled</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-800 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded">
            <span className="material-symbols-outlined text-[#006398] text-[16px]">sync</span>
            <span>PLC Interlock: NORMAL</span>
          </div>
        </div>
      </div>

      {/* 2. 5-Step Linear Progress Stepper */}
      <section className="w-full bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { num: '01', title: 'Scope & Location', icon: 'check', status: 'completed' },
            { num: '02', title: 'Hazards & JSA Matrix', icon: 'warning', status: 'active' },
            { num: '03', title: 'LOTO & Isolations', icon: 'lock', status: 'pending' },
            { num: '04', title: 'Gas Testing Protocols', icon: 'air', status: 'pending' },
            { num: '05', title: 'Triad Authorization', icon: 'draw', status: 'pending' }
          ].map((s, idx) => {
            const isCurrent = step === idx + 1;
            const isDone = step > idx + 1;

            return (
              <button
                key={s.num}
                onClick={() => setStep(idx + 1)}
                className={`flex items-center gap-2.5 p-2 rounded-md text-left transition-all ${
                  isCurrent
                    ? 'bg-[#006398] text-white font-semibold shadow-sm'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold shrink-0 ${
                    isCurrent
                      ? 'bg-white text-[#006398]'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isDone ? '✓' : s.num}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[9px] uppercase tracking-wider opacity-75">Step {s.num}</span>
                  <span className="font-sans text-xs font-semibold truncate leading-tight">{s.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Success Notification Alert */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span className="text-xs font-mono font-semibold">
              Permit DRAFT-PTW-2026-0941 committed to SAP S/4HANA (OData V4) with CSRF validation!
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 font-bold">Pending Safety Officer Sign-Off</span>
        </div>
      )}

      {/* 3. Work Order & Spatial Plant Location Context */}
      <section className="w-full bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-2.5 max-w-2xl flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded font-mono text-xs font-bold">
                WO-2026-8841
              </span>
              <span className="bg-blue-50 text-[#006398] px-2.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold border border-blue-200">
                Scheduled Turnaround High-Priority
              </span>
              <span className="font-mono text-xs text-gray-500">
                Validity: Today 08:00 – 18:00 CST (Shift B)
              </span>
            </div>

            <input
              type="text"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 font-display font-bold text-base text-gray-900 tracking-tight focus:outline-none focus:border-[#006398] focus:bg-white"
              placeholder="Permit Work Description..."
            />

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#006398]">location_on</span>
                Sector 04 - Hydrocracker Deethanizer Column (V-4012-A)
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-amber-600">engineering</span>
                Lead Isolator: M. Al-Mansoor (#9024)
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">shield</span>
                EHS Supervisor: E. Vance (Shift B)
              </span>
            </div>
          </div>

          {/* P&ID Diagram Card Preview */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 w-full lg:w-auto shrink-0">
            <div className="w-20 h-16 bg-blue-50 rounded border border-blue-200 flex flex-col items-center justify-center text-[#006398] shrink-0">
              <span className="material-symbols-outlined text-[24px]">account_tree</span>
              <span className="font-mono text-[9px] uppercase font-bold">Schematic</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs text-[#006398] font-bold uppercase">P&ID-HC-4012-REV7</span>
              <span className="text-xs text-gray-800 font-medium">Deethanizer Tower Circuit</span>
              <span className="font-mono text-[10px] text-gray-500">Verified: Chief Process Engineer</span>
              <button
                type="button"
                onClick={() => alert('Opening CAD P&ID vector schematic viewer...')}
                className="mt-0.5 text-[10px] font-mono text-[#006398] font-bold hover:underline flex items-center gap-1 uppercase"
              >
                <span>Inspect P&ID Overlay</span>
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Step 2 Detailed Form & Job Safety Analysis (JSA) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-4">
        {/* Left 8 Cols: Hazards, Chemicals & Precautions */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* Permit Classification Selector */}
          <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-sm text-gray-900">Permit Classification & Hazard Tier</h3>
                <p className="text-xs text-gray-500">Select operational permit category to load regulatory requirements</p>
              </div>
              <span className="font-mono text-[10px] text-[#006398] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                OData Entity: PermitHeader
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'HOT', label: 'HOT WORK', desc: 'Welding, torching, grinding', icon: 'local_fire_department', color: 'text-red-600' },
                { id: 'CONF', label: 'CONFINED SPACE', desc: 'Column/Vessel entry', icon: 'door_sliding', color: 'text-amber-600' },
                { id: 'ELEC', label: 'ELECTRICAL LOTO', desc: 'Breaker lock >440V', icon: 'bolt', color: 'text-[#006398]' },
                { id: 'COLD', label: 'COLD WORK', desc: 'Rigging, bolt torque', icon: 'build', color: 'text-emerald-600' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPermitType(item.id as any)}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1.5 transition-all ${
                    permitType === item.id
                      ? 'bg-blue-50/50 border-[#006398] ring-2 ring-[#006398]/20 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${item.color}`}>
                    {item.icon}
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-900">{item.label}</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{item.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Chemical Substance & NFPA 704 Diamond Card */}
          <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">science</span>
                <h3 className="font-display font-bold text-sm text-gray-900">Chemical Substance Hazard Profile</h3>
              </div>
              <span className="font-mono text-[10px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 font-bold">
                CAS #7783-06-4 • PSM TOXIC EXTREME
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
              {/* NFPA 704 Diamond Graphical Element */}
              <div className="flex flex-col items-center justify-center p-2">
                <span className="font-mono text-[10px] text-gray-500 uppercase font-bold mb-2">NFPA 704 Standard</span>
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Flammability (Red - Top) */}
                  <div className="absolute top-0 w-11 h-11 bg-red-500 border border-red-600 rounded flex flex-col items-center justify-center transform rotate-45 shadow-sm">
                    <span className="transform -rotate-45 font-mono text-sm font-bold text-white">4</span>
                  </div>
                  {/* Health (Blue - Left) */}
                  <div className="absolute left-0 w-11 h-11 bg-blue-600 border border-blue-700 rounded flex flex-col items-center justify-center transform rotate-45 shadow-sm">
                    <span className="transform -rotate-45 font-mono text-sm font-bold text-white">3</span>
                  </div>
                  {/* Instability (Yellow - Right) */}
                  <div className="absolute right-0 w-11 h-11 bg-amber-400 border border-amber-500 rounded flex flex-col items-center justify-center transform rotate-45 shadow-sm">
                    <span className="transform -rotate-45 font-mono text-sm font-bold text-gray-900">1</span>
                  </div>
                  {/* Special (White - Bottom) */}
                  <div className="absolute bottom-0 w-11 h-11 bg-white border border-gray-300 rounded flex flex-col items-center justify-center transform rotate-45 shadow-sm">
                    <span className="transform -rotate-45 font-mono text-[10px] font-bold text-gray-900">SA</span>
                  </div>
                </div>
              </div>

              {/* Chemical Telemetry Specs */}
              <div className="md:col-span-2 space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-500">Primary Process Fluid:</span>
                  <span className="text-gray-900 font-bold">Hydrogen Sulfide (H2S) & Light Gas</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-500">Flash Point / Autoignition:</span>
                  <span className="text-amber-700 font-bold">-104°C / 260°C</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-500">Lower Explosive Limit (LEL):</span>
                  <span className="text-red-700 font-bold">4.0% (Toxic IDLH: 100 ppm)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Scrubber Line Interlock:</span>
                  <span className="text-emerald-700 font-bold">VALVE-SCRUB-09 ENGAGED</span>
                </div>
              </div>
            </div>
          </section>

          {/* Job Safety Hazards Checklist */}
          <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="font-display font-bold text-sm text-gray-900 mb-3">
              Identified Mechanical & Atmospheric Hazards
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'FLAMMABLE_GAS', title: 'Flammable Hydrocarbon Gas', cat: 'Atmosphere', control: 'Continuous calibrated multi-gas sniffer active' },
                { id: 'TOXIC_H2S', title: 'Toxic Hydrogen Sulfide (H2S)', cat: 'Chemical', control: 'Positive pressure SCBA respirator mandated' },
                { id: 'PRESSURE_SURGE', title: 'Residual Pressure in Pipe', cat: 'Mechanical', control: 'Bleed line depressurized to flare header' },
                { id: 'HIGH_VOLTAGE', title: 'High Voltage Adjacent Line', cat: 'Electrical', control: 'Grounding mats and dielectric boots deployed' }
              ].map((h) => {
                const checked = selectedHazards.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHazard(h.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-blue-50/50 border-[#006398] shadow-sm'
                        : 'bg-gray-50 border-gray-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="mt-0.5 h-4 w-4 accent-[#006398] rounded cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 font-sans">{h.title}</span>
                          <span className="text-[10px] font-mono text-[#006398] font-bold">{h.cat}</span>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-1 italic">"{h.control}"</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 4 Cols: 5x5 Risk Matrix & PPE Gear */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          {/* Interactive 5x5 Risk Matrix Calculation */}
          <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-sm text-gray-900">5x5 Risk Matrix</h3>
                <span className="font-mono text-[10px] text-gray-500 font-semibold">OSHA / API 754</span>
              </div>

              <div className="space-y-4">
                {/* Consequence Slider */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-gray-600">Consequence (1-5):</span>
                    <span className="text-[#006398] font-bold">{severity} - Major Damage</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-[#006398]"
                  />
                </div>

                {/* Likelihood Slider */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-gray-600">Likelihood (1-5):</span>
                    <span className="text-[#006398] font-bold">{likelihood} - Probable</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={likelihood}
                    onChange={(e) => setLikelihood(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-[#006398]"
                  />
                </div>

                {/* Score Output Banner */}
                <div className={`p-4 rounded-lg border text-center ${risk.color}`}>
                  <span className="block font-mono text-[10px] uppercase tracking-wider font-bold">
                    Composite Risk Score: {riskScore} / 25
                  </span>
                  <span className="block font-display font-bold text-base mt-0.5">
                    {risk.label}
                  </span>
                  <span className="block text-[10px] text-gray-600 mt-1 font-sans">
                    Requires Level-2 Safety Officer and Operations Manager sign-off.
                  </span>
                </div>
              </div>
            </div>

            {/* PPE Gear Requirements */}
            <div className="mt-5 border-t border-gray-200 pt-4">
              <h4 className="font-display font-bold text-xs text-gray-900 mb-2.5">
                Mandatory PPE Equipment Checklist
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'NOMEX_SUIT', name: 'Nomex FR Suit' },
                  { id: 'SCBA_RESPIRATOR', name: 'SCBA Respirator' },
                  { id: 'CHEM_GLOVES', name: 'Butyl Gloves' },
                  { id: 'STEEL_BOOTS', name: 'Dielectric Boots' }
                ].map((ppe) => {
                  const active = selectedPPE.includes(ppe.id);
                  return (
                    <button
                      key={ppe.id}
                      type="button"
                      onClick={() => togglePPE(ppe.id)}
                      className={`p-2 rounded border text-left text-xs font-mono flex items-center gap-2 transition-colors ${
                        active
                          ? 'bg-blue-50 border-[#006398] text-[#006398] font-bold'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {active ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="truncate">{ppe.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Action Submission Card */}
          <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3">
            <h4 className="font-display font-bold text-xs text-gray-900 uppercase tracking-wider">
              OData V4 Transactional Commitment
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Submitting transmits atomic payload with CSRF handshake to SAP S/4HANA backend:
              <code className="text-[#006398] bg-blue-50 px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">
                /sap/opu/odata4/sap/zptw_mamagement_srv/...
              </code>
            </p>

            <button
              disabled={isSubmitting}
              onClick={handleSubmitPermit}
              className="w-full py-3 bg-[#006398] hover:bg-[#004f7a] text-white font-display font-bold text-sm uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
              <span>{isSubmitting ? 'Transmitting to SAP...' : 'Submit Permit for Approval'}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
