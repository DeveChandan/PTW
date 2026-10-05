import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { GasTestRecord } from '../../core/types/ptw.types';
import { gasTesterApi, AtmosphereAssessment } from '../../core/api/modules/gasTester.api';

interface GasTesterWorkspaceProps {
  user: SapUser | null;
  onBack: () => void;
}

export const GasTesterWorkspace: React.FC<GasTesterWorkspaceProps> = ({ user, onBack }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [gasTests, setGasTests] = useState<GasTestRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<GasTestRecord | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(false);

  // New Gas Test Form State
  const [formPermitNo, setFormPermitNo] = useState<string>('PTW0000013');
  const [formTestSeq, setFormTestSeq] = useState<string>('1');
  const [formTestType, setFormTestType] = useState<string>('INIT');
  const [formSampleLevel, setFormSampleLevel] = useState<string>('MID');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formMeterType, setFormMeterType] = useState<string>('Multi-Gas 4-in-1 MX4');
  const [formMeterId, setFormMeterId] = useState<string>('MTR-GFL-014');
  const [formCalibDate, setFormCalibDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formBumpTestOk, setFormBumpTestOk] = useState<boolean>(true);
  const [formO2, setFormO2] = useState<number>(20.9);
  const [formLel, setFormLel] = useState<number>(0.0);
  const [formCo, setFormCo] = useState<number>(0.0);
  const [formH2s, setFormH2s] = useState<number>(0.0);
  const [formOtherGas, setFormOtherGas] = useState<string>('');
  const [formOtherVal, setFormOtherVal] = useState<number>(0.0);
  const [formOtherUnit, setFormOtherUnit] = useState<string>('PPM');
  const [formCert, setFormCert] = useState<string>('AGT-GFL-2026-08');
  const [formSigned, setFormSigned] = useState<boolean>(true);
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isHotWorkMode, setIsHotWorkMode] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load live tests from SAP
  const loadGasTests = async (permitFilter?: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    try {
      const data = await gasTesterApi.list(permitFilter, controller.signal);
      if (!controller.signal.aborted) {
        setGasTests(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setNotification({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to fetch gas test records from SAP Gateway.'
        });
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadGasTests();
    return () => abortControllerRef.current?.abort();
  }, []);

  // Compute next sequence for a permit
  const handlePermitNoChange = (newPermitNo: string) => {
    setFormPermitNo(newPermitNo);
    const existing = gasTests.filter(t => t.PermitNo.toUpperCase() === newPermitNo.trim().toUpperCase());
    if (existing.length > 0) {
      const maxSeq = Math.max(...existing.map(t => parseInt(t.TestSeq, 10) || 0));
      setFormTestSeq(String(maxSeq + 1));
      if (maxSeq >= 1) {
        setFormTestType('RETEST');
      }
    } else {
      setFormTestSeq('1');
      setFormTestType('INIT');
    }
  };

  // Open modal with pre-filled permit
  const handleRetestClick = (record: GasTestRecord) => {
    handlePermitNoChange(record.PermitNo);
    setFormLocation(record.TestLocation || '');
    setFormMeterType(record.MeterType || 'Multi-Gas 4-in-1 MX4');
    setFormMeterId(record.MeterId || 'MTR-GFL-014');
    setFormTestType('RETEST');
    setShowCreateModal(true);
  };

  // Real-time atmosphere assessment of the active form input
  const liveFormAssessment: AtmosphereAssessment = useMemo(() => {
    return gasTesterApi.evaluateAtmosphere(
      {
        O2Pct: formO2,
        LelPct: formLel,
        CoVal: formCo,
        H2sVal: formH2s,
        OtherGas: formOtherGas,
        OtherVal: formOtherVal,
        OtherUnit: formOtherUnit
      },
      isHotWorkMode
    );
  }, [formO2, formLel, formCo, formH2s, formOtherGas, formOtherVal, formOtherUnit, isHotWorkMode]);

  // Filtered tests
  const filteredTests = useMemo(() => {
    return gasTests.filter(test => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        test.PermitNo.toLowerCase().includes(q) ||
        (test.TestLocation && test.TestLocation.toLowerCase().includes(q)) ||
        (test.MeterId && test.MeterId.toLowerCase().includes(q)) ||
        (test.TestedBy && test.TestedBy.toLowerCase().includes(q)) ||
        (test.Remarks && test.Remarks.toLowerCase().includes(q));

      // Type Filter
      const matchType = typeFilter === 'ALL' || test.TestType === typeFilter;

      // Sample Level Filter
      const matchLevel = levelFilter === 'ALL' || test.SampleLevel === levelFilter;

      // Safety Status Filter
      if (statusFilter !== 'ALL') {
        const assessment = gasTesterApi.evaluateAtmosphere(test);
        if (statusFilter === 'SAFE' && assessment.overallStatus !== 'SAFE') return false;
        if (statusFilter === 'WARNING' && assessment.overallStatus !== 'WARNING') return false;
        if (statusFilter === 'DANGER' && assessment.overallStatus !== 'DANGER') return false;
      }

      return matchSearch && matchType && matchLevel;
    });
  }, [gasTests, searchQuery, typeFilter, levelFilter, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let safeCount = 0;
    let warningCount = 0;
    let dangerCount = 0;

    gasTests.forEach(test => {
      const assessment = gasTesterApi.evaluateAtmosphere(test);
      if (assessment.overallStatus === 'SAFE') safeCount++;
      else if (assessment.overallStatus === 'WARNING') warningCount++;
      else dangerCount++;
    });

    return {
      total: gasTests.length,
      safe: safeCount,
      warning: warningCount,
      danger: dangerCount
    };
  }, [gasTests]);

  // Form submission handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPermitNo.trim()) {
      setNotification({ type: 'error', text: 'Permit Number is required.' });
      return;
    }
    if (!formSigned) {
      setNotification({ type: 'error', text: 'Authorized Gas Tester signature confirmation is mandatory.' });
      return;
    }
    if (!formBumpTestOk) {
      setNotification({ type: 'error', text: 'Bump test must be verified before submitting gas clearance.' });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const newRecord: Partial<GasTestRecord> = {
        PermitNo: formPermitNo.trim().toUpperCase(),
        TestSeq: formTestSeq.trim() || '1',
        TestType: formTestType,
        TestDate: new Date().toISOString().split('T')[0],
        TestTime: new Date().toTimeString().split(' ')[0],
        TestLocation: formLocation.trim(),
        SampleLevel: formSampleLevel,
        TestedBy: user?.id || 'AGT-TESTER',
        Cert: formCert.trim(),
        MeterType: formMeterType.trim(),
        MeterId: formMeterId.trim(),
        CalibDate: formCalibDate,
        BumpTestOk: formBumpTestOk ? 'Y' : 'N',
        LelPct: Number(formLel),
        O2Pct: Number(formO2),
        CoVal: Number(formCo),
        H2sVal: Number(formH2s),
        OtherGas: formOtherGas.trim(),
        OtherVal: Number(formOtherVal),
        OtherUnit: formOtherUnit.trim() || 'PPM',
        TesterSigned: formSigned ? 'Y' : 'N',
        Remarks: formRemarks.trim()
      };

      const result = await gasTesterApi.create(newRecord);
      setGasTests(prev => [result, ...prev.filter(t => !(t.PermitNo === result.PermitNo && t.TestSeq === result.TestSeq))]);

      setShowCreateModal(false);
      setNotification({
        type: 'success',
        text: `Gas test record #${result.TestSeq} for ${result.PermitNo} successfully submitted to SAP S/4HANA!`
      });
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save Gas Test record.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 shadow-xs transition hover:border-[#006398] hover:text-[#006398]"
            >
              <span className="material-symbols-outlined text-[15px] group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
              <span>Launchpad</span>
            </button>
            <span>/</span>
            <span className="text-slate-400">PTW Suite</span>
            <span>/</span>
            <span className="text-[#006398] font-bold">Gas Tester</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#006398] border border-blue-100 shadow-xs">
              <span className="material-symbols-outlined text-[26px]">air</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Gas Tester Workspace
                <span className="text-xs font-mono font-medium bg-blue-100/70 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                  OData V4: GasTest
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Atmospheric Oxygen, Combustible % LEL, Carbon Monoxide & Hydrogen Sulfide Verification
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowGuidelines(!showGuidelines)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition shadow-xs ${
              showGuidelines
                ? 'border-blue-400 bg-blue-50 text-[#006398]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">verified_user</span>
            <span>{showGuidelines ? 'Hide Gas Limits' : 'Gas Safety Limits'}</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadGasTests()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:border-[#006398] hover:text-[#006398] disabled:opacity-50 transition"
            title="Reload from SAP Gateway"
          >
            <span className={`material-symbols-outlined text-[17px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handlePermitNoChange('PTW0000013');
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white px-4 py-2 text-xs font-semibold shadow-xs transition active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Record Gas Test</span>
          </button>
        </div>
      </header>

      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-start justify-between gap-3 p-4 rounded-xl border text-sm transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              {notification.type === 'success' ? 'check_circle' : notification.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Comprehensive Gas Safety Thresholds Guide Banner (Collapsible) */}
      {showGuidelines && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-[22px]">policy</span>
              <h3 className="font-bold text-sm text-slate-900">
                GFL Dahej PTW Safety Manual · Atmospheric Acceptance Thresholds (HSE/SAF/02)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Rev 08 Mandatory Matrix
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* O2 Rule */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-900">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Oxygen (O₂)
                </span>
                <span className="font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">19.5% – 23.5%</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Normal air is <strong>20.9%</strong>. Deficiency below <strong>19.5%</strong> causes asphyxiation. Enrichment above <strong>23.5%</strong> creates catastrophic flammability.
              </p>
            </div>

            {/* LEL Rule */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-amber-900">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  Combustible (% LEL)
                </span>
                <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">0.0% / &lt; 5%</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Hot work demands strictly <strong>0.0% LEL</strong>. Vessel entry allowed only under <strong>5% LEL</strong> with forced ventilation. Above <strong>10%</strong> is immediate explosive hazard.
              </p>
            </div>

            {/* CO Rule */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-blue-900">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Carbon Monoxide (CO)
                </span>
                <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">&lt; 25 ppm</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Colorless, odorless gas. Permissible Exposure Limit (PEL) is <strong>&lt; 25 ppm</strong>. Concentrations above 25 ppm cause severe chemical asphyxiation.
              </p>
            </div>

            {/* H2S Rule */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-purple-900">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                  Hydrogen Sulfide (H₂S)
                </span>
                <span className="font-mono bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">&lt; 5.0 ppm</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Extremely toxic sour gas with olfactory paralysis. Strict ceiling is <strong>&lt; 5 ppm</strong>. At ≥ 10 ppm, entry is strictly forbidden.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-500">timer</span>
              <span>
                <strong>Freshness Requirement:</strong> Initial gas test valid for 2 hours. Mandatory retesting required every 2 hours or after work pause &gt; 1 hour.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-500">layers</span>
              <span>
                <strong>Stratified Sampling:</strong> Confined space vessels require testing at TOP, MID, and BOT levels due to vapor density differences.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* KPI Metric Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Tests Logged</span>
            <span className="material-symbols-outlined text-[18px] text-blue-600">assessment</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{metrics.total}</div>
          <div className="mt-1 text-[11px] text-slate-500">Live in SAP S/4HANA GasTest</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>Clear / Safe Tests</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700">{metrics.safe}</div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">All 4 gas parameters in safe band</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
            <span>Caution / Alerts</span>
            <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-700">{metrics.warning}</div>
          <div className="mt-1 text-[11px] text-amber-600 font-medium">Trace combustible / low O2 detected</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 text-xs font-medium">
            <span>Hazardous / Inhibit</span>
            <span className="material-symbols-outlined text-[18px] text-rose-600">block</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-700">{metrics.danger}</div>
          <div className="mt-1 text-[11px] text-rose-600 font-medium">Threshold breached; work prohibited</div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by Permit #, Location, Detector ID, or Tester..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398] transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
            >
              <option value="ALL">All Test Types</option>
              <option value="INIT">Initial Test (INIT)</option>
              <option value="RETEST">Periodic Retest (RETEST)</option>
              <option value="CONT">Continuous (CONT)</option>
            </select>

            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
            >
              <option value="ALL">All Sampling Levels</option>
              <option value="TOP">TOP (Light Gases)</option>
              <option value="MID">MID (Breathing Zone)</option>
              <option value="BOT">BOT (Heavy Gases)</option>
            </select>

            {/* Safety Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
            >
              <option value="ALL">All Safety Outcomes</option>
              <option value="SAFE">Safe / Approved Only</option>
              <option value="WARNING">Caution / Trace Only</option>
              <option value="DANGER">Hazardous / Inhibit Only</option>
            </select>

            {(searchQuery || typeFilter !== 'ALL' || levelFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
                  setLevelFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Gas Test Records Table */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500 text-[18px]">table_rows</span>
            <h2 className="text-sm font-bold text-slate-800">
              Atmospheric Test Register ({filteredTests.length} records)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Entity Set: <code className="text-[#006398]">GasTest</code>
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
            <div className="w-7 h-7 border-2 border-[#006398] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono">Querying SAP S/4HANA OData GasTest records...</span>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="text-center p-12 space-y-2">
            <span className="material-symbols-outlined text-[42px] text-slate-300">air</span>
            <p className="text-sm font-semibold text-slate-700">No atmospheric test logs match your filter</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or record a new gas test.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Permit &amp; Seq</th>
                  <th className="py-3 px-3">Type &amp; Level</th>
                  <th className="py-3 px-3">Date &amp; Time (IST)</th>
                  <th className="py-3 px-3 text-center">Oxygen (O₂)</th>
                  <th className="py-3 px-3 text-center">Combustible (% LEL)</th>
                  <th className="py-3 px-3 text-center">CO (ppm)</th>
                  <th className="py-3 px-3 text-center">H₂S (ppm)</th>
                  <th className="py-3 px-3 text-center">Overall Clearance</th>
                  <th className="py-3 px-3">Detector &amp; Bump</th>
                  <th className="py-3 px-3">Tester &amp; Sign</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTests.map((test, idx) => {
                  const assessment = gasTesterApi.evaluateAtmosphere(test);

                  return (
                    <tr
                      key={`${test.PermitNo}-${test.TestSeq}-${idx}`}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Permit & Seq */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-[#006398]">{test.PermitNo}</div>
                        <div className="text-[11px] text-slate-400">Seq #{test.TestSeq}</div>
                      </td>

                      {/* Type & Level */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              test.TestType === 'INIT'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : test.TestType === 'RETEST'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {test.TestType || 'INIT'}
                          </span>

                          <span
                            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                              test.SampleLevel === 'TOP'
                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                : test.SampleLevel === 'BOT'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                            title={`Stratified level: ${test.SampleLevel}`}
                          >
                            {test.SampleLevel === 'TOP'
                              ? '▲ TOP (Light)'
                              : test.SampleLevel === 'BOT'
                              ? '▼ BOT (Heavy)'
                              : '◆ MID (Zone)'}
                          </span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        <div>{test.TestDate || '—'}</div>
                        <div className="text-[11px] text-slate-400">{test.TestTime || '—'}</div>
                        {test.TestLocation && (
                          <div
                            className="text-[10px] text-slate-500 truncate max-w-[140px] mt-0.5"
                            title={test.TestLocation}
                          >
                            {test.TestLocation}
                          </div>
                        )}
                      </td>

                      {/* O2 Concentration with Color Indication */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full border text-[11px] ${assessment.o2.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${assessment.o2.dotClass}`}></span>
                            {Number(test.O2Pct).toFixed(2)}%
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{assessment.o2.label}</span>
                        </div>
                      </td>

                      {/* Combustible % LEL with Color Indication */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full border text-[11px] ${assessment.lel.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${assessment.lel.dotClass}`}></span>
                            {Number(test.LelPct).toFixed(2)}%
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{assessment.lel.label}</span>
                        </div>
                      </td>

                      {/* CO ppm with Color Indication */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full border text-[11px] ${assessment.co.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${assessment.co.dotClass}`}></span>
                            {Number(test.CoVal).toFixed(2)} ppm
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{assessment.co.label}</span>
                        </div>
                      </td>

                      {/* H2S ppm with Color Indication */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full border text-[11px] ${assessment.h2s.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${assessment.h2s.dotClass}`}></span>
                            {Number(test.H2sVal).toFixed(2)} ppm
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{assessment.h2s.label}</span>
                        </div>
                      </td>

                      {/* Overall Clearance Result */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                            assessment.overallStatus === 'SAFE'
                              ? 'bg-emerald-100/70 text-emerald-800 border-emerald-300'
                              : assessment.overallStatus === 'WARNING'
                              ? 'bg-amber-100/70 text-amber-800 border-amber-300'
                              : 'bg-rose-100/70 text-rose-800 border-rose-300 animate-pulse'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {assessment.overallStatus === 'SAFE'
                              ? 'verified'
                              : assessment.overallStatus === 'WARNING'
                              ? 'warning'
                              : 'dangerous'}
                          </span>
                          {assessment.overallStatus === 'SAFE'
                            ? 'Cleared'
                            : assessment.overallStatus === 'WARNING'
                            ? 'Caution'
                            : 'Inhibited'}
                        </span>
                      </td>

                      {/* Detector & Bump Test */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-slate-700 font-medium truncate max-w-[120px]">
                          {test.MeterId || '—'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] mt-0.5">
                          <span
                            className={`font-semibold ${
                              test.BumpTestOk === 'Y' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {test.BumpTestOk === 'Y' ? '✓ Bump OK' : '✗ Bump Fail'}
                          </span>
                        </div>
                      </td>

                      {/* Tester & Sign */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-slate-800 font-semibold">{test.TestedBy || '—'}</div>
                        <div className="text-[10px] text-slate-400">{test.Cert || 'Cert Pending'}</div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          {test.TesterSigned === 'Y' && <span>✓ Signed</span>}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(test)}
                            className="p-1.5 text-slate-500 hover:text-[#006398] hover:bg-blue-50 rounded-lg transition"
                            title="Inspect Test Certificate"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRetestClick(test)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Perform Retest for this Permit"
                          >
                            <span className="material-symbols-outlined text-[17px]">replay</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Record New Gas Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-[#006398]">
                  <span className="material-symbols-outlined text-[20px]">detector_smoke</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Record Atmospheric Gas Test</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Direct POST to SAP Entity Set: <span className="text-[#006398] font-bold">GasTest</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
              {/* Hot Work Toggle Bar */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900">
                  <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
                  <span className="font-semibold">Hot Work Permit Mode (Strict 0.00% LEL Requirement)</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={isHotWorkMode}
                    onChange={e => setIsHotWorkMode(e.target.checked)}
                    className="h-4 w-4 rounded text-[#006398] focus:ring-[#006398]"
                  />
                  <span>Enforce Nil Flammable</span>
                </label>
              </div>

              {/* Permit & Test Context */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Permit Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPermitNo}
                    onChange={e => handlePermitNoChange(e.target.value)}
                    placeholder="e.g. PTW0000013"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold uppercase focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Test Sequence <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTestSeq}
                    onChange={e => setFormTestSeq(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Test Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formTestType}
                    onChange={e => setFormTestType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                  >
                    <option value="INIT">Initial Gas Test (INIT)</option>
                    <option value="RETEST">Periodic Retest (RETEST)</option>
                    <option value="CONT">Continuous Monitoring (CONT)</option>
                  </select>
                </div>
              </div>

              {/* Location & Sampling Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Test Location / Equipment Specifics <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vessel V-101 Interior / Bottom Sump"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stratified Sampling Level <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'TOP', label: '▲ TOP', sub: 'CH4, H2, CO' },
                      { id: 'MID', label: '◆ MID', sub: 'Breathing' },
                      { id: 'BOT', label: '▼ BOT', sub: 'H2S, LEL, Cl2' }
                    ].map(lvl => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setFormSampleLevel(lvl.id)}
                        className={`p-2 rounded-xl border text-center transition ${
                          formSampleLevel === lvl.id
                            ? 'bg-[#006398] text-white border-[#006398] font-bold shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs">{lvl.label}</div>
                        <div className="text-[9px] opacity-80">{lvl.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* REAL-TIME GAS SENSOR MEASUREMENTS & LIVE COLOR INDICATIONS */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-[#006398]">sensors</span>
                    Gas Concentration Measurements &amp; Safety Limits
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">Live Indicator Evaluation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 1. Oxygen (O2 %) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">
                        Oxygen (O₂) <span className="text-slate-400 font-normal">% v/v</span>
                      </label>
                      <span className="font-mono text-[10px] text-slate-400">Target: 20.9% (19.5 - 23.5)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={formO2}
                        onChange={e => setFormO2(parseFloat(e.target.value) || 0)}
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-sm focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                      />
                      <span
                        className={`flex-1 text-center py-1 px-2 rounded-lg font-bold text-[10px] border truncate ${liveFormAssessment.o2.badgeClass}`}
                      >
                        {liveFormAssessment.o2.label}
                      </span>
                    </div>

                    {/* Clear safety message */}
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {liveFormAssessment.o2.message}
                    </p>
                  </div>

                  {/* 2. Flammable / Combustible (% LEL) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">
                        Combustible Gas (% LEL)
                      </label>
                      <span className="font-mono text-[10px] text-slate-400">Target: 0.00%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={formLel}
                        onChange={e => setFormLel(parseFloat(e.target.value) || 0)}
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-sm focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                      />
                      <span
                        className={`flex-1 text-center py-1 px-2 rounded-lg font-bold text-[10px] border truncate ${liveFormAssessment.lel.badgeClass}`}
                      >
                        {liveFormAssessment.lel.label}
                      </span>
                    </div>

                    {/* Clear safety message */}
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {liveFormAssessment.lel.message}
                    </p>
                  </div>

                  {/* 3. Carbon Monoxide (CO ppm) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">
                        Carbon Monoxide (CO) <span className="text-slate-400 font-normal">ppm</span>
                      </label>
                      <span className="font-mono text-[10px] text-slate-400">Limit: &lt; 25.0 ppm</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formCo}
                        onChange={e => setFormCo(parseFloat(e.target.value) || 0)}
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-sm focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                      />
                      <span
                        className={`flex-1 text-center py-1 px-2 rounded-lg font-bold text-[10px] border truncate ${liveFormAssessment.co.badgeClass}`}
                      >
                        {liveFormAssessment.co.label}
                      </span>
                    </div>

                    {/* Clear safety message */}
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {liveFormAssessment.co.message}
                    </p>
                  </div>

                  {/* 4. Hydrogen Sulfide (H2S ppm) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">
                        Hydrogen Sulfide (H₂S) <span className="text-slate-400 font-normal">ppm</span>
                      </label>
                      <span className="font-mono text-[10px] text-slate-400">Limit: &lt; 5.0 ppm</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formH2s}
                        onChange={e => setFormH2s(parseFloat(e.target.value) || 0)}
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-sm focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                      />
                      <span
                        className={`flex-1 text-center py-1 px-2 rounded-lg font-bold text-[10px] border truncate ${liveFormAssessment.h2s.badgeClass}`}
                      >
                        {liveFormAssessment.h2s.label}
                      </span>
                    </div>

                    {/* Clear safety message */}
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {liveFormAssessment.h2s.message}
                    </p>
                  </div>
                </div>

                {/* Optional Toxic / Other Chemical Gas */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-700 mb-2">Optional Specific Chemical Toxic Gas</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <input
                        type="text"
                        placeholder="Gas Name (e.g. SO2, Cl2, NH3)"
                        value={formOtherGas}
                        onChange={e => setFormOtherGas(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 uppercase font-mono"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Value (e.g. 0.00)"
                        value={formOtherVal}
                        onChange={e => setFormOtherVal(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <select
                        value={formOtherUnit}
                        onChange={e => setFormOtherUnit(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200"
                      >
                        <option value="PPM">PPM</option>
                        <option value="%">%</option>
                        <option value="MG/M3">MG/M3</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Live Comprehensive Atmosphere Clearance Summary Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${liveFormAssessment.bannerClass}`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {liveFormAssessment.overallStatus === 'SAFE'
                      ? 'verified_user'
                      : liveFormAssessment.overallStatus === 'WARNING'
                      ? 'warning'
                      : 'dangerous'}
                  </span>
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide">
                      {liveFormAssessment.summaryTitle}
                    </h5>
                    <p className="text-[11px] mt-0.5 leading-relaxed">
                      {liveFormAssessment.summaryMessage}
                    </p>
                  </div>
                </div>
              </div>

              {/* Equipment Integrity & Bump Test */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-[#006398]">hardware</span>
                  Detector Integrity &amp; Calibration Check
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gas Detector Model</label>
                    <input
                      type="text"
                      value={formMeterType}
                      onChange={e => setFormMeterType(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Meter Serial / Tag ID</label>
                    <input
                      type="text"
                      required
                      value={formMeterId}
                      onChange={e => setFormMeterId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Calibration Date</label>
                    <input
                      type="date"
                      required
                      value={formCalibDate}
                      onChange={e => setFormCalibDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={formBumpTestOk}
                      onChange={e => setFormBumpTestOk(e.target.checked)}
                      className="h-4 w-4 rounded text-[#006398] focus:ring-[#006398]"
                    />
                    <span>Pre-Use Bump Test Completed &amp; Verified Successfully</span>
                  </label>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      formBumpTestOk
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {formBumpTestOk ? '✓ Bump Test Passed' : '✗ Required'}
                  </span>
                </div>
              </div>

              {/* Tester Sign-off & Remarks */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">AGT Certificate #</label>
                    <input
                      type="text"
                      value={formCert}
                      onChange={e => setFormCert(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Authorized Tester ID</label>
                    <input
                      type="text"
                      readOnly
                      value={user?.id || 'AGT-TESTER'}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Atmospheric Remarks &amp; Ventilation Plan</label>
                  <textarea
                    rows={2}
                    placeholder="Enter observations, ventilation details, blower rate, or hold notices..."
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                  ></textarea>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900">
                    <input
                      type="checkbox"
                      checked={formSigned}
                      onChange={e => setFormSigned(e.target.checked)}
                      className="h-4 w-4 rounded text-[#006398] focus:ring-[#006398]"
                    />
                    <span>Digital Sign-off: I certify atmospheric readings were physically sampled on site</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#006398] font-bold">AGT Verified</span>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !formBumpTestOk || !formSigned}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white font-bold shadow-xs disabled:opacity-50 transition active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting to SAP...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[17px]">send</span>
                      <span>Submit Gas Clearance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Single Test Certificate Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Gas Clearance Certificate #{selectedRecord.TestSeq}
                </h3>
                <p className="text-xs font-mono text-[#006398]">Permit: {selectedRecord.PermitNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Assessment banner */}
            {(() => {
              const asmt = gasTesterApi.evaluateAtmosphere(selectedRecord);
              return (
                <div className={`p-4 rounded-xl border space-y-1 ${asmt.bannerClass}`}>
                  <div className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">
                      {asmt.overallStatus === 'SAFE' ? 'verified' : 'warning'}
                    </span>
                    {asmt.summaryTitle}
                  </div>
                  <p className="text-xs leading-relaxed">{asmt.summaryMessage}</p>
                </div>
              );
            })()}

            {/* Readings Matrix */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Oxygen (O₂)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedRecord.O2Pct}%</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Combustible (% LEL)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedRecord.LelPct}%</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Carbon Monoxide (CO)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedRecord.CoVal} ppm</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Hydrogen Sulfide (H₂S)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedRecord.H2sVal} ppm</span>
              </div>
            </div>

            {/* Additional details */}
            <dl className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
              <div>
                <dt className="text-slate-400">Sample Location / Level</dt>
                <dd className="font-medium text-slate-800">
                  {selectedRecord.TestLocation || 'General Area'} ({selectedRecord.SampleLevel})
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Detector ID</dt>
                <dd className="font-mono text-slate-800">{selectedRecord.MeterId || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Tested By / Cert</dt>
                <dd className="font-mono text-slate-800">
                  {selectedRecord.TestedBy} ({selectedRecord.Cert || 'AGT'})
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Timestamp</dt>
                <dd className="font-mono text-slate-800">
                  {selectedRecord.TestDate} {selectedRecord.TestTime}
                </dd>
              </div>
            </dl>

            {selectedRecord.Remarks && (
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700 block mb-0.5">Remarks:</span>
                <p className="text-slate-600">{selectedRecord.Remarks}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GasTesterWorkspace;
