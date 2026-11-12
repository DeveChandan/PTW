import React, { useEffect, useState } from 'react';
import type { PermitDeepInsertResponse, PermitInfoRecord, ShiftRenewalRecord } from '../../core/types/ptw.types';
import type { SapConfigRecord } from '../../core/types/config.types';
import { configApi, FALLBACK_CONFIG_DATA } from '../../core/api';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { toast } from '../../shared/context/ToastContext';

interface ShiftRenewalModalProps {
  isOpen: boolean;
  permit: PermitDeepInsertResponse | PermitInfoRecord;
  onClose: () => void;
  onRenewed: (record: ShiftRenewalRecord) => void | Promise<void>;
}

const QUICK_REASONS = [
  'Work pending; continuing into the next shift',
  'Handover to incoming shift crew for job continuity',
  'Inspection, testing, or commissioning ongoing'
] as const;

const DAHEJ_SHIFT_DEFAULTS: SapConfigRecord[] = FALLBACK_CONFIG_DATA.SHIFT;

function normalizeTimeToHms(raw?: string): string {
  const value = (raw || '').trim();
  const full = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (full) return value;
  const short = value.match(/^(\d{2}):(\d{2})$/);
  if (short) return `${short[1]}:${short[2]}:00`;
  return '23:00:00';
}

function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMinutesYmdHms(dateStr: string, timeStr: string, minutes: number): { date: string; time: string } {
  const dateMatch = (dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const hms = normalizeTimeToHms(timeStr);
  const timeMatch = hms.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  const baseDate = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(timeMatch?.[1] || 0), Number(timeMatch?.[2] || 0), Number(timeMatch?.[3] || 0))
    : new Date();
  const target = new Date(baseDate.getTime() + minutes * 60 * 1000);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  const ss = String(target.getSeconds()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}:${ss}` };
}

function stepDateIfEarlier(currentDate: string, currentTime: string, targetTime: string): string {
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(currentDate) ? currentDate : getTodayYmd();
  if (normalizeTimeToHms(targetTime) > normalizeTimeToHms(currentTime)) {
    return baseDate;
  }
  return addMinutesYmdHms(baseDate, '00:00:00', 24 * 60).date;
}

export const ShiftRenewalModal: React.FC<ShiftRenewalModalProps> = ({
  isOpen,
  permit,
  onClose,
  onRenewed
}) => {
  const [shiftOptions, setShiftOptions] = useState<SapConfigRecord[]>(DAHEJ_SHIFT_DEFAULTS);
  const [newShift, setNewShift] = useState<string>('B');
  const [newValidToD, setNewValidToD] = useState<string>(getTodayYmd());
  const [newValidToT, setNewValidToT] = useState<string>('23:00:00');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    configApi
      .fetchShiftConfig()
      .then((records) => {
        if (!active || !records || records.length === 0) return;
        const merged = new Map<string, SapConfigRecord>();
        for (const item of DAHEJ_SHIFT_DEFAULTS) {
          merged.set(item.Config_Code, item);
        }
        for (const item of records) {
          if (item.Config_Code) merged.set(item.Config_Code, item);
        }
        setShiftOptions(Array.from(merged.values()));
      })
      .catch(() => {
        // Keep Dahej fallback shift list when config lookup is unavailable.
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !permit) return;
    setNewShift((permit.Shift || 'B').trim() || 'B');
    setNewValidToD((permit.ValidToD || getTodayYmd()).slice(0, 10));
    setNewValidToT(normalizeTimeToHms(permit.ValidToT));
    setReason('');
    setFormError('');
  }, [isOpen, permit]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !permit) return null;

  const permitNo = permit.Permit_No;
  const baseValidToD = (permit.ValidToD || getTodayYmd()).slice(0, 10);
  const baseValidToT = normalizeTimeToHms(permit.ValidToT);

  const applyOffsetPreset = (minutes: number) => {
    const next = addMinutesYmdHms(baseValidToD, baseValidToT, minutes);
    setNewValidToD(next.date);
    setNewValidToT(next.time);
    setFormError('');
  };

  const applyShiftPreset = (shiftCode: string, endTimeHms: string) => {
    setNewShift(shiftCode);
    setNewValidToD(stepDateIfEarlier(baseValidToD, baseValidToT, endTimeHms));
    setNewValidToT(endTimeHms);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedShift = newShift.trim();
    const trimmedDate = newValidToD.trim();
    const trimmedTime = normalizeTimeToHms(newValidToT);
    const trimmedReason = reason.trim();

    if (!trimmedShift) {
      setFormError('Select the shift code for this renewal.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setFormError('Enter a valid extension date (YYYY-MM-DD).');
      return;
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(trimmedTime)) {
      setFormError('Enter a valid extension end time (HH:MM:SS).');
      return;
    }
    if (!trimmedReason) {
      setFormError('Enter a reason for extending permit validity.');
      return;
    }

    setSubmitting(true);
    try {
      const record = await sitePermitApi.renewShift(permitNo, {
        NewShift: trimmedShift,
        NewValidToD: trimmedDate,
        NewValidToT: trimmedTime,
        Reason: trimmedReason
      });
      toast.success(
        `Permit ${permitNo} renewed (${record.RenewalNo ? `#${record.RenewalNo} · ` : ''}${record.Status || 'RENEWED'}) until ${record.NewValidToD} ${record.NewValidToT} (Shift ${record.NewShift}).`,
        { title: 'Shift Renewal Recorded' }
      );
      await onRenewed(record);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to submit shift renewal to SAP.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentShiftInList = shiftOptions.some((s) => s.Config_Code === newShift);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-renewal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/20 text-indigo-300">
              <span className="material-symbols-outlined text-[20px]">update</span>
            </div>
            <div className="min-w-0">
              <h2 id="shift-renewal-title" className="text-sm font-bold text-white truncate">
                Shift Handover &amp; Validity Renewal
              </h2>
              <p className="text-[11px] font-mono text-slate-300 truncate">
                Permit <span className="font-bold text-sky-300">{permitNo}</span> · Status {permit.Status || '—'} · Area {permit.AreaLoc || '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close shift renewal dialog"
            className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5 text-xs">
          {/* Current Validity Summary */}
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-indigo-950">
            <div>
              <span className="text-indigo-700 font-semibold">Current Shift: </span>
              <strong>{permit.Shift || '—'}</strong>
            </div>
            <div>
              <span className="text-indigo-700 font-semibold">Current End: </span>
              <strong>{baseValidToD} {baseValidToT}</strong>
            </div>
          </div>

          {/* Quick Extension Presets */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold text-slate-600">
              Quick extension presets (from current end)
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyOffsetPreset(15)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => applyOffsetPreset(60)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                +1h
              </button>
              <button
                type="button"
                onClick={() => applyOffsetPreset(120)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                +2h
              </button>
              <button
                type="button"
                onClick={() => applyShiftPreset('B', '23:00:00')}
                className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 font-mono text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                Shift B · 23:00
              </button>
              <button
                type="button"
                onClick={() => applyShiftPreset('C', '09:00:00')}
                className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 font-mono text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                Shift C · 09:00
              </button>
            </div>
          </div>

          {/* Shift / Date / Time Inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="block font-semibold text-slate-700">New Shift *</span>
              <select
                value={newShift}
                onChange={(e) => setNewShift(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                {!currentShiftInList && newShift && (
                  <option value={newShift}>{newShift}</option>
                )}
                {shiftOptions.map((opt) => (
                  <option key={opt.Config_Code} value={opt.Config_Code}>
                    {opt.Config_Code} — {opt.Config_Desc}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="block font-semibold text-slate-700">Extended Valid To Date *</span>
              <input
                type="date"
                value={newValidToD}
                onChange={(e) => setNewValidToD(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>

            <label className="block space-y-1">
              <span className="block font-semibold text-slate-700">Extended Valid To Time *</span>
              <input
                type="time"
                step={1}
                value={newValidToT}
                onChange={(e) => setNewValidToT(normalizeTimeToHms(e.target.value))}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
          </div>

          {/* Reason Input + Quick Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="shift-renewal-reason" className="font-semibold text-slate-700">
                Renewal / Handover Reason *
              </label>
              <span className="font-mono text-[10px] text-slate-400">{reason.length}/255</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setReason(chip);
                    setFormError('');
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              id="shift-renewal-reason"
              rows={3}
              maxLength={255}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why work is continuing and the shift handover conditions..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {formError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {formError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[16px] ${submitting ? 'animate-spin' : ''}`}>
                {submitting ? 'progress_activity' : 'update'}
              </span>
              <span>{submitting ? 'Submitting Renewal...' : 'Renew Shift in SAP'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShiftRenewalModal;

