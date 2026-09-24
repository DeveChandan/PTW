import React, { useState, useMemo } from 'react';
import { SapUser } from '../../core/auth/sapAuthContext';
import {
  PermitDeepInsertPayload,
  PermitDeepInsertResponse,
  WorkerRecord,
  PPERecord,
  SafetyRecord,
  HazardControlRecord,
  GasTestRecord,
  IsolationRecord
} from '../../core/types/ptw.types';
import {
  permitCreateApi,
  getSampleDeepInsertPayload
} from '../../core/api/modules/permitCreate.api';

import { PermitWorkSelectionStep } from './PermitWorkSelectionStep';
import { WorkSelection, referenceId } from '../../core/api/modules/permitWorkLookup.api';

interface PermitCreateModuleProps {
  user: SapUser | null;
  onBack?: () => void;
}

type TabKey = 'work' | 'general' | 'workers' | 'ppe' | 'hazards' | 'gas-isolation' | 'payload';

export const PermitCreateModule: React.FC<PermitCreateModuleProps> = ({ user, onBack }) => {
  // 1. Initial State loaded with default dummy permit setup
  const [activeTab, setActiveTab] = useState<TabKey>('work');
  const [workSelection, setWorkSelection] = useState<WorkSelection | null>(null);

  // Permit Header Fields
  const [permitNo, setPermitNo] = useState<string>('0000101');
  const [permitType, setPermitType] = useState<string>('HOT');
  const [formRev, setFormRev] = useState<string>('1');

  // SAP PM Order Linkage
  const [aufnr, setAufnr] = useState<string>('400100001');
  const [qmnum, setQmnum] = useState<string>('100100000001');
  const [auart, setAuart] = useState<string>('PM01');
  const [personResp, setPersonResp] = useState<string>(user?.id || 'ARYA5677');
  const [plannerGroup, setPlannerGroup] = useState<string>('001');
  const [pmBasicStartD, setPmBasicStartD] = useState<string>('2026-09-21');
  const [pmBasicFinishD, setPmBasicFinishD] = useState<string>('2026-09-22');
  const [pmFinalDueD, setPmFinalDueD] = useState<string>('2026-09-22');
  const [revision, setRevision] = useState<string>('REV101');
  const [priority, setPriority] = useState<string>('01');
  const [assembly, setAssembly] = useState<string>('PUMP-101');

  // Plant & Location
  const [equnr, setEqunr] = useState<string>('10000101');
  const [tplnr, setTplnr] = useState<string>('PLANT-AREA-101');
  const [werks, setWerks] = useState<string>('1000');
  const [arbpl, setArbpl] = useState<string>('MECH101');
  const [areaLoc, setAreaLoc] = useState<string>('PROCESS AREA D');
  const [jobDesc, setJobDesc] = useState<string>('HOT WORK ON PROCESS EQUIPMENT - AUDIT DEEP INSERT TEST');

  // Execution & Supervision
  const [execAgency, setExecAgency] = useState<string>('CONT');
  const [execDept, setExecDept] = useState<string>('MECHANICAL');
  const [supvName, setSupvName] = useState<string>('TEST SUPERVISOR 101');
  const [supvPhone, setSupvPhone] = useState<string>('9876510100');
  const [safetyOfficer, setSafetyOfficer] = useState<string>('SAFETY OFFICER 101');
  const [shift, setShift] = useState<string>('GENERAL');
  const [personsQty, setPersonsQty] = useState<number>(5);

  // Validity Period
  const [validFromD, setValidFromD] = useState<string>('2026-09-21');
  const [validFromT, setValidFromT] = useState<string>('08:00:00');
  const [validToD, setValidToD] = useState<string>('2026-09-21');
  const [validToT, setValidToT] = useState<string>('18:00:00');
  const [gasTestFreqHr, setGasTestFreqHr] = useState<string>('2');
  const [creatorComment, setCreatorComment] = useState<string>('COMPLETE PTW DEEP INSERT TEST - 0000101');

  // LOTO & Isolation Requirements
  const [lotoRequired, setLotoRequired] = useState<'Y' | 'N'>('Y');
  const [lotoCertNo, setLotoCertNo] = useState<string>('LOTO-000101');
  const [isolationRequired, setIsolationRequired] = useState<'Y' | 'N'>('Y');
  const [isolationRefType, setIsolationRefType] = useState<string>('EQUIP');
  const [isolationNo, setIsolationNo] = useState<string>('ISO-000101');

  // Child Collections State
  const [workers, setWorkers] = useState<WorkerRecord[]>([
    {
      PermitNo: '0000101',
      ItemNo: '1',
      WorkerTypeCode: 'EMP',
      WorkerName: 'EMPLOYEE 101',
      PhoneNo: '9876510101',
      ContractorId: '',
      ContractorName: '',
      EmpId: 'EMP101',
      Shift: 'GENERAL'
    },
    {
      PermitNo: '0000101',
      ItemNo: '2',
      WorkerTypeCode: 'CONT',
      WorkerName: 'CONTRACTOR WORKER 101',
      PhoneNo: '9876510102',
      ContractorId: 'CONT101',
      ContractorName: 'ABC CONTRACTOR',
      EmpId: '',
      Shift: 'GENERAL'
    }
  ]);

  const [ppeItems, setPpeItems] = useState<PPERecord[]>([
    {
      PermitNo: '0000101',
      ItemNo: '1',
      PpeCode: 'HELMET99',
      PpeDesc: 'SAFETY HELMET',
      IsRequired: 'Y',
      IsAvailable: 'Y',
      IsIssued: 'Y',
      CheckedBy: '',
      CheckedAt: null,
      Remarks: 'AVAILABLE'
    },
    {
      PermitNo: '0000101',
      ItemNo: '2',
      PpeCode: 'GLOVE99',
      PpeDesc: 'SAFETY GLOVES',
      IsRequired: 'Y',
      IsAvailable: 'Y',
      IsIssued: 'Y',
      CheckedBy: '',
      CheckedAt: null,
      Remarks: 'AVAILABLE'
    },
    {
      PermitNo: '0000101',
      ItemNo: '3',
      PpeCode: 'BOOTS99',
      PpeDesc: 'STEEL TOE SAFETY SHOES',
      IsRequired: 'Y',
      IsAvailable: 'Y',
      IsIssued: 'Y',
      CheckedBy: '',
      CheckedAt: null,
      Remarks: 'CONFIRMED ON SITE'
    },
    {
      PermitNo: '0000101',
      ItemNo: '4',
      PpeCode: 'GOGGLE99',
      PpeDesc: 'SAFETY EYE PROTECTION GOGGLES',
      IsRequired: 'Y',
      IsAvailable: 'Y',
      IsIssued: 'Y',
      CheckedBy: '',
      CheckedAt: null,
      Remarks: 'WELDING / GRINDING SHIELD'
    }
  ]);

  const [safetyChecklist, setSafetyChecklist] = useState<SafetyRecord[]>([
    {
      PermitNo: '0000101',
      ItemNo: '1',
      Category: 'PPE',
      ItemCode: '001',
      Response: 'YES',
      ValueText: 'REQUIRED PPE AVAILABLE',
      ValueNum: 0,
      Unit: '',
      ReferenceNo: '',
      ResponsibleUser: user?.id || 'ARYA5677',
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: 'SAFETY REQUIREMENT CHECKED'
    },
    {
      PermitNo: '0000101',
      ItemNo: '2',
      Category: 'FIRE',
      ItemCode: '002',
      Response: 'YES',
      ValueText: 'FIRE EXTINGUISHER AVAILABLE',
      ValueNum: 0,
      Unit: '',
      ReferenceNo: '',
      ResponsibleUser: user?.id || 'ARYA5677',
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: 'FIRE PROTECTION CHECKED'
    },
    {
      PermitNo: '0000101',
      ItemNo: '3',
      Category: 'ENVR',
      ItemCode: '003',
      Response: 'YES',
      ValueText: 'DRAINAGE SEALED AND COVERED WITH FIRE BLANKET',
      ValueNum: 0,
      Unit: '',
      ReferenceNo: '',
      ResponsibleUser: user?.id || 'ARYA5677',
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: 'AREA CLEARED OF COMBUSTIBLE MATERIALS'
    }
  ]);

  const [hazards, setHazards] = useState<HazardControlRecord[]>([
    {
      PermitNo: '0000101',
      ItemNo: '1',
      HazardCode: 'FIRE',
      HazardDesc: 'FIRE AND IGNITION HAZARD',
      RiskLevel: 'HIGH',
      ControlCode: 'FIRE01',
      ControlDesc: 'FIRE EXTINGUISHER AND FIRE WATCH PROVIDED',
      ControlStatus: 'OPEN',
      ResponsibleUser: user?.id || 'ARYA5677',
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: 'CONTROL REQUIRED BEFORE WORK'
    },
    {
      PermitNo: '0000101',
      ItemNo: '2',
      HazardCode: 'GAS',
      HazardDesc: 'FLAMMABLE GAS EXPOSURE',
      RiskLevel: 'HIGH',
      ControlCode: 'GAS01',
      ControlDesc: 'CONTINUOUS GAS MONITORING REQUIRED',
      ControlStatus: 'OPEN',
      ResponsibleUser: user?.id || 'ARYA5677',
      VerifiedBy: '',
      VerifiedAt: null,
      Remarks: 'GAS MONITORING REQUIRED'
    }
  ]);

  // Selected Hazard for the 5x5 Risk Matrix
  const [selectedHazardIdx, setSelectedHazardIdx] = useState<number>(0);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ c: number; l: number }>({ c: 4, l: 4 });

  // Atmospheric Gas Readings
  const [o2Pct, setO2Pct] = useState<number>(20.9);
  const [lelPct, setLelPct] = useState<number>(0);
  const [h2sVal, setH2sVal] = useState<number>(0);
  const [coVal, setCoVal] = useState<number>(0);

  const [gasTests, setGasTests] = useState<GasTestRecord[]>([
    {
      PermitNo: '0000101',
      TestSeq: '1',
      TestType: 'INIT',
      TestDate: '2026-09-21',
      TestTime: '07:45:00',
      TestLocation: 'PROCESS AREA D',
      SampleLevel: 'TOP',
      TestedBy: user?.id || 'ARYA5677',
      Cert: 'GT-CERT-101',
      MeterType: 'MSA-ALTAIR',
      MeterId: 'GAS-101',
      CalibDate: '2026-08-15',
      BumpTestOk: 'Y',
      LelPct: 0,
      O2Pct: 20.9,
      CoVal: 0,
      H2sVal: 0,
      OtherGas: '',
      OtherVal: 0,
      OtherUnit: '',
      TesterSigned: 'Y',
      Remarks: 'INITIAL GAS TEST'
    }
  ]);

  const [isolations, setIsolations] = useState<IsolationRecord[]>([
    {
      PermitNo: '0000101',
      IsolationNo: 'ISO-000101',
      ItemNo: '1',
      IsolType: 'FLOCK',
      ReferenceType: 'EQUIP',
      ReferenceId: '10000101',
      Status: 'CRTD',
      RequestedBy: user?.id || 'ARYA5677',
      RequestedDate: '2026-09-21',
      RequestedTime: '08:00:00',
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
      IsolationPoint: 'PUMP-101 INLET',
      IsolMethod: 'LOCK',
      LockTagNo: 'LT-000101',
      IsIsolated: 'N',
      PointIsolatedBy: '',
      PointIsolatedAt: null,
      ZeroEnergyConf: 'N',
      ZeroEnergyBy: '',
      ZeroEnergyAt: null,
      IsNormalized: 'N',
      PointNormalizedBy: '',
      PointNormalizedAt: null,
      Remarks: 'ISOLATION POINT CREATED',
      LastChangedAt: null
    }
  ]);

  // UI state for Submitting & Modals
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResponse, setSubmissionResponse] = useState<PermitDeepInsertResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [notificationBanner, setNotificationBanner] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // New Worker Form Modal / Row
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
  const [newIsoType, setNewIsoType] = useState('FLOCK');
  const [newIsoLockTag, setNewIsoLockTag] = useState('');

  // 2. Real-Time Atmospheric Safety Calculation
  const isAtmosphereSafe = useMemo(() => {
    return o2Pct >= 19.5 && o2Pct <= 23.5 && lelPct < 10 && h2sVal < 10 && coVal < 25;
  }, [o2Pct, lelPct, h2sVal, coVal]);

  // 3. Overall Readiness Completion Percentage
  const completionPercentage = useMemo(() => {
    if (!workSelection) return 0;
    let score = 0;
    if (jobDesc && werks) score += 20;
    if (workers.length > 0) score += 20;
    if (ppeItems.length > 0) score += 20;
    if (hazards.length > 0) score += 20;
    if (gasTests.length > 0 && isAtmosphereSafe) score += 20;
    return score;
  }, [workSelection, jobDesc, werks, workers, ppeItems, hazards, gasTests, isAtmosphereSafe]);

  // The first step owns reference selection; clear absent fields to avoid stale order linkage.
  const handleWorkSelected = (selection: WorkSelection) => {
    const ref = selection.reference;
    setWorkSelection(selection);
    setAufnr(ref.Aufnr || '');
    setQmnum(ref.Qmnum || '');
    setAuart(ref.Auart || '');
    setJobDesc(ref.JobDesc || ref.Description || '');
    setEqunr(ref.Equnr || '');
    setTplnr(ref.Tplnr || '');
    setWerks(ref.Werks || user?.plant || '');
    setArbpl(ref.Arbpl || '');
    setAreaLoc(ref.AreaLoc || '');
    setAssembly(ref.Assembly || '');
    setPriority(ref.Priority || '');
    setRevision(ref.Revision || '');
    setPersonResp(ref.PersonResp || user?.id || '');
    setPlannerGroup(ref.PlannerGroup || '');
    setPmBasicStartD(ref.PmBasicStartD || '');
    setPmBasicFinishD(ref.PmBasicFinishD || '');
    setPmFinalDueD(ref.PmFinalDueD || '');
    setExecDept(ref.ExecDept || '');
    setPermitType(ref.DefaultPermitType || 'COLD');
    setCreatorComment(selection.category + ' work · ' + selection.source + ' ' + referenceId(selection.source, ref));
    setSubmissionResponse(null);
    setNotificationBanner(null);
    setActiveTab('general');
  };

  // 5. Generate New Dummy Permit Number
  const handleRegenerateDummyNo = () => {
    const newNum = permitCreateApi.generateDummyPermitNo();
    setPermitNo(newNum);
    setLotoCertNo(`LOTO-${newNum}`);
    setIsolationNo(`ISO-${newNum}`);
    setCreatorComment(`COMPLETE PTW DEEP INSERT TEST - ${newNum}`);

    setWorkers((prev) => prev.map((w) => ({ ...w, PermitNo: newNum })));
    setPpeItems((prev) => prev.map((p) => ({ ...p, PermitNo: newNum })));
    setSafetyChecklist((prev) => prev.map((s) => ({ ...s, PermitNo: newNum })));
    setHazards((prev) => prev.map((h) => ({ ...h, PermitNo: newNum })));
    setGasTests((prev) => prev.map((g) => ({ ...g, PermitNo: newNum })));
    setIsolations((prev) => prev.map((i) => ({ ...i, PermitNo: newNum, IsolationNo: `ISO-${newNum}` })));

    setNotificationBanner({
      type: 'info',
      message: `Generated New Dummy Permit Number: ${newNum}`
    });
  };

  // 6. One-Click Load Exact User Sample Payload
  const handleLoadUserSample = () => {
    const sample = getSampleDeepInsertPayload('0000101');
    setWorkSelection(null);
    setActiveTab('work');
    setPermitNo(sample.Permit_No);
    setPermitType(sample.PermitType);
    setFormRev(sample.FormRev || '1');
    setAufnr(sample.Aufnr);
    setQmnum(sample.Qmnum);
    setAuart(sample.Auart);
    setPersonResp(sample.PersonResp);
    setPlannerGroup(sample.PlannerGroup);
    setPmBasicStartD(sample.PmBasicStartD || '2026-09-21');
    setPmBasicFinishD(sample.PmBasicFinishD || '2026-09-22');
    setPmFinalDueD(sample.PmFinalDueD || '2026-09-22');
    setRevision(sample.Revision);
    setPriority(sample.Priority);
    setAssembly(sample.Assembly);
    setEqunr(sample.Equnr);
    setTplnr(sample.Tplnr);
    setWerks(sample.Werks);
    setArbpl(sample.Arbpl);
    setAreaLoc(sample.AreaLoc);
    setJobDesc(sample.JobDesc);
    setExecAgency(sample.ExecAgency);
    setExecDept(sample.ExecDept);
    setSupvName(sample.SupvName);
    setSupvPhone(sample.SupvPhone);
    setSafetyOfficer(sample.SafetyOfficer);
    setShift(sample.Shift);
    setPersonsQty(sample.PersonsQty);
    setValidFromD(sample.ValidFromD || '2026-09-21');
    setValidFromT(sample.ValidFromT);
    setValidToD(sample.ValidToD || '2026-09-21');
    setValidToT(sample.ValidToT);
    setGasTestFreqHr(sample.GasTestFreqHr);
    setLotoRequired(sample.LotoRequired as any);
    setLotoCertNo(sample.LotoCertNo);
    setIsolationRequired(sample.IsolationRequired as any);
    setIsolationRefType(sample.IsolationRefType);
    setIsolationNo(sample.IsolationNo);
    setCreatorComment(sample.CreatorComment);

    if (sample._Worker) setWorkers(sample._Worker);
    if (sample._PPE) setPpeItems(sample._PPE);
    if (sample._Safety) setSafetyChecklist(sample._Safety);
    if (sample._HazardControl) setHazards(sample._HazardControl);
    if (sample._GasTest) {
      setGasTests(sample._GasTest);
      setO2Pct(sample._GasTest[0].O2Pct);
      setLelPct(sample._GasTest[0].LelPct);
      setH2sVal(sample._GasTest[0].H2sVal);
      setCoVal(sample._GasTest[0].CoVal);
    }
    if (sample._Isolation) setIsolations(sample._Isolation);

    setNotificationBanner({
      type: 'success',
      message: 'Successfully loaded user verified sample test payload: 0000101 with all 10 child collections.'
    });
  };

  // 7. Add Worker Handler
  const handleAddWorker = () => {
    if (!newWorkerName) return;
    const nextItemNo = (workers.length + 1).toString();
    const newWorker: WorkerRecord = {
      PermitNo: permitNo,
      ItemNo: nextItemNo,
      WorkerTypeCode: newWorkerType,
      WorkerName: newWorkerName.toUpperCase(),
      PhoneNo: newWorkerPhone || '9876500000',
      ContractorId: newWorkerType === 'CONT' ? 'CONT101' : '',
      ContractorName: newWorkerType === 'CONT' ? newWorkerContractorName || 'ABC CONTRACTOR' : '',
      EmpId: newWorkerType === 'EMP' ? newWorkerEmpId || `EMP${nextItemNo}` : '',
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
    setPersonsQty((prev) => Math.max(1, prev - 1));
  };

  // 8. Add Hazard Control Handler
  const handleAddHazard = () => {
    if (!newHazardDesc) return;
    const nextItemNo = (hazards.length + 1).toString();
    const newH: HazardControlRecord = {
      PermitNo: permitNo,
      ItemNo: nextItemNo,
      HazardCode: newHazardCode,
      HazardDesc: newHazardDesc.toUpperCase(),
      RiskLevel: 'HIGH',
      ControlCode: newControlCode,
      ControlDesc: newControlDesc || 'STANDARD SAFETY CONTROL APPLIED',
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
    const nextItemNo = (isolations.length + 1).toString();
    const newIso: IsolationRecord = {
      PermitNo: permitNo,
      IsolationNo: isolationNo,
      ItemNo: nextItemNo,
      IsolType: newIsoType,
      ReferenceType: isolationRefType,
      ReferenceId: equnr,
      Status: 'CRTD',
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
      LockTagNo: newIsoLockTag || `LT-${permitNo}-${nextItemNo}`,
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
      FormRev: formRev,

      Aufnr: aufnr,
      Qmnum: qmnum,
      Auart: auart,

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

      GasTestFreqHr: gasTestFreqHr,
      Status: 'CRTD',

      RefPermitNo: '',

      LotoRequired: lotoRequired,
      LotoCertNo: lotoCertNo,

      IsolationRequired: isolationRequired,
      IsolationRefType: isolationRefType,
      IsolationNo: isolationNo,
      IsolationStatus: 'CRTD',

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
      _Safety: safetyChecklist,
      _HazardControl: hazards,
      _GasTest: [
        {
          ...gasTests[0],
          O2Pct: o2Pct,
          LelPct: lelPct,
          H2sVal: h2sVal,
          CoVal: coVal,
          PermitNo: permitNo
        }
      ],
      _Isolation: isolations,
      _Attachment: [
        {
          PermitNo: permitNo,
          FileName: `PERMIT-ATTACH-${permitNo}.PDF`,
          MimeType: 'application/pdf',
          DocumentRef: `DOC-${permitNo}`
        }
      ],
      _Approval: [
        {
          PermitNo: permitNo,
          Stage: '01',
          SeqNo: '1',
          RoleId: 'VER',
          Action: 'VR',
          SignedBy: '',
          ActionDate: null,
          ActionTime: '00:00:00',
          Comments: 'INITIAL VERIFICATION RECORD'
        }
      ],
      _ShiftRenewal: [
        {
          PermitNo: permitNo,
          RenewalNo: '1',
          PreviousShift: shift,
          NewShift: 'NIGHT',
          PreviousValidToD: validToD,
          PreviousValidToT: validToT,
          NewValidToD: validToD,
          NewValidToT: '22:00:00',
          RequestedBy: personResp,
          RequestedAt: `${validToD}T17:00:00Z`,
          ApprovedBy: '',
          ApprovedAt: null,
          Status: 'REQUESTED',
          Reason: 'SHIFT CONTINUATION ENTRY'
        }
      ],
      _AuditLog: [
        {
          PermitNo: permitNo,
          AuditId: '1',
          Action: 'CREATE',
          OldStatus: '',
          NewStatus: 'CRTD',
          Actor: user?.id || personResp,
          EventAt: new Date().toISOString(),
          Comments: `PERMIT CREATED VIA GFL CHEMSAFE PTW UI (REF MO ${aufnr})`
        }
      ]
    };
  }, [
    permitNo,
    permitType,
    formRev,
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
    lotoRequired,
    lotoCertNo,
    isolationRequired,
    isolationRefType,
    isolationNo,
    creatorComment,
    user,
    workers,
    ppeItems,
    safetyChecklist,
    hazards,
    gasTests,
    isolations,
    o2Pct,
    lelPct,
    h2sVal,
    coVal
  ]);

  // 12. Submit Deep Insert to SAP
  const handleSubmitDeepInsert = async () => {
    if (!workSelection) {
      setActiveTab('work');
      setNotificationBanner({ type: 'error', message: 'Select a work reference before submitting the permit.' });
      return;
    }
    setIsSubmitting(true);
    setNotificationBanner(null);

    try {
      const response = await permitCreateApi.createPermitDeepInsert(fullPayload);
      setSubmissionResponse(response);
      setNotificationBanner({
        type: 'success',
        message: `SAP OData V4 Deep Insert Successful! Permit ${response.Permit_No} created in status ${response.Status || 'CRTD'}.`
      });
    } catch (err: any) {
      console.error('[PermitCreateModule] Submit error:', err);
      setNotificationBanner({
        type: 'error',
        message: err.message || 'Failed to submit permit to SAP Gateway.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(fullPayload, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const stepsList: { key: TabKey; label: string; icon: string; count?: number }[] = [
    { key: 'work', label: '1. Work Selection', icon: 'construction' },
    { key: 'general', label: '2. General Details', icon: 'info' },
    { key: 'workers', label: '3. Crew Muster', icon: 'group', count: workers.length },
    { key: 'ppe', label: '4. PPE & Safety', icon: 'security', count: ppeItems.length },
    { key: 'hazards', label: '5. Hazards & 5x5 Risk', icon: 'warning', count: hazards.length },
    { key: 'gas-isolation', label: '6. Gas & LOTO', icon: 'air', count: isolations.length },
    { key: 'payload', label: '7. Review & Submit', icon: 'data_object' }
  ];

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
            <span className="text-[#006398] font-bold">Permit Create (Deep Insert)</span>
          </div>
        </div>

        {/* Quick Actions Header */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleLoadUserSample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-300 text-[#006398] hover:bg-sky-100 rounded-xl font-bold shadow-sm transition-colors"
            title="Populate form with user verified deep insert sample data"
          >
            <span className="material-symbols-outlined text-[16px]">file_open</span>
            <span>Load Sample Payload (0000101)</span>
          </button>

          <button
            onClick={handleRegenerateDummyNo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded-xl font-semibold shadow-sm transition-colors"
            title="Generate new sequential dummy permit number"
          >
            <span className="material-symbols-outlined text-[16px]">casino</span>
            <span>New Dummy No: <strong className="text-[#006398]">{permitNo}</strong></span>
          </button>
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
              Permit Formulation Readiness
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-500">Progress:</span>
            <strong className="text-[#006398]">{completionPercentage}% Ready</strong>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
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
                  Create Safety Permit
                </h1>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#006398] border border-blue-200">
                  Permit_No: {permitNo}
                </span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  SAP Status: CRTD
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target EntitySet: <code className="font-mono text-[#006398] font-bold">PermitInfo</code> • Deep Insert with 10 Child Collections
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
        <div className="p-6">
          {activeTab === 'work' && (
            <PermitWorkSelectionStep selection={workSelection} client={user?.client}
              onInvalidate={() => { setWorkSelection(null); setSubmissionResponse(null); setNotificationBanner(null); }}
              onContinue={handleWorkSelected} />
          )}
          {/* TAB 1: General Details & PM Order */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Permit Type Radio Bar */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Permit Category & Nature of Work *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                  {[
                    { code: 'HOT', label: 'Hot Work', icon: 'local_fire_department', desc: 'Welding, Grinding, Open Flame' },
                    { code: 'COLD', label: 'Cold Work', icon: 'ac_unit', desc: 'Maintenance, Painting, Civil' },
                    { code: 'CONF', label: 'Confined Space', icon: 'door_sliding', desc: 'Vessel, Tank, Sump Entry' },
                    { code: 'ELEC', label: 'Electrical', icon: 'bolt', desc: 'Breaker, HT/LT Switchgear' },
                    { code: 'HGHT', label: 'Work at Height', icon: 'height', desc: 'Scaffold, Ladder > 1.8m' }
                  ].map((t) => (
                    <div
                      key={t.code}
                      onClick={() => setPermitType(t.code)}
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

              {/* Plant, Functional Location & Equipment Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-sans text-xs">
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
                      onChange={(e) => setGasTestFreqHr(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-[#006398]"
                    >
                      <option value="1">1 Hour</option>
                      <option value="2">2 Hours (Standard)</option>
                      <option value="4">4 Hours</option>
                      <option value="8">8 Hours</option>
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

              {/* LOTO & Isolation Requirements Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-slate-800">LOTO Required</span>
                    <button
                      type="button"
                      onClick={() => setLotoRequired(lotoRequired === 'Y' ? 'N' : 'Y')}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                        lotoRequired === 'Y'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {lotoRequired === 'Y' ? 'YES (REQUIRED)' : 'NO'}
                    </button>
                  </div>
                  {lotoRequired === 'Y' && (
                    <div className="mt-2">
                      <label className="block text-[11px] text-slate-600 font-semibold mb-1">LOTO Certificate No</label>
                      <input
                        type="text"
                        value={lotoCertNo}
                        onChange={(e) => setLotoCertNo(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-slate-800">Isolation Required</span>
                    <button
                      type="button"
                      onClick={() => setIsolationRequired(isolationRequired === 'Y' ? 'N' : 'Y')}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                        isolationRequired === 'Y'
                          ? 'bg-orange-100 text-orange-900 border border-orange-300'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isolationRequired === 'Y' ? 'YES (REQUIRED)' : 'NO'}
                    </button>
                  </div>
                  {isolationRequired === 'Y' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-600 font-semibold mb-1">Isolation No</label>
                        <input
                          type="text"
                          value={isolationNo}
                          onChange={(e) => setIsolationNo(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                        />
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
                      <option value="EMP">Employee (EMP)</option>
                      <option value="CONT">Contractor (CONT)</option>
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
                <h3 className="font-display font-bold text-base text-slate-900 mb-3">
                  Safety Inspection Checklist (_Safety)
                </h3>
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
              {/* Atmospheric Gas Testing Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Atmospheric Gas Testing Protocol (_GasTest)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Live sensor validation with real-time OSHA / HSE threshold safety checks.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    ✓ Bump Test OK
                  </span>
                </div>

                {/* Real-Time Atmospheric Safety Alert Banner */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between font-mono text-xs mb-4 shadow-xs ${
                    isAtmosphereSafe
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px]">
                      {isAtmosphereSafe ? 'verified' : 'crisis_alert'}
                    </span>
                    <span className="font-bold">
                      {isAtmosphereSafe
                        ? 'ATMOSPHERE NORMAL: All gas parameters within safe OSHA/HSE regulatory limits'
                        : 'ATMOSPHERE HAZARD DETECTED: Parameters exceed safe limits. Work prohibited!'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      isAtmosphereSafe ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900 animate-pulse'
                    }`}
                  >
                    {isAtmosphereSafe ? 'SAFE FOR WORK' : 'UNSAFE'}
                  </span>
                </div>

                {/* Interactive Gas Readings Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-white border border-slate-300 rounded-xl">
                    <div className="flex justify-between text-xs font-mono font-semibold mb-1">
                      <span>Oxygen O₂</span>
                      <span className={o2Pct >= 19.5 && o2Pct <= 23.5 ? 'text-emerald-600' : 'text-rose-600'}>
                        {o2Pct}%
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={o2Pct}
                      onChange={(e) => setO2Pct(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-sm font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">Safe: 19.5% - 23.5%</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-300 rounded-xl">
                    <div className="flex justify-between text-xs font-mono font-semibold mb-1">
                      <span>Combustible LEL</span>
                      <span className={lelPct < 10 ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                        {lelPct}%
                      </span>
                    </div>
                    <input
                      type="number"
                      step="1"
                      value={lelPct}
                      onChange={(e) => setLelPct(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-sm font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">Max Safe: &lt; 10% LEL</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-300 rounded-xl">
                    <div className="flex justify-between text-xs font-mono font-semibold mb-1">
                      <span>Toxic H₂S</span>
                      <span className={h2sVal < 10 ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                        {h2sVal} PPM
                      </span>
                    </div>
                    <input
                      type="number"
                      step="1"
                      value={h2sVal}
                      onChange={(e) => setH2sVal(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-sm font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">Threshold: &lt; 10 PPM</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-300 rounded-xl">
                    <div className="flex justify-between text-xs font-mono font-semibold mb-1">
                      <span>Carbon Monoxide CO</span>
                      <span className={coVal < 25 ? 'text-slate-800' : 'text-rose-600 font-bold'}>
                        {coVal} PPM
                      </span>
                    </div>
                    <input
                      type="number"
                      step="1"
                      value={coVal}
                      onChange={(e) => setCoVal(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-sm font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">Threshold: &lt; 25 PPM</span>
                  </div>
                </div>
              </div>

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
                        <option value="FLOCK">FLOCK - Flange Lock</option>
                        <option value="VALVE">VALVE - Manual Valve</option>
                        <option value="ELEC">ELEC - Breaker Lockout</option>
                        <option value="BLIND">BLIND - Spade/Blind</option>
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
                    Live Deep Insert JSON Payload Inspector
                  </h3>
                  <p className="text-xs text-slate-500">
                    This payload will be sent via <code className="font-mono text-[#006398]">POST /PermitInfo</code> to SAP Gateway.
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
                    <span>{copySuccess ? 'Copied!' : 'Copy JSON'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitDeepInsert}
                    disabled={isSubmitting || !workSelection}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl text-xs font-mono font-bold shadow-sm transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSubmitting ? 'sync' : 'send'}
                    </span>
                    <span>{isSubmitting ? 'Posting to SAP...' : 'Submit to SAP (POST /PermitInfo)'}</span>
                  </button>
                </div>
              </div>

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
                  {JSON.stringify(fullPayload, null, 2)}
                </pre>
              </div>

              {/* Response Modal / Box (When available) */}
              {submissionResponse && (
                <div className="p-5 border border-emerald-300 bg-emerald-50/70 rounded-2xl animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold mb-2">
                    <span className="material-symbols-outlined text-[24px]">verified</span>
                    <span className="text-sm font-display">SAP S/4HANA OData V4 Response Received</span>
                  </div>
                  <p className="text-xs text-emerald-800 font-sans mb-3">
                    Permit <strong className="font-mono">{submissionResponse.Permit_No}</strong> was created successfully against Maintenance Order <strong className="font-mono">{submissionResponse.Aufnr}</strong>.
                  </p>

                  <div className="bg-white border border-emerald-200 rounded-xl p-3 font-mono text-xs space-y-1 text-slate-700">
                    <div><strong>@odata.context:</strong> {submissionResponse['@odata.context']}</div>
                    <div><strong>@odata.metadataEtag:</strong> {submissionResponse['@odata.metadataEtag']}</div>
                    <div><strong>Permit Number:</strong> {submissionResponse.Permit_No}</div>
                    <div><strong>Status:</strong> {submissionResponse.Status}</div>
                    <div><strong>Workers Created:</strong> {submissionResponse._Worker?.length || 0}</div>
                    <div><strong>PPE Items Created:</strong> {submissionResponse._PPE?.length || 0}</div>
                    <div><strong>Hazards Created:</strong> {submissionResponse._HazardControl?.length || 0}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs font-mono text-slate-500">
            Current Permit No: <strong className="text-slate-900">{permitNo}</strong>{workSelection ? ` · ${workSelection.source} ${referenceId(workSelection.source, workSelection.reference)}` : " · Select work to begin"}
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'work' && (
              <button
                type="button"
                onClick={() => {
                  const tabs: TabKey[] = ['work', 'general', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
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
                  const tabs: TabKey[] = ['work', 'general', 'workers', 'ppe', 'hazards', 'gas-isolation', 'payload'];
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
                disabled={isSubmitting}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isSubmitting ? 'sync' : 'verified'}
                </span>
                <span>{isSubmitting ? 'Submitting to SAP...' : 'Submit Permit to SAP'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermitCreateModule;
