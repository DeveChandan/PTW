import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SapUser } from '../../core/auth/sapAuthContext';
import {
  PermitDeepInsertPayload,
  PermitDeepInsertResponse,
  WorkerRecord,
  PPERecord,
  SafetyRecord,
  HazardControlRecord,
  IsolationRecord,
  WorkTypeRecord,
  ChkRecord,
  EquipmentRecord,
  NatwRecord,
  PermitInfoRecord
} from '../../core/types/ptw.types';
import {
  permitCreateApi, PermitCreateUnconfirmedError
} from '../../core/api/modules/permitCreate.api';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';

import { preparePermitCreate } from '../../core/api/modules/permitCreate.validation';
import { initialPermitStatus, type Requirement } from '../../core/ptw/prerequisites';
import { SiteProcedureStep, ProcedureGuidance } from './SiteProcedureStep';
import { emptySitePlan, PERMIT_CATEGORIES, sitePlanRows, toNatwCode, toEquipCode } from '../../core/ptw/siteProcedure';
import { PermitWorkSelectionStep } from './PermitWorkSelectionStep';
import { WorkSelection, referenceId, toPermitReferenceFields } from '../../core/api/modules/permitWorkLookup.api';
import { configApi, checklistApi, isolationApi, toSapChecklistPermitType, toSapPermitType, FALLBACK_CONFIG_DATA } from '../../core/api';
import { SapConfigRecord } from '../../core/types/config.types';
import { SapChecklistItem, ChecklistAnswer, ChecklistAnswerType } from '../../core/types/checklist.types';
import { PpeValueHelpDialog } from '../../shared/components/PpeValueHelpDialog';
import { PermitChecklistModal } from './PermitChecklistModal';
import { SectionCard } from '../../shared/components/SectionCard';
import { toast } from '../../shared/context/ToastContext';
import { useFormDraft } from '../../shared/hooks/useFormDraft';
import { RiskMatrix5x5Section, getRiskMatrixCell } from './RiskMatrix5x5Section';
import { ExecutionTargetNestedDropdown } from './ExecutionTargetNestedDropdown';
import { validatePhoneNumber, sanitizePhoneNumber } from '../../core/utils/phoneValidation';
import { PermitAnnexPrintView } from './PermitAnnexPrintView';
import { PermitPrintModal } from './PermitPrintModal';

/**
 * Formats the combined execution target: plant - department.
 * Guarantees strict compliance with SAP OData V4 schema limit of 40 characters (ExecDept).
 */
export function formatExecutionTarget(plant: string, dept: string, deptCode?: string): string {
  const p = (plant || '').trim();
  const d = (dept || '').trim();
  if (!p && !d) return '';
  if (!p) return d.substring(0, 40);
  if (!d) return p.substring(0, 40);

  const combined = `${p} - ${d}`;
  if (combined.length <= 40) {
    return combined;
  }

  // If combined exceeds 40 chars, try using shorter department code if available (e.g. MECH_STAT)
  if (deptCode && deptCode.trim() && deptCode.trim() !== d) {
    const combinedWithCode = `${p} - ${deptCode.trim()}`;
    if (combinedWithCode.length <= 40) {
      return combinedWithCode;
    }
  }

  // Safe substring clamp to 40 characters
  return combined.substring(0, 40);
}

interface PermitCreateModuleProps {
  user: SapUser | null;
  onBack?: () => void;
  revisionPermit?: PermitDeepInsertResponse | null;
}

type TabKey = 'work' | 'general' | 'procedure' | 'workers' | 'ppe' | 'hazards' | 'gas-isolation' | 'payload';

export const PermitCreateModule: React.FC<PermitCreateModuleProps> = ({ user, onBack, revisionPermit }) => {
  // A new request starts without asserted work, crew or safety evidence.
  const [activeTab, setActiveTab] = useState<TabKey>('work');

  // Guarantee each wizard step/tab opens from the top (never scrolled down mid-way)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [activeTab]);

  const [workSelection, setWorkSelection] = useState<WorkSelection | null>(null);

  // Permit Header Fields
  const permitNo = ''; // Assigned by SAP on creation.
  const submissionLock = useRef(false);
  const previousWorkKey = useRef('');
  const [permitType, setPermitType] = useState<string>('');
  const [sitePlan, setSitePlan] = useState(emptySitePlan);

  // SAP PM Order Linkage
  const [aufnr, setAufnr] = useState<string>('');
  const [qmnum, setQmnum] = useState<string>('');
  const [auart, setAuart] = useState<string>('');
  const [personResp, setPersonResp] = useState<string>(user?.id || '');
  const [plannerGroup, setPlannerGroup] = useState<string>('');
  const [pmBasicStartD, setPmBasicStartD] = useState<string>('');
  const [pmBasicFinishD, setPmBasicFinishD] = useState<string>('');
  const [pmFinalDueD, setPmFinalDueD] = useState<string>('');
  const [revision, setRevision] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [assembly, setAssembly] = useState<string>('');

  // Plant & Location
  const [equnr, setEqunr] = useState<string>('');
  const [tplnr, setTplnr] = useState<string>('');
  const [werks, setWerks] = useState<string>('');
  const [arbpl, setArbpl] = useState<string>('');
  const [areaLoc, setAreaLoc] = useState<string>('');
  const [jobDesc, setJobDesc] = useState<string>('');

  // Execution & Supervision
  const [execAgency, setExecAgency] = useState<string>('EMP');
  const [execDept, setExecDept] = useState<string>('');
  const [execPlant, setExecPlant] = useState<string>('');
  const [supvName, setSupvName] = useState<string>('');
  const [supvPhone, setSupvPhone] = useState<string>('');
  const [supvPhoneTouched, setSupvPhoneTouched] = useState<boolean>(false);
  const [safetyOfficer, setSafetyOfficer] = useState<string>('');
  const [shift, setShift] = useState<string>('GENERAL');
  const [personsQty, setPersonsQty] = useState<number>(0);

  // Validity Period (without seconds in user interaction)
  const [validFromD, setValidFromD] = useState<string>('');
  const [validFromT, setValidFromT] = useState<string>('');
  const [validToD, setValidToD] = useState<string>('');
  const [validToT, setValidToT] = useState<string>('');
  const [gasTestFreqHr, setGasTestFreqHr] = useState<string>('2');
  const [creatorComment, setCreatorComment] = useState<string>('');

  // Pre-populate form when revising a rejected permit
  useEffect(() => {
    if (!revisionPermit) return;

    if (revisionPermit.PermitType) setPermitType(revisionPermit.PermitType);
    if (revisionPermit.Aufnr) setAufnr(revisionPermit.Aufnr);
    if (revisionPermit.Qmnum) setQmnum(revisionPermit.Qmnum);
    if (revisionPermit.Auart) setAuart(revisionPermit.Auart);
    if (revisionPermit.PersonResp) setPersonResp(revisionPermit.PersonResp);
    if (revisionPermit.PlannerGroup) setPlannerGroup(revisionPermit.PlannerGroup);
    if (revisionPermit.Equnr) setEqunr(revisionPermit.Equnr);
    if (revisionPermit.Tplnr) setTplnr(revisionPermit.Tplnr);
    if (revisionPermit.Werks) setWerks(revisionPermit.Werks);
    if (revisionPermit.Arbpl) setArbpl(revisionPermit.Arbpl);
    if (revisionPermit.AreaLoc) setAreaLoc(revisionPermit.AreaLoc);
    if (revisionPermit.JobDesc) setJobDesc(revisionPermit.JobDesc);
    if (revisionPermit.ExecAgency) setExecAgency(revisionPermit.ExecAgency);
    if (revisionPermit.ExecDept) setExecDept(revisionPermit.ExecDept);
    if (revisionPermit.SupvName) setSupvName(revisionPermit.SupvName);
    if (revisionPermit.SupvPhone) setSupvPhone(revisionPermit.SupvPhone);
    if (revisionPermit.SafetyOfficer) setSafetyOfficer(revisionPermit.SafetyOfficer);
    if (revisionPermit.Shift) setShift(revisionPermit.Shift);
    if (revisionPermit.ValidFromD) setValidFromD(revisionPermit.ValidFromD);
    if (revisionPermit.ValidFromT) setValidFromT(revisionPermit.ValidFromT);
    if (revisionPermit.ValidToD) setValidToD(revisionPermit.ValidToD);
    if (revisionPermit.ValidToT) setValidToT(revisionPermit.ValidToT);
    if (revisionPermit.GasTestFreqHr) setGasTestFreqHr(revisionPermit.GasTestFreqHr);
    if (revisionPermit.CreatorComment) setCreatorComment(revisionPermit.CreatorComment);

    setWorkSelection({
      id: revisionPermit.Aufnr || revisionPermit.Qmnum || revisionPermit.Permit_No,
      type: revisionPermit.Aufnr ? 'ORDER' : 'NOTIFICATION',
      title: revisionPermit.JobDesc,
      plant: revisionPermit.Werks,
      workCenter: revisionPermit.Arbpl,
      functionalLocation: revisionPermit.Tplnr,
      equipment: revisionPermit.Equnr,
      description: revisionPermit.JobDesc,
      source: revisionPermit.Aufnr ? 'ORDER' : 'NOTIFICATION',
      category: revisionPermit.PermitType,
      reference: revisionPermit.Aufnr || revisionPermit.Qmnum || revisionPermit.Permit_No
    } as unknown as WorkSelection);

    if (revisionPermit._Worker && revisionPermit._Worker.length > 0) {
      setWorkers(revisionPermit._Worker);
    }
    if (revisionPermit._PPE && revisionPermit._PPE.length > 0) {
      setPpeItems(revisionPermit._PPE);
    }
    if (revisionPermit._HazardControl && revisionPermit._HazardControl.length > 0) {
      setHazards(revisionPermit._HazardControl);
    }

    setActiveTab('general');
  }, [revisionPermit]);

  // Unified datetime-local values (YYYY-MM-DDTHH:mm) - without seconds
  const validFromDateTime = useMemo(() => {
    if (!validFromD || !validFromT) return '';
    const cleanTime = validFromT.slice(0, 5);
    return `${validFromD}T${cleanTime}`;
  }, [validFromD, validFromT]);

  const validToDateTime = useMemo(() => {
    if (!validToD || !validToT) return '';
    const cleanTime = validToT.slice(0, 5);
    return `${validToD}T${cleanTime}`;
  }, [validToD, validToT]);

  const handleValidFromDateTimeChange = (val: string) => {
    if (!val) {
      setValidFromD('');
      setValidFromT('');
      return;
    }
    const [d, t] = val.split('T');
    setValidFromD(d || '');
    setValidFromT(t ? (t.length === 5 ? `${t}:00` : t) : '');
  };

  const handleValidToDateTimeChange = (val: string) => {
    if (!val) {
      setValidToD('');
      setValidToT('');
      return;
    }
    const [d, t] = val.split('T');
    setValidToD(d || '');
    setValidToT(t ? (t.length === 5 ? `${t}:00` : t) : '');
  };

  // Helper preset: Set Start to current date & time (without seconds)
  const handleSetStartNow = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min}:00`;

    setValidFromD(dateStr);
    setValidFromT(timeStr);

    // If validTo is not set, also default it to now + 8 hours (standard permit validity)
    if (!validToD || !validToT) {
      const end = new Date(now.getTime() + 8 * 3600 * 1000);
      const endY = end.getFullYear();
      const endM = String(end.getMonth() + 1).padStart(2, '0');
      const endD = String(end.getDate()).padStart(2, '0');
      const endH = String(end.getHours()).padStart(2, '0');
      const endMin = String(end.getMinutes()).padStart(2, '0');
      setValidToD(`${endY}-${endM}-${endD}`);
      setValidToT(`${endH}:${endMin}:00`);
    }
  };

  // Helper preset: Auto-calculate Expiry as +8 Hours from Start Window
  const handleSetPlus8Hours = () => {
    let baseTime: Date;
    if (validFromD && validFromT) {
      baseTime = new Date(`${validFromD}T${validFromT.slice(0, 5)}`);
    } else {
      baseTime = new Date();
    }
    const end = new Date(baseTime.getTime() + 8 * 3600 * 1000);
    const endY = end.getFullYear();
    const endM = String(end.getMonth() + 1).padStart(2, '0');
    const endD = String(end.getDate()).padStart(2, '0');
    const endH = String(end.getHours()).padStart(2, '0');
    const endMin = String(end.getMinutes()).padStart(2, '0');
    setValidToD(`${endY}-${endM}-${endD}`);
    setValidToT(`${endH}:${endMin}:00`);
  };

  // Helper preset: Snap Expiry to shift boundary (17:30 / 23:00 / 09:00)
  const handleSetShiftEnd = () => {
    let baseTime: Date;
    if (validFromD && validFromT) {
      baseTime = new Date(`${validFromD}T${validFromT.slice(0, 5)}`);
    } else {
      baseTime = new Date();
    }
    const mins = baseTime.getHours() * 60 + baseTime.getMinutes();
    const baseDateStr = validFromD || new Date().toISOString().slice(0, 10);

    if (mins >= 540 && mins < 1050) {
      // Day shift -> ends at 17:30 same day
      setValidToD(baseDateStr);
      setValidToT('17:30:00');
    } else if (mins >= 1050 && mins < 1380) {
      // Evening shift -> ends at 23:00 same day
      setValidToD(baseDateStr);
      setValidToT('23:00:00');
    } else {
      // Night shift -> ends at 09:00 next day
      let nextDate = baseDateStr;
      if (mins >= 1380) {
        const d = new Date(baseTime.getTime() + 24 * 3600 * 1000);
        nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      setValidToD(nextDate);
      setValidToT('09:00:00');
    }
  };

  // LOTO & Isolation Requirements
  const [isolationRequired, setIsolationRequired] = useState<Requirement>('');
  const [gasTestRequired, setGasTestRequired] = useState<Requirement>('');
  const [isolationRefType, setIsolationRefType] = useState<string>('EQUIP');
  const [isolationNo, setIsolationNo] = useState<string>('');

  // Child Collections State
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [ppeItems, setPpeItems] = useState<PPERecord[]>([]);
  const [safetyChecklist, setSafetyChecklist] = useState<SafetyRecord[]>([]);
  const [hazards, setHazards] = useState<HazardControlRecord[]>([]);
  // Selected Hazard for the 5x5 Risk Matrix
  const [selectedHazardIdx, setSelectedHazardIdx] = useState<number>(0);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ c: number; l: number }>({ c: 4, l: 4 });

  const [isolations, setIsolations] = useState<IsolationRecord[]>([]);
  // UI state for Submitting & Modals
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [isCheckingRecentPermits, setIsCheckingRecentPermits] = useState(false);
  const [recentSapPermits, setRecentSapPermits] = useState<PermitInfoRecord[] | null>(null);
  const [excludeChildNavs, setExcludeChildNavs] = useState(false);
  const [submissionResponse, setSubmissionResponse] = useState<PermitDeepInsertResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [notificationBanner, setNotificationBanner] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // New Worker Form Modal / Row
  const [newPpeCode, setNewPpeCode] = useState('');
  const [newPpeDescription, setNewPpeDescription] = useState('');
  const [newSafetyCode, setNewSafetyCode] = useState('');
  const [newSafetyDescription, setNewSafetyDescription] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [workerPhoneTouched, setWorkerPhoneTouched] = useState<boolean>(false);
  const [newWorkerType, setNewWorkerType] = useState<'EMP' | 'CONT'>('EMP');
  const [newWorkerEmpId, setNewWorkerEmpId] = useState('');
  const [newWorkerContractorName, setNewWorkerContractorName] = useState('');

  // Live Phone Number Validations (10-15 digits, standard mobile)
  const supvPhoneValidation = useMemo(
    () => validatePhoneNumber(supvPhone, true),
    [supvPhone]
  );

  const workerPhoneValidation = useMemo(
    () => validatePhoneNumber(newWorkerPhone, true),
    [newWorkerPhone]
  );

  // Synchronize authorized crew quantity with actual crew muster ledger count
  useEffect(() => {
    setPersonsQty(workers.length);
  }, [workers.length]);

  // New Hazard Form Inputs
  const [newHazardCode, setNewHazardCode] = useState('ELEC');
  const [newHazardDesc, setNewHazardDesc] = useState('');
  const [newControlCode, setNewControlCode] = useState('ELEC01');
  const [newControlDesc, setNewControlDesc] = useState('');

  // New Isolation Point Inputs

  // SAP Live Config State (Dropdowns & F4 Value Help)
  const [shiftOptions, setShiftOptions] = useState<SapConfigRecord[]>(FALLBACK_CONFIG_DATA.SHIFT || []);
  const [deptOptions, setDeptOptions] = useState<SapConfigRecord[]>(FALLBACK_CONFIG_DATA.DEPARTMENT || []);
  const [plantOptions, setPlantOptions] = useState<SapConfigRecord[]>(FALLBACK_CONFIG_DATA.PLANT || []);
  const [permitTypeOptions, setPermitTypeOptions] = useState<SapConfigRecord[]>([]);
  const [availableIsolations, setAvailableIsolations] = useState<string[]>([]);
  const [ppeCatalog, setPpeCatalog] = useState<SapConfigRecord[]>([]);
  const [workerTypeOptions, setWorkerTypeOptions] = useState<SapConfigRecord[]>([]);
  const [isPpeHelpOpen, setIsPpeHelpOpen] = useState(false);

  // Filtered sub working plants mapped to selected execution department via Parent_Code
  const filteredPlantOptions = useMemo(() => {
    if (!execDept) return [];

    const matchedDept = deptOptions.find(
      (d) => d.Config_Desc === execDept || d.Config_Code === execDept
    );
    const deptCode = (matchedDept?.Config_Code || execDept).trim().toUpperCase();
    const deptDesc = (matchedDept?.Config_Desc || execDept).trim().toUpperCase();

    return plantOptions.filter((p) => {
      const parent = (p.Parent_Code || '').trim().toUpperCase();
      return (
        parent === 'DEPARTMENT' ||
        parent === deptCode ||
        parent === deptDesc ||
        (matchedDept && parent === matchedDept.Config_Code.trim().toUpperCase())
      );
    });
  }, [execDept, deptOptions, plantOptions]);

  // SAP Checklist Questionnaire State (Multi-Activity Work Support)
  const [activeChecklistPermitType, setActiveChecklistPermitType] = useState<string>('');
  const [categoryQuestions, setCategoryQuestions] = useState<Record<string, SapChecklistItem[]>>({});
  const [categoryAnswers, setCategoryAnswers] = useState<Record<string, Record<string, { response: ChecklistAnswerType; remarks: string }>>>({});
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState<boolean>(false);

  // Local Draft Storage Hook (persists permit draft during disconnect, reload, or crash)
  const {
    hasDraft,
    lastSaved,
    savedTimestamp,
    saveDraft,
    getSavedDraft,
    clearDraft,
    discardDraft
  } = useFormDraft<any>({
    draftKey: 'permit_create',
    userId: user?.id || 'guest',
    debounceMs: 1200
  });

  // Auto-save form draft to localStorage whenever fields change
  useEffect(() => {
    const hasStarted = Boolean(
      workSelection ||
      permitType ||
      aufnr ||
      jobDesc ||
      equnr ||
      workers.length > 0 ||
      hazards.length > 0 ||
      ppeItems.length > 0 ||
      sitePlan.additionalTypes?.length > 0 ||
      sitePlan.nature?.length > 0 ||
      Object.keys(sitePlan.fields || {}).length > 0 ||
      Object.keys(categoryAnswers).length > 0
    );

    if (!hasStarted) return;

    saveDraft({
      activeTab,
      workSelection,
      permitType,
      sitePlan,
      aufnr,
      qmnum,
      auart,
      personResp,
      plannerGroup,
      pmBasicStartD,
      pmBasicFinishD,
      pmFinalDueD,
      revision,
      priority,
      assembly,
      equnr,
      tplnr,
      werks,
      arbpl,
      areaLoc,
      jobDesc,
      execAgency,
      execDept,
      execPlant,
      supvName,
      supvPhone,
      safetyOfficer,
      shift,
      personsQty,
      validFromD,
      validFromT,
      validToD,
      validToT,
      gasTestFreqHr,
      creatorComment,
      isolationRequired,
      gasTestRequired,
      isolationRefType,
      isolationNo,
      workers,
      ppeItems,
      safetyChecklist,
      hazards,
      isolations,
      categoryAnswers
    });
  }, [
    activeTab,
    workSelection,
    permitType,
    sitePlan,
    aufnr,
    qmnum,
    auart,
    personResp,
    plannerGroup,
    pmBasicStartD,
    pmBasicFinishD,
    pmFinalDueD,
    revision,
    priority,
    assembly,
    equnr,
    tplnr,
    werks,
    arbpl,
    areaLoc,
    jobDesc,
    execAgency,
    execDept,
    execPlant,
    supvName,
    supvPhone,
    safetyOfficer,
    shift,
    personsQty,
    validFromD,
    validFromT,
    validToD,
    validToT,
    gasTestFreqHr,
    creatorComment,
    isolationRequired,
    gasTestRequired,
    isolationRefType,
    isolationNo,
    workers,
    ppeItems,
    safetyChecklist,
    hazards,
    isolations,
    categoryAnswers,
    saveDraft
  ]);

  const handleRestoreDraft = () => {
    const draft = getSavedDraft();
    if (!draft) return;
    if (draft.activeTab) setActiveTab(draft.activeTab);
    if (draft.workSelection) setWorkSelection(draft.workSelection);
    if (draft.permitType) setPermitType(draft.permitType);
    if (draft.sitePlan) setSitePlan(draft.sitePlan);
    if (draft.aufnr) setAufnr(draft.aufnr);
    if (draft.qmnum) setQmnum(draft.qmnum);
    if (draft.auart) setAuart(draft.auart);
    if (draft.personResp) setPersonResp(draft.personResp);
    if (draft.plannerGroup) setPlannerGroup(draft.plannerGroup);
    if (draft.pmBasicStartD) setPmBasicStartD(draft.pmBasicStartD);
    if (draft.pmBasicFinishD) setPmBasicFinishD(draft.pmBasicFinishD);
    if (draft.pmFinalDueD) setPmFinalDueD(draft.pmFinalDueD);
    if (draft.revision) setRevision(draft.revision);
    if (draft.priority) setPriority(draft.priority);
    if (draft.assembly) setAssembly(draft.assembly);
    if (draft.equnr) setEqunr(draft.equnr);
    if (draft.tplnr) setTplnr(draft.tplnr);
    if (draft.werks) setWerks(draft.werks);
    if (draft.arbpl) setArbpl(draft.arbpl);
    if (draft.areaLoc) setAreaLoc(draft.areaLoc);
    if (draft.jobDesc) setJobDesc(draft.jobDesc);
    if (draft.execAgency) setExecAgency(draft.execAgency);
    if (draft.execPlant) setExecPlant(draft.execPlant);
    if (draft.execDept) {
      if (draft.execDept.includes(' - ') && !draft.execPlant) {
        const parts = draft.execDept.split(' - ');
        setExecPlant(parts[0].trim());
        setExecDept(parts[1].trim());
      } else {
        setExecDept(draft.execDept);
      }
    }
    if (draft.supvName) setSupvName(draft.supvName);
    if (draft.supvPhone) setSupvPhone(draft.supvPhone);
    if (draft.safetyOfficer) setSafetyOfficer(draft.safetyOfficer);
    if (draft.shift) setShift(draft.shift);
    if (draft.personsQty !== undefined) setPersonsQty(draft.personsQty);
    if (draft.validFromD) setValidFromD(draft.validFromD);
    if (draft.validFromT) setValidFromT(draft.validFromT);
    if (draft.validToD) setValidToD(draft.validToD);
    if (draft.validToT) setValidToT(draft.validToT);
    if (draft.gasTestFreqHr) setGasTestFreqHr(draft.gasTestFreqHr);
    if (draft.creatorComment) setCreatorComment(draft.creatorComment);
    if (draft.isolationRequired) setIsolationRequired(draft.isolationRequired);
    if (draft.gasTestRequired) setGasTestRequired(draft.gasTestRequired);
    if (draft.isolationRefType) setIsolationRefType(draft.isolationRefType);
    if (draft.isolationNo) setIsolationNo(draft.isolationNo);
    if (draft.workers) setWorkers(draft.workers);
    if (draft.ppeItems) setPpeItems(draft.ppeItems);
    if (draft.safetyChecklist) setSafetyChecklist(draft.safetyChecklist.filter((p: SafetyRecord) => !p.ItemCode?.startsWith('Q')));
    if (draft.hazards) setHazards(draft.hazards);
    if (draft.isolations) setIsolations(draft.isolations);
    if (draft.categoryAnswers) setCategoryAnswers(draft.categoryAnswers);
    toast.success('Permit draft successfully restored from local storage.', { title: 'Draft Restored' });
  };

  const handleDiscardDraft = () => {
    discardDraft();
    toast.info('Saved permit draft discarded.', { title: 'Draft Discarded' });
  };

  // All active categories (Primary + Additional from Site Plan)
  const allActiveCategories = useMemo(() => {
    const primarySap = toSapChecklistPermitType(permitType) || permitType;
    const additionalSaps = (sitePlan.additionalTypes || []).map(
      (t) => toSapChecklistPermitType(t) || t
    );
    return Array.from(new Set([primarySap, ...additionalSaps].filter(Boolean)));
  }, [permitType, sitePlan.additionalTypes]);

  // WorkType records for SAP child table _WorkType:
  // Primary permit type (Section 2.1) and any additional work categories (Section A)
  // are stored in _WorkType with sequential SeqNo for both single and multiple categories.
  const workTypeRecords = useMemo((): WorkTypeRecord[] => {
    const primarySap = toSapPermitType(permitType) || permitType;
    if (!primarySap) return [];
    const additionalSaps = (sitePlan.additionalTypes || [])
      .map((t) => toSapPermitType(t) || t)
      .filter((t) => Boolean(t) && t !== primarySap);

    const allTypes = Array.from(new Set([primarySap, ...additionalSaps]));
    return allTypes.map((code, index) => ({
      SeqNo: String(index + 1),
      WorkType: code
    }));
  }, [permitType, sitePlan.additionalTypes]);

  // Pure Cold Work Check: Primary category is Cold Work and no other additional categories exist
  const isOnlyColdWork = useMemo(() => {
    const primarySap = toSapPermitType(permitType) || permitType;
    if (primarySap !== 'COLD') return false;
    const additional = (sitePlan.additionalTypes || []).filter(
      (t) => Boolean(t) && (toSapPermitType(t) || t) !== 'COLD'
    );
    return additional.length === 0;
  }, [permitType, sitePlan.additionalTypes]);

  // Overall statistics across all active categories
  const overallChecklistStats = useMemo(() => {
    let yes = 0;
    let no = 0;
    let na = 0;
    let answered = 0;
    let total = 0;

    allActiveCategories.forEach((catCode) => {
      const questions = categoryQuestions[catCode] || [];
      const answers = categoryAnswers[catCode] || {};
      total += questions.length;
      questions.forEach((item) => {
        const resp = answers[item.QuestionaireId]?.response;
        if (resp === 'YES') { yes++; answered++; }
        else if (resp === 'NO') { no++; answered++; }
        else if (resp === 'NA') { na++; answered++; }
      });
    });

    const pending = total - answered;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { yes, no, na, answered, total, pending, percent };
  }, [allActiveCategories, categoryQuestions, categoryAnswers]);

  // Per-category progress map for SiteProcedureStep and category cards
  const checklistProgressMap = useMemo(() => {
    const progress: Record<string, { answered: number; total: number; verified: number }> = {};
    PERMIT_CATEGORIES.forEach((cat) => {
      const sap = cat.sapCode;
      const questions = categoryQuestions[sap] || [];
      const answers = categoryAnswers[sap] || {};
      let answered = 0;
      questions.forEach((q) => {
        if (answers[q.QuestionaireId]?.response) {
          answered++;
        }
      });
      progress[sap] = {
        answered,
        total: questions.length,
        verified: answered
      };
    });
    return progress;
  }, [categoryQuestions, categoryAnswers]);

  // Checklist responses formatted for SAP child table _CHK:
  // Maps all answered questions across all active categories into CHKType records
  const chkRecords = useMemo((): ChkRecord[] => {
    const records: ChkRecord[] = [];
    const addedKeys = new Set<string>();

    allActiveCategories.forEach((catCode) => {
      const sapCat = toSapPermitType(catCode) || catCode;
      const ansMap = categoryAnswers[catCode] || {};
      const questions = categoryQuestions[catCode] || [];

      // Include answered questions from questions catalog
      questions.forEach((q) => {
        const ans = ansMap[q.QuestionaireId];
        if (ans && ans.response) {
          const key = `${sapCat}_${q.QuestionaireId}`;
          if (!addedKeys.has(key)) {
            addedKeys.add(key);
            records.push({
              QuestionnaireId: String(q.QuestionaireId).trim().slice(0, 6),
              PermitType: sapCat.slice(0, 10),
              Answer: ans.response.trim().slice(0, 3).toUpperCase(),
              Remarks: (ans.remarks || '').trim().slice(0, 255)
            });
          }
        }
      });

      // Also ensure any answered IDs in ansMap not present in questions catalog are preserved
      Object.entries(ansMap).forEach(([qId, ans]) => {
        if (ans && ans.response) {
          const key = `${sapCat}_${qId}`;
          if (!addedKeys.has(key)) {
            addedKeys.add(key);
            records.push({
              QuestionnaireId: String(qId).trim().slice(0, 6),
              PermitType: sapCat.slice(0, 10),
              Answer: ans.response.trim().slice(0, 3).toUpperCase(),
              Remarks: (ans.remarks || '').trim().slice(0, 255)
            });
          }
        }
      });
    });

    return records;
  }, [allActiveCategories, categoryAnswers, categoryQuestions]);

  // Nature of Work records formatted for SAP child table _NATW (Entity NATWType)
  const natwRecords = useMemo((): NatwRecord[] => {
    return (sitePlan.nature || []).map((desc, index) => {
      const otherDetail = desc === 'Other' ? (sitePlan.fields.OTHER_NATURE || sitePlan.fields.NOTE || '').trim() : '';
      return {
        ItemNo: String(index + 1),
        NatwCode: toNatwCode(desc),
        NatwDesc: (desc === 'Other' && otherDetail) ? `Other: ${otherDetail}`.slice(0, 255) : desc.trim().slice(0, 255),
        OtherText: otherDetail.slice(0, 255)
      };
    });
  }, [sitePlan.nature, sitePlan.fields.OTHER_NATURE, sitePlan.fields.NOTE]);

  // Tools & Equipment records formatted for SAP child table _Equipment (Entity EquipmentType)
  const equipmentRecords = useMemo((): EquipmentRecord[] => {
    return (sitePlan.tools || []).map((desc, index) => {
      const otherDetail = desc === 'Other' ? (sitePlan.fields.OTHER_TOOLS || sitePlan.fields.NOTE || '').trim() : '';
      return {
        ItemNo: String(index + 1),
        EquipCode: toEquipCode(desc),
        EquipDesc: (desc === 'Other' && otherDetail) ? `Other: ${otherDetail}`.slice(0, 255) : desc.trim().slice(0, 255),
        OtherText: otherDetail.slice(0, 255)
      };
    });
  }, [sitePlan.tools, sitePlan.fields.OTHER_TOOLS, sitePlan.fields.NOTE]);

  // Pre-fetch questionnaires for any active categories so item counts & progress are immediately ready
  useEffect(() => {
    allActiveCategories.forEach(async (catCode) => {
      if (catCode && !categoryQuestions[catCode]) {
        try {
          const questions = await checklistApi.fetchChecklist(catCode);
          setCategoryQuestions((prev) => ({
            ...prev,
            [catCode]: questions
          }));
        } catch (err) {
          console.warn(`Failed to preload checklist for category ${catCode}:`, err);
        }
      }
    });
  }, [allActiveCategories, categoryQuestions]);

  // Handler to open checklist modal for any category (Primary or Additional)
  const handleOpenChecklistForCategory = async (rawCode: string) => {
    const sapCode = toSapChecklistPermitType(rawCode) || rawCode;
    if (!sapCode) return;
    setActiveChecklistPermitType(sapCode);

    // If questions for this category have already been fetched:
    if (categoryQuestions[sapCode] !== undefined) {
      if (categoryQuestions[sapCode].length > 0) {
        setIsChecklistModalOpen(true);
      } else {
        setIsChecklistModalOpen(false);
      }
      return;
    }

    setIsLoadingChecklist(true);
    try {
      const questions = await checklistApi.fetchChecklist(sapCode);
      setCategoryQuestions((prev) => ({
        ...prev,
        [sapCode]: questions
      }));
      // ONLY open the modal if questions actually exist for this category
      if (questions && questions.length > 0) {
        setIsChecklistModalOpen(true);
      } else {
        setIsChecklistModalOpen(false);
      }
    } catch (err) {
      console.error(`Failed to load permit checklist for ${sapCode}:`, err);
      setIsChecklistModalOpen(false);
    } finally {
      setIsLoadingChecklist(false);
    }
  };

  const handleSelectPermitType = async (rawCode: string) => {
    const sapCode = toSapPermitType(rawCode) || rawCode;
    setPermitType(sapCode);
    await handleOpenChecklistForCategory(sapCode);
  };

  const handleSaveChecklist = (answers: ChecklistAnswer[]) => {
    const targetCode = activeChecklistPermitType || toSapChecklistPermitType(permitType) || permitType;
    const newCatAnswersMap: Record<string, { response: ChecklistAnswerType; remarks: string }> = {};
    answers.forEach((a) => {
      newCatAnswersMap[a.questionaireId] = { response: a.response, remarks: a.remarks };
    });

    const updatedCategoryAnswers = {
      ...categoryAnswers,
      [targetCode]: newCatAnswersMap
    };
    setCategoryAnswers(updatedCategoryAnswers);

    // Compliance checklist responses are formatted into child table _CHK (CHKType) via chkRecords.
    // They are NOT added to _Safety.
    setIsChecklistModalOpen(false);
    const answeredCount = answers.filter((a) => a.response).length;
    const targetLabel = PERMIT_CATEGORIES.find((c) => c.code === targetCode || c.sapCode === targetCode)?.label || targetCode;
    const bannerMsg = `${targetLabel} compliance checklist (_CHK) updated: ${answeredCount} of ${answers.length} verified.`;
    toast.success(bannerMsg, { title: 'Compliance Checklist Saved' });
    setNotificationBanner({
      type: 'success',
      message: bannerMsg
    });
  };

  useEffect(() => {
    configApi.fetchShiftConfig().then((data) => {
      setShiftOptions(data);
      if (data.length > 0) {
        setShift((prev) => (prev === 'GENERAL' || !prev ? data[0].Config_Code : prev));
      }
    });
    configApi.fetchPpeConfig().then(setPpeCatalog);
    configApi.fetchWorkerTypeConfig().then(setWorkerTypeOptions);
    configApi.fetchDepartmentConfig().then(setDeptOptions);
    configApi.fetchPlantConfig().then(setPlantOptions);
    configApi.fetchPermitTypeConfig().then(setPermitTypeOptions);
    isolationApi.list().then((list) => {
      setAvailableIsolations(list.map((i) => i.IsolationNo));
    }).catch(reason => {
      const errMsg = reason instanceof Error ? reason.message : 'Unable to load isolation certificates from SAP.';
      toast.error(errMsg, { title: 'Isolation Registry' });
      setNotificationBanner({ type: 'error', message: errMsg });
    });
  }, []);

  // 3. Overall Readiness Completion Percentage
  const baseCompletionPercentage = useMemo(() => {
    if (!workSelection) return 0;
    let score = 0;
    if (jobDesc && werks) score += 20;
    if (workers.length > 0) score += 20;
    if (ppeItems.length > 0) score += 20;
    if (hazards.length > 0) score += 20;
    if (validFromD && validToD && supvName) score += 20;
    return score;
  }, [workSelection, jobDesc, werks, workers, ppeItems, hazards, validFromD, validToD, supvName]);

  // The first step owns reference selection; clear absent fields to avoid stale order linkage.
  const handleWorkSelected = (selection: WorkSelection) => {
    const selectionKey = `${selection.reference.ReferenceSource}:${referenceId(selection.source, selection.reference)}`;
    if (previousWorkKey.current && previousWorkKey.current !== selectionKey) {
      // A different job must not inherit site-specific preparation or JSA evidence.
      setSitePlan(emptySitePlan()); setPermitType('');
      setIsolationRequired(''); setGasTestRequired(''); setExecDept(''); setExecPlant('');
      setWorkers([]); setPersonsQty(0); setHazards([]); setIsolations([]);
      setPpeItems([]); setSafetyChecklist([]); setIsolationNo('');
      setCategoryQuestions({}); setCategoryAnswers({}); setActiveChecklistPermitType(''); setIsChecklistModalOpen(false);
      setValidFromD(''); setValidFromT(''); setValidToD(''); setValidToT('');
    }
    previousWorkKey.current = selectionKey;
    const ref = toPermitReferenceFields(selection.reference);
    setWorkSelection(selection);
    setAufnr(ref.Aufnr || '');
    setQmnum(ref.Qmnum || '');
    setAuart(ref.Auart || '');
    setJobDesc(ref.JobDesc);
    setEqunr(ref.Equnr || '');
    setTplnr(ref.Tplnr || '');
    setWerks(ref.Werks || user?.plant || '');
    setArbpl(ref.Arbpl || '');
    setAreaLoc(ref.AreaLoc || ref.LocationDesc || '');
    setAssembly('');
    setPriority(ref.Priority || '');
    setRevision('');
    setPersonResp(user?.id || '');
    setPlannerGroup(ref.PlannerGroup || '');
    setPmBasicStartD(ref.PmBasicStartD || '');
    setPmBasicFinishD('');
    setPmFinalDueD('');
    setExecDept('');
    setExecPlant('');
    setCreatorComment(selection.category + ' work · ' + selection.source + ' ' + referenceId(selection.source, selection.reference));
    setSubmissionResponse(null);
    setNotificationBanner(null);
    setActiveTab('general');
  };

  // Auto-scroll & Focus Jump Helper for Mandatory Validation
  const jumpToField = (fieldId?: string, targetTab?: TabKey) => {
    if (targetTab && activeTab !== targetTab) {
      setActiveTab(targetTab);
    }
    if (!fieldId) return;
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = (el.matches('input, select, textarea, button')
          ? el
          : el.querySelector<HTMLElement>('input, select, textarea, button') || el) as HTMLElement;
        if (focusable && typeof focusable.focus === 'function') {
          focusable.focus({ preventScroll: true });
        }
        el.classList.add('field-highlight-error');
        setTimeout(() => {
          el.classList.remove('field-highlight-error');
        }, 3600);
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    }, 120);
  };

  // Tab-level validation helper for mandatory fields with auto-focus jump metadata
  interface TabValidationResult {
    valid: boolean;
    message?: string;
    fieldId?: string;
    targetTab?: TabKey;
  }

  const validateTab = (tab: TabKey): TabValidationResult => {
    if (tab === 'work') {
      if (!workSelection) {
        return {
          valid: false,
          message: 'Please select a PM maintenance order or notification to begin.',
          fieldId: 'field-work-selection',
          targetTab: 'work'
        };
      }
    }
    if (tab === 'general') {
      if (!permitType) {
        return {
          valid: false,
          message: 'Permit Category is mandatory. Select the primary work category.',
          fieldId: 'field-permit-type',
          targetTab: 'general'
        };
      }
      if (!jobDesc.trim()) {
        return {
          valid: false,
          message: 'Job Description is mandatory.',
          fieldId: 'field-job-desc',
          targetTab: 'general'
        };
      }
      if (!areaLoc.trim()) {
        return {
          valid: false,
          message: 'Work Area / Functional Location is mandatory.',
          fieldId: 'field-area-loc',
          targetTab: 'general'
        };
      }
      if (tplnr && tplnr.length > 40) {
        return {
          valid: false,
          message: 'Functional Location (Tplnr) exceeds the 40-character limit of SAP PermitInfo.',
          fieldId: 'field-tplnr',
          targetTab: 'general'
        };
      }
      if (!validFromD || !validToD) {
        return {
          valid: false,
          message: 'Permit Start Date and End Date are mandatory.',
          fieldId: 'field-valid-from-datetime',
          targetTab: 'general'
        };
      }
      if (!validFromT || !validToT) {
        return {
          valid: false,
          message: 'Permit Start Time and End Time are mandatory.',
          fieldId: 'field-valid-from-datetime',
          targetTab: 'general'
        };
      }
      if (!supvName.trim()) {
        return {
          valid: false,
          message: 'Supervisor Name is mandatory.',
          fieldId: 'field-supv-name',
          targetTab: 'general'
        };
      }
      if (!supvPhone.trim()) {
        setSupvPhoneTouched(true);
        return {
          valid: false,
          message: 'Supervisor Phone is mandatory. Enter a valid 10-digit mobile number.',
          fieldId: 'field-supv-phone',
          targetTab: 'general'
        };
      }
      const supvPhoneVal = validatePhoneNumber(supvPhone, true);
      if (!supvPhoneVal.isValid) {
        setSupvPhoneTouched(true);
        return {
          valid: false,
          message: `Supervisor Phone: ${supvPhoneVal.error}`,
          fieldId: 'field-supv-phone',
          targetTab: 'general'
        };
      }
      if (!execDept.trim()) {
        return {
          valid: false,
          message: 'Execution Department is mandatory. Select the responsible department.',
          fieldId: 'field-exec-dept-container',
          targetTab: 'general'
        };
      }
      if (filteredPlantOptions.length > 0 && !execPlant.trim()) {
        return {
          valid: false,
          message: `Executing Sub Working Plant is mandatory for ${execDept}. Select a sub working plant.`,
          fieldId: 'field-exec-dept-container',
          targetTab: 'general'
        };
      }
      if (!gasTestRequired || (gasTestRequired !== 'Y' && gasTestRequired !== 'N' && gasTestRequired !== 'X')) {
        return {
          valid: false,
          message: 'Gas Testing Required choice is mandatory in Section 2.6. Select Yes or No.',
          fieldId: 'field-gas-testing-required',
          targetTab: 'general'
        };
      }
      if (!isolationRequired || (isolationRequired !== 'X' && isolationRequired !== 'Y' && isolationRequired !== ' ' && isolationRequired !== 'N')) {
        return {
          valid: false,
          message: 'Isolation Required (LOTO) choice is mandatory in Section 2.6. Select Yes or No.',
          fieldId: 'field-isolation-required',
          targetTab: 'general'
        };
      }
      if ((isolationRequired === 'X' || isolationRequired === 'Y') && !isolationNo.trim()) {
        return {
          valid: false,
          message: 'Isolation Certificate No is mandatory when physical isolation is required in Section 2.6.',
          fieldId: 'field-isolation-no',
          targetTab: 'general'
        };
      }
      if ((gasTestRequired === 'Y' || gasTestRequired === 'X') && !gasTestFreqHr) {
        return {
          valid: false,
          message: 'Atmospheric gas retest frequency interval is mandatory when gas testing is required in Section 2.6.',
          fieldId: 'field-gas-test-freq',
          targetTab: 'general'
        };
      }
    }
    if (tab === 'procedure') {
      if (sitePlan.nature.length === 0) {
        return {
          valid: false,
          message: 'Nature of Work is mandatory. Select at least one planned work activity in Section B.',
          fieldId: 'field-nature-of-work',
          targetTab: 'procedure'
        };
      }
      if (sitePlan.nature.includes('Other') && !(sitePlan.fields.OTHER_NATURE || sitePlan.fields.NOTE)?.trim()) {
        return {
          valid: false,
          message: 'Please specify the other nature of work in Section B.',
          fieldId: 'procedure-other-nature',
          targetTab: 'procedure'
        };
      }
      if (sitePlan.tools.length === 0) {
        return {
          valid: false,
          message: 'Tools & Equipment declaration is mandatory. Select at least one tool in Section C.',
          fieldId: 'field-tools-equipment',
          targetTab: 'procedure'
        };
      }
      if (sitePlan.tools.includes('Other') && !(sitePlan.fields.OTHER_TOOLS || sitePlan.fields.NOTE)?.trim()) {
        return {
          valid: false,
          message: 'Please specify the other tools & equipment in Section C.',
          fieldId: 'procedure-other-tools',
          targetTab: 'procedure'
        };
      }
      if ((permitType === 'OTHER' || sitePlan.additionalTypes.includes('OTHER')) && !sitePlan.fields.OTHR?.trim()) {
        return {
          valid: false,
          message: 'Please specify the scope and required controls for Other work in Section A / D.',
          fieldId: 'procedure-field-OTHR',
          targetTab: 'procedure'
        };
      }
      if (!sitePlan.fields.JSA1?.trim()) {
        return {
          valid: false,
          message: 'Signed JSA document reference is mandatory in Section D.',
          fieldId: 'procedure-field-JSA1',
          targetTab: 'procedure'
        };
      }
      if (!sitePlan.fields.JSA2?.trim()) {
        return {
          valid: false,
          message: 'JSA team / joint site visit notes are mandatory in Section D.',
          fieldId: 'procedure-field-JSA2',
          targetTab: 'procedure'
        };
      }
      if (!sitePlan.fields.SHFT?.trim()) {
        return {
          valid: false,
          message: 'Planned shift end time is mandatory in Section D.',
          fieldId: 'procedure-field-SHFT',
          targetTab: 'procedure'
        };
      }
      if (!sitePlan.fields.ISSR?.trim()) {
        return {
          valid: false,
          message: 'Proposed Issuer SAP user ID is mandatory in Section D.',
          fieldId: 'procedure-field-ISSR',
          targetTab: 'procedure'
        };
      }
      if (!sitePlan.fields.ACCP?.trim()) {
        return {
          valid: false,
          message: 'Proposed Acceptor SAP user ID is mandatory in Section D.',
          fieldId: 'procedure-field-ACCP',
          targetTab: 'procedure'
        };
      }
      if (!sitePlan.fields.OPER?.trim()) {
        return {
          valid: false,
          message: 'Proposed Area Operator SAP user ID is mandatory in Section D.',
          fieldId: 'procedure-field-OPER',
          targetTab: 'procedure'
        };
      }
    }
    if (tab === 'workers') {
      if (workers.length === 0) {
        if (newWorkerName.trim() && newWorkerPhone.trim()) {
          const phoneCheck = validatePhoneNumber(newWorkerPhone, true);
          if (phoneCheck.isValid) {
            const hasId = (newWorkerType === 'EMP' && newWorkerEmpId.trim()) || (newWorkerType === 'CONT' && newWorkerContractorName.trim());
            if (hasId) {
              const newWorker: WorkerRecord = {
                PermitNo: permitNo,
                ItemNo: '1',
                WorkerTypeCode: newWorkerType,
                WorkerName: newWorkerName.toUpperCase(),
                PhoneNo: newWorkerPhone.trim(),
                ContractorId: '',
                ContractorName: newWorkerType === 'CONT' ? newWorkerContractorName.trim() : '',
                EmpId: newWorkerType === 'EMP' ? newWorkerEmpId.trim() : '',
                Shift: shift
              };
              setWorkers([newWorker]);
              setPersonsQty(1);
              setNewWorkerName('');
              setNewWorkerPhone('');
              setNewWorkerEmpId('');
              setNewWorkerContractorName('');
              return { valid: true };
            }
          }
        }
        return {
          valid: false,
          message: 'Add at least one crew member in Crew Muster before proceeding.',
          fieldId: 'field-worker-name',
          targetTab: 'workers'
        };
      }
    }
    if (tab === 'ppe') {
      if (newPpeCode.trim() && newPpeDescription.trim()) {
        const nextNo = String(ppeItems.length + 1);
        const autoPpe: PPERecord = {
          PermitNo: '',
          ItemNo: nextNo,
          PpeCode: newPpeCode.trim(),
          PpeDesc: newPpeDescription.trim(),
          IsRequired: 'Y',
          IsAvailable: 'N',
          IsIssued: 'N',
          CheckedBy: '',
          CheckedAt: null,
          Remarks: ''
        };
        setPpeItems((prev) => [...prev, autoPpe]);
        setNewPpeCode('');
        setNewPpeDescription('');
      } else if (ppeItems.length === 0) {
        if (newPpeCode.trim() && !newPpeDescription.trim()) {
          return {
            valid: false,
            message: 'PPE Description is mandatory for the entered PPE Code. Click "+" to add it.',
            fieldId: 'field-ppe-desc',
            targetTab: 'ppe'
          };
        }
        return {
          valid: false,
          message: 'Personal Protective Equipment (PPE) declaration is mandatory. Add at least one required PPE item.',
          fieldId: 'field-ppe-code',
          targetTab: 'ppe'
        };
      }
    }
    if (tab === 'hazards') {
      if (newHazardDesc.trim() && newControlDesc.trim()) {
        const cellDef = getRiskMatrixCell(selectedMatrixCell.c, selectedMatrixCell.l);
        const autoH: HazardControlRecord = {
          PermitNo: permitNo,
          ItemNo: String(hazards.length + 1),
          HazardCode: newHazardCode,
          HazardDesc: newHazardDesc.toUpperCase(),
          RiskLevel: cellDef.sapRiskLevel,
          ControlCode: newControlCode,
          ControlDesc: newControlDesc,
          ControlStatus: 'OPEN',
          ResponsibleUser: user?.id || personResp,
          VerifiedBy: '',
          VerifiedAt: null,
          Remarks: `[5x5 S=${selectedMatrixCell.c}, L=${selectedMatrixCell.l}, Score=${cellDef.score}: ${cellDef.riskLabel.toUpperCase()}] MANDATORY CONTROL VERIFICATION`
        };
        setHazards((prev) => [...prev, autoH]);
        setNewHazardDesc('');
        setNewControlDesc('');
      } else if (hazards.length === 0) {
        if (newHazardDesc.trim() && !newControlDesc.trim()) {
          return {
            valid: false,
            message: 'Control Description is mandatory for the entered hazard.',
            fieldId: 'field-control-desc',
            targetTab: 'hazards'
          };
        }
        return {
          valid: false,
          message: 'Add at least one hazard and required risk control before proceeding.',
          fieldId: 'field-hazard-desc',
          targetTab: 'hazards'
        };
      }
    }
    if (tab === 'gas-isolation') {
      const isIso = isolationRequired === 'X' || isolationRequired === 'Y';
      if (isIso && !isolationNo.trim()) {
        return {
          valid: false,
          message: 'Isolation certificate number is required when positive isolation is selected.',
          fieldId: 'field-isolation-no',
          targetTab: 'gas-isolation'
        };
      }
      const isGas = gasTestRequired === 'X' || gasTestRequired === 'Y';
      if (isGas && !gasTestFreqHr) {
        return {
          valid: false,
          message: 'Gas test frequency interval (1h or 2h) is required when gas testing is selected.',
          fieldId: 'field-gas-test-freq',
          targetTab: 'gas-isolation'
        };
      }
    }
    return { valid: true };
  };

  const handleNextStep = () => {
    const tabs: TabKey[] = ['work', 'general', 'procedure', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
    const currentIndex = tabs.indexOf(activeTab);
    const validation = validateTab(activeTab);
    if (!validation.valid && validation.message) {
      toast.warning(validation.message, { title: 'Mandatory Field Missing' });
      if (validation.fieldId) {
        jumpToField(validation.fieldId, validation.targetTab || activeTab);
      }
      return;
    }
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handleTabSelect = (targetKey: TabKey) => {
    const tabs: TabKey[] = ['work', 'general', 'procedure', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
    const targetIndex = tabs.indexOf(targetKey);
    const currentIndex = tabs.indexOf(activeTab);

    // If moving forward, validate all steps sequentially up to targetIndex
    if (targetIndex > currentIndex) {
      for (let i = currentIndex; i < targetIndex; i++) {
        const stepToValidate = tabs[i];
        const validation = validateTab(stepToValidate);
        if (!validation.valid && validation.message) {
          toast.warning(validation.message, { title: 'Mandatory Field Missing' });
          if (validation.fieldId) {
            jumpToField(validation.fieldId, validation.targetTab || stepToValidate);
          }
          return;
        }
      }
    }
    setActiveTab(targetKey);
  };

  // 7. Add Worker Handler
  const handleAddWorker = () => {
    if (!newWorkerName.trim()) {
      const msg = 'Worker Full Name is mandatory.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-worker-name', 'workers');
      return;
    }
    if (!newWorkerPhone.trim()) {
      setWorkerPhoneTouched(true);
      const msg = 'Worker Phone Number is mandatory. Enter a 10-digit mobile number.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-worker-phone', 'workers');
      return;
    }
    const workerPhoneCheck = validatePhoneNumber(newWorkerPhone, true);
    if (!workerPhoneCheck.isValid) {
      setWorkerPhoneTouched(true);
      const msg = `Worker Phone: ${workerPhoneCheck.error}`;
      toast.warning(msg, { title: 'Invalid Phone Number' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-worker-phone', 'workers');
      return;
    }
    if (newWorkerType === 'EMP' && !newWorkerEmpId.trim()) {
      const msg = 'Employee ID is mandatory for company employee workers.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-worker-id', 'workers');
      return;
    }
    if (newWorkerType === 'CONT' && !newWorkerContractorName.trim()) {
      const msg = 'Contractor Company Name is mandatory for contractor workers.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-worker-id', 'workers');
      return;
    }
    const nextItemNo = (Math.max(0, ...workers.map(row => Number(row.ItemNo))) + 1).toString();
    const newWorker: WorkerRecord = {
      PermitNo: permitNo,
      ItemNo: nextItemNo,
      WorkerTypeCode: newWorkerType,
      WorkerName: newWorkerName.toUpperCase(),
      PhoneNo: newWorkerPhone.trim(),
      ContractorId: '',
      ContractorName: newWorkerType === 'CONT' ? newWorkerContractorName.trim() : '',
      EmpId: newWorkerType === 'EMP' ? newWorkerEmpId.trim() : '',
      Shift: shift
    };

    setWorkers([...workers, newWorker]);
    setPersonsQty(workers.length + 1);
    setNewWorkerName('');
    setNewWorkerPhone('');
    setWorkerPhoneTouched(false);
    setNewWorkerEmpId('');
    setNewWorkerContractorName('');
    toast.info(`Added worker ${newWorker.WorkerName} to crew muster.`);
  };

  const handleRemoveWorker = (itemNo: string) => {
    setWorkers(workers.filter((w) => w.ItemNo !== itemNo));
    setPersonsQty((prev) => Math.max(0, prev - 1));
  };

  // 8. Add Hazard Control Handler
  const handleAddHazard = () => {
    if (!newHazardDesc.trim()) {
      const msg = 'Hazard Description is mandatory.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-hazard-desc', 'hazards');
      return;
    }
    if (!newControlDesc.trim()) {
      const msg = 'Control Description is mandatory.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      jumpToField('field-control-desc', 'hazards');
      return;
    }
    const nextItemNo = (Math.max(0, ...hazards.map(row => Number(row.ItemNo))) + 1).toString();
    const cellDef = getRiskMatrixCell(selectedMatrixCell.c, selectedMatrixCell.l);
    const newH: HazardControlRecord = {
      PermitNo: permitNo,
      ItemNo: nextItemNo,
      HazardCode: newHazardCode,
      HazardDesc: newHazardDesc.toUpperCase(),
      RiskLevel: cellDef.sapRiskLevel,
      ControlCode: newControlCode,
      ControlDesc: newControlDesc,
      ControlStatus: 'OPEN',
      ResponsibleUser: user?.id || personResp,
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: `[5x5 S=${selectedMatrixCell.c}, L=${selectedMatrixCell.l}, Score=${cellDef.score}: ${cellDef.riskLabel.toUpperCase()}] MANDATORY CONTROL VERIFICATION`
    };
    setHazards([...hazards, newH]);
    setNewHazardDesc('');
    setNewControlDesc('');
    toast.info(`Added hazard control: ${newH.HazardDesc}`);
  };

  // 9. Interactive 5x5 Matrix Cell Click Handler
  const handleMatrixCellClick = (consequence: number, likelihood: number) => {
    setSelectedMatrixCell({ c: consequence, l: likelihood });
    const cellDef = getRiskMatrixCell(consequence, likelihood);

    setHazards((prev) =>
      prev.map((h, i) => (i === selectedHazardIdx ? { ...h, RiskLevel: cellDef.sapRiskLevel } : h))
    );
  };

  const fullPayload: PermitDeepInsertPayload = useMemo(() => {
    return {
      Permit_No: permitNo,
      PermitType: toSapPermitType(permitType) || permitType,

      Aufnr: aufnr,
      Qmnum: qmnum,
      Auart: auart,
      Qmart: workSelection?.reference.ReferenceSource === 'NOTIFICATION' ? workSelection.reference.OrderNotifType : '',
      Qmtxt: workSelection?.reference.ReferenceSource === 'NOTIFICATION' ? workSelection.reference.JobDescription : '',
      Qmdat: workSelection?.reference.ReferenceSource === 'NOTIFICATION' ? workSelection.reference.WorkDate : null,

      PersonResp: personResp,
      PlannerGroup: plannerGroup,

      PmBasicStartD: pmBasicStartD || null,
      PmBasicFinishD: pmBasicFinishD || null,
      PmFinalDueD: pmFinalDueD || null,

      Revision: revision,
      Priority: priority,
      Assembly: assembly,

      Equnr: equnr,
      Tplnr: tplnr,

      Werks: werks,
      Arbpl: arbpl,

      AreaLoc: areaLoc,
      JobDesc: jobDesc,
      ExecAgency: execAgency,
      ExecDept: formatExecutionTarget(
        execPlant,
        execDept,
        deptOptions.find(d => d.Config_Desc === execDept || d.Config_Code === execDept)?.Config_Code
      ),

      SupvName: supvName,
      SupvPhone: supvPhone,
      SafetyOfficer: safetyOfficer,

      Shift: shift,
      PersonsQty: personsQty,

      ValidFromD: validFromD || null,
      ValidFromT: validFromT ? (validFromT.length === 5 ? `${validFromT}:00` : validFromT) : '',
      ValidToD: validToD || null,
      ValidToT: validToT ? (validToT.length === 5 ? `${validToT}:00` : validToT) : '',

      GasTestFreqHr: (gasTestRequired === 'Y' || gasTestRequired === 'X') ? gasTestFreqHr : '',
      GasTestRequired: (gasTestRequired === 'Y' || gasTestRequired === 'X') ? 'X' : ' ',
      Status: isOnlyColdWork
        ? 'APPR'
        : (isolationRequired && gasTestRequired ? initialPermitStatus(isolationRequired, gasTestRequired) : 'INTD'),

      RefPermitNo: '',

      LotoRequired: (isolationRequired === 'X' || isolationRequired === 'Y') ? 'X' : ' ',
      LotoCertNo: (isolationRequired === 'X' || isolationRequired === 'Y') ? isolationNo : '',

      IsolationRequired: isolationRequired,
      IsolationRefType: (isolationRequired === 'X' || isolationRequired === 'Y') ? isolationRefType : '',
      IsolationNo: (isolationRequired === 'X' || isolationRequired === 'Y') ? isolationNo : '',
      IsolationStatus: (isolationRequired === 'X' || isolationRequired === 'Y') ? 'CRTD' : '',

      PermitIssuer: '',
      SuspendReason: '',
      CancelReason: '',

      Ernam: user?.id || '',
      Erdat: new Date().toISOString().slice(0, 10),
      Erzet: '00:00:00',

      CreatorComment: creatorComment,

      VerifiedBy: '',
      VerifiedDate: null,
      VerifiedTime: '00:00:00',
      VerifierComment: '',

      ApprovedBy: '',
      ApprovedDate: null,
      ApprovedTime: '00:00:00',
      ApproverComment: '',

      IssuedBy: '',
      IssuedDate: null,
      IssuedTime: '00:00:00',
      IssuerComment: '',

      Aenam: '',
      Aedat: null,
      Aezet: '00:00:00',

      LastChangedAt: null,

      _Worker: workers,
      _PPE: ppeItems,
      _Safety: [...sitePlanRows(permitType, sitePlan), ...safetyChecklist.filter(s => !s.ItemCode?.startsWith('Q'))],
      _HazardControl: hazards,
      _Isolation: [],
      _WorkType: workTypeRecords,
      _CHK: chkRecords,
      _Equipment: excludeChildNavs ? [] : equipmentRecords,
      _NATW: excludeChildNavs ? [] : natwRecords

    };
  }, [
    permitNo,
    permitType,
    aufnr,
    qmnum,
    auart,
    personResp,
    plannerGroup,
    pmBasicStartD,
    pmBasicFinishD,
    pmFinalDueD,
    revision,
    priority,
    assembly,
    equnr,
    tplnr,
    werks,
    arbpl,
    areaLoc,
    jobDesc,
    execAgency,
    execDept,
    execPlant,
    supvName,
    supvPhone,
    safetyOfficer,
    shift,
    personsQty,
    validFromD,
    validFromT,
    validToD,
    validToT,
    gasTestFreqHr,
    gasTestRequired,
    isolationRequired,
    isolationRefType,
    isolationNo,
    creatorComment,
    user,
    workers,
    ppeItems,
    safetyChecklist,
    sitePlan,
    hazards,
    isolations,
    workSelection,
    workTypeRecords,
    chkRecords,
    equipmentRecords,
    natwRecords,
    excludeChildNavs,
    isOnlyColdWork
  ]);

  const requestPreview = useMemo(() => {
    try { return { body: preparePermitCreate(fullPayload), error: '' }; }
    catch (error) { return { body: null, error: error instanceof Error ? error.message : 'Complete the required details.' }; }
  }, [fullPayload]);

  const completionPercentage = !workSelection ? 0 : requestPreview.error ? Math.min(baseCompletionPercentage, 90) : 100;

  // 12. Submit Deep Insert to SAP
  const handleSubmitDeepInsert = async () => {
    if (submissionLock.current || submissionResponse || creationUncertain) return;
    if (!workSelection) {
      toast.warning('Select a work reference before submitting the permit.', { title: 'Work Reference Required' });
      setNotificationBanner({ type: 'error', message: 'Select a work reference before submitting the permit.' });
      jumpToField('field-work-selection', 'work');
      return;
    }
    if (tplnr.length > 40) {
      toast.error('The selected functional location exceeds the 40-character limit of PermitInfo.', { title: 'Validation Error' });
      setNotificationBanner({ type: 'error', message: 'The selected functional location exceeds the 40-character limit of PermitInfo. Please resolve the location with the SAP team before submitting.' });
      jumpToField('field-tplnr', 'general');
      return;
    }
    if (!user) {
      toast.error('Sign in to SAP before creating a permit.', { title: 'Authentication Required' });
      setNotificationBanner({ type: 'error', message: 'Sign in to SAP before creating a permit.' });
      return;
    }

    // Sequentially validate all steps to catch any missing mandatory fields and auto-jump
    const tabsToValidate: TabKey[] = ['general', 'procedure', 'workers', 'ppe', 'hazards', 'gas-isolation'];
    for (const stepKey of tabsToValidate) {
      const result = validateTab(stepKey);
      if (!result.valid && result.message) {
        toast.warning(result.message, { title: 'Mandatory Field Missing' });
        setNotificationBanner({ type: 'error', message: result.message });
        if (result.fieldId) {
          jumpToField(result.fieldId, result.targetTab || stepKey);
        }
        return;
      }
    }

    try {
      preparePermitCreate(fullPayload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Check the permit details.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      if (msg.includes('ExecDept')) jumpToField('field-exec-dept-container', 'general');
      else if (msg.includes('PermitType')) jumpToField('field-permit-type', 'general');
      else if (msg.includes('JobDesc')) jumpToField('field-job-desc', 'general');
      else if (msg.includes('SupvName')) jumpToField('field-supv-name', 'general');
      else if (msg.includes('ValidFrom')) jumpToField('field-valid-from-datetime', 'general');
      else if (msg.includes('ValidTo')) jumpToField('field-valid-to-datetime', 'general');
      else if (msg.includes('crew') || msg.includes('worker')) jumpToField('field-worker-name', 'workers');
      else if (msg.includes('ppe') || msg.includes('protective')) jumpToField('field-ppe-code', 'ppe');
      else if (msg.includes('hazard')) jumpToField('field-hazard-desc', 'hazards');
      else if (msg.includes('gas')) jumpToField('field-gas-test-freq', 'gas-isolation');
      return;
    }
    submissionLock.current = true;
    setIsSubmitting(true);
    setNotificationBanner(null);

    // If revising a rejected permit, update changed fields and execute .Resubmit bound action
    if (revisionPermit) {
      try {
        const updates: Partial<PermitInfoRecord> = {
          JobDesc: jobDesc,
          AreaLoc: areaLoc,
          ExecDept: execDept,
          ExecAgency: execAgency,
          SupvName: supvName,
          SupvPhone: supvPhone,
          SafetyOfficer: safetyOfficer,
          Shift: shift,
          ValidFromD: validFromD,
          ValidFromT: validFromT.length === 5 ? `${validFromT}:00` : validFromT,
          ValidToD: validToD,
          ValidToT: validToT.length === 5 ? `${validToT}:00` : validToT,
          CreatorComment: creatorComment,
          GasTestFreqHr: gasTestFreqHr
        };
        await sitePermitApi.reviseAndResubmit(
          revisionPermit.Permit_No,
          updates,
          creatorComment || 'Resubmitted after addressing reviewer remarks',
          revisionPermit['@odata.etag']
        );
        toast.success(
          `Permit ${revisionPermit.Permit_No} revised and resubmitted for approval via SAP .Resubmit action!`,
          { title: 'Permit Revised & Resubmitted', duration: 7000 }
        );
        onBack?.();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to resubmit permit to SAP Gateway.', {
          title: 'Resubmission Failed'
        });
      } finally {
        submissionLock.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const response = await permitCreateApi.createPermitDeepInsert(fullPayload);
      clearDraft();
      const mergedResponse = {
        ...fullPayload,
        ...response,
        _WorkType: (response._WorkType && response._WorkType.length > 0) ? response._WorkType : fullPayload._WorkType,
        _Safety: (response._Safety && response._Safety.length > 0) ? response._Safety : fullPayload._Safety,
        _PPE: (response._PPE && response._PPE.length > 0) ? response._PPE : fullPayload._PPE,
        _Equipment: (response._Equipment && response._Equipment.length > 0) ? response._Equipment : fullPayload._Equipment,
        _Worker: (response._Worker && response._Worker.length > 0) ? response._Worker : fullPayload._Worker,
      };
      setSubmissionResponse(mergedResponse as unknown as PermitDeepInsertResponse);

      // Cache newly created permit for immediate discovery in Gas Tester and Isolation modules
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const stored = JSON.parse(window.localStorage.getItem('ptw_recent_created_permits') || '[]');
          const newEntry = {
            Permit_No: response.Permit_No,
            PermitType: response.PermitType || fullPayload.PermitType,
            Status: response.Status || fullPayload.Status || 'INTD',
            GasTestRequired: response.GasTestRequired || fullPayload.GasTestRequired || 'X',
            GasTestFreqHr: response.GasTestFreqHr || fullPayload.GasTestFreqHr || '2',
            AreaLoc: response.AreaLoc || fullPayload.AreaLoc || '',
            JobDesc: response.JobDesc || fullPayload.JobDesc || '',
            Werks: response.Werks || fullPayload.Werks || '',
            Erdat: response.Erdat || new Date().toISOString().slice(0, 10),
            Erzet: response.Erzet || '00:00:00'
          };
          const updated = [newEntry, ...stored.filter((p: any) => p?.Permit_No !== response.Permit_No)].slice(0, 50);
          window.localStorage.setItem('ptw_recent_created_permits', JSON.stringify(updated));
        }
      } catch (cacheErr) {
        console.warn('[PermitCreateModule] Could not cache created permit:', cacheErr);
      }

      // Automatically back-link the Isolation Certificate with the newly generated SAP Permit Number
      if (isolationNo.trim() && response.Permit_No) {
        try {
          await isolationApi.update(isolationNo.trim(), { PermitNo: response.Permit_No });
          console.log(`[PermitCreateModule] Successfully linked Permit ${response.Permit_No} to Isolation Certificate ${isolationNo.trim()}`);
        } catch (linkErr) {
          console.warn('[PermitCreateModule] Could not auto-backlink isolation certificate:', linkErr);
        }
      }

      const successMsg = `SAP OData V4 Deep Insert Successful! Permit ${response.Permit_No} created in status ${response.Status || 'not confirmed'}.`;
      toast.success(successMsg, { title: 'Permit Request Created', duration: 7000 });
      setNotificationBanner({
        type: 'success',
        message: successMsg
      });
    } catch (err: any) {
      if (err instanceof PermitCreateUnconfirmedError) setCreationUncertain(true);
      console.error('[PermitCreateModule] Submit error:', err);
      let errMsg = err.message || 'Failed to submit permit to SAP Gateway.';
      if (typeof errMsg === 'string') {
        if (errMsg.includes("association '_CHK'")) {
          errMsg = `${errMsg} — [SAP Backend Action Required: Enable creation on association '_CHK' by declaring 'association _CHK { create; }' in the ABAP Behavior Definition (ZI_PTW_HEADER.bdef) in ADT/Eclipse].`;
        } else if (errMsg.includes("association '_NATW'") || errMsg.includes("association '_Equipment'")) {
          errMsg = `${errMsg} — [SAP Backend Action Required: Enable creation on associations in the ABAP Behavior Definition (ZI_PTW_HEADER.bdef) with 'association _NATW { create; }' and 'association _Equipment { create; }'].`;
        } else if (errMsg.includes('key value is already in use') || errMsg.includes('already in use')) {
          errMsg = `${errMsg} — [SAP Backend Diagnostic: NATWType metadata defines ONLY 'PermitNo' as key without 'ItemNo'. If multiple Nature of Work items are selected, SAP detects key collisions. Backend CDS view must define 'key ItemNo' on NATWType].`;
        }
      }
      toast.error(errMsg, { title: 'SAP Gateway Error', duration: 12000 });
      setNotificationBanner({
        type: 'error',
        message: errMsg
      });
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCopyJson = () => {
    if (!requestPreview.body) return;
    navigator.clipboard.writeText(JSON.stringify(requestPreview.body, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handlePrevStep = () => {
    const tabs: TabKey[] = ['work', 'general', 'procedure', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
  };

  const stepsList: { key: TabKey; label: string; shortLabel: string; icon: string; count?: number }[] = [
    { key: 'work', label: '1. Work Selection', shortLabel: 'Work Source', icon: 'construction' },
    { key: 'general', label: '2. General Details', shortLabel: 'General & PM', icon: 'info' },
    { key: 'procedure', label: '3. Client Procedure', shortLabel: 'Procedure', icon: 'fact_check' },
    { key: 'workers', label: '4. Crew Muster', shortLabel: 'Crew Ledger', icon: 'group', count: workers.length },
    { key: 'ppe', label: '5. PPE & Safety', shortLabel: 'PPE & Safety', icon: 'security', count: ppeItems.length },
    { key: 'hazards', label: '6. Hazards & 5x5 Risk', shortLabel: '5×5 Risk Matrix', icon: 'warning', count: hazards.length },
    { key: 'gas-isolation', label: '7. Isolation Plan', shortLabel: 'Gas & Isolation', icon: 'air', count: isolations.length },
    { key: 'payload', label: '8. Review & Submit', shortLabel: 'Review & Send', icon: 'verified' }
  ];

  if (submissionResponse) return (
    <div className="relative">
      <section className="no-print mx-auto mt-10 max-w-2xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-emerald-800">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Permit Request Created</h1>
            <p className="text-xs text-emerald-600 font-mono">SAP Gateway OData V4 Deep Insert Confirmed</p>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-600 font-medium">SAP Permit Number:</span>
            <span className="font-mono font-bold text-lg text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200">
              {submissionResponse.Permit_No}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-600 font-medium">Initial Status:</span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded ${(submissionResponse.Status || fullPayload.Status) === 'APPR'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : (submissionResponse.Status || fullPayload.Status) === 'INTD'
                  ? 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                  : 'text-amber-700 bg-amber-50 border border-amber-200'
              }`}>
              {submissionResponse.Status || fullPayload.Status || (isOnlyColdWork ? 'APPR' : 'CRTD')}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-600 font-medium">Document Standard:</span>
            <span className="font-mono text-xs text-slate-700">HSE/SAF/02 Rev-08 (Annexure-V)</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-600 leading-relaxed">
          Complete the required approval, isolation and gas-testing workflow before work starts in the field.
          You can print the official Annexure-V permit document immediately for site clearance.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[17px]">print</span>
            <span>Print Official Permit (Annexure-V)</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[17px]">grid_view</span>
            <span>Return to Launchpad</span>
          </button>
        </div>
      </section>

      {/* Print Preview Modal */}
      <PermitPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        permit={submissionResponse}
      />

      {/* Dedicated Print Document Render (fallback when modal is closed) */}
      {!showPrintModal && (
        <div className="print-only">
          <PermitAnnexPrintView permit={submissionResponse} includeReverseSide={false} />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto py-2.5 px-3 sm:px-5 lg:px-6 animate-in fade-in duration-300">
      {/* Unified Executive Navigation Header & Stage Pipeline */}
      <header className="mb-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-gradient-to-r from-sky-50/80 via-white to-slate-50/90 border-b border-slate-200/70">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-[#006398] text-slate-700 hover:text-[#006398] rounded-xl text-xs font-mono font-semibold transition-all shadow-2xs group shrink-0"
              >
                <span className="material-symbols-outlined text-[17px] group-hover:-translate-x-0.5 transition-transform">
                  arrow_back
                </span>
                <span>Launchpad</span>
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-slate-400">PTW /</span>
                <h1 className="font-display font-bold text-sm sm:text-base text-slate-900 leading-tight">
                  {revisionPermit ? `Revise Permit: ${revisionPermit.Permit_No}` : 'Create Permit Request'}
                </h1>
                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  revisionPermit ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-[#006398] border-blue-200'
                }`}>
                  {revisionPermit ? 'Revision Mode (REJT)' : 'SAP Auto-Numbered'}
                </span>
                {lastSaved && (
                  <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-emerald-600">cloud_done</span>
                    <span>Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Work linkage indicator + Progress meter + Header Quick Controls */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
            {workSelection ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-mono">
                <span className="material-symbols-outlined text-[15px] text-[#006398]">link</span>
                <span className="font-bold text-[#006398]">{workSelection.category}</span>
                <span className="text-slate-500 truncate max-w-[140px] sm:max-w-none">
                  · {workSelection.source} {referenceId(workSelection.source, workSelection.reference)}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('work')}
                  className="ml-1 text-[11px] text-[#006398] hover:underline font-bold"
                  title="Change linked SAP work reference"
                >
                  Change
                </button>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">info</span>
                <span>Select work reference to begin</span>
              </span>
            )}

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="px-2.5 py-1 rounded-xl font-mono text-xs font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                {completionPercentage}%
              </span>

              {activeTab !== 'work' && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-mono font-semibold transition-all shadow-2xs"
                  title="Previous Step"
                >
                  ←
                </button>
              )}

              {activeTab !== 'payload' ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-3 py-1 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1 shadow-2xs transition-all"
                  title="Next Step"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitDeepInsert}
                  disabled={isSubmitting || creationUncertain || !workSelection || !!requestPreview.error}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1 shadow-2xs transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">{isSubmitting ? 'sync' : 'send'}</span>
                  <span>{isSubmitting ? 'Posting...' : 'Submit'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Streamlined Horizontal 8-Step Interactive Pipeline Ribbon */}
        <div className="px-2 py-1.5 bg-slate-50/70 overflow-x-auto">
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5 min-w-[700px]">
            {stepsList.map((st, idx) => {
              const isCurrent = activeTab === st.key;
              const isCompleted = idx < stepsList.findIndex((s) => s.key === activeTab);
              const isDisabled = st.key !== 'work' && !workSelection;

              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleTabSelect(st.key)}
                  disabled={isDisabled}
                  className={`px-2 py-1.5 rounded-xl text-left transition-all flex items-center justify-between gap-1 select-none ${isDisabled
                      ? 'opacity-40 cursor-not-allowed bg-slate-100/60 text-slate-400 border border-transparent'
                      : isCurrent
                        ? 'bg-white text-[#006398] font-bold border border-[#006398] shadow-xs ring-1 ring-[#006398]/30 -translate-y-0.5'
                        : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`material-symbols-outlined text-[15px] shrink-0 ${isCurrent ? 'text-[#006398]' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isCompleted && !isCurrent ? 'check_circle' : st.icon}
                    </span>
                    <span className="text-[11px] font-semibold truncate leading-tight">
                      {st.shortLabel}
                    </span>
                  </div>
                  {st.count !== undefined && st.count > 0 && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold shrink-0 ${isCurrent ? 'bg-sky-100 text-[#006398]' : 'bg-slate-100 text-slate-600'
                      }`}>
                      {st.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-1 bg-slate-200/70 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#006398] via-sky-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </header>

      {/* Revision Mode Rejection Reason Banner */}
      {revisionPermit && (
        <div className="mb-3.5 p-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-700 text-2xl mt-0.5">edit_note</span>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-bold text-amber-950 text-sm">
                  Revising Rejected Permit: <span className="font-mono text-amber-900">{revisionPermit.Permit_No}</span>
                </h4>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  STATUS: REJECTED ({revisionPermit.Status})
                </span>
              </div>
              {(() => {
                const rej = revisionPermit._Approval?.find(a => a.Action === 'RJ' || a.Action === 'REJECTED' || a.Action === 'REJT');
                if (!rej) return null;
                return (
                  <div className="p-2.5 rounded-xl bg-white/90 border border-rose-200 text-xs text-rose-950 space-y-1">
                    <div className="font-mono font-bold text-rose-800 text-[11px] flex items-center justify-between">
                      <span>Approver {rej.SignedBy || 'Reviewer'} noted:</span>
                      <span>{rej.ActionDate || ''} {rej.ActionTime || ''}</span>
                    </div>
                    <p className="text-slate-800 font-medium italic">&ldquo;{rej.Comments || 'Please correct requested items before resubmitting.'}&rdquo;</p>
                  </div>
                );
              })()}
              <p className="text-xs text-amber-900 leading-relaxed">
                Edit the fields requested by the approver across the tabs below. Once ready, click <strong>&ldquo;Save Changes & Resubmit for Approval&rdquo;</strong> to update the SAP record and trigger the bound action <code className="font-mono font-bold text-[#006398]">.Resubmit</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Creation Uncertain Diagnostic & Recovery Card */}
      {creationUncertain && (
        <div className="mb-3.5 p-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-2xl mt-0.5">warning</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-amber-950 text-sm">
                  SAP Save Result Unconfirmed (HTTP 500 / Network Disconnect)
                </h4>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  Form Protected
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                The permit request was dispatched to SAP Gateway, but SAP returned an internal error (HTTP 500) or connection timeout.
                Because SAP began processing the request before the failure, a permit may or may not have been created in the SAP database.
              </p>

              {notificationBanner?.message && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-100/90 border border-amber-200 text-amber-950 font-mono text-[11px] break-words">
                  {notificationBanner.message}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setCreationUncertain(false);
                    toast.info('Form unlocked. You can now edit and re-try submitting.');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">lock_open</span>
                  <span>Unlock Form to Edit / Re-try</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsCheckingRecentPermits(true);
                    try {
                      const list = await sitePermitApi.list(werks, '', 0);
                      const recent = list.slice(0, 5);
                      setRecentSapPermits(recent);
                      toast.success(`Queried SAP for Plant ${werks}: Found ${list.length} permits.`);
                    } catch (e: any) {
                      toast.error('Could not query SAP permit list: ' + (e?.message || ''));
                    } finally {
                      setIsCheckingRecentPermits(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">search</span>
                  <span>{isCheckingRecentPermits ? 'Checking SAP...' : 'Check Recent Permits in SAP'}</span>
                </button>

                {!excludeChildNavs && (
                  <button
                    type="button"
                    onClick={() => {
                      setExcludeChildNavs(true);
                      setCreationUncertain(false);
                      toast.info('Excluded _Equipment and _NATW child tables. Nature and tools remain stored in _Safety table.');
                    }}
                    className="px-3 py-1.5 bg-sky-50 border border-sky-300 hover:bg-sky-100 text-sky-900 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                    title="If SAP backend does not have _Equipment / _NATW enabled in the Behavior Definition yet, exclude them and submit with _Safety"
                  >
                    <span className="material-symbols-outlined text-[15px]">tune</span>
                    <span>Exclude _Equipment &amp; _NATW and Unlock</span>
                  </button>
                )}
              </div>

              {recentSapPermits && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-800">Latest 5 permits in SAP Plant {werks}:</span>
                    <button
                      type="button"
                      onClick={() => setRecentSapPermits(null)}
                      className="text-slate-400 hover:text-slate-600 text-[11px]"
                    >
                      Dismiss
                    </button>
                  </div>
                  {recentSapPermits.length === 0 ? (
                    <p className="text-slate-500 mt-2">No recent permits found in plant {werks}.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-100 font-mono text-[11px]">
                      {recentSapPermits.map((p) => (
                        <li key={p.Permit_No} className="py-1.5 flex items-center justify-between flex-wrap gap-2">
                          <span className="font-bold text-[#006398]">{p.Permit_No} ({p.PermitType})</span>
                          <span className="text-slate-600 truncate max-w-[200px] sm:max-w-none">{p.JobDesc}</span>
                          <span className="text-slate-500">{p.Status} · {p.Erdat} {p.Erzet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Alert Banner */}
      {notificationBanner && (
        <div
          className={`mb-3 p-3 rounded-xl border flex items-center justify-between text-xs font-sans shadow-2xs ${notificationBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : notificationBanner.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {notificationBanner.type === 'success' ? 'check_circle' : notificationBanner.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{notificationBanner.message}</span>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Restore Unsaved Draft Banner */}
      {hasDraft && (
        <aside aria-label="Draft Recovery Banner" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-amber-900">
            <span className="material-symbols-outlined text-[18px] text-amber-600">history_edu</span>
            <div>
              <span className="font-bold">Unsaved Permit Draft Available:</span>
              <span className="ml-1 text-amber-800">
                Preserved uncommitted permit data found from previous session
                {savedTimestamp ? ` (${new Date(savedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-2.5 py-1 bg-[#006398] hover:bg-[#004f7a] text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[13px]">restore</span>
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 font-medium rounded-lg text-xs transition-colors"
            >
              Discard
            </button>
          </div>
        </aside>
      )}

      {/* Main Form Work Area Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden mb-4">
        {/* Tab Content Panes */}
        <fieldset disabled={isSubmitting || creationUncertain} className="p-3.5 sm:p-5 lg:p-6 min-w-0">
          {activeTab === 'work' && (
            <PermitWorkSelectionStep selection={workSelection} client={user?.client}
              onInvalidate={() => { setWorkSelection(null); setSubmissionResponse(null); setNotificationBanner(null); }}
              onContinue={handleWorkSelected} />
          )}
          {activeTab === 'procedure' && (
            <SiteProcedureStep
              primary={permitType}
              plan={sitePlan}
              startTime={validFromT}
              onChange={setSitePlan}
              onOpenChecklist={handleOpenChecklistForCategory}
              checklistProgress={checklistProgressMap}
            />
          )}

          {/* TAB 1: General Details & PM Order */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* SECTION 2.1: Permit Category & Nature of Work */}
              <SectionCard
                theme="blue"
                sectionTag="SECTION 2.1"
                title="Permit Category & Nature of Work"
                subtitle="Select the primary high-risk work category. This defines the required safety protocols and compliance checklist."
                icon="category"
                badge={
                  permitType ? (
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-100 text-[#006398]">
                      Selected: {PERMIT_CATEGORIES.find((c) => c.code === permitType || c.sapCode === permitType)?.label || permitType} ({toSapPermitType(permitType) || permitType})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800">
                      Category Required *
                    </span>
                  )
                }
              >
                <div className="space-y-4">
                  {/* Dropdown created from Config OData */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="ptw-label font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#006398]">tune</span>
                        <span>Permit Category / Type (SAP Config OData)</span>
                        <span className="text-red-500">*</span>
                      </label>
                      {permitType && (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                            Payload Code: <strong>{toSapPermitType(permitType)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                    <select
                      id="field-permit-type"
                      value={toSapPermitType(permitType) || permitType}
                      onChange={(e) => void handleSelectPermitType(e.target.value)}
                      className="ptw-select font-mono text-xs bg-white"
                    >
                      <option value="" disabled>Select permit type from SAP config dropdown...</option>
                      {(permitTypeOptions.length > 0
                        ? permitTypeOptions
                        : [
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'COLD', Config_Desc: 'COLD WORK' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'CSE', Config_Desc: 'CONFINED SPACE ENTRY' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'EXCV', Config_Desc: 'EXCAVATION' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'HOT', Config_Desc: 'HOT WORK' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'HYD_PNEU', Config_Desc: 'HYDRAULIC & PNEUMATIC SYSTEM' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'LBRK', Config_Desc: 'LINE BREAK' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'RAD', Config_Desc: 'RADIOGRAPHY' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'RIG', Config_Desc: 'RIGGING' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'W@H', Config_Desc: 'WORK AT HEIGHT' },
                          { Config_Type: 'PERMIT_TYPE', Config_Code: 'ELEC', Config_Desc: 'ELECTRICAL' },
                        ]
                      ).map((item) => (
                        <option key={item.Config_Code} value={item.Config_Code}>
                          {item.Config_Desc} ({item.Config_Code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 font-sans">
                      Select directly from the SAP configuration dropdown or choose from the quick category cards below. Both stay synchronized.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                    {PERMIT_CATEGORIES.map((t) => {
                      const isSelected = permitType === t.code || permitType === t.sapCode;
                      return (
                        <div
                          key={t.code}
                          onClick={() => void handleSelectPermitType(t.sapCode)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${isSelected
                              ? 'bg-sky-50/80 border-[#006398] shadow-xs text-[#006398] ring-2 ring-[#006398]/20'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-slate-600'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#006398] text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                            </div>
                            {isSelected && (
                              <span className="material-symbols-outlined text-[18px] text-[#006398]">check_circle</span>
                            )}
                          </div>
                          <span className="font-bold text-xs text-slate-900">{t.label}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.sapCode} · {t.desc}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamic SAP Compliance Questionnaire Status Strip */}
                  {isLoadingChecklist && (
                    <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 flex items-center gap-2.5 text-xs text-sky-800">
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      <span>Checking SAP for required compliance checklist questionnaire...</span>
                    </div>
                  )}

                  {!isLoadingChecklist && permitType && (categoryQuestions[toSapChecklistPermitType(permitType)] || []).length > 0 && (() => {
                    const primarySap = toSapChecklistPermitType(permitType);
                    const pQuestions = categoryQuestions[primarySap] || [];
                    const pAnswers = categoryAnswers[primarySap] || {};
                    let pAnswered = 0;
                    let pYes = 0; let pNo = 0; let pNa = 0;
                    pQuestions.forEach((q) => {
                      const r = pAnswers[q.QuestionaireId]?.response;
                      if (r === 'YES') { pYes++; pAnswered++; }
                      else if (r === 'NO') { pNo++; pAnswered++; }
                      else if (r === 'NA') { pNa++; pAnswered++; }
                    });
                    const pPercent = pQuestions.length > 0 ? Math.round((pAnswered / pQuestions.length) * 100) : 0;
                    const isComplete = pQuestions.length > 0 && pAnswered === pQuestions.length;

                    return (
                      <div className="p-4 rounded-xl border border-[#006398]/30 bg-gradient-to-r from-sky-50/70 via-slate-50 to-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#006398] text-white flex items-center justify-center shadow-xs shrink-0">
                            <span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                                {PERMIT_CATEGORIES.find((c) => c.code === permitType || c.sapCode === permitType)?.label || permitType} Compliance Checklist
                              </span>
                              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                                SAP: {primarySap}
                              </span>
                              {isComplete ? (
                                <span className="px-2 py-0.5 rounded-full font-sans text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  Complete
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full font-sans text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">warning</span>
                                  Verification Pending
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {pAnswered} of {pQuestions.length} questions completed ({pPercent}%)
                              {pAnswered > 0 && (
                                <span className="ml-2 font-mono text-[11px] text-slate-600">
                                  · YES: {pYes} · NO: {pNo} · NA: {pNa}
                                </span>
                              )}
                              {sitePlan.additionalTypes.length > 0 && (
                                <span className="ml-2 font-mono text-[11px] text-[#006398] font-bold">
                                  · +{sitePlan.additionalTypes.length} additional work {sitePlan.additionalTypes.length === 1 ? 'checklist' : 'checklists'} in Step 3
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleOpenChecklistForCategory(permitType)}
                          className="px-4 py-2 rounded-xl bg-[#006398] hover:bg-[#004e78] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">fact_check</span>
                          {isComplete ? 'Review Checklist' : 'Fill Compliance Questionnaire'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </SectionCard>

              {/* SECTION 2.2: SAP Maintenance Order (MO) & Notification Context */}
              <SectionCard
                theme="slate"
                sectionTag="SECTION 2.2"
                title="SAP Maintenance Order & Notification Linkage"
                subtitle="Master data linked directly from SAP S/4HANA (Read-only master data)."
                icon="construction"
                badge={
                  <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    SAP Master Data
                  </span>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
                  <div>
                    <label className="ptw-label flex items-center justify-between">
                      <span>MO Number (Aufnr)</span>
                      <span className="text-[10px] text-slate-400 font-mono">SAP MO</span>
                    </label>
                    <input
                      type="text"
                      value={aufnr}
                      readOnly
                      placeholder="e.g. 400100001"
                      className="ptw-input font-mono bg-slate-50 text-slate-700 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="ptw-label flex items-center justify-between">
                      <span>Notification (Qmnum)</span>
                      <span className="text-[10px] text-slate-400 font-mono">SAP M2</span>
                    </label>
                    <input
                      type="text"
                      value={qmnum}
                      readOnly
                      placeholder="e.g. 100100000001"
                      className="ptw-input font-mono bg-slate-50 text-slate-700 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="ptw-label flex items-center justify-between">
                      <span>Order Type (Auart)</span>
                      <span className="text-[10px] text-slate-400 font-mono">SAP Type</span>
                    </label>
                    <input
                      type="text"
                      value={auart}
                      readOnly
                      className="ptw-input font-mono bg-slate-50 text-slate-700 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="ptw-label">Assembly Tag</label>
                    <input
                      type="text"
                      value={assembly}
                      onChange={(e) => setAssembly(e.target.value)}
                      placeholder="e.g. PUMP-01-MECH"
                      className="ptw-input font-mono"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* SECTION 2.3: Plant, Functional Location & Work Center */}
              <SectionCard
                theme="indigo"
                sectionTag="SECTION 2.3"
                title="Plant, Equipment & Work Area Location"
                subtitle="Geographic work area, operating unit, plant work center, and associated equipment tag."
                icon="pin_drop"
              >
                <div className="space-y-4 font-sans text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <label className="ptw-label">
                        Plant (Werks) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={werks}
                        onChange={(e) => setWerks(e.target.value)}
                        className="ptw-input font-mono"
                      />
                    </div>

                    <div>
                      <label className="ptw-label">
                        Work Area (AreaLoc) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="field-area-loc"
                        type="text"
                        required
                        maxLength={40}
                        value={areaLoc}
                        onChange={(e) => setAreaLoc(e.target.value)}
                        placeholder="e.g. Caustic Unit / Tank Farm"
                        className="ptw-input font-mono"
                      />
                      {workSelection?.reference?.LocationDesc && (
                        <p className="mt-1 text-[11px] text-slate-500 truncate" title={workSelection.reference.LocationDesc}>
                          📍 <span className="text-slate-600 font-medium">{workSelection.reference.LocationDesc}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="ptw-label">Work Center (Arbpl)</label>
                      <input
                        type="text"
                        value={arbpl}
                        onChange={(e) => setArbpl(e.target.value)}
                        className="ptw-input font-mono"
                      />
                      {workSelection?.reference?.WorkCenterDesc && (
                        <p className="mt-1 text-[11px] text-slate-500 truncate" title={workSelection.reference.WorkCenterDesc}>
                          ⚙️ <span className="text-slate-600 font-medium">{workSelection.reference.WorkCenterDesc}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="ptw-label">Equipment No (Equnr)</label>
                        <span className="text-[10px] font-mono text-slate-400">Max 18</span>
                      </div>
                      <input
                        id="field-equnr"
                        type="text"
                        maxLength={18}
                        value={equnr}
                        onChange={(e) => setEqunr(e.target.value)}
                        className="ptw-input font-mono"
                        placeholder="e.g. 10002931"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="ptw-label">Functional Location (Tplnr)</label>
                        <span className={`text-[10px] font-mono ${tplnr.length > 40 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                          {tplnr.length}/40
                        </span>
                      </div>
                      <input
                        id="field-tplnr"
                        type="text"
                        maxLength={40}
                        value={tplnr}
                        onChange={(e) => setTplnr(e.target.value)}
                        className="ptw-input font-mono"
                        placeholder="e.g. GFL-DHJ-U04-CDU"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="ptw-label">
                      Job Description (JobDesc) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="field-job-desc"
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      rows={2}
                      className="ptw-input font-sans"
                      placeholder="Describe the detailed technical work to be performed..."
                    />
                  </div>
                </div>
              </SectionCard>

              {/* SECTION 2.4: Execution Agency, Department & Supervision */}
              <SectionCard
                theme="emerald"
                sectionTag="SECTION 2.4"
                title="Execution Responsibility & Supervisory Contacts"
                subtitle="Designate contractor or company execution agency, responsible department, and on-site field supervisors."
                icon="supervised_user_circle"
                overflow="visible"
                className="overflow-visible relative z-30"
              >
                <div className="space-y-4 text-xs font-sans relative z-30">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start relative z-40">
                    {/* Execution Agency (3 cols) */}
                    <div className="md:col-span-3">
                      <label className="ptw-label">
                        Execution Agency <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        value={execAgency}
                        onChange={(e) => setExecAgency(e.target.value)}
                        className="ptw-select font-medium"
                      >
                        <option value="CONT">Contractor Agency (CONT)</option>
                        <option value="EMP">Company Employees (EMP)</option>
                      </select>
                    </div>

                    {/* Execution Department & Sub Working Plant (6 cols) */}
                    <div className="md:col-span-6">
                      <label className="ptw-label">
                        Execution Department & Sub Working Plant <span className="text-red-500">*</span>
                      </label>
                      <ExecutionTargetNestedDropdown
                        execDept={execDept}
                        execPlant={execPlant}
                        onChange={(dept, plant) => {
                          setExecDept(dept);
                          setExecPlant(plant);
                        }}
                        deptOptions={deptOptions}
                        plantOptions={plantOptions}
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Click to open department list; hover or click each department to select its sub working plant.
                      </span>
                    </div>

                    {/* Shift (3 cols) */}
                    <div className="md:col-span-3">
                      <label className="ptw-label">
                        Shift <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={shift}
                        onChange={(e) => setShift(e.target.value)}
                        className="ptw-select font-mono"
                      >
                        {(shiftOptions.length > 0
                          ? shiftOptions
                          : [
                            { Config_Code: 'A', Config_Desc: 'SHIFT A' },
                            { Config_Code: 'B', Config_Desc: 'SHIFT B' },
                            { Config_Code: 'C', Config_Desc: 'SHIFT C' },
                            { Config_Code: 'EXTENDED DAY', Config_Desc: 'EXTENDED DAY' },
                            { Config_Code: 'EXTENDED NIGHT', Config_Desc: 'EXTENDED NIGHT' },
                            { Config_Code: 'G', Config_Desc: 'SHIFT GENERAL' },
                          ]
                        ).map((s) => (
                          <option key={s.Config_Code} value={s.Config_Code}>
                            {s.Config_Code} — {s.Config_Desc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Execution Target Mapping Preview Strip */}
                  {execDept && (() => {
                    const matchedDeptCode = deptOptions.find(d => d.Config_Desc === execDept || d.Config_Code === execDept)?.Config_Code || execDept;
                    const formattedTarget = execPlant
                      ? formatExecutionTarget(execPlant, execDept, matchedDeptCode)
                      : `${execDept} (Select sub working plant)`;
                    const targetLen = execPlant ? formattedTarget.length : execDept.length;

                    return (
                      <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50/50 border border-blue-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#006398]">domain_verification</span>
                          <div>
                            <span className="text-[11px] font-bold text-slate-700 block">
                              Executing Target (Plant — Department):
                            </span>
                            <span className="font-mono text-xs font-bold text-[#006398]">
                              {formattedTarget}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 self-end sm:self-auto">
                          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                            {targetLen}/40 chars
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="ptw-label flex items-center justify-between">
                        <span>
                          Supervisor Name <span className="text-red-500 font-bold">*</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">On-site Lead</span>
                      </label>
                      <input
                        id="field-supv-name"
                        type="text"
                        required
                        maxLength={60}
                        value={supvName}
                        onChange={(e) => setSupvName(e.target.value)}
                        placeholder="e.g. RAJESH PATEL"
                        className="ptw-input uppercase"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="ptw-label mb-0 flex items-center gap-1">
                          <span>Supervisor Phone</span>
                          <span className="text-red-500 font-bold">*</span>
                        </label>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${supvPhoneValidation.isValid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                              : supvPhone.trim().length > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-300 font-medium'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {supvPhoneValidation.isValid
                            ? `✓ ${supvPhoneValidation.digitCount} digits`
                            : supvPhone.trim().length > 0
                              ? `${supvPhoneValidation.digitCount}/10 digits`
                              : '10 digits required'}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          id="field-supv-phone"
                          type="tel"
                          maxLength={16}
                          value={supvPhone}
                          onChange={(e) => {
                            const sanitized = sanitizePhoneNumber(e.target.value, 16);
                            setSupvPhone(sanitized);
                          }}
                          onBlur={() => setSupvPhoneTouched(true)}
                          placeholder="9876543210"
                          className={`ptw-input font-mono text-xs pr-8 transition-colors ${supvPhoneTouched && !supvPhoneValidation.isValid
                              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20'
                              : supvPhoneValidation.isValid
                                ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20'
                                : ''
                            }`}
                        />
                        {supvPhone.trim() && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <span
                              className={`material-symbols-outlined text-[16px] ${supvPhoneValidation.isValid ? 'text-emerald-600' : 'text-amber-500'
                                }`}
                            >
                              {supvPhoneValidation.isValid ? 'check_circle' : 'error'}
                            </span>
                          </div>
                        )}
                      </div>
                      {supvPhoneTouched && !supvPhoneValidation.isValid && supvPhoneValidation.error && (
                        <p className="mt-1 text-[11px] text-rose-600 font-sans flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">error</span>
                          <span>{supvPhoneValidation.error}</span>
                        </p>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Enter 10-digit mobile number (e.g. 9825012345 or +91 98250 12345)
                      </span>
                    </div>

                    <div>
                      <label className="ptw-label flex items-center justify-between">
                        <span>Safety Officer</span>
                        <span className="text-[10px] text-slate-400 font-mono">Area EHS</span>
                      </label>
                      <input
                        type="text"
                        value={safetyOfficer}
                        onChange={(e) => setSafetyOfficer(e.target.value)}
                        placeholder="e.g. AMIT SHARMA"
                        className="ptw-input"
                      />
                    </div>

                    <div>
                      <label className="ptw-label flex items-center justify-between">
                        <span>
                          Authorized Crew Qty <span className="text-red-500 font-bold">*</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Synced ({workers.length} crew)
                        </span>
                      </label>
                      <input
                        type="number"
                        readOnly
                        value={workers.length}
                        className="ptw-input font-mono bg-slate-50 text-slate-700 cursor-not-allowed"
                        title="Automatically calculated from workers mustered in Step 4"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Synced with Crew Muster (Step 4).
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="ptw-label">Requester Comments</label>
                    <textarea
                      value={creatorComment}
                      onChange={(e) => setCreatorComment(e.target.value)}
                      maxLength={255}
                      rows={2}
                      placeholder="Optional notes or instructions for the safety approver..."
                      className="ptw-input"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* SECTION 2.5: Validity Window & Shift Duration */}
              <SectionCard
                theme="amber"
                sectionTag="SECTION 2.5"
                title="Validity Window & Shift Duration"
                subtitle="Dahej complex site timings (IST). Standard permits are valid for maximum 8 hours or shift boundary."
                icon="schedule"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 font-sans text-xs">
                  {/* Valid From Group (5 cols) */}
                  <div className="md:col-span-5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#006398]">play_circle</span>
                        <span>Permit Start Window (Valid From)</span>
                        <span className="text-red-500 font-bold">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleSetStartNow}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#006398]/10 text-[#006398] hover:bg-[#006398]/20 transition flex items-center gap-1 shrink-0"
                        title="Set to Current Date & Time (IST)"
                      >
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        <span>Now</span>
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-1">Date & Time (IST) *</label>
                      <input
                        id="field-valid-from-datetime"
                        type="datetime-local"
                        required
                        value={validFromDateTime}
                        onChange={(e) => handleValidFromDateTimeChange(e.target.value)}
                        className="ptw-input font-mono text-xs w-full bg-white shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Valid To Group (5 cols) */}
                  <div className="md:col-span-5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-amber-600">stop_circle</span>
                        <span>Permit Expiry Window (Valid To)</span>
                        <span className="text-red-500 font-bold">*</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={handleSetPlus8Hours}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 transition flex items-center gap-0.5"
                          title="Auto-calculate 8 hours from Start Window"
                        >
                          <span className="material-symbols-outlined text-[11px]">hourglass_top</span>
                          <span>+8h Max</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSetShiftEnd}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition flex items-center gap-0.5"
                          title="Snap to shift end boundary (17:30 / 23:00 / 09:00)"
                        >
                          <span className="material-symbols-outlined text-[11px]">wb_twilight</span>
                          <span>Shift</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-1">Date & Time (IST) *</label>
                      <input
                        id="field-valid-to-datetime"
                        type="datetime-local"
                        required
                        value={validToDateTime}
                        onChange={(e) => handleValidToDateTimeChange(e.target.value)}
                        className="ptw-input font-mono text-xs w-full bg-white shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Gas Retest Interval (2 cols) */}
                  <div className="md:col-span-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-sky-600">timer</span>
                      <span>Gas Interval</span>
                      {gasTestRequired === 'Y' && <span className="text-red-500 font-bold">*</span>}
                    </span>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-1">Retest Period</label>
                      <select
                        id="field-gas-test-freq"
                        value={gasTestFreqHr}
                        disabled={gasTestRequired !== 'Y'}
                        onChange={(e) => setGasTestFreqHr(e.target.value)}
                        className="ptw-select font-mono text-xs bg-white"
                      >
                        <option value="1">1 Hour</option>
                        <option value="2">2 Hours (Standard)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* SECTION 2.6: Mandatory LOTO & Gas Prerequisites */}
              <SectionCard
                theme="rose"
                sectionTag="SECTION 2.6"
                title="Mandatory LOTO & Gas Testing Prerequisites"
                subtitle="Specify zero-energy lockout/tagout and atmospheric gas measurement prerequisites required before work begins."
                icon="lock_open"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Gas Testing Required Card */}
                  <div className="ptw-card p-4 bg-sky-50/50 border-sky-200 flex flex-col justify-between">
                    <div>
                      <fieldset id="field-gas-testing-required" className="p-1 rounded-xl transition-all">
                        <legend className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-sky-600">air</span>
                          <span>Gas Testing Required</span>
                          <span className="text-red-500 font-bold">*</span>
                        </legend>
                        <div className="flex gap-6">
                          {(['Y', 'N'] as const).map((value) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-slate-800">
                              <input
                                type="radio"
                                name="gas-required"
                                required
                                checked={gasTestRequired === value}
                                onChange={() => setGasTestRequired(value)}
                                className="accent-[#006398] w-4 h-4 cursor-pointer"
                              />
                              <span>{value === 'Y' ? 'Yes (Mandatory Gas Test)' : 'No'}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <p className="mt-2.5 text-xs text-slate-600 font-sans leading-relaxed">
                        {!isolationRequired || !gasTestRequired
                          ? 'Select both requirements to determine the initial permit status.'
                          : isOnlyColdWork
                            ? 'Initial Status: APPR (Approved). Cold Work without additional categories does not require approver sign-off and is pre-authorized synchronously.'
                            : initialPermitStatus(isolationRequired, gasTestRequired) === 'INTD'
                              ? 'Initial Status: INTD. All required isolation and gas-test approvals must be completed in SAP before CRTD.'
                              : 'Initial Status: CRTD. No isolation or gas-test approval is requested.'}{' '}
                        {isOnlyColdWork ? 'Directly authorized for field execution.' : 'CRTD does not authorize field work.'}
                      </p>
                    </div>
                    {gasTestRequired === 'Y' && (
                      <div className="mt-3 p-2 rounded-lg bg-sky-100/70 border border-sky-300 text-sky-900 text-[11px] font-mono flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-sky-700">info</span>
                        <span>Atmospheric retesting scheduled every {gasTestFreqHr} hour(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Isolation Required Card */}
                  <div className="ptw-card p-4 bg-amber-50/50 border-amber-200 flex flex-col justify-between">
                    <div>
                      <fieldset id="field-isolation-required" className="p-1 rounded-xl transition-all">
                        <legend className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-600">lock</span>
                          <span>Isolation Required (LOTO)</span>
                          <span className="text-red-500 font-bold">*</span>
                        </legend>
                        <div className="flex gap-6">
                          {[
                            { value: 'X', label: 'Yes (Mandatory LOTO)' },
                            { value: ' ', label: 'No' },
                          ].map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-slate-800">
                              <input
                                type="radio"
                                name="isolation-required"
                                required
                                checked={
                                  value === 'X'
                                    ? isolationRequired === 'X' || isolationRequired === 'Y'
                                    : isolationRequired === ' ' || isolationRequired === 'N'
                                }
                                onChange={() => {
                                  setIsolationRequired(value as Requirement);
                                  if (value === ' ') {
                                    setIsolationNo('');
                                    setIsolations([]);
                                  }
                                }}
                                className="accent-[#006398] w-4 h-4 cursor-pointer"
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <p className="mt-2.5 text-xs text-slate-600 font-sans leading-relaxed">
                        When required, the isolation module user completes and approves physical isolation points in SAP.
                      </p>
                    </div>

                    {(isolationRequired === 'X' || isolationRequired === 'Y') && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="ptw-label text-[11px]">
                            Isolation Certificate No <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input
                            id="field-isolation-no"
                            type="text"
                            list="available-isolations"
                            placeholder="e.g. ISO0000012"
                            value={isolationNo}
                            onChange={(e) => setIsolationNo(e.target.value)}
                            className="ptw-input font-mono text-xs"
                          />
                          <datalist id="available-isolations">
                            {availableIsolations.map((no) => (
                              <option key={no} value={no} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="ptw-label text-[11px]">Reference Type</label>
                          <input
                            type="text"
                            value={isolationRefType}
                            onChange={(e) => setIsolationRefType(e.target.value)}
                            className="ptw-input font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* TAB 2: Workers & Crew Ledger */}
          {activeTab === 'workers' && (
            <SectionCard
              theme="indigo"
              sectionTag="STEP 4"
              title="Authorized Worker & Contractor Crew Ledger"
              subtitle="Register all company personnel and vendor contractors executing work under this permit."
              icon="group"
              badge={
                workers.length === 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Required * (Min 1 Crew Member)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    {workers.length} Personnel Registered ✓
                  </span>
                )
              }
            >
              <div className="space-y-6">

                {/* Workers Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono text-[11px] uppercase">
                        <th className="py-2.5 px-3">Item #</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Worker Name</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Employee / Contractor ID</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {workers.map((worker) => (
                        <tr key={worker.ItemNo} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-500">{worker.ItemNo}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${worker.WorkerTypeCode === 'EMP'
                                  ? 'bg-blue-100 text-[#006398]'
                                  : 'bg-amber-100 text-amber-800'
                                }`}
                            >
                              {worker.WorkerTypeCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{worker.WorkerName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{worker.PhoneNo}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {worker.WorkerTypeCode === 'EMP' ? worker.EmpId : `${worker.ContractorName} (${worker.ContractorId})`}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{worker.Shift}</td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleRemoveWorker(worker.ItemNo)}
                              className="text-rose-600 hover:text-rose-800 font-mono text-xs"
                              title="Remove Worker"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add Worker Inline Strip */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block font-mono text-xs font-bold text-slate-800 uppercase mb-3">
                    Add Worker to Ledger
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs font-sans">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        Worker Type <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        value={newWorkerType}
                        onChange={(e) => setNewWorkerType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                      >
                        {(workerTypeOptions.length > 0
                          ? workerTypeOptions
                          : [
                            { Config_Code: 'EMP', Config_Desc: 'EMPLOYEE' },
                            { Config_Code: 'CONT', Config_Desc: 'CONTRACTOR' },
                          ]
                        ).map((wt) => (
                          <option key={wt.Config_Code} value={wt.Config_Code}>
                            {wt.Config_Desc} ({wt.Config_Code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        Full Name <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        id="field-worker-name"
                        type="text"
                        value={newWorkerName}
                        onChange={(e) => setNewWorkerName(e.target.value)}
                        placeholder="e.g. JOHN DOE"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs uppercase"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-600 font-semibold text-xs">
                           Phone Number <span className="text-red-500 font-bold">*</span>
                        </label>
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded border transition-colors ${workerPhoneValidation.isValid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                              : newWorkerPhone.trim().length > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-300 font-medium'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {workerPhoneValidation.isValid
                            ? '✓ 10 digits'
                            : newWorkerPhone.trim()
                              ? `${workerPhoneValidation.digitCount}/10`
                              : '10 digits'}
                        </span>
                      </div>
                      <input
                        id="field-worker-phone"
                        type="tel"
                        maxLength={20}
                        value={newWorkerPhone}
                        onChange={(e) => {
                          const sanitized = sanitizePhoneNumber(e.target.value, 20);
                          setNewWorkerPhone(sanitized);
                        }}
                        onBlur={() => setWorkerPhoneTouched(true)}
                        placeholder="9876543210"
                        className={`w-full px-2.5 py-1.5 bg-white border rounded-lg font-mono text-xs transition-colors ${workerPhoneTouched && !workerPhoneValidation.isValid
                            ? 'border-rose-400 bg-rose-50/20'
                            : workerPhoneValidation.isValid
                              ? 'border-emerald-400'
                              : 'border-slate-300'
                          }`}
                      />
                      {workerPhoneTouched && !workerPhoneValidation.isValid && workerPhoneValidation.error && (
                        <p className="mt-0.5 text-[10px] text-rose-600 font-sans">
                          {workerPhoneValidation.error}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        {newWorkerType === 'EMP' ? 'Employee ID' : 'Contractor Co.'} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        id="field-worker-id"
                        type="text"
                        value={newWorkerType === 'EMP' ? newWorkerEmpId : newWorkerContractorName}
                        onChange={(e) =>
                          newWorkerType === 'EMP'
                            ? setNewWorkerEmpId(e.target.value)
                            : setNewWorkerContractorName(e.target.value)
                        }
                        placeholder={newWorkerType === 'EMP' ? 'EMP105' : 'ABC INFRA'}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs uppercase"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddWorker}
                        className="w-full px-3 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>Add Worker</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* TAB 3: PPE & Safety Checklist */}
          {activeTab === 'ppe' && (
            <SectionCard
              theme="blue"
              sectionTag="STEP 5"
              title="Personal Protective Equipment Matrix & Safety Checks"
              subtitle="Specify required, available, and issued safety equipment for field operations."
              icon="security"
              badge={
                ppeItems.length === 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Required * (Min 1 PPE Item)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-100 text-[#006398]">
                    {ppeItems.length} PPE Requirements ✓
                  </span>
                )
              }
            >
              <div className="space-y-6">
                {/* Add PPE with SAP F4 Value Help & Dropdown */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#006398] text-[18px]">shield</span>
                      <span>Add Personal Protective Equipment (SAP Config)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPpeHelpOpen(true)}
                      className="px-3 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Open SAP PPE Catalog Value Help Modal"
                    >
                      <span className="material-symbols-outlined text-[16px]">search</span>
                      <span>F4 Value Help</span>
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12 items-end">
                    {/* Quick Select Dropdown */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Quick Dropdown
                      </label>
                      <select
                        value={newPpeCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          setNewPpeCode(code);
                          const matched = ppeCatalog.find(p => p.Config_Code === code);
                          if (matched) setNewPpeDescription(matched.Config_Desc);
                        }}
                        className="block w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-mono truncate"
                      >
                        <option value="">-- Select from 28 PPEs --</option>
                        {ppeCatalog.map((p) => (
                          <option key={p.Config_Code} value={p.Config_Code}>
                            [{p.Parent_Code || 'GEN'}] {p.Config_Code} - {p.Config_Desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* PPE Code */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        PPE Code *
                      </label>
                      <div className="relative">
                        <input
                          id="field-ppe-code"
                          value={newPpeCode}
                          onChange={(e) => setNewPpeCode(e.target.value.toUpperCase())}
                          placeholder="e.g. SAFHELM"
                          maxLength={10}
                          className="block w-full border border-slate-300 rounded-lg p-2 pr-8 text-xs font-mono uppercase bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPpeHelpOpen(true)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-[#006398]"
                          title="F4 Search Help"
                        >
                          <span className="material-symbols-outlined text-[16px]">search</span>
                        </button>
                      </div>
                    </div>

                    {/* PPE Description */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Description *
                      </label>
                      <input
                        id="field-ppe-desc"
                        value={newPpeDescription}
                        onChange={(e) => setNewPpeDescription(e.target.value)}
                        placeholder="e.g. SAFETY HELMET"
                        className="block w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>

                    {/* Add Button */}
                    <div className="sm:col-span-1">
                      <button
                        type="button"
                        id="btn-add-ppe"
                        className="w-full rounded-lg bg-[#006398] hover:bg-[#004f7a] p-2 text-xs font-mono font-bold text-white transition-colors flex items-center justify-center gap-1 shadow-2xs"
                        onClick={() => {
                          if (!newPpeCode.trim()) {
                            toast.warning('PPE Code is mandatory. Select from dropdown or enter code.', { title: 'Mandatory Field Missing' });
                            jumpToField('field-ppe-code', 'ppe');
                            return;
                          }
                          if (!newPpeDescription.trim()) {
                            toast.warning('PPE Description is mandatory.', { title: 'Mandatory Field Missing' });
                            jumpToField('field-ppe-desc', 'ppe');
                            return;
                          }
                          const code = newPpeCode.trim().toUpperCase();
                          const desc = newPpeDescription.trim();
                          setPpeItems(prev => [
                            ...prev,
                            {
                              PermitNo: '',
                              ItemNo: String(prev.length + 1),
                              PpeCode: code,
                              PpeDesc: desc,
                              IsRequired: 'Y',
                              IsAvailable: 'N',
                              IsIssued: 'N',
                              CheckedBy: '',
                              CheckedAt: null,
                              Remarks: ''
                            }
                          ]);
                          setNewPpeCode('');
                          setNewPpeDescription('');
                          toast.success(`Added PPE: ${code} - ${desc}`, { title: 'PPE Added' });
                        }}
                        title="Add PPE Requirement"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Personal Protective Equipment Matrix (_PPE)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Specify required, available, and issued safety equipment for field operations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPpeItems((prev) =>
                        prev.map((item) => ({ ...item, IsRequired: 'Y', IsAvailable: 'Y', IsIssued: 'Y' }))
                      )
                    }
                    className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-mono font-bold hover:bg-emerald-100"
                  >
                    ✓ Confirm All Available & Issued
                  </button>
                </div>

                {/* PPE Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono text-[11px] uppercase">
                        <th className="py-2.5 px-3">Item #</th>
                        <th className="py-2.5 px-3">PPE Code</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-center">Required</th>
                        <th className="py-2.5 px-3 text-center">Available</th>
                        <th className="py-2.5 px-3 text-center">Issued</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ppeItems.map((ppe, idx) => (
                        <tr key={ppe.ItemNo} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono text-slate-500">{ppe.ItemNo}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#006398]">{ppe.PpeCode}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{ppe.PpeDesc}</td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={ppe.IsRequired === 'Y'}
                              onChange={(e) => {
                                const checked = e.target.checked ? 'Y' : 'N';
                                setPpeItems((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, IsRequired: checked } : p))
                                );
                              }}
                              className="h-4 w-4 rounded text-[#006398] focus:ring-[#006398]"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={ppe.IsAvailable === 'Y'}
                              onChange={(e) => {
                                const checked = e.target.checked ? 'Y' : 'N';
                                setPpeItems((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, IsAvailable: checked } : p))
                                );
                              }}
                              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={ppe.IsIssued === 'Y'}
                              onChange={(e) => {
                                const checked = e.target.checked ? 'Y' : 'N';
                                setPpeItems((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, IsIssued: checked } : p))
                                );
                              }}
                              className="h-4 w-4 rounded text-[#006398] focus:ring-[#006398]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={ppe.Remarks}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPpeItems((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, Remarks: val } : p))
                                );
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Compliance Questionnaires (_CHK) */}
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="p-4 bg-sky-50/70 border border-sky-200/90 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#006398] text-[20px]">fact_check</span>
                          <h3 className="font-display font-bold text-base text-slate-900">
                            Compliance Checklists (_CHK)
                          </h3>
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#006398] text-white">
                            SAP Entity _CHK
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          Statutory compliance questionnaire responses are saved into SAP child table <strong className="font-mono text-slate-900">_CHK</strong> (not _Safety). Click below to complete each active category questionnaire.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {allActiveCategories.map((catCode) => {
                          const catDef = PERMIT_CATEGORIES.find((c) => c.code === catCode || c.sapCode === catCode);
                          const qCount = (categoryQuestions[catCode] || []).length;
                          const pStat = checklistProgressMap[catCode];
                          const answered = pStat?.answered || 0;
                          const isComplete = answered === qCount && qCount > 0;
                          return (
                            <button
                              key={catCode}
                              type="button"
                              onClick={() => void handleOpenChecklistForCategory(catCode)}
                              className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0 ${isComplete
                                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                  : 'bg-white border-[#006398] text-[#006398] hover:bg-[#006398] hover:text-white'
                                }`}
                              title={`Open ${catDef?.label || catCode} Compliance Questionnaire`}
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {isComplete ? 'verified' : 'fact_check'}
                              </span>
                              <span>{catDef?.label || catCode} ({answered}/{qCount})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Custom Safety Inspection Checks (_Safety) */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[#006398] text-[18px]">verified_user</span>
                          <h4 className="font-display font-bold text-sm text-slate-900">
                            Custom Safety Inspection Checks (_Safety)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          Additional field safety checks stored in SAP child table _Safety.
                        </p>
                      </div>
                      {safetyChecklist.length > 0 && (
                        <span className="font-mono text-[11px] text-slate-500">
                          {safetyChecklist.length} Custom {safetyChecklist.length === 1 ? 'Check' : 'Checks'}
                        </span>
                      )}
                    </div>

                    {/* Add Custom Safety Check Toolbar */}
                    <div className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2">
                      <span className="font-mono text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#006398] text-[16px]">add_task</span>
                        <span>Add Custom Safety Check Item</span>
                      </span>
                      <div className="grid gap-2 sm:grid-cols-12 items-end">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Check Code (Max 4 chars)</label>
                          <input
                            maxLength={4}
                            value={newSafetyCode}
                            onChange={e => setNewSafetyCode(e.target.value.toUpperCase())}
                            placeholder="e.g. S01"
                            className="ptw-input font-mono uppercase text-xs"
                          />
                        </div>
                        <div className="sm:col-span-7">
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Check Description</label>
                          <input
                            maxLength={100}
                            value={newSafetyDescription}
                            onChange={e => setNewSafetyDescription(e.target.value)}
                            placeholder="e.g. Verify area barricading and equipment certification"
                            className="ptw-input text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            className="w-full py-2 px-3 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white text-xs font-bold font-mono transition-colors flex items-center justify-center gap-1 shadow-2xs"
                            onClick={() => {
                              if (!newSafetyCode.trim() || !newSafetyDescription.trim()) return;
                              setSafetyChecklist(prev => [...prev, { PermitNo: '', ItemNo: String(prev.length + 1), Category: 'GEN', ItemCode: newSafetyCode.trim(), Response: 'NO', ValueText: newSafetyDescription.trim(), ValueNum: 0, Unit: '', ReferenceNo: '', ResponsibleUser: user?.id || '', VerifiedBy: '', VerifiedAt: null, Remarks: '' }]);
                              setNewSafetyCode('');
                              setNewSafetyDescription('');
                            }}
                          >
                            <span className="material-symbols-outlined text-[15px]">add</span>
                            <span>Add Check</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {safetyChecklist.length === 0 ? (
                      <div className="p-4 bg-slate-50/60 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                        No custom safety checks added. Mandatory site preparations from Client Procedure (Section D) are automatically serialized into _Safety.
                      </div>
                    ) : (
                      safetyChecklist.map((item, idx) => (
                        <div
                          key={item.ItemNo || idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                              {item.Category} #{item.ItemCode}
                            </span>
                            <div>
                              <span className="font-semibold text-slate-800">{item.ValueText}</span>
                              <span className="block text-[11px] text-slate-500">{item.Remarks}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-mono">
                            {['YES', 'NO', 'NA'].map((resp) => (
                              <button
                                key={resp}
                                type="button"
                                onClick={() =>
                                  setSafetyChecklist((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, Response: resp } : s))
                                  )
                                }
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${item.Response === resp
                                    ? resp === 'YES'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : resp === 'NO'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-slate-600 text-white shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                              >
                                {resp}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* STEP 6: Hazard Controls & Interactive 5x5 Risk Assessment Matrix */}
          {activeTab === 'hazards' && (
            <SectionCard
              theme="amber"
              sectionTag="STEP 6"
              title="Hazard Controls & Interactive 5×5 Risk Assessment Matrix"
              subtitle="Corporate standard 5×5 Risk Assessment Matrix: Evaluate People, Asset, Environment & Reputation consequence ratings against probability frequency."
              icon="warning"
              badge={
                hazards.length === 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Required * (Min 1 Hazard)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {hazards.length} Hazards Identified ✓
                  </span>
                )
              }
            >
              <RiskMatrix5x5Section
                hazards={hazards}
                setHazards={setHazards}
                selectedHazardIdx={selectedHazardIdx}
                setSelectedHazardIdx={setSelectedHazardIdx}
                selectedMatrixCell={selectedMatrixCell}
                setSelectedMatrixCell={setSelectedMatrixCell}
                newHazardCode={newHazardCode}
                setNewHazardCode={setNewHazardCode}
                newHazardDesc={newHazardDesc}
                setNewHazardDesc={setNewHazardDesc}
                newControlCode={newControlCode}
                setNewControlCode={setNewControlCode}
                newControlDesc={newControlDesc}
                setNewControlDesc={setNewControlDesc}
                handleAddHazard={handleAddHazard}
                onMatrixCellClick={handleMatrixCellClick}
                userPersonResp={user?.id || personResp}
                permitNo={permitNo}
              />
            </SectionCard>
          )}

          {/* TAB 5: Gas Testing & Isolation */}
          {activeTab === 'gas-isolation' && (
            <SectionCard
              theme="rose"
              sectionTag="STEP 7"
              title="Isolation Certificate & Gas Workflow Architecture"
              subtitle="Prerequisite isolation and gas testing workflow guidelines."
              icon="lock"
            >
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-5 space-y-3 text-slate-700 text-xs sm:text-sm">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006398] text-[20px]">info</span>
                  <span>Sequential SAP Clearance Requirements</span>
                </h4>
                <p>Create the permit first. If isolation is required, open Isolation Create with the returned permit number and add the physical points under the certificate. SAP assigns the certificate and item numbers.</p>
                <p>Gas measurements are read from the backend. The gas module can finalize saved backend tests; the supplied service does not support entering new measurements.</p>
                <p className="font-semibold text-[#006398]">All required checks must be approved in SAP before the permit progresses from INTD to CRTD.</p>
              </div>
            </SectionCard>
          )}

          {activeTab === 'payload' && (
            <SectionCard
              theme="emerald"
              sectionTag="STEP 8"
              title="Review Permit Request & Deep Insert Submission"
              subtitle="Review all validated permit sections before final transmission to SAP S/4HANA OData V4 service."
              icon="verified"
            >
              <div className="space-y-6">
                {/* Payload Summary Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 border border-slate-200 rounded-xl">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Permit Dossier Pre-Submission Review
                    </h3>
                    <p className="text-xs text-slate-500">
                      Verify all technical inputs. Site preparations, signatures and field authorization must be completed before work starts.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-[#006398] text-slate-700 hover:text-[#006398] rounded-xl text-xs font-mono font-bold shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {copySuccess ? 'done' : 'content_copy'}
                      </span>
                      <span>{copySuccess ? 'Copied!' : 'Copy request'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitDeepInsert}
                      disabled={isSubmitting || creationUncertain || !workSelection || !!requestPreview.error}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl text-xs font-mono font-bold shadow-sm transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isSubmitting ? 'sync' : 'send'}
                      </span>
                      <span>{isSubmitting ? 'Posting to SAP...' : 'Create permit request'}</span>
                    </button>
                  </div>
                </div>

                <div className="ptw-card p-5 border-slate-200 text-sm">
                  <h3 className="mb-3 font-display font-bold text-slate-900">Request Technical Summary</h3>
                  <dl className="grid gap-3.5 sm:grid-cols-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><dt className="text-slate-500 font-medium">Job and Area</dt><dd className="mt-1 font-semibold text-slate-900">{jobDesc || 'Not entered'} · {areaLoc || 'Area required'}</dd></div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <dt className="text-slate-500 font-medium">Primary Work Category (Section 2.1)</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {PERMIT_CATEGORIES.find(item => item.code === permitType || item.sapCode === permitType)?.label || permitType || 'Not selected'}
                        {permitType ? ` (${toSapPermitType(permitType)})` : ''}
                      </dd>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <dt className="text-slate-500 font-medium">SAP Child Table _WorkType</dt>
                      <dd className="mt-1 font-mono font-bold text-slate-900">
                        {workTypeRecords.length > 0 ? (
                          <span className="text-[#006398]">
                            {workTypeRecords.length} {workTypeRecords.length === 1 ? 'Category' : 'Categories'} ({workTypeRecords.map(w => w.WorkType).join(', ')})
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">
                            Not assigned
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><dt className="text-slate-500 font-medium">Requested Validity (IST)</dt><dd className="mt-1 font-mono font-bold text-slate-900">{validFromD} {validFromT} → {validToD} {validToT}</dd></div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><dt className="text-slate-500 font-medium">Crew / Hazards / Isolation Points</dt><dd className="mt-1 font-mono font-bold text-slate-900">{workers.length} Personnel · {hazards.length} Hazards · {isolations.length} Points</dd></div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <dt className="text-slate-500 font-medium">Compliance Checklists (_CHK)</dt>
                      <dd className="mt-1 font-mono font-bold text-slate-900">
                        {chkRecords.length > 0 ? (
                          <span className="text-emerald-700">
                            {chkRecords.length} Answers in _CHK ({overallChecklistStats.answered}/{overallChecklistStats.total} across {allActiveCategories.length} {allActiveCategories.length === 1 ? 'Category' : 'Categories'})
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">
                            0 Answers Recorded ({allActiveCategories.length} {allActiveCategories.length === 1 ? 'Category' : 'Categories'})
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <dt className="text-slate-500 font-medium">Nature of Work (_NATW)</dt>
                      <dd className="mt-1 font-mono font-bold text-slate-900">
                        {natwRecords.length > 0 ? (
                          <span className="text-indigo-700">
                            {natwRecords.length} Selected ({natwRecords.map(n => n.OtherText ? `${n.NatwCode} (${n.OtherText})` : n.NatwCode).join(', ')})
                          </span>
                        ) : (
                          <span className="text-amber-600 font-normal">
                            0 Selected (Required)
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <dt className="text-slate-500 font-medium">Tools & Equipment (_Equipment)</dt>
                      <dd className="mt-1 font-mono font-bold text-slate-900">
                        {equipmentRecords.length > 0 ? (
                          <span className="text-amber-700">
                            {equipmentRecords.length} Declared ({equipmentRecords.map(e => e.OtherText ? `${e.EquipCode} (${e.OtherText})` : e.EquipCode).join(', ')})
                          </span>
                        ) : (
                          <span className="text-amber-600 font-normal">
                            0 Declared (Required)
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><dt className="text-slate-500 font-medium">JSA Reference</dt><dd className="mt-1 font-mono font-bold text-slate-900">{sitePlan.fields.JSA1 || 'Required'}</dd></div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><dt className="text-slate-500 font-medium">Signatories (Proposed)</dt><dd className="mt-1 font-semibold text-slate-900">{sitePlan.fields.ISSR || '—'} (Issuer) / {sitePlan.fields.ACCP || '—'} (Acceptor) / {sitePlan.fields.OPER || '—'} (Operator)</dd></div>
                  </dl>
                  {requestPreview.error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{requestPreview.error}</p>}
                </div>
                <ProcedureGuidance />
                <details className="ptw-card p-4 border-slate-200">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Technical JSON Payload (OData V4 Deep Insert)</span>
                    <span className="material-symbols-outlined text-[16px] text-slate-400">code</span>
                  </summary>
                  {/* Code Mirror / Monospace JSON Viewer */}
                  <div className="mt-3 relative border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-[#0b1c30]">
                    <div className="px-4 py-2 bg-slate-900 text-slate-300 font-mono text-[11px] flex items-center justify-between border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-400 ml-2">Request Payload • application/json</span>
                      </div>
                      <span className="text-slate-400">Permit: {permitNo}</span>
                    </div>

                    <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[500px] leading-relaxed">
                      {requestPreview.error || JSON.stringify(requestPreview.body, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </SectionCard>
          )}
        </fieldset>

        {/* Sticky Action Footer */}
        <footer className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 text-center sm:text-left">
            <span className="font-bold text-[#006398] bg-[#006398]/10 px-2 py-0.5 rounded border border-[#006398]/20">
              {stepsList.find(s => s.key === activeTab)?.label}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">
              {workSelection ? `${workSelection.source} ${referenceId(workSelection.source, workSelection.reference)}` : 'Select work reference to begin'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'work' && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-mono font-semibold transition-all shadow-2xs hover:bg-slate-50"
              >
                ← Previous
              </button>
            )}

            {activeTab !== 'payload' ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1 shadow-2xs transition-all"
              >
                <span>Next Step</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (requestPreview.error) {
                    toast.warning(requestPreview.error, { title: 'Mandatory Requirement Incomplete' });
                    return;
                  }
                  handleSubmitDeepInsert();
                }}
                disabled={isSubmitting || creationUncertain}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isSubmitting ? 'sync' : 'verified'}
                </span>
                <span>{isSubmitting ? 'Submitting to SAP...' : revisionPermit ? 'Save Changes & Resubmit for Approval' : 'Create permit request'}</span>
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* SAP F4 Value Help Dialog for PPE */}
      <PpeValueHelpDialog
        isOpen={isPpeHelpOpen}
        onClose={() => setIsPpeHelpOpen(false)}
        onSelect={(code, desc) => {
          setNewPpeCode(code);
          setNewPpeDescription(desc);
        }}
        onSelectMultiple={(items) => {
          setPpeItems((prev) => {
            const existingCodes = new Set(prev.map((p) => p.PpeCode));
            const newRecords: PPERecord[] = items
              .filter((item) => !existingCodes.has(item.code))
              .map((item, idx) => ({
                PermitNo: '',
                ItemNo: String(prev.length + idx + 1),
                PpeCode: item.code,
                PpeDesc: item.description,
                IsRequired: 'Y',
                IsAvailable: 'N',
                IsIssued: 'N',
                CheckedBy: '',
                CheckedAt: null,
                Remarks: ''
              }));
            return [...prev, ...newRecords];
          });
        }}
      />

      {/* Dynamic SAP Permit Compliance Checklist Questionnaire Modal */}
      <PermitChecklistModal
        isOpen={
          isChecklistModalOpen &&
          Boolean((categoryQuestions[activeChecklistPermitType || toSapChecklistPermitType(permitType)] || []).length > 0)
        }
        permitType={activeChecklistPermitType || toSapChecklistPermitType(permitType)}
        permitTypeName={
          PERMIT_CATEGORIES.find(
            (c) => c.code === (activeChecklistPermitType || permitType) || c.sapCode === (activeChecklistPermitType || permitType)
          )?.label || (activeChecklistPermitType || permitType)
        }
        items={categoryQuestions[activeChecklistPermitType || toSapChecklistPermitType(permitType)] || []}
        initialAnswers={categoryAnswers[activeChecklistPermitType || toSapChecklistPermitType(permitType)] || {}}
        onSave={handleSaveChecklist}
        onClose={() => setIsChecklistModalOpen(false)}
      />
    </div>
  );
};

export default PermitCreateModule;
