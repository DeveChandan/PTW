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
}

type TabKey = 'work' | 'general' | 'procedure' | 'workers' | 'ppe' | 'hazards' | 'gas-isolation' | 'payload';

export const PermitCreateModule: React.FC<PermitCreateModuleProps> = ({ user, onBack }) => {
  // A new request starts without asserted work, crew or safety evidence.
  const [activeTab, setActiveTab] = useState<TabKey>('work');
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
  const [execAgency, setExecAgency] = useState<string>('CONT');
  const [execDept, setExecDept] = useState<string>('');
  const [execPlant, setExecPlant] = useState<string>('');
  const [supvName, setSupvName] = useState<string>('');
  const [supvPhone, setSupvPhone] = useState<string>('');
  const [supvPhoneTouched, setSupvPhoneTouched] = useState<boolean>(false);
  const [safetyOfficer, setSafetyOfficer] = useState<string>('');
  const [shift, setShift] = useState<string>('GENERAL');
  const [personsQty, setPersonsQty] = useState<number>(0);

  // Validity Period
  const [validFromD, setValidFromD] = useState<string>('');
  const [validFromT, setValidFromT] = useState<string>('');
  const [validToD, setValidToD] = useState<string>('');
  const [validToT, setValidToT] = useState<string>('');
  const [gasTestFreqHr, setGasTestFreqHr] = useState<string>('2');
  const [creatorComment, setCreatorComment] = useState<string>('');

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
    if (draft.safetyChecklist) setSafetyChecklist(draft.safetyChecklist);
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
  // Section 2.1 defines primary permit type. If Section A additional categories are selected (multiple select),
  // both primary and additional work types are stored in _WorkType with sequential SeqNo.
  const workTypeRecords = useMemo((): WorkTypeRecord[] => {
    const primarySap = toSapPermitType(permitType) || permitType;
    if (!primarySap) return [];
    const additionalSaps = (sitePlan.additionalTypes || [])
      .map((t) => toSapPermitType(t) || t)
      .filter((t) => Boolean(t) && t !== primarySap);

    if (additionalSaps.length > 0) {
      const allTypes = [primarySap, ...additionalSaps];
      return allTypes.map((code, index) => ({
        SeqNo: String(index + 1),
        WorkType: code
      }));
    }
    return [];
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
    return (sitePlan.nature || []).map((desc, index) => ({
      ItemNo: String(index + 1),
      NatwCode: toNatwCode(desc),
      NatwDesc: desc.trim().slice(0, 255),
      OtherText: (desc === 'Other' ? (sitePlan.fields.NOTE || '') : '').trim().slice(0, 255)
    }));
  }, [sitePlan.nature, sitePlan.fields.NOTE]);

  // Tools & Equipment records formatted for SAP child table _Equipment (Entity EquipmentType)
  const equipmentRecords = useMemo((): EquipmentRecord[] => {
    return (sitePlan.tools || []).map((desc, index) => ({
      ItemNo: String(index + 1),
      EquipCode: toEquipCode(desc),
      EquipDesc: desc.trim().slice(0, 255),
      OtherText: (desc === 'Other' ? (sitePlan.fields.NOTE || '') : '').trim().slice(0, 255)
    }));
  }, [sitePlan.tools, sitePlan.fields.NOTE]);

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

    // Recompile _Safety records across ALL active categories with their latest questions and answers
    // Ensures answers from multiple categories in the same permit are preserved without collisions
    const compiledRecords: SafetyRecord[] = [];
    let itemIndex = 1;

    allActiveCategories.forEach((cat) => {
      const questions = categoryQuestions[cat] || (cat === targetCode ? (categoryQuestions[targetCode] || []) : []);
      const ansMap = updatedCategoryAnswers[cat] || {};
      const handledQIds = new Set<string>();

      questions.forEach((q) => {
        handledQIds.add(q.QuestionaireId);
        const answer = ansMap[q.QuestionaireId];
        if (answer && answer.response) {
          compiledRecords.push({
            PermitNo: '',
            ItemNo: String(itemIndex++).slice(-4),
            Category: (q.Category || cat).substring(0, 6).toUpperCase(),
            ItemCode: (q.QuestionaireId.startsWith('Q') ? q.QuestionaireId : `Q${q.QuestionaireId}`).slice(0, 4),
            Response: answer.response || 'NO',
            ValueText: q.Question.substring(0, 100),
            ValueNum: 0,
            Unit: '',
            ReferenceNo: q.QuestionaireId.substring(0, 30),
            ResponsibleUser: user?.id || '',
            VerifiedBy: '',
            VerifiedAt: null,
            Remarks: (answer.remarks || '').substring(0, 255),
          });
        }
      });

      // Preserve any answered questions in ansMap not yet in the loaded catalog
      Object.entries(ansMap).forEach(([qId, answer]) => {
        if (!handledQIds.has(qId) && answer && answer.response) {
          compiledRecords.push({
            PermitNo: '',
            ItemNo: String(itemIndex++).slice(-4),
            Category: cat.substring(0, 6).toUpperCase(),
            ItemCode: (qId.startsWith('Q') ? qId : `Q${qId}`).slice(0, 4),
            Response: answer.response || 'NO',
            ValueText: `Checklist item ${qId}`,
            ValueNum: 0,
            Unit: '',
            ReferenceNo: qId.substring(0, 30),
            ResponsibleUser: user?.id || '',
            VerifiedBy: '',
            VerifiedAt: null,
            Remarks: (answer.remarks || '').substring(0, 255),
          });
        }
      });
    });

    setSafetyChecklist((prev) => {
      const manualEntries = prev.filter((p) => !p.ItemCode.startsWith('Q'));
      return [...compiledRecords, ...manualEntries];
    });

    setIsChecklistModalOpen(false);
    const answeredCount = answers.filter((a) => a.response).length;
    const targetLabel = PERMIT_CATEGORIES.find((c) => c.code === targetCode || c.sapCode === targetCode)?.label || targetCode;
    const bannerMsg = `${targetLabel} compliance checklist updated: ${answeredCount} of ${answers.length} verified.`;
    toast.success(bannerMsg, { title: 'Checklist Saved' });
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
    setArbpl('');
    setAreaLoc('');
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

  // Tab-level validation helper for mandatory fields
  const validateTab = (tab: TabKey): { valid: boolean; message?: string } => {
    if (tab === 'work') {
      if (!workSelection) {
        return { valid: false, message: 'Please select a PM maintenance order or notification to begin.' };
      }
    }
    if (tab === 'general') {
      if (!permitType) {
        return { valid: false, message: 'Permit Category is mandatory. Select the primary work category.' };
      }
      if (!jobDesc.trim()) {
        return { valid: false, message: 'Job Description is mandatory.' };
      }
      if (!areaLoc.trim()) {
        return { valid: false, message: 'Work Area / Functional Location is mandatory.' };
      }
      if (!validFromD || !validToD) {
        return { valid: false, message: 'Permit Start Date and End Date are mandatory.' };
      }
      if (!validFromT || !validToT) {
        return { valid: false, message: 'Permit Start Time and End Time are mandatory.' };
      }
      if (!supvName.trim()) {
        return { valid: false, message: 'Supervisor Name is mandatory.' };
      }
      if (!supvPhone.trim()) {
        setSupvPhoneTouched(true);
        return { valid: false, message: 'Supervisor Phone is mandatory. Enter a valid 10-digit mobile number.' };
      }
      const supvPhoneVal = validatePhoneNumber(supvPhone, true);
      if (!supvPhoneVal.isValid) {
        setSupvPhoneTouched(true);
        return { valid: false, message: `Supervisor Phone: ${supvPhoneVal.error}` };
      }
      if (!execDept.trim()) {
        return { valid: false, message: 'Execution Department is mandatory. Select the responsible department.' };
      }
      if (filteredPlantOptions.length > 0 && !execPlant.trim()) {
        return { valid: false, message: `Executing Sub Working Plant is mandatory for ${execDept}. Select a sub working plant.` };
      }
    }
    if (tab === 'procedure') {
      if (sitePlan.nature.length === 0) {
        return { valid: false, message: 'Nature of Work is mandatory. Select at least one planned work activity in Section B.' };
      }
      if (sitePlan.tools.length === 0) {
        return { valid: false, message: 'Tools & Equipment declaration is mandatory. Select at least one tool in Section C.' };
      }
      if (!sitePlan.fields.JSA1?.trim()) {
        return { valid: false, message: 'Signed JSA document reference is mandatory in Section D.' };
      }
      if (!sitePlan.fields.JSA2?.trim()) {
        return { valid: false, message: 'JSA team / joint site visit notes are mandatory in Section D.' };
      }
      if (!sitePlan.fields.SHFT?.trim()) {
        return { valid: false, message: 'Planned shift end time is mandatory in Section D.' };
      }
      if (!sitePlan.fields.ISSR?.trim()) {
        return { valid: false, message: 'Proposed Issuer SAP user ID is mandatory in Section D.' };
      }
      if (!sitePlan.fields.ACCP?.trim()) {
        return { valid: false, message: 'Proposed Acceptor SAP user ID is mandatory in Section D.' };
      }
      if (!sitePlan.fields.OPER?.trim()) {
        return { valid: false, message: 'Proposed Area Operator SAP user ID is mandatory in Section D.' };
      }
    }
    if (tab === 'workers') {
      if (workers.length === 0) {
        return { valid: false, message: 'Add at least one crew member in Crew Muster before proceeding.' };
      }
    }
    if (tab === 'hazards') {
      if (hazards.length === 0) {
        return { valid: false, message: 'Add at least one hazard and required risk control before proceeding.' };
      }
    }
    if (tab === 'gas-isolation') {
      const isIso = isolationRequired === 'X' || isolationRequired === 'Y';
      if (isIso && !isolationNo.trim()) {
        return { valid: false, message: 'Isolation certificate number is required when positive isolation is selected.' };
      }
      const isGas = gasTestRequired === 'X' || gasTestRequired === 'Y';
      if (isGas && !gasTestFreqHr) {
        return { valid: false, message: 'Gas test frequency interval (1h or 2h) is required when gas testing is selected.' };
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

    // If moving forward, validate current tab first
    if (targetIndex > currentIndex) {
      const validation = validateTab(activeTab);
      if (!validation.valid && validation.message) {
        toast.warning(validation.message, { title: 'Mandatory Field Missing' });
        return;
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
      return;
    }
    if (!newWorkerPhone.trim()) {
      setWorkerPhoneTouched(true);
      const msg = 'Worker Phone Number is mandatory. Enter a 10-digit mobile number.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      return;
    }
    const workerPhoneCheck = validatePhoneNumber(newWorkerPhone, true);
    if (!workerPhoneCheck.isValid) {
      setWorkerPhoneTouched(true);
      const msg = `Worker Phone: ${workerPhoneCheck.error}`;
      toast.warning(msg, { title: 'Invalid Phone Number' });
      setNotificationBanner({ type: 'error', message: msg });
      return;
    }
    if (newWorkerType === 'EMP' && !newWorkerEmpId.trim()) {
      const msg = 'Employee ID is mandatory for company employee workers.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      return;
    }
    if (newWorkerType === 'CONT' && !newWorkerContractorName.trim()) {
      const msg = 'Contractor Company Name is mandatory for contractor workers.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
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
    if (!newHazardDesc.trim() || !newControlDesc.trim()) {
      const msg = 'Enter both the hazard description and its required control measure.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
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
      ValidFromT: validFromT,
      ValidToD: validToD || null,
      ValidToT: validToT,

      GasTestFreqHr: (gasTestRequired === 'Y' || gasTestRequired === 'X') ? gasTestFreqHr : '',
      GasTestRequired: (gasTestRequired === 'Y' || gasTestRequired === 'X') ? 'X' : ' ',
      Status: isolationRequired && gasTestRequired ? initialPermitStatus(isolationRequired, gasTestRequired) : 'INTD',

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
      _Safety: [...sitePlanRows(permitType, sitePlan), ...safetyChecklist],
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
    excludeChildNavs
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
      setActiveTab('work');
      toast.warning('Select a work reference before submitting the permit.', { title: 'Work Reference Required' });
      setNotificationBanner({ type: 'error', message: 'Select a work reference before submitting the permit.' });
      return;
    }
    if (tplnr.length > 30) {
      setActiveTab('general');
      toast.error('The selected functional location exceeds the 30-character limit of PermitInfo.', { title: 'Validation Error' });
      setNotificationBanner({ type: 'error', message: 'The selected functional location exceeds the 30-character limit of PermitInfo. Please resolve the location with the SAP team before submitting.' });
      return;
    }
    if (!user) {
      toast.error('Sign in to SAP before creating a permit.', { title: 'Authentication Required' });
      setNotificationBanner({ type: 'error', message: 'Sign in to SAP before creating a permit.' });
      return;
    }
    if (!execDept.trim()) {
      setActiveTab('general');
      toast.warning('Select the execution department before submitting the permit.', { title: 'Execution Department Required' });
      setNotificationBanner({ type: 'error', message: 'Select the execution department before submitting the permit.' });
      return;
    }
    if (filteredPlantOptions.length > 0 && !execPlant.trim()) {
      setActiveTab('general');
      toast.warning(`Select the sub working plant for ${execDept}.`, { title: 'Sub Working Plant Required' });
      setNotificationBanner({ type: 'error', message: `Select the sub working plant for ${execDept}.` });
      return;
    }
    if (!supvPhone.trim()) {
      setActiveTab('general');
      setSupvPhoneTouched(true);
      toast.warning('Supervisor Phone Number is mandatory. Enter a 10-digit mobile number.', { title: 'Supervisor Phone Required' });
      setNotificationBanner({ type: 'error', message: 'Supervisor Phone Number is mandatory.' });
      return;
    }
    const supvPhoneCheck = validatePhoneNumber(supvPhone, true);
    if (!supvPhoneCheck.isValid) {
      setActiveTab('general');
      setSupvPhoneTouched(true);
      toast.warning(`Supervisor Phone: ${supvPhoneCheck.error}`, { title: 'Invalid Phone Number' });
      setNotificationBanner({ type: 'error', message: `Supervisor Phone: ${supvPhoneCheck.error}` });
      return;
    }
    try {
      preparePermitCreate(fullPayload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Check the permit details.';
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      setNotificationBanner({ type: 'error', message: msg });
      return;
    }
    submissionLock.current = true;
    setIsSubmitting(true);
    setNotificationBanner(null);

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
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {submissionResponse.Status || 'CRTD'}
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
                  Create Permit Request
                </h1>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#006398] border border-blue-200">
                  SAP Auto-Numbered
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
                  className={`px-2 py-1.5 rounded-xl text-left transition-all flex items-center justify-between gap-1 select-none ${
                    isDisabled
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
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                      isCurrent ? 'bg-sky-100 text-[#006398]' : 'bg-slate-100 text-slate-600'
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
          className={`mb-3 p-3 rounded-xl border flex items-center justify-between text-xs font-sans shadow-2xs ${
            notificationBanner.type === 'success'
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
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
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
                        type="text"
                        required
                        maxLength={40}
                        value={areaLoc}
                        onChange={(e) => setAreaLoc(e.target.value)}
                        placeholder="e.g. Caustic Unit / Tank Farm"
                        className="ptw-input font-mono"
                      />
                    </div>

                    <div>
                      <label className="ptw-label">Work Center (Arbpl)</label>
                      <input
                        type="text"
                        value={arbpl}
                        onChange={(e) => setArbpl(e.target.value)}
                        className="ptw-input font-mono"
                      />
                    </div>

                    <div>
                      <label className="ptw-label">Equipment No (Equnr)</label>
                      <input
                        type="text"
                        value={equnr}
                        onChange={(e) => setEqunr(e.target.value)}
                        className="ptw-input font-mono"
                      />
                    </div>

                    <div>
                      <label className="ptw-label">Functional Location (Tplnr)</label>
                      <input
                        type="text"
                        value={tplnr}
                        onChange={(e) => setTplnr(e.target.value)}
                        className="ptw-input font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="ptw-label">
                      Job Description (JobDesc) <span className="text-red-500">*</span>
                    </label>
                    <textarea
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
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                            supvPhoneValidation.isValid
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
                          type="tel"
                          maxLength={16}
                          value={supvPhone}
                          onChange={(e) => {
                            const sanitized = sanitizePhoneNumber(e.target.value, 16);
                            setSupvPhone(sanitized);
                          }}
                          onBlur={() => setSupvPhoneTouched(true)}
                          placeholder="9876543210"
                          className={`ptw-input font-mono text-xs pr-8 transition-colors ${
                            supvPhoneTouched && !supvPhoneValidation.isValid
                              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20'
                              : supvPhoneValidation.isValid
                              ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20'
                              : ''
                          }`}
                        />
                        {supvPhone.trim() && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                supvPhoneValidation.isValid ? 'text-emerald-600' : 'text-amber-500'
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
                    <span className="font-mono text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-[#006398]">play_circle</span>
                      <span>Permit Start Window (Valid From)</span>
                      <span className="text-red-500 font-bold">*</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Date *</label>
                        <input
                          type="date"
                          required
                          value={validFromD}
                          onChange={(e) => setValidFromD(e.target.value)}
                          className="ptw-input font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Time (IST) *</label>
                        <input
                          type="time"
                          step="1"
                          required
                          value={validFromT}
                          onChange={(e) => setValidFromT(e.target.value)}
                          className="ptw-input font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Valid To Group (5 cols) */}
                  <div className="md:col-span-5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-amber-600">stop_circle</span>
                      <span>Permit Expiry Window (Valid To)</span>
                      <span className="text-red-500 font-bold">*</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Date *</label>
                        <input
                          type="date"
                          required
                          value={validToD}
                          onChange={(e) => setValidToD(e.target.value)}
                          className="ptw-input font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Time (IST) *</label>
                        <input
                          type="time"
                          step="1"
                          required
                          value={validToT}
                          onChange={(e) => setValidToT(e.target.value)}
                          className="ptw-input font-mono text-xs"
                        />
                      </div>
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
                      <fieldset>
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
                          : initialPermitStatus(isolationRequired, gasTestRequired) === 'INTD'
                          ? 'Initial Status: INTD. All required isolation and gas-test approvals must be completed in SAP before CRTD.'
                          : 'Initial Status: CRTD. No isolation or gas-test approval is requested.'}{' '}
                        CRTD does not authorize field work.
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
                      <fieldset>
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
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                              worker.WorkerTypeCode === 'EMP'
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
                        className={`text-[9px] font-mono px-1 py-0.2 rounded border transition-colors ${
                          workerPhoneValidation.isValid
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
                      type="tel"
                      maxLength={20}
                      value={newWorkerPhone}
                      onChange={(e) => {
                        const sanitized = sanitizePhoneNumber(e.target.value, 20);
                        setNewWorkerPhone(sanitized);
                      }}
                      onBlur={() => setWorkerPhoneTouched(true)}
                      placeholder="9876543210"
                      className={`w-full px-2.5 py-1.5 bg-white border rounded-lg font-mono text-xs transition-colors ${
                        workerPhoneTouched && !workerPhoneValidation.isValid
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
                <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-100 text-[#006398]">
                  {ppeItems.length} PPE Requirements
                </span>
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
                      className="w-full rounded-lg bg-[#006398] hover:bg-[#004f7a] p-2 text-xs font-mono font-bold text-white transition-colors flex items-center justify-center gap-1"
                      onClick={() => {
                        if (!newPpeCode.trim() || !newPpeDescription.trim()) return;
                        setPpeItems(prev => [
                          ...prev,
                          {
                            PermitNo: '',
                            ItemNo: String(prev.length + 1),
                            PpeCode: newPpeCode.trim(),
                            PpeDesc: newPpeDescription.trim(),
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

              {/* Safety Checklist (_Safety) */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Safety Inspection Checklist (_Safety)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Verified safety preparations and mandatory questionnaire responses for{' '}
                      {PERMIT_CATEGORIES.find((c) => c.code === permitType || c.sapCode === permitType)?.label || permitType || 'permit'}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {allActiveCategories.map((catCode) => {
                      const catDef = PERMIT_CATEGORIES.find((c) => c.code === catCode || c.sapCode === catCode);
                      const qCount = (categoryQuestions[catCode] || []).length;
                      const pStat = checklistProgressMap[catCode];
                      const answered = pStat?.answered || 0;
                      return (
                        <button
                          key={catCode}
                          type="button"
                          onClick={() => void handleOpenChecklistForCategory(catCode)}
                          className="px-3.5 py-1.5 rounded-xl border border-[#006398] text-[#006398] hover:bg-[#006398] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0"
                          title={`Open ${catDef?.label || catCode} Compliance Questionnaire`}
                        >
                          <span className="material-symbols-outlined text-[15px]">fact_check</span>
                          <span>{catDef?.label || catCode} ({answered}/{qCount})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3">
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

                  {safetyChecklist.map((item, idx) => (
                    <div
                      key={item.ItemNo}
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
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              item.Response === resp
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
                  ))}
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
                      <dt className="text-slate-500 font-medium">SAP Child Table _WorkType (Multi-Work)</dt>
                      <dd className="mt-1 font-mono font-bold text-slate-900">
                        {workTypeRecords.length > 0 ? (
                          <span className="text-[#006398]">
                            {workTypeRecords.length} Categories ({workTypeRecords.map(w => w.WorkType).join(', ')})
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">
                            Single Work Type (Primary Only)
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
                            {natwRecords.length} Selected ({natwRecords.map(n => n.NatwCode).join(', ')})
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
                            {equipmentRecords.length} Declared ({equipmentRecords.map(e => e.EquipCode).join(', ')})
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
                <span>{isSubmitting ? 'Submitting to SAP...' : 'Create permit request'}</span>
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
