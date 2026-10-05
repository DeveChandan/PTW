import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SapUser } from '../../core/auth/sapAuthContext';
import {
  PermitDeepInsertPayload,
  PermitDeepInsertResponse,
  WorkerRecord,
  PPERecord,
  SafetyRecord,
  HazardControlRecord,
  IsolationRecord
} from '../../core/types/ptw.types';
import {
  permitCreateApi, PermitCreateUnconfirmedError
} from '../../core/api/modules/permitCreate.api';

import { preparePermitCreate } from '../../core/api/modules/permitCreate.validation';
import { initialPermitStatus, type Requirement } from '../../core/ptw/prerequisites';
import { SiteProcedureStep, ProcedureGuidance } from './SiteProcedureStep';
import { emptySitePlan, PERMIT_CATEGORIES, sitePlanRows } from '../../core/ptw/siteProcedure';
import { PermitWorkSelectionStep } from './PermitWorkSelectionStep';
import { WorkSelection, referenceId, toPermitReferenceFields } from '../../core/api/modules/permitWorkLookup.api';
import { configApi, checklistApi, isolationApi, toSapChecklistPermitType } from '../../core/api';
import { SapConfigRecord } from '../../core/types/config.types';
import { SapChecklistItem, ChecklistAnswer, ChecklistAnswerType } from '../../core/types/checklist.types';
import { PpeValueHelpDialog } from '../../shared/components/PpeValueHelpDialog';
import { PermitChecklistModal } from './PermitChecklistModal';

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
  const [supvName, setSupvName] = useState<string>('');
  const [supvPhone, setSupvPhone] = useState<string>('');
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

  // Isolation & Gas Testing Requirements
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
  const [submissionResponse, setSubmissionResponse] = useState<PermitDeepInsertResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [notificationBanner, setNotificationBanner] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // New Worker Form Modal / Row
  const [newPpeCode, setNewPpeCode] = useState('');
  const [newPpeDescription, setNewPpeDescription] = useState('');
  const [newSafetyCode, setNewSafetyCode] = useState('');
  const [newSafetyDescription, setNewSafetyDescription] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerType, setNewWorkerType] = useState<'EMP' | 'CONT'>('EMP');
  const [newWorkerEmpId, setNewWorkerEmpId] = useState('');
  const [newWorkerContractorName, setNewWorkerContractorName] = useState('');

  // New Hazard Form Inputs
  const [newHazardCode, setNewHazardCode] = useState('ELEC');
  const [newHazardDesc, setNewHazardDesc] = useState('');
  const [newControlCode, setNewControlCode] = useState('ELEC01');
  const [newControlDesc, setNewControlDesc] = useState('');

  // New Isolation Point Inputs
  const [newIsoPoint, setNewIsoPoint] = useState('');
  const [newIsoType, setNewIsoType] = useState('MECH');
  const [newIsoLockTag, setNewIsoLockTag] = useState('');

  // SAP Live Config State (Dropdowns & F4 Value Help)
  const [shiftOptions, setShiftOptions] = useState<SapConfigRecord[]>([]);
  const [deptOptions, setDeptOptions] = useState<SapConfigRecord[]>([]);
  const [availableIsolations, setAvailableIsolations] = useState<string[]>([]);
  const [ppeCatalog, setPpeCatalog] = useState<SapConfigRecord[]>([]);
  const [workerTypeOptions, setWorkerTypeOptions] = useState<SapConfigRecord[]>([]);
  const [isPpeHelpOpen, setIsPpeHelpOpen] = useState(false);

  // SAP Checklist Questionnaire State
  const [checklistItems, setChecklistItems] = useState<SapChecklistItem[]>([]);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, { response: ChecklistAnswerType; remarks: string }>>({});
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState<boolean>(false);

  const checklistStats = useMemo(() => {
    let yes = 0;
    let no = 0;
    let na = 0;
    let answered = 0;
    checklistItems.forEach((item) => {
      const resp = checklistAnswers[item.QuestionaireId]?.response;
      if (resp === 'YES') { yes++; answered++; }
      else if (resp === 'NO') { no++; answered++; }
      else if (resp === 'NA') { na++; answered++; }
    });
    const total = checklistItems.length;
    const pending = total - answered;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { yes, no, na, answered, total, pending, percent };
  }, [checklistItems, checklistAnswers]);

  const handleSelectPermitType = async (code: string) => {
    setPermitType(code);
    const sapCode = toSapChecklistPermitType(code);
    setIsLoadingChecklist(true);
    try {
      const questions = await checklistApi.fetchChecklist(sapCode);
      setChecklistItems(questions);
      if (questions.length > 0) {
        setIsChecklistModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load permit checklist:', err);
    } finally {
      setIsLoadingChecklist(false);
    }
  };

  const handleSaveChecklist = (answers: ChecklistAnswer[]) => {
    const newAnswersMap: Record<string, { response: ChecklistAnswerType; remarks: string }> = {};
    answers.forEach((a) => {
      newAnswersMap[a.questionaireId] = { response: a.response, remarks: a.remarks };
    });
    setChecklistAnswers(newAnswersMap);

    const newSafetyRecords: SafetyRecord[] = answers
      .filter((a) => a.response)
      .map((a, idx) => ({
        PermitNo: '',
        ItemNo: String(idx + 1).slice(-4),
        Category: (a.category || 'GEN').substring(0, 6).toUpperCase(),
        ItemCode: `Q${a.questionaireId}`.slice(0, 4),
        Response: a.response || 'NO',
        ValueText: a.question.substring(0, 100),
        ValueNum: 0,
        Unit: '',
        ReferenceNo: a.questionaireId.substring(0, 30),
        ResponsibleUser: user?.id || '',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: (a.remarks || '').substring(0, 255),
      }));

    setSafetyChecklist((prev) => {
      const manualEntries = prev.filter((p) => !p.ItemCode.startsWith('Q'));
      return [...newSafetyRecords, ...manualEntries];
    });

    setIsChecklistModalOpen(false);
    const answeredCount = answers.filter((a) => a.response).length;
    setNotificationBanner({
      type: 'success',
      message: `Compliance checklist updated: ${answeredCount} of ${answers.length} verified.`
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
    isolationApi.list().then((list) => {
      setAvailableIsolations(list.map((i) => i.IsolationNo));
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
      setIsolationRequired(''); setGasTestRequired(''); setExecDept('');
      setWorkers([]); setPersonsQty(0); setHazards([]); setIsolations([]);
      setPpeItems([]); setSafetyChecklist([]); setIsolationNo('');
      setChecklistItems([]); setChecklistAnswers({}); setIsChecklistModalOpen(false);
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
    setCreatorComment(selection.category + ' work · ' + selection.source + ' ' + referenceId(selection.source, selection.reference));
    setSubmissionResponse(null);
    setNotificationBanner(null);
    setActiveTab('general');
  };

  // 7. Add Worker Handler
  const handleAddWorker = () => {
    if (!newWorkerName.trim() || (newWorkerType === 'EMP' && !newWorkerEmpId.trim()) || (newWorkerType === 'CONT' && !newWorkerContractorName.trim())) {
      setNotificationBanner({ type: 'error', message: 'Enter a worker name and employee ID or contractor company.' }); return;
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
    setPersonsQty((prev) => prev + 1);
    setNewWorkerName('');
    setNewWorkerPhone('');
    setNewWorkerEmpId('');
    setNewWorkerContractorName('');
  };

  const handleRemoveWorker = (itemNo: string) => {
    setWorkers(workers.filter((w) => w.ItemNo !== itemNo));
    setPersonsQty((prev) => Math.max(0, prev - 1));
  };

  // 8. Add Hazard Control Handler
  const handleAddHazard = () => {
    if (!newHazardDesc.trim() || !newControlDesc.trim()) { setNotificationBanner({ type: 'error', message: 'Enter the hazard and its required control.' }); return; }
    const nextItemNo = (Math.max(0, ...hazards.map(row => Number(row.ItemNo))) + 1).toString();
    const newH: HazardControlRecord = {
      PermitNo: permitNo,
      ItemNo: nextItemNo,
      HazardCode: newHazardCode,
      HazardDesc: newHazardDesc.toUpperCase(),
      RiskLevel: 'HIGH',
      ControlCode: newControlCode,
      ControlDesc: newControlDesc,
      ControlStatus: 'OPEN',
      ResponsibleUser: user?.id || personResp,
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: 'MANDATORY CONTROL VERIFICATION'
    };
    setHazards([...hazards, newH]);
    setNewHazardDesc('');
    setNewControlDesc('');
  };

  // 9. Interactive 5x5 Matrix Cell Click Handler
  const handleMatrixCellClick = (consequence: number, likelihood: number) => {
    setSelectedMatrixCell({ c: consequence, l: likelihood });
    const score = consequence * likelihood;
    let computedLevel: 'LOW' | 'MED' | 'HIGH' | 'CRIT' = 'LOW';
    if (score >= 15) computedLevel = 'CRIT';
    else if (score >= 10) computedLevel = 'HIGH';
    else if (score >= 5) computedLevel = 'MED';

    setHazards((prev) =>
      prev.map((h, i) => (i === selectedHazardIdx ? { ...h, RiskLevel: computedLevel } : h))
    );
  };

  // 10. Add Isolation Point Handler
  const handleAddIsolation = () => {
    if (!newIsoPoint) return;
    const nextItemNo = (Math.max(0, ...isolations.map(row => Number(row.ItemNo))) + 1).toString();
    const newIso: IsolationRecord = {
      PermitNo: permitNo,
      IsolationNo: isolationNo,
      ItemNo: nextItemNo,
      IsolType: newIsoType,
      ReferenceType: isolationRefType,
      ReferenceId: equnr,
      Status: 'INTD',
      RequestedBy: user?.id || personResp,
      RequestedDate: validFromD,
      RequestedTime: validFromT,
      VerifiedBy: '',
      VerifiedDate: null,
      VerifiedTime: '00:00:00',
      IsolatedBy: '',
      IsolatedDate: null,
      IsolatedTime: '00:00:00',
      ApprovedBy: '',
      ApprovedDate: null,
      ApprovedTime: '00:00:00',
      NormalizedBy: '',
      NormalizedDate: null,
      NormalizedTime: '00:00:00',
      IsolationPoint: newIsoPoint.toUpperCase(),
      IsolMethod: 'LOCK',
      LockTagNo: newIsoLockTag,
      IsIsolated: 'N',
      PointIsolatedBy: '',
      PointIsolatedAt: null,
      ZeroEnergyConf: 'N',
      ZeroEnergyBy: '',
      ZeroEnergyAt: null,
      IsNormalized: 'N',
      PointNormalizedBy: '',
      PointNormalizedAt: null,
      Remarks: 'ZERO ENERGY CONFIRMATION MANDATORY',
      LastChangedAt: null
    };

    setIsolations([...isolations, newIso]);
    setNewIsoPoint('');
    setNewIsoLockTag('');
  };

  // 11. Build the Complete Deep Insert JSON Payload
  const fullPayload: PermitDeepInsertPayload = useMemo(() => {
    return {
      Permit_No: permitNo,
      PermitType: permitType,

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
      ExecDept: execDept,

      SupvName: supvName,
      SupvPhone: supvPhone,
      SafetyOfficer: safetyOfficer,

      Shift: shift,
      PersonsQty: personsQty,

      ValidFromD: validFromD || null,
      ValidFromT: validFromT,
      ValidToD: validToD || null,
      ValidToT: validToT,

      GasTestFreqHr: gasTestRequired === 'Y' ? gasTestFreqHr : '',
      GasTestRequired: gasTestRequired,
      Status: isolationRequired && gasTestRequired ? initialPermitStatus(isolationRequired, gasTestRequired) : 'INTD',

      RefPermitNo: '',

      LotoRequired: (isolationRequired === 'X' || isolationRequired === 'Y') ? 'Y' : 'N',
      LotoCertNo: (isolationRequired === 'X' || isolationRequired === 'Y') ? (isolationNo || '') : '',

      IsolationRequired: (isolationRequired === 'X' || isolationRequired === 'Y') ? 'X' : ' ',
      IsolationRefType: (isolationRequired === 'X' || isolationRequired === 'Y') ? isolationRefType : '',
      IsolationNo: (isolationRequired === 'X' || isolationRequired === 'Y') ? isolationNo : '',
      IsolationStatus: (isolationRequired === 'X' || isolationRequired === 'Y') ? 'INTD' : '',

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
      _Isolation: (isolationRequired === 'X' || isolationRequired === 'Y') ? isolations : []

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
    workSelection
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
      setNotificationBanner({ type: 'error', message: 'Select a work reference before submitting the permit.' });
      return;
    }
    if (tplnr.length > 30) {
      setActiveTab('general');
      setNotificationBanner({ type: 'error', message: 'The selected functional location exceeds the 30-character limit of PermitInfo. Please resolve the location with the SAP team before submitting.' });
      return;
    }
    if (!user) { setNotificationBanner({ type: 'error', message: 'Sign in to SAP before creating a permit.' }); return; }
    try { preparePermitCreate(fullPayload); } catch (error) { setNotificationBanner({ type: 'error', message: error instanceof Error ? error.message : 'Check the permit details.' }); return; }
    submissionLock.current = true;
    setIsSubmitting(true);
    setNotificationBanner(null);

    try {
      const response = await permitCreateApi.createPermitDeepInsert(fullPayload);
      setSubmissionResponse(response);
      setNotificationBanner({
        type: 'success',
        message: `SAP OData V4 Deep Insert Successful! Permit ${response.Permit_No} created in status ${response.Status || 'not confirmed'}.`
      });
    } catch (err: any) {
      if (err instanceof PermitCreateUnconfirmedError) setCreationUncertain(true);
      console.error('[PermitCreateModule] Submit error:', err);
      setNotificationBanner({
        type: 'error',
        message: err.message || 'Failed to submit permit to SAP Gateway.'
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

  const stepsList: { key: TabKey; label: string; icon: string; count?: number }[] = [
    { key: 'work', label: '1. Work Selection', icon: 'construction' },
    { key: 'general', label: '2. General Details', icon: 'info' },
    { key: 'procedure', label: '3. Client Procedure', icon: 'fact_check' },
    { key: 'workers', label: '4. Crew Muster', icon: 'group', count: workers.length },
    { key: 'ppe', label: '5. PPE & Safety', icon: 'security', count: ppeItems.length },
    { key: 'hazards', label: '6. Hazards & 5x5 Risk', icon: 'warning', count: hazards.length },
    { key: 'gas-isolation', label: '7. Isolation Plan', icon: 'air', count: isolations.length },
    { key: 'payload', label: '8. Review & Submit', icon: 'data_object' }
  ];

  if (submissionResponse) return (
    <section className="mx-auto mt-10 max-w-2xl rounded-2xl border border-emerald-200 bg-white p-8">
      <h1 className="text-2xl font-bold text-emerald-800">Permit request created</h1>
      <p className="mt-4">SAP permit number: <strong>{submissionResponse.Permit_No}</strong></p>
      <p className="mt-2">Status: {submissionResponse.Status || 'Returned by SAP'}</p>
      <p className="mt-4 text-sm text-slate-600">Complete the required approval, isolation and gas-testing workflow before work starts.</p>
      <button type="button" onClick={onBack} className="mt-6 rounded-lg bg-[#006398] px-4 py-2 text-white">Return to launchpad</button>
    </section>
  );

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumb Bar */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#006398] text-slate-700 hover:text-[#006398] rounded-xl text-xs font-mono font-semibold transition-all shadow-sm group"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
              <span>Launchpad</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <span>PTW Suite</span>
            <span>/</span>
            <span className="text-[#006398] font-bold">Create Permit Request</span>
          </div>
        </div>

      </div>

      {/* Notification Alert Banner */}
      {notificationBanner && (
        <div
          className={`mb-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-sans shadow-sm ${
            notificationBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : notificationBanner.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              {notificationBanner.type === 'success' ? 'check_circle' : notificationBanner.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{notificationBanner.message}</span>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* UX STEPPER PROGRESS BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006398] text-[20px]">task_alt</span>
            <span className="font-display font-bold text-sm text-slate-900">
              Request completion
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-500">Progress:</span>
            <strong className="text-[#006398]">{completionPercentage}% Request complete</strong>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#006398] to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>

        {/* Work selection followed by the existing six permit steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {stepsList.map((st) => {
            const isCurrent = activeTab === st.key;
            return (
              <button
                key={st.key}
                onClick={() => setActiveTab(st.key)}
                disabled={st.key !== 'work' && !workSelection}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-2 rounded-xl border text-left transition-all flex items-center justify-between font-mono text-[11px] ${
                  isCurrent
                    ? 'bg-sky-50 border-[#006398] text-[#006398] font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-[16px] shrink-0">{st.icon}</span>
                  <span className="truncate">{st.label}</span>
                </div>
                {st.count !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 font-bold shrink-0">
                    {st.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form Container Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
        {/* Top Title & Creation Source Toggle Bar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#006398] text-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[24px]">post_add</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-xl text-slate-900">
                  Create permit request
                </h1>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#006398] border border-blue-200">
                  Permit number: Assigned by SAP
                </span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  New request
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Create a permit request in SAP. Creation does not authorize work.
              </p>
            </div>
          </div>

        </div>

        {workSelection && activeTab !== 'work' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-sky-50 px-5 py-3 text-sm">
            <span><strong>{workSelection.category}</strong> · {workSelection.source} {referenceId(workSelection.source, workSelection.reference)} · {workSelection.fromDate} to {workSelection.toDate}</span>
            <button type="button" onClick={() => setActiveTab('work')} className="font-semibold text-[#006398] underline">Change work selection</button>
          </div>
        )}

        {/* Tab Content Panes */}
        <fieldset disabled={isSubmitting || creationUncertain} className="p-6 min-w-0">
          {activeTab === 'work' && (
            <PermitWorkSelectionStep selection={workSelection} client={user?.client}
              onInvalidate={() => { setWorkSelection(null); setSubmissionResponse(null); setNotificationBanner(null); }}
              onContinue={handleWorkSelected} />
          )}
          {activeTab === 'procedure' && <SiteProcedureStep primary={permitType} plan={sitePlan} startTime={validFromT} onChange={setSitePlan} />}

          {/* TAB 1: General Details & PM Order */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm">Execution agency<select value={execAgency} onChange={e => setExecAgency(e.target.value)} className="block w-full border rounded p-2"><option value="CONT">Contractor</option><option value="EMP">Company employees</option></select></label>
                <label className="text-sm">
                  Execution department *
                  <select
                    required
                    aria-required="true"
                    value={execDept}
                    onChange={e => setExecDept(e.target.value)}
                    className="block w-full border rounded p-2 bg-white"
                  >
                    <option value="" disabled>Select department</option>
                    {(deptOptions.length > 0
                      ? deptOptions
                      : [
                          { Config_Code: 'CIVIL', Config_Desc: 'CIVIL' },
                          { Config_Code: 'ELECTRICAL', Config_Desc: 'ELECTRICAL' },
                          { Config_Code: 'INSPECTION', Config_Desc: 'INSPECTION' },
                          { Config_Code: 'INSTRUMENT', Config_Desc: 'INSTRUMENTATION' },
                          { Config_Code: 'MECH_ROT', Config_Desc: 'MECHANICAL (ROTARY)' },
                          { Config_Code: 'MECH_STAT', Config_Desc: 'MECHANICAL (STATIC)' },
                          { Config_Code: 'PROCESS', Config_Desc: 'PROCESS' },
                          { Config_Code: 'SAFETY', Config_Desc: 'SAFETY' },
                        ]
                    ).map((d) => (
                      <option key={d.Config_Code} value={d.Config_Desc}>
                        {d.Config_Code === d.Config_Desc ? d.Config_Desc : `${d.Config_Desc} (${d.Config_Code})`}
                      </option>
                    ))}
                    {execDept && !(deptOptions.length > 0 ? deptOptions : [
                      { Config_Code: 'CIVIL', Config_Desc: 'CIVIL' },
                      { Config_Code: 'ELECTRICAL', Config_Desc: 'ELECTRICAL' },
                      { Config_Code: 'INSPECTION', Config_Desc: 'INSPECTION' },
                      { Config_Code: 'INSTRUMENT', Config_Desc: 'INSTRUMENTATION' },
                      { Config_Code: 'MECH_ROT', Config_Desc: 'MECHANICAL (ROTARY)' },
                      { Config_Code: 'MECH_STAT', Config_Desc: 'MECHANICAL (STATIC)' },
                      { Config_Code: 'PROCESS', Config_Desc: 'PROCESS' },
                      { Config_Code: 'SAFETY', Config_Desc: 'SAFETY' }
                    ]).some(d => (d.Config_Desc || d.Config_Code) === execDept || d.Config_Code === execDept) && (
                      <option value={execDept}>{execDept}</option>
                    )}
                  </select>
                </label>
                <label className="text-sm">
                  Shift *
                  <select
                    value={shift}
                    onChange={e => setShift(e.target.value)}
                    className="block w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-mono"
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
                </label>
              </div>
              <label className="block text-sm">Requester comments<textarea value={creatorComment} onChange={e => setCreatorComment(e.target.value)} maxLength={255} className="block w-full border rounded p-2" /></label>
              {/* Permit Type Radio Bar */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Permit Category & Nature of Work *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                  {PERMIT_CATEGORIES.map((t) => (
                    <div
                      key={t.code}
                      onClick={() => void handleSelectPermitType(t.code)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        permitType === t.code
                          ? 'bg-sky-50 border-[#006398] shadow-sm text-[#006398]'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                        {permitType === t.code && (
                          <span className="material-symbols-outlined text-[16px] text-[#006398]">check_circle</span>
                        )}
                      </div>
                      <span className="font-bold text-xs">{t.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Dynamic SAP Compliance Questionnaire Status Strip */}
                {isLoadingChecklist && (
                  <div className="mt-3 p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 flex items-center gap-2.5 text-xs text-sky-800">
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>Checking SAP for required compliance checklist questionnaire...</span>
                  </div>
                )}

                {!isLoadingChecklist && permitType && checklistItems.length > 0 && (
                  <div className="mt-3 p-4 rounded-xl border border-[#006398]/30 bg-gradient-to-r from-sky-50/70 via-slate-50 to-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                            SAP: {toSapChecklistPermitType(permitType)}
                          </span>
                          {checklistStats.percent === 100 ? (
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
                          {checklistStats.answered} of {checklistItems.length} questions completed ({checklistStats.percent}%)
                          {checklistStats.answered > 0 && (
                            <span className="ml-2 font-mono text-[11px] text-slate-600">
                              · YES: {checklistStats.yes} · NO: {checklistStats.no} · NA: {checklistStats.na}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsChecklistModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#006398] hover:bg-[#004e78] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">fact_check</span>
                      {checklistStats.percent === 100 ? 'Review Checklist' : 'Fill Compliance Questionnaire'}
                    </button>
                  </div>
                )}
              </div>

              {/* Maintenance Order & Notification Strip */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#006398]">construction</span>
                    SAP Maintenance Order (MO) & Notification Context
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Service: zptw_services/0001</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">MO Number (Aufnr)</label>
                    <input
                      type="text"
                      value={aufnr}
                      readOnly
                      placeholder="e.g. 400100001"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Notification (Qmnum)</label>
                    <input
                      type="text"
                      value={qmnum}
                      readOnly
                      placeholder="e.g. 100100000001"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Order Type (Auart)</label>
                    <input
                      type="text"
                      value={auart}
                      readOnly
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Assembly Tag</label>
                    <input
                      type="text"
                      value={assembly}
                      onChange={(e) => setAssembly(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>
                </div>
              </div>

              {/* Plant, Functional Location, Equipment & Work Area Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 font-sans text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Plant (Werks) *</label>
                  <input
                    type="text"
                    value={werks}
                    onChange={(e) => setWerks(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Work Area (AreaLoc) *</label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={areaLoc}
                    onChange={(e) => setAreaLoc(e.target.value)}
                    placeholder="e.g. Caustic Unit / Tank Farm"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Work Center (Arbpl)</label>
                  <input
                    type="text"
                    value={arbpl}
                    onChange={(e) => setArbpl(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Equipment No (Equnr)</label>
                  <input
                    type="text"
                    value={equnr}
                    onChange={(e) => setEqunr(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Functional Location (Tplnr)</label>
                  <input
                    type="text"
                    value={tplnr}
                    onChange={(e) => setTplnr(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>
              </div>

              {/* Work Scope / Job Description */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">Job Description (JobDesc) *</label>
                <textarea
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  placeholder="Describe the technical work to be performed..."
                />
              </div>

              {/* Validity Window (Dates & Times) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="block text-xs font-mono font-bold text-slate-800 uppercase mb-3">
                  Validity Window & Shift Duration
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 font-sans text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Valid From Date</label>
                    <input
                      type="date"
                      value={validFromD}
                      onChange={(e) => setValidFromD(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Valid From Time</label>
                    <input
                      type="time"
                      step="1"
                      value={validFromT}
                      onChange={(e) => setValidFromT(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Valid To Date</label>
                    <input
                      type="date"
                      value={validToD}
                      onChange={(e) => setValidToD(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Valid To Time</label>
                    <input
                      type="time"
                      step="1"
                      value={validToT}
                      onChange={(e) => setValidToT(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Gas Retest Interval (Hrs)</label>
                    <select
                      value={gasTestFreqHr}
                      disabled={gasTestRequired !== 'Y'}
                      onChange={(e) => setGasTestFreqHr(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    >
                      <option value="1">1 Hour</option>
                      <option value="2">2 Hours (Standard)</option>

                    </select>
                  </div>
                </div>
              </div>

              {/* Personnel, Supervision & Agency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Supervisor Name</label>
                  <input
                    type="text"
                    value={supvName}
                    onChange={(e) => setSupvName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Supervisor Phone</label>
                  <input
                    type="text"
                    value={supvPhone}
                    onChange={(e) => setSupvPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Safety Officer</label>
                  <input
                    type="text"
                    value={safetyOfficer}
                    onChange={(e) => setSafetyOfficer(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Authorized Crew Qty</label>
                  <input
                    type="number"
                    value={personsQty}
                    onChange={(e) => setPersonsQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <fieldset><legend className="text-sm font-semibold">Gas testing required *</legend><div className="mt-2 flex gap-5">{(['Y', 'N'] as const).map(value => <label key={value} className="flex items-center gap-2"><input type="radio" name="gas-required" required checked={gasTestRequired === value} onChange={() => setGasTestRequired(value)} />{value === 'Y' ? 'Yes' : 'No'}</label>)}</div></fieldset>
                <p className="mt-2 text-sm">{!isolationRequired || !gasTestRequired ? 'Select both requirements to determine the initial status.' : initialPermitStatus(isolationRequired, gasTestRequired) === 'INTD' ? 'Initial status: INTD. All required isolation and gas-test approvals must be completed before CRTD.' : 'Initial status: CRTD. No isolation or gas-test approval is requested.'} CRTD does not authorize work.</p>
              </div>
              {/* Isolation Requirements Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <fieldset>
                    <legend className="text-sm font-semibold">Isolation required *</legend>
                    <div className="mt-2 flex gap-5">
                      {[
                        { value: 'X', label: 'Yes' },
                        { value: ' ', label: 'No' },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="isolation-required"
                            required
                            checked={value === 'X' ? (isolationRequired === 'X' || isolationRequired === 'Y') : (isolationRequired === ' ' || isolationRequired === 'N')}
                            onChange={() => setIsolationRequired(value as Requirement)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <p className="text-xs text-slate-600">
                  When required, the isolation module user completes and approves the isolation after this request is saved.
                </p>
                {(isolationRequired === 'X' || isolationRequired === 'Y') && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
                    <div>
                      <label className="block text-[11px] text-slate-600 font-semibold mb-1">Isolation No</label>
                      <input
                        type="text"
                        list="available-isolations"
                        placeholder="e.g. ISO0000012"
                        value={isolationNo}
                        onChange={(e) => setIsolationNo(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                      />
                      <datalist id="available-isolations">
                        {availableIsolations.map((no) => (
                          <option key={no} value={no} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 font-semibold mb-1">Ref Type</label>
                      <input
                        type="text"
                        value={isolationRefType}
                        onChange={(e) => setIsolationRefType(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Workers & Crew Ledger */}
          {activeTab === 'workers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Authorized Worker & Contractor Crew Ledger (_Worker)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Register all company employees and external contractors working under this permit.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold bg-blue-50 text-[#006398] px-2.5 py-1 rounded-lg border border-blue-200">
                  {workers.length} Personnel Registered
                </span>
              </div>

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
                    <label className="block text-slate-600 font-semibold mb-1">Worker Type</label>
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
                    <label className="block text-slate-600 font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={newWorkerName}
                      onChange={(e) => setNewWorkerName(e.target.value)}
                      placeholder="e.g. JOHN DOE"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={newWorkerPhone}
                      onChange={(e) => setNewWorkerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      {newWorkerType === 'EMP' ? 'Employee ID' : 'Contractor Co.'}
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
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
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
          )}

          {/* TAB 3: PPE & Safety Checklist */}
          {activeTab === 'ppe' && (
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
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">Safety check code<input maxLength={4} value={newSafetyCode} onChange={e => setNewSafetyCode(e.target.value)} className="block w-full border rounded p-2" /></label>
                <label className="text-sm">Safety check description<input maxLength={100} value={newSafetyDescription} onChange={e => setNewSafetyDescription(e.target.value)} className="block w-full border rounded p-2" /></label>
                <button type="button" className="rounded border p-2 text-[#006398]" onClick={() => {
                  if (!newSafetyCode.trim() || !newSafetyDescription.trim()) return;
                  setSafetyChecklist(prev => [...prev, { PermitNo: '', ItemNo: String(prev.length + 1), Category: 'GEN', ItemCode: newSafetyCode.trim(), Response: 'NO', ValueText: newSafetyDescription.trim(), ValueNum: 0, Unit: '', ReferenceNo: '', ResponsibleUser: user?.id || '', VerifiedBy: '', VerifiedAt: null, Remarks: '' }]);
                  setNewSafetyCode(''); setNewSafetyDescription('');
                }}>Add safety check</button>
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
                  {checklistItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsChecklistModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl border border-[#006398] text-[#006398] hover:bg-[#006398] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">fact_check</span>
                      Open {toSapChecklistPermitType(permitType)} Questionnaire ({checklistStats.answered}/{checklistItems.length})
                    </button>
                  )}
                </div>
                <div className="space-y-3">
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
          )}

          {/* TAB 4: Hazard Controls & Interactive 5x5 Risk Matrix */}
          {activeTab === 'hazards' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Hazard Controls & Interactive 5x5 Risk Assessment Matrix
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select a hazard below and click the 5x5 matrix to automatically calculate risk severity & level.
                  </p>
                </div>
              </div>

              {/* 5x5 Risk Matrix Interactive Component */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 uppercase">
                      Evaluating Hazard:
                    </span>
                    <span className="font-mono font-bold text-xs bg-[#006398] text-white px-2 py-0.5 rounded-lg">
                      #{hazards[selectedHazardIdx]?.ItemNo} - {hazards[selectedHazardIdx]?.HazardDesc}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span>Selected Matrix Score:</span>
                    <strong className="text-base text-slate-900 font-bold">
                      {selectedMatrixCell.c * selectedMatrixCell.l}
                    </strong>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        selectedMatrixCell.c * selectedMatrixCell.l >= 15
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : selectedMatrixCell.c * selectedMatrixCell.l >= 10
                          ? 'bg-orange-100 text-orange-800 border border-orange-300'
                          : selectedMatrixCell.c * selectedMatrixCell.l >= 5
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {selectedMatrixCell.c * selectedMatrixCell.l >= 15
                        ? 'CRITICAL'
                        : selectedMatrixCell.c * selectedMatrixCell.l >= 10
                        ? 'HIGH'
                        : selectedMatrixCell.c * selectedMatrixCell.l >= 5
                        ? 'MEDIUM'
                        : 'LOW'}
                    </span>
                  </div>
                </div>

                {/* The 5x5 Grid Table */}
                <div className="grid grid-cols-6 gap-1.5 text-center font-mono text-xs max-w-xl mx-auto">
                  <div className="font-bold text-[10px] text-slate-400 flex items-center justify-center">
                    C \ L
                  </div>
                  <div className="font-bold text-[10px] text-slate-600">1 (Rare)</div>
                  <div className="font-bold text-[10px] text-slate-600">2 (Unlikely)</div>
                  <div className="font-bold text-[10px] text-slate-600">3 (Possible)</div>
                  <div className="font-bold text-[10px] text-slate-600">4 (Likely)</div>
                  <div className="font-bold text-[10px] text-slate-600">5 (Certain)</div>

                  {/* Row 5: Catastrophic */}
                  <div className="font-bold text-[10px] text-slate-600 text-right pr-2 self-center">5 (Catastr.)</div>
                  <button type="button" onClick={() => handleMatrixCellClick(5, 1)} className="p-2 rounded-lg bg-yellow-200 hover:ring-2 hover:ring-[#006398] font-bold">5</button>
                  <button type="button" onClick={() => handleMatrixCellClick(5, 2)} className="p-2 rounded-lg bg-orange-300 hover:ring-2 hover:ring-[#006398] font-bold">10</button>
                  <button type="button" onClick={() => handleMatrixCellClick(5, 3)} className="p-2 rounded-lg bg-rose-300 hover:ring-2 hover:ring-[#006398] font-bold">15</button>
                  <button type="button" onClick={() => handleMatrixCellClick(5, 4)} className="p-2 rounded-lg bg-rose-400 hover:ring-2 hover:ring-[#006398] font-bold">20</button>
                  <button type="button" onClick={() => handleMatrixCellClick(5, 5)} className="p-2 rounded-lg bg-rose-500 text-white hover:ring-2 hover:ring-[#006398] font-bold">25</button>

                  {/* Row 4: Major */}
                  <div className="font-bold text-[10px] text-slate-600 text-right pr-2 self-center">4 (Major)</div>
                  <button type="button" onClick={() => handleMatrixCellClick(4, 1)} className="p-2 rounded-lg bg-emerald-200 hover:ring-2 hover:ring-[#006398] font-bold">4</button>
                  <button type="button" onClick={() => handleMatrixCellClick(4, 2)} className="p-2 rounded-lg bg-yellow-200 hover:ring-2 hover:ring-[#006398] font-bold">8</button>
                  <button type="button" onClick={() => handleMatrixCellClick(4, 3)} className="p-2 rounded-lg bg-orange-300 hover:ring-2 hover:ring-[#006398] font-bold">12</button>
                  <button type="button" onClick={() => handleMatrixCellClick(4, 4)} className="p-2 rounded-lg bg-rose-300 hover:ring-2 hover:ring-[#006398] font-bold">16</button>
                  <button type="button" onClick={() => handleMatrixCellClick(4, 5)} className="p-2 rounded-lg bg-rose-400 hover:ring-2 hover:ring-[#006398] font-bold">20</button>

                  {/* Row 3: Moderate */}
                  <div className="font-bold text-[10px] text-slate-600 text-right pr-2 self-center">3 (Moderate)</div>
                  <button type="button" onClick={() => handleMatrixCellClick(3, 1)} className="p-2 rounded-lg bg-emerald-200 hover:ring-2 hover:ring-[#006398] font-bold">3</button>
                  <button type="button" onClick={() => handleMatrixCellClick(3, 2)} className="p-2 rounded-lg bg-yellow-200 hover:ring-2 hover:ring-[#006398] font-bold">6</button>
                  <button type="button" onClick={() => handleMatrixCellClick(3, 3)} className="p-2 rounded-lg bg-yellow-300 hover:ring-2 hover:ring-[#006398] font-bold">9</button>
                  <button type="button" onClick={() => handleMatrixCellClick(3, 4)} className="p-2 rounded-lg bg-orange-300 hover:ring-2 hover:ring-[#006398] font-bold">12</button>
                  <button type="button" onClick={() => handleMatrixCellClick(3, 5)} className="p-2 rounded-lg bg-rose-300 hover:ring-2 hover:ring-[#006398] font-bold">15</button>

                  {/* Row 2: Minor */}
                  <div className="font-bold text-[10px] text-slate-600 text-right pr-2 self-center">2 (Minor)</div>
                  <button type="button" onClick={() => handleMatrixCellClick(2, 1)} className="p-2 rounded-lg bg-emerald-100 hover:ring-2 hover:ring-[#006398] font-bold">2</button>
                  <button type="button" onClick={() => handleMatrixCellClick(2, 2)} className="p-2 rounded-lg bg-emerald-200 hover:ring-2 hover:ring-[#006398] font-bold">4</button>
                  <button type="button" onClick={() => handleMatrixCellClick(2, 3)} className="p-2 rounded-lg bg-yellow-200 hover:ring-2 hover:ring-[#006398] font-bold">6</button>
                  <button type="button" onClick={() => handleMatrixCellClick(2, 4)} className="p-2 rounded-lg bg-yellow-200 hover:ring-2 hover:ring-[#006398] font-bold">8</button>
                  <button type="button" onClick={() => handleMatrixCellClick(2, 5)} className="p-2 rounded-lg bg-orange-300 hover:ring-2 hover:ring-[#006398] font-bold">10</button>

                  {/* Row 1: Insignificant */}
                  <div className="font-bold text-[10px] text-slate-600 text-right pr-2 self-center">1 (Insignif.)</div>
                  <button type="button" onClick={() => handleMatrixCellClick(1, 1)} className="p-2 rounded-lg bg-emerald-100 hover:ring-2 hover:ring-[#006398] font-bold">1</button>
                  <button type="button" onClick={() => handleMatrixCellClick(1, 2)} className="p-2 rounded-lg bg-emerald-100 hover:ring-2 hover:ring-[#006398] font-bold">2</button>
                  <button type="button" onClick={() => handleMatrixCellClick(1, 3)} className="p-2 rounded-lg bg-emerald-200 hover:ring-2 hover:ring-[#006398] font-bold">3</button>
                  <button type="button" onClick={() => handleMatrixCellClick(1, 4)} className="p-2 rounded-lg bg-emerald-200 hover:ring-2 hover:ring-[#006398] font-bold">4</button>
                  <button type="button" onClick={() => handleMatrixCellClick(1, 5)} className="p-2 rounded-lg bg-yellow-200 hover:ring-2 hover:ring-[#006398] font-bold">5</button>
                </div>
              </div>

              {/* Hazard List */}
              <div className="space-y-3">
                {hazards.map((hazard, idx) => (
                  <div
                    key={hazard.ItemNo}
                    onClick={() => setSelectedHazardIdx(idx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-sans ${
                      selectedHazardIdx === idx
                        ? 'bg-sky-50/70 border-[#006398] shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-mono font-bold text-xs ${
                          hazard.RiskLevel === 'HIGH' || hazard.RiskLevel === 'CRIT'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {hazard.RiskLevel}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{hazard.HazardDesc}</span>
                          <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                            {hazard.HazardCode}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1 font-medium">
                          Control: <span className="font-mono font-bold text-[#006398]">{hazard.ControlCode}</span> - {hazard.ControlDesc}
                        </p>
                        <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                          Responsible: {hazard.ResponsibleUser} • Status: {hazard.ControlStatus}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <select
                        value={hazard.RiskLevel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHazards((prev) =>
                            prev.map((h, i) => (i === idx ? { ...h, RiskLevel: val } : h))
                          );
                        }}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MED">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRIT">CRITICAL</option>
                      </select>

                      <select
                        value={hazard.ControlStatus}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHazards((prev) =>
                            prev.map((h, i) => (i === idx ? { ...h, ControlStatus: val } : h))
                          );
                        }}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="CLOSED">CLOSED / VERIFIED</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Custom Hazard Inline Strip */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block font-mono text-xs font-bold text-slate-800 uppercase mb-3">
                  Add Hazard & Control Measure
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-sans">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Hazard Code</label>
                    <select
                      value={newHazardCode}
                      onChange={(e) => {
                        setNewHazardCode(e.target.value);
                        setNewControlCode(`${e.target.value}01`);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                    >
                      <option value="FIRE">FIRE - Ignition & Welding</option>
                      <option value="GAS">GAS - Flammable Gas</option>
                      <option value="ELEC">ELEC - High Voltage</option>
                      <option value="FALL">FALL - Work at Height</option>
                      <option value="TOXIC">TOXIC - Chemical Vapor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Hazard Description</label>
                    <input
                      type="text"
                      value={newHazardDesc}
                      onChange={(e) => setNewHazardDesc(e.target.value)}
                      placeholder="e.g. CHEMICAL SPLASH RISK"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Control Description</label>
                    <input
                      type="text"
                      value={newControlDesc}
                      onChange={(e) => setNewControlDesc(e.target.value)}
                      placeholder="e.g. EYE WASH STATION READY"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddHazard}
                      className="w-full px-3 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Hazard</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Gas Testing & Isolation */}
          {activeTab === 'gas-isolation' && (
            <div className="space-y-6">
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No gas test or tester signature is recorded during permit creation. An authorized gas tester must record actual measurements in the gas-testing workflow before work is authorized.</p>

              {/* LOTO Physical Isolation Points */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Lockout / Tagout Physical Isolation Points (_Isolation)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Physical electrical breaker, valve locks, and blind flanges requiring zero-energy lock.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#006398] bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg">
                    Certificate: {isolationNo}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs mb-4">
                  <table className="w-full text-left border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono text-[11px] uppercase">
                        <th className="py-2.5 px-3">Item #</th>
                        <th className="py-2.5 px-3">Isolation Point</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Tag / Lock No</th>
                        <th className="py-2.5 px-3">Zero Energy Conf</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {isolations.map((iso) => (
                        <tr key={iso.ItemNo} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-slate-500">{iso.ItemNo}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">{iso.IsolationPoint}</td>
                          <td className="py-2.5 px-3 text-[#006398]">{iso.IsolType}</td>
                          <td className="py-2.5 px-3 font-bold">{iso.LockTagNo}</td>
                          <td className="py-2.5 px-3 text-amber-800">{iso.ZeroEnergyConf === 'Y' ? 'YES' : 'PENDING'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-[#006398] font-bold text-[10px]">
                              {iso.Status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add Isolation Point Inline Strip */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block font-mono text-xs font-bold text-slate-800 uppercase mb-3">
                    Add Physical Isolation Point
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-sans">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Isolation Point</label>
                      <input
                        type="text"
                        value={newIsoPoint}
                        onChange={(e) => setNewIsoPoint(e.target.value)}
                        placeholder="e.g. PUMP DISCHARGE VALVE"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Isolation Type</label>
                      <select
                        value={newIsoType}
                        onChange={(e) => setNewIsoType(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                      >
                        <option value="MECH">MECH — PROCESS/MECHANICAL</option>
                        <option value="ELEC">ELEC — ELECTRICAL</option>
                        <option value="INHOVR">INHOVR — INHIBITS AND OVERRIDES</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Lock / Tag Number</label>
                      <input
                        type="text"
                        value={newIsoLockTag}
                        onChange={(e) => setNewIsoLockTag(e.target.value)}
                        placeholder="LT-000101-02"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddIsolation}
                        className="w-full px-3 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>Add Point</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Live Payload Inspector & Review / Submit */}
          {activeTab === 'payload' && (
            <div className="space-y-6">
              {/* Payload Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Review permit request
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create a request for review. Site preparations, signatures and field authorization must be completed before work starts.
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

              <div className="rounded-xl border p-4 text-sm">
                <h3 className="mb-3 font-bold">Request summary</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div><dt className="text-slate-500">Job and area</dt><dd>{jobDesc || 'Not entered'} · {areaLoc || 'Area required'}</dd></div>
                  <div><dt className="text-slate-500">Primary work category</dt><dd>{PERMIT_CATEGORIES.find(item => item.code === permitType)?.label || 'Not selected'}</dd></div>
                  <div><dt className="text-slate-500">Requested validity (IST)</dt><dd>{validFromD} {validFromT} → {validToD} {validToT}</dd></div>
                  <div><dt className="text-slate-500">Crew / hazards / isolation points</dt><dd>{workers.length} / {hazards.length} / {isolations.length}</dd></div>
                  <div><dt className="text-slate-500">JSA reference</dt><dd>{sitePlan.fields.JSA1 || 'Required'}</dd></div>
                  <div><dt className="text-slate-500">Issuer / Acceptor / Operator (proposed)</dt><dd>{sitePlan.fields.ISSR || '—'} / {sitePlan.fields.ACCP || '—'} / {sitePlan.fields.OPER || '—'}</dd></div>
                </dl>
                {requestPreview.error && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900">{requestPreview.error}</p>}
              </div>
              <ProcedureGuidance />
              <details><summary className="cursor-pointer text-sm font-semibold">Technical request details</summary>
              {/* Code Mirror / Monospace JSON Viewer */}
              <div className="relative border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-[#0b1c30]">
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
              {/* Response Modal / Box (When available) */}

            </div>
          )}
        </fieldset>

        {/* Footer Action Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs font-mono text-slate-500">
            Permit number: <strong className="text-slate-900">Assigned by SAP after creation</strong>{workSelection ? ` · ${workSelection.source} ${referenceId(workSelection.source, workSelection.reference)}` : " · Select work to begin"}
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'work' && (
              <button
                type="button"
                onClick={() => {
                  const tabs: TabKey[] = ['work', 'general', 'procedure', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                }}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-mono font-semibold"
              >
                Previous
              </button>
            )}

            {activeTab === 'work' ? null : activeTab !== 'payload' ? (
              <button
                type="button"
                onClick={() => {
                  const tabs: TabKey[] = ['work', 'general', 'procedure', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
                }}
                className="px-4 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1"
              >
                <span>Next Step</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitDeepInsert}
                disabled={isSubmitting || creationUncertain || !!requestPreview.error}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isSubmitting ? 'sync' : 'verified'}
                </span>
                <span>{isSubmitting ? 'Submitting to SAP...' : 'Create permit request'}</span>
              </button>
            )}
          </div>
        </div>
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
        isOpen={isChecklistModalOpen}
        permitType={toSapChecklistPermitType(permitType)}
        permitTypeName={
          PERMIT_CATEGORIES.find(
            (c) => c.code === permitType || c.sapCode === permitType
          )?.label
        }
        items={checklistItems}
        initialAnswers={checklistAnswers}
        onSave={handleSaveChecklist}
        onClose={() => setIsChecklistModalOpen(false)}
      />
    </div>
  );
};

export default PermitCreateModule;
