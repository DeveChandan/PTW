import React, { useRef, useState, useEffect } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const ApprovalsStudio: React.FC = () => {
  const { user } = useSapAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'APPROVE' | 'REJECT' | 'SUSPEND' | null>('APPROVE');
  const [remarks, setRemarks] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Setup canvas for digital signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#006398';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
      }
    }
  }, [selectedAction]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleExecuteDecision = () => {
    if (selectedAction === 'APPROVE' && !hasSignature) {
      alert('Digital signature is required to authorize permit in SAP.');
      return;
    }
    setActionSuccess(`Permit PERMIT-2026-0941 status transitioned to [${selectedAction}] by SAP User ${user?.id}. Audit entry committed.`);
    setTimeout(() => setActionSuccess(null), 7000);
    clearSignature();
    setRemarks('');
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">Approvals & Signatures</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
            STAGE 3: AREA CLEARANCE PENDING
          </span>
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
        </div>
        <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded font-mono text-xs text-gray-700">
          Authorized Approver: <strong className="text-[#006398]">{user?.id}</strong> ({user?.fullName})
        </span>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <span className="text-xs font-mono font-semibold">{actionSuccess}</span>
        </div>
      )}

      {/* Permit In-Review Summary */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded font-bold">
                PERMIT-2026-0941
              </span>
              <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                HOT WORK • PSM HIGH
              </span>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                RISK SCORE: 12 / 25
              </span>
            </div>
            <h2 className="font-display font-bold text-lg text-gray-900 mt-2">
              Catalytic Cracking Unit (CCU-2) - Pipe Flange Welding & High-Pressure Repair
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Plant 1000 • Equipment: <span className="font-mono text-[#006398] font-semibold">PIPE-CCU-9921</span> • Work Validity: Today 08:00 to 18:00 CST
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelectedAction('APPROVE')}
              className={`px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                selectedAction === 'APPROVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Approve & Sign</span>
            </button>
            <button
              onClick={() => setSelectedAction('REJECT')}
              className={`px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                selectedAction === 'REJECT'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              <span>Reject</span>
            </button>
            <button
              onClick={() => setSelectedAction('SUSPEND')}
              className={`px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                selectedAction === 'SUSPEND'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>Safety Suspend</span>
            </button>
          </div>
        </div>

        {/* Triad Authorization Progression */}
        <div className="mt-5">
          <h4 className="font-mono text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-3">
            Multi-Tier Triad Authorization Chain
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { stage: 'Stage 1', role: 'Permit Requester', user: 'VERTIF-V', time: '08:30 CST', status: 'AUTHORIZED', note: 'Initial draft & risk assessment submitted.' },
              { stage: 'Stage 2', role: 'HSE Safety Officer', user: 'M_SHARMA', time: '09:15 CST', status: 'AUTHORIZED', note: 'Atmospheric sniffer verified safe (O2: 20.8%, LEL: 0%).' },
              { stage: 'Stage 3', role: 'Area Owner / Isolator', user: user?.id || 'CURRENT_USER', time: 'ACTION REQUIRED', status: 'PENDING', note: 'Pending LOTO electrical breaker #12 confirmation.' },
              { stage: 'Stage 4', role: 'Operations Approver', user: 'PLANT_CHIEF_01', time: 'Queued', status: 'LOCKED', note: 'Final permit authorization unlocks field execution.' }
            ].map((st) => {
              const isDone = st.status === 'AUTHORIZED';
              const isCurrent = st.status === 'PENDING';
              return (
                <div
                  key={st.stage}
                  className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                    isDone
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : isCurrent
                      ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-100'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase mb-1">
                      <span className="font-semibold">{st.stage}</span>
                      <span className="font-bold">{st.status}</span>
                    </div>
                    <p className="font-display font-bold text-xs text-gray-900">{st.role}</p>
                    <p className="text-[11px] font-mono text-gray-600 mt-0.5">{st.user}</p>
                    <p className="text-[10px] text-gray-600 mt-2 italic line-clamp-2">"{st.note}"</p>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 mt-3 font-semibold">{st.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Digital Signature & Decision Card */}
        {selectedAction && (
          <div className="mt-5 border-t border-gray-200 pt-5 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-display font-bold text-xs text-gray-900 mb-3 flex items-center gap-1.5 uppercase">
              <span className="material-symbols-outlined text-[#006398]">draw</span>
              <span>Execute Decision: {selectedAction} Protocol</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Canvas Pad */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-mono text-gray-600 font-semibold">Draw Digital Signature:</span>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] font-mono text-red-600 hover:underline font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={120}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full h-28 cursor-crosshair"
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-gray-400 text-xs font-mono">
                      <span className="material-symbols-outlined text-[20px]">gesture</span>
                      <span>Sign using mouse or touch</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-1">
                  <span>SAP Identity: <strong>{user?.id}</strong></span>
                  <span>Crypto Stamp: SHA256-SAP-O4</span>
                </div>
              </div>

              {/* Remarks and Action Trigger */}
              <div className="flex flex-col justify-between">
                <div>
                  <label className="block text-[11px] font-mono text-gray-600 mb-1 font-semibold">
                    Authorization Remarks / Conditions of Entry:
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter verification notes, isolation tag checks, or atmospheric parameters..."
                    className="w-full bg-white border border-gray-300 rounded p-2.5 text-xs text-gray-900 font-sans focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <button
                  onClick={handleExecuteDecision}
                  className="w-full py-2.5 bg-[#006398] hover:bg-[#004f7a] text-white font-display font-bold text-xs uppercase tracking-wider rounded transition-all shadow-sm mt-2"
                >
                  Commit Action to SAP Gateway (OData V4)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Immutable SAP Audit Trail Log */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="font-display font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006398]">history</span>
          <span>Immutable SAP Audit Ledger & Status Transitions</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Event Timestamp</th>
                <th className="py-2.5 px-3">SAP User</th>
                <th className="py-2.5 px-3">Action Bound</th>
                <th className="py-2.5 px-3">Transition</th>
                <th className="py-2.5 px-3">Ledger Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              <tr className="hover:bg-gray-50">
                <td className="py-2.5 px-3 text-gray-500">2026-09-17 08:30:14 UTC</td>
                <td className="py-2.5 px-3 font-bold text-[#006398]">VERTIF-V</td>
                <td className="py-2.5 px-3">ZPTW_SUBMIT</td>
                <td className="py-2.5 px-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-semibold">DRAFT → SUBM</span></td>
                <td className="py-2.5 px-3 text-gray-400 font-mono text-[10px]">0x7f2a...881c</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="py-2.5 px-3 text-gray-500">2026-09-17 09:15:33 UTC</td>
                <td className="py-2.5 px-3 font-bold text-emerald-700">M_SHARMA</td>
                <td className="py-2.5 px-3">ZPTW_HSE_APPROVE</td>
                <td className="py-2.5 px-3"><span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-semibold border border-emerald-200">SUBM → HSE_A</span></td>
                <td className="py-2.5 px-3 text-gray-400 font-mono text-[10px]">0x3e19...f44b</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
