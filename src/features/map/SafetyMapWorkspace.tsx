import React, { useState, useCallback, useMemo } from 'react';
import {
  SafetyDistrict,
  Avenue,
  Street,
  SAFETY_DISTRICTS,
  AVENUES,
  STREETS
} from '../../core/ptw/safetyDistricts';
import { PlantInteractiveSvg } from './PlantInteractiveSvg';
import { INITIAL_ACTIVE_PERMITS } from './simulatedPermits';
import {
  SelectedEntity,
  SelectedEntityCategory,
  ActivePermitPin,
  MapLayerVisibility,
  CanvasTheme,
  InteractionMode,
  DirectoryTab,
  PermitWorkType
} from './types';

interface SafetyMapWorkspaceProps {
  onBack: () => void;
  initialDistrictId?: string;
}

export const SafetyMapWorkspace: React.FC<SafetyMapWorkspaceProps> = ({
  onBack,
  initialDistrictId
}) => {
  // Master active permits list
  const [activePermits, setActivePermits] = useState<ActivePermitPin[]>(INITIAL_ACTIVE_PERMITS);

  // Initial selection
  const defaultDistrict = useMemo(() => {
    if (initialDistrictId) {
      const found = SAFETY_DISTRICTS.find(
        (d) => d.id === initialDistrictId || d.code === initialDistrictId
      );
      if (found) return found;
    }
    return SAFETY_DISTRICTS[0];
  }, [initialDistrictId]);

  const [currentSelection, setCurrentSelection] = useState<SelectedEntity>({
    category: 'DISTRICT',
    item: defaultDistrict,
    pinCoords: { x: defaultDistrict.center.x, y: defaultDistrict.center.y }
  });

  // UI state
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('inspect');
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<DirectoryTab>('sd');
  const [theme, setTheme] = useState<CanvasTheme>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoverTarget, setHoverTarget] = useState('Hover over any District or Road');
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Layer visibility state
  const [layers, setLayers] = useState<MapLayerVisibility>({
    districts: true,
    hatches: true,
    avenues: true,
    streets: true,
    pins: true
  });

  // Viewport Pan/Zoom state
  const [viewState, setViewState] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1
  });

  // Modals state
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Issue Permit form fields
  const [formWorkType, setFormWorkType] = useState<PermitWorkType>('Hot Work');
  const [formPtwNumber, setFormPtwNumber] = useState('');
  const [formContractor, setFormContractor] = useState('L&T Mechanical Services');
  const [formJobDesc, setFormJobDesc] = useState('Flange guard & pipeline hydro-test near North header');

  // Center SVG camera on a point
  const centerOnPoint = useCallback((svgX: number, svgY: number, targetScale = 1.45) => {
    setViewState({
      scale: targetScale,
      x: 1000 - svgX * targetScale,
      y: 610 - svgY * targetScale
    });
  }, []);

  // Zoom handlers
  const handleZoom = useCallback((factor: number) => {
    setViewState((prev) => {
      const newScale = Math.min(4.5, Math.max(0.55, prev.scale * factor));
      const cx = 500;
      const cy = 300;
      return {
        scale: newScale,
        x: cx - (cx - prev.x) * (newScale / prev.scale),
        y: cy - (cy - prev.y) * (newScale / prev.scale)
      };
    });
  }, []);

  const handleResetViewport = useCallback(() => {
    setViewState({ x: 0, y: 0, scale: 1 });
  }, []);

  const handleZoomToSelected = useCallback(() => {
    centerOnPoint(currentSelection.pinCoords.x, currentSelection.pinCoords.y, 1.4);
  }, [centerOnPoint, currentSelection.pinCoords]);

  // Entity selection handler
  const handleSelectEntity = useCallback(
    (
      category: SelectedEntityCategory,
      item: SafetyDistrict | Avenue | Street,
      customCoords?: { x: number; y: number }
    ) => {
      let defaultCoords = { x: 500, y: 500 };
      if (category === 'DISTRICT') {
        const sd = item as SafetyDistrict;
        defaultCoords = { x: sd.center.x, y: sd.center.y };
      } else {
        const road = item as Avenue | Street;
        defaultCoords = {
          x: Math.round((road.x1 + road.x2) / 2),
          y: Math.round((road.y1 + road.y2) / 2)
        };
      }

      setCurrentSelection({
        category,
        item,
        pinCoords: customCoords || defaultCoords
      });
    },
    []
  );

  // Focus on a permit pin
  const handleFocusOnPermit = useCallback(
    (permit: ActivePermitPin) => {
      const sd = SAFETY_DISTRICTS.find((d) => d.id === permit.targetId);
      const av = AVENUES.find((a) => a.id === permit.targetId);
      const st = STREETS.find((s) => s.id === permit.targetId);

      if (sd) handleSelectEntity('DISTRICT', sd, { x: permit.x, y: permit.y });
      else if (av) handleSelectEntity('AVENUE', av, { x: permit.x, y: permit.y });
      else if (st) handleSelectEntity('STREET', st, { x: permit.x, y: permit.y });

      centerOnPoint(permit.x, permit.y, 1.5);
    },
    [handleSelectEntity, centerOnPoint]
  );

  // Trigger Permit modal
  const handleOpenIssuePermitModal = useCallback(() => {
    const randomSuffix = Math.floor(8200 + Math.random() * 799);
    setFormPtwNumber(`PTW-2025-${randomSuffix}`);
    setIsIssueModalOpen(true);
  }, []);

  const handleCloseIssuePermitModal = useCallback(() => {
    setIsIssueModalOpen(false);
  }, []);

  const handleSubmitNewPermit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const newPermit: ActivePermitPin = {
        ptwNo: formPtwNumber.trim(),
        type: formWorkType,
        targetId: currentSelection.item.id,
        targetName: `${currentSelection.item.id}: ${currentSelection.item.name}`,
        owner:
          currentSelection.category === 'DISTRICT'
            ? (currentSelection.item as SafetyDistrict).owner
            : 'Corridor Safety HOD',
        contractor: formContractor.trim(),
        desc: formJobDesc.trim(),
        x: currentSelection.pinCoords.x,
        y: currentSelection.pinCoords.y
      };

      setActivePermits((prev) => [newPermit, ...prev]);
      setIsIssueModalOpen(false);
      setActiveDirectoryTab('permits');
    },
    [formPtwNumber, formWorkType, currentSelection, formContractor, formJobDesc]
  );

  // SAP Payload JSON generation
  const payloadJson = useMemo(() => {
    const { category, item, pinCoords } = currentSelection;
    const sd = category === 'DISTRICT' ? (item as SafetyDistrict) : null;
    const av = category === 'AVENUE' ? (item as Avenue) : null;
    const st = category === 'STREET' ? (item as Street) : null;

    const payload = {
      plantCode: 'GFL-DAHEJ-A',
      drawingReference: 'GFL-PP-DWG-SD-04-15-D0127_REV03',
      selectedEntityType: category,
      locationId: item.id,
      locationTitle: item.name,
      sapFunctionalLocation:
        category === 'DISTRICT' ? `GFL-DHJ-${item.id}` : `GFL-DHJ-RD-${item.id}`,
      areaOwnerHOD: sd ? sd.owner : 'Central Safety & Corridor Authority',
      connectedAvenues_NS: sd
        ? sd.avenues.map((a) => `Avenue ${a}`)
        : av
        ? [`Avenue ${av.num}`]
        : [],
      connectedStreets_EW: sd
        ? sd.streets.map((s) => `Street ${s}`)
        : st
        ? [`Street ${st.num}`]
        : [],
      mapPinCoordinates: {
        svgGridX: pinCoords.x,
        svgGridY: pinCoords.y,
        units: 'mm_scaled'
      },
      activePermitsAtLocation: activePermits.filter((p) => p.targetId === item.id)
    };

    return JSON.stringify(payload, null, 2);
  }, [currentSelection, activePermits]);

  const handleCopyPayload = useCallback(() => {
    navigator.clipboard.writeText(payloadJson);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [payloadJson]);

  // Filtered lists for directory search
  const q = searchQuery.trim().toLowerCase();

  const filteredDistricts = useMemo(() => {
    if (!q) return SAFETY_DISTRICTS;
    return SAFETY_DISTRICTS.filter(
      (sd) =>
        sd.id.toLowerCase().includes(q) ||
        sd.name.toLowerCase().includes(q) ||
        sd.owner.toLowerCase().includes(q) ||
        sd.streets.some((s) => `street ${s}` === q || `${s}` === q) ||
        sd.avenues.some((a) => `avenue ${a}` === q || `${a}` === q)
    );
  }, [q]);

  const filteredAvenues = useMemo(() => {
    if (!q) return AVENUES;
    return AVENUES.filter(
      (av) =>
        av.id.toLowerCase().includes(q) ||
        av.name.toLowerCase().includes(q) ||
        av.districts.some((d) => d.toLowerCase().includes(q))
    );
  }, [q]);

  const filteredStreets = useMemo(() => {
    if (!q) return STREETS;
    return STREETS.filter(
      (st) =>
        st.id.toLowerCase().includes(q) ||
        st.name.toLowerCase().includes(q) ||
        `${st.num}` === q
    );
  }, [q]);

  const filteredPermits = useMemo(() => {
    if (!q) return activePermits;
    return activePermits.filter(
      (p) =>
        p.ptwNo.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.targetName.toLowerCase().includes(q) ||
        p.contractor.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q)
    );
  }, [q, activePermits]);

  // Details for current selection
  const selectedDistrict = currentSelection.category === 'DISTRICT' ? (currentSelection.item as SafetyDistrict) : null;
  const selectedAvenue = currentSelection.category === 'AVENUE' ? (currentSelection.item as Avenue) : null;
  const selectedStreet = currentSelection.category === 'STREET' ? (currentSelection.item as Street) : null;

  return (
    <div className="bg-slate-950 text-slate-100 h-screen w-screen flex flex-col overflow-hidden font-sans">
      {/* TOP HEADER BAR */}
      <header className="h-14 bg-slate-900/95 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30 select-none">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={onBack}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition mr-1"
            title="Return to PTW Dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          {/* GFL Logo */}
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center font-black text-white shadow-md shadow-amber-500/20 text-sm tracking-tighter">
            GFL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm md:text-base tracking-tight text-white">
                GUJARAT FLUOROCHEMICALS LTD — DAHEJ COMPLEX
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded">
                DWG: GFL-PP-DWG-SD-04-15-D0127 (REV 03)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Interactive e-Permit Location Pinpointing System</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-medium">26 Safety Districts</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-medium">15 Avenues (N–S)</span>
              <span className="text-slate-600">•</span>
              <span className="text-sky-400 font-medium">40 Streets (E–W)</span>
            </p>
          </div>
        </div>

        {/* Header Controls & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Map Interaction Mode Switcher */}
          <div className="hidden md:flex items-center bg-slate-800/90 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setInteractionMode('inspect')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                interactionMode === 'inspect'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
                />
              </svg>
              Select / Pinpoint Mode
            </button>
            <button
              onClick={() => setInteractionMode('pin')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                interactionMode === 'pin'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              Instant Permit Pin-Drop
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme((prev) => (prev === 'cad' ? 'dark' : 'cad'))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
            title="Switch CAD Blueprint / Dark GIS Theme"
          >
            <span>{theme === 'cad' ? '☀️' : '🌙'}</span>
            <span className="hidden sm:inline">
              {theme === 'cad' ? 'CAD Blueprint' : 'Dark GIS Mode'}
            </span>
          </button>

          {/* SAP / API Payload Button */}
          <button
            onClick={() => setIsPayloadModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>SAP / API Payload</span>
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT / CENTER: INTERACTIVE SVG VIEWPORT */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* FLOATING MAP LAYER & FILTER TOOLBAR */}
          <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Layer Visibility Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto select-none">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                Layers:
              </span>

              <label className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={layers.districts}
                  onChange={(e) => setLayers((prev) => ({ ...prev, districts: e.target.checked }))}
                  className="accent-emerald-500 rounded"
                />
                <span className="text-emerald-300 font-medium">26 Districts</span>
              </label>

              <label className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={layers.hatches}
                  onChange={(e) => setLayers((prev) => ({ ...prev, hatches: e.target.checked }))}
                  className="accent-purple-500 rounded"
                />
                <span className="text-purple-300 font-medium">CAD Hatches</span>
              </label>

              <label className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={layers.avenues}
                  onChange={(e) => setLayers((prev) => ({ ...prev, avenues: e.target.checked }))}
                  className="accent-amber-500 rounded"
                />
                <span className="text-amber-300 font-medium">15 Avenues (N–S)</span>
              </label>

              <label className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={layers.streets}
                  onChange={(e) => setLayers((prev) => ({ ...prev, streets: e.target.checked }))}
                  className="accent-sky-500 rounded"
                />
                <span className="text-sky-300 font-medium">40 Streets (E–W)</span>
              </label>

              <label className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={layers.pins}
                  onChange={(e) => setLayers((prev) => ({ ...prev, pins: e.target.checked }))}
                  className="accent-rose-500 rounded"
                />
                <span className="text-rose-300 font-medium">
                  Permit Pins ({activePermits.length})
                </span>
              </label>
            </div>

            {/* Live Cursor Coordinates & Hover Target */}
            <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto text-xs font-mono select-none">
              <span className="text-slate-400">GRID:</span>
              <span className="text-amber-400 font-semibold w-28">
                X:{String(cursorCoords.x).padStart(4, '0')} Y:{String(cursorCoords.y).padStart(4, '0')}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-sky-300 font-sans font-medium truncate max-w-[220px]">
                {hoverTarget}
              </span>
            </div>
          </div>

          {/* FLOATING ZOOM & COMPASS CONTROLS (BOTTOM LEFT) */}
          <div className="absolute bottom-4 left-4 z-20 flex items-end gap-3 pointer-events-none select-none">
            <div className="flex flex-col bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-xl overflow-hidden pointer-events-auto">
              <button
                onClick={() => handleZoom(1.25)}
                className="p-2.5 hover:bg-slate-800 text-slate-200 border-b border-slate-800 transition"
                title="Zoom In (+)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => handleZoom(0.8)}
                className="p-2.5 hover:bg-slate-800 text-slate-200 border-b border-slate-800 transition"
                title="Zoom Out (-)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={handleResetViewport}
                className="p-2.5 hover:bg-slate-800 text-amber-400 text-[10px] font-mono font-bold transition"
                title="Fit Entire Plant to Screen"
              >
                FIT
              </button>
            </div>

            {/* Permit Type Legend */}
            <div className="hidden xl:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-xl pointer-events-auto text-[11px]">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Permit Pins:</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Hot Work
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> Cold Work
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Confined Space
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Height / Crane
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Excavation / Road
              </span>
            </div>
          </div>

          {/* INTERACTIVE SVG CANVAS COMPONENT */}
          <PlantInteractiveSvg
            currentSelection={currentSelection}
            onSelectEntity={handleSelectEntity}
            activePermits={activePermits}
            onSelectPermit={handleFocusOnPermit}
            layers={layers}
            theme={theme}
            hoverTarget={hoverTarget}
            onHoverTargetChange={setHoverTarget}
            cursorCoords={cursorCoords}
            onCursorCoordsChange={setCursorCoords}
            interactionMode={interactionMode}
            onTriggerPinDropModal={handleOpenIssuePermitModal}
            viewState={viewState}
            setViewState={setViewState}
          />
        </div>

        {/* RIGHT SIDEBAR: INSPECTOR, DIRECTORY & SEARCH */}
        <aside className="w-96 md:w-[430px] bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-20 shadow-2xl">
          {/* TOP INSPECTOR CARD */}
          <div className="p-4 bg-gradient-to-b from-slate-800/90 to-slate-900 border-b border-slate-800 select-none">
            <div className="flex items-center justify-between mb-2">
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border ${
                  currentSelection.category === 'DISTRICT'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : currentSelection.category === 'AVENUE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                }`}
              >
                {currentSelection.category === 'DISTRICT'
                  ? 'SAFETY DISTRICT SELECTED'
                  : currentSelection.category === 'AVENUE'
                  ? 'NORTH–SOUTH AVENUE SELECTED'
                  : 'EAST–WEST STREET SELECTED'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {currentSelection.category === 'DISTRICT'
                  ? `FLOC: GFL-DHJ-${currentSelection.item.id}`
                  : `FLOC: GFL-DHJ-RD-${currentSelection.item.id}`}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-xl text-white font-mono font-extrabold text-lg flex items-center justify-center shrink-0 shadow-lg border-2 border-white/80 ${
                  currentSelection.category === 'DISTRICT'
                    ? 'bg-red-600'
                    : currentSelection.category === 'AVENUE'
                    ? 'bg-amber-500 text-slate-950 text-base'
                    : 'bg-sky-600 text-base'
                }`}
              >
                {currentSelection.category === 'DISTRICT'
                  ? (currentSelection.item as SafetyDistrict).code
                  : currentSelection.category === 'AVENUE'
                  ? `A${(currentSelection.item as Avenue).num}`
                  : `S${(currentSelection.item as Street).num}`}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-base text-white leading-snug break-words">
                  {currentSelection.item.name}
                </h2>
                <p className="text-xs text-sky-400 font-medium mt-0.5 flex items-center gap-1.5">
                  {currentSelection.category === 'DISTRICT' ? (
                    <>
                      <span>👤 Area Owner / HOD:</span>
                      <strong className="text-white">
                        {(currentSelection.item as SafetyDistrict).owner}
                      </strong>
                    </>
                  ) : currentSelection.category === 'AVENUE' ? (
                    <>
                      <span>🛣️ Corridor Direction:</span>
                      <strong className="text-amber-300">
                        North ↔ South (Avenue {(currentSelection.item as Avenue).num})
                      </strong>
                    </>
                  ) : (
                    <>
                      <span>🛣️ Corridor Direction:</span>
                      <strong className="text-sky-300">
                        East ↔ West (Street {(currentSelection.item as Street).num})
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Intersecting Roads Metadata */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/90 text-xs">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  {currentSelection.category === 'DISTRICT'
                    ? 'Connected Avenues (N–S)'
                    : 'Primary Direction'}
                </span>
                <span className="font-mono text-amber-300 font-semibold text-xs mt-0.5 block truncate">
                  {selectedDistrict
                    ? selectedDistrict.avenues.map((a) => `Av-${a}`).join(', ')
                    : selectedAvenue
                    ? `Avenue ${selectedAvenue.num} (Primary N–S)`
                    : `Span X:${selectedStreet?.x1} to X:${selectedStreet?.x2}`}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  {currentSelection.category === 'DISTRICT'
                    ? 'Connected Streets (E–W)'
                    : 'Connected Plant Blocks'}
                </span>
                <span className="font-mono text-sky-300 font-semibold text-xs mt-0.5 block truncate">
                  {selectedDistrict
                    ? selectedDistrict.streets.map((s) => `St-${s}`).join(', ')
                    : selectedAvenue
                    ? `Adjacent: ${selectedAvenue.districts.join(', ')}`
                    : `Street ${selectedStreet?.num} (E–W Corridor)`}
                </span>
              </div>
            </div>

            {/* Pinpoint Coordinate Bar & Action Buttons */}
            <div className="mt-3 flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
              <div className="text-[11px] font-mono">
                <span className="text-slate-400">PINPOINT:</span>
                <span className="text-emerald-400 font-bold ml-1">
                  X: {currentSelection.pinCoords.x}, Y: {currentSelection.pinCoords.y}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleZoomToSelected}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                >
                  Center Map
                </button>
                <button
                  onClick={handleOpenIssuePermitModal}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow transition"
                >
                  <span>+ Pin Permit Here</span>
                </button>
              </div>
            </div>
          </div>

          {/* DIRECTORY NAVIGATION TABS */}
          <div className="grid grid-cols-4 bg-slate-950 border-b border-slate-800 text-[11px] font-semibold select-none">
            <button
              onClick={() => setActiveDirectoryTab('sd')}
              className={`py-2.5 text-center border-b-2 transition ${
                activeDirectoryTab === 'sd'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/60 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Districts (26)
            </button>
            <button
              onClick={() => setActiveDirectoryTab('avenues')}
              className={`py-2.5 text-center border-b-2 transition ${
                activeDirectoryTab === 'avenues'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/60 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Avenues (15)
            </button>
            <button
              onClick={() => setActiveDirectoryTab('streets')}
              className={`py-2.5 text-center border-b-2 transition ${
                activeDirectoryTab === 'streets'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/60 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Streets (40)
            </button>
            <button
              onClick={() => setActiveDirectoryTab('permits')}
              className={`py-2.5 text-center border-b-2 transition ${
                activeDirectoryTab === 'permits'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/60 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Permits ({activePermits.length})
            </button>
          </div>

          {/* SEARCH FILTER BAR */}
          <div className="p-2.5 bg-slate-900 border-b border-slate-800">
            <div className="relative">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search District, Plant Name, Owner, Street or Avenue..."
                className="w-full bg-slate-950 text-xs text-slate-100 pl-9 pr-7 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-amber-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* SCROLLABLE DIRECTORY LIST */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {activeDirectoryTab === 'sd' &&
              filteredDistricts.map((sd) => {
                const isSel =
                  currentSelection.category === 'DISTRICT' && currentSelection.item.id === sd.id;
                return (
                  <div
                    key={sd.id}
                    onClick={() => {
                      handleSelectEntity('DISTRICT', sd);
                      centerOnPoint(sd.center.x, sd.center.y, 1.4);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                      isSel
                        ? 'bg-amber-500/15 border-amber-500/70 shadow'
                        : 'bg-slate-950/70 hover:bg-slate-800/70 border-slate-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-white/40">
                      {sd.code}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white truncate">{sd.shortLabel}</span>
                        <span className="text-[10px] font-mono text-amber-400">{sd.id}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{sd.name}</p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                        <span className="text-sky-400">👤 {sd.owner}</span>
                        <span className="font-mono">
                          Av:{sd.avenues.length} | St:{sd.streets.length}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

            {activeDirectoryTab === 'avenues' &&
              filteredAvenues.map((av) => {
                const isSel =
                  currentSelection.category === 'AVENUE' && currentSelection.item.id === av.id;
                const midX = Math.round((av.x1 + av.x2) / 2);
                const midY = Math.round((av.y1 + av.y2) / 2);
                return (
                  <div
                    key={av.id}
                    onClick={() => {
                      handleSelectEntity('AVENUE', av);
                      centerOnPoint(midX, midY, 1.4);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                      isSel
                        ? 'bg-amber-500/15 border-amber-500/70'
                        : 'bg-slate-950/70 hover:bg-slate-800/70 border-slate-800'
                    }`}
                  >
                    <div className="w-9 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-extrabold text-xs flex items-center justify-center shrink-0">
                      AV-{av.num}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white truncate">{av.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Serves: {av.districts.join(', ')}
                      </div>
                    </div>
                  </div>
                );
              })}

            {activeDirectoryTab === 'streets' &&
              filteredStreets.map((st) => {
                const isSel =
                  currentSelection.category === 'STREET' && currentSelection.item.id === st.id;
                const midX = Math.round((st.x1 + st.x2) / 2);
                const midY = Math.round((st.y1 + st.y2) / 2);
                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      handleSelectEntity('STREET', st);
                      centerOnPoint(midX, midY, 1.4);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                      isSel
                        ? 'bg-sky-500/15 border-sky-500/70'
                        : 'bg-slate-950/70 hover:bg-slate-800/70 border-slate-800'
                    }`}
                  >
                    <div className="w-9 h-8 rounded-lg bg-sky-600 text-white font-mono font-extrabold text-xs flex items-center justify-center shrink-0">
                      S-{st.num}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white truncate">{st.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        E–W Grid Y:{st.y1} (X:{st.x1}→{st.x2})
                      </div>
                    </div>
                  </div>
                );
              })}

            {activeDirectoryTab === 'permits' &&
              filteredPermits.map((p, idx) => (
                <div
                  key={`${p.ptwNo}-${idx}`}
                  onClick={() => handleFocusOnPermit(p)}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800/70 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-amber-400">{p.ptwNo}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-200">
                      {p.type}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">{p.targetName}</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-slate-400">
                    <span>👷 {p.contractor}</span>
                    <span className="text-emerald-400">
                      X:{p.x}, Y:{p.y}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* FOOTER STATUS BAR */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between select-none">
            <span>Click any block/road on map to pinpoint</span>
            <span className="font-mono text-slate-500">Scale: NTS | All dim in mm</span>
          </div>
        </aside>
      </div>

      {/* MODAL 1: PIN NEW PERMIT-TO-WORK (PTW) */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Pin New Permit-to-Work (PTW)</h3>
                <p className="text-xs text-amber-400 font-mono mt-0.5">
                  Location: {currentSelection.item.id} (X: {currentSelection.pinCoords.x}, Y:{' '}
                  {currentSelection.pinCoords.y})
                </p>
              </div>
              <button
                onClick={handleCloseIssuePermitModal}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewPermit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Permit Category / Work Type
                </label>
                <select
                  value={formWorkType}
                  onChange={(e) => setFormWorkType(e.target.value as PermitWorkType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="Hot Work">🔥 Hot Work Permit (Welding / Grinding / Cutting)</option>
                  <option value="Cold Work">🔧 Cold Work Permit (Mechanical / Valve Maintenance)</option>
                  <option value="Confined Space">🕳️ Confined Space Entry (Vessel / Tank / Pit)</option>
                  <option value="Height / Crane">🏗️ Work at Height / Heavy Crane Lifting</option>
                  <option value="Excavation / Road">🚧 Excavation / Road Blockade Permit</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    SAP Work Order / PTW #
                  </label>
                  <input
                    type="text"
                    required
                    value={formPtwNumber}
                    onChange={(e) => setFormPtwNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-amber-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Contractor / Executer
                  </label>
                  <input
                    type="text"
                    required
                    value={formContractor}
                    onChange={(e) => setFormContractor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Exact Equipment / Job Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={formJobDesc}
                  onChange={(e) => setFormJobDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  placeholder="Describe the job and exact sub-unit or road stretch..."
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
                <div>
                  Target Block/Road:{' '}
                  <span className="text-white font-semibold">
                    {currentSelection.item.id}: {currentSelection.item.name}
                  </span>
                </div>
                <div>
                  Area Owner Approval:{' '}
                  <span className="text-emerald-400">
                    {currentSelection.category === 'DISTRICT'
                      ? (currentSelection.item as SafetyDistrict).owner
                      : 'Plant Safety & Corridor HOD'}
                  </span>
                </div>
                <div>
                  Map Coordinates:{' '}
                  <span className="text-amber-300">
                    X: {currentSelection.pinCoords.x}, Y: {currentSelection.pinCoords.y}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseIssuePermitModal}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  Drop Permit Pin on Map
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SAP / WEB PERMIT JSON INTEGRATION PAYLOAD */}
      {isPayloadModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">
                  Web Permit Application — Location Payload
                </h3>
                <p className="text-xs text-slate-400">
                  Ready-to-consume JSON object for SAP PM / e-Permit Form binding
                </p>
              </div>
              <button
                onClick={() => setIsPayloadModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <pre className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-80">
                {payloadJson}
              </pre>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`text-xs text-amber-400 font-medium transition ${
                    copyFeedback ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  ✓ Copied to clipboard!
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyPayload}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Copy JSON Payload
                  </button>
                  <button
                    onClick={() => setIsPayloadModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
