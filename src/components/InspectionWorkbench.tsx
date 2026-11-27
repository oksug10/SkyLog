import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Crosshair,
  Eye,
  EyeOff,
  FileText,
  Grid3X3,
  ImageOff,
  Loader2,
  RefreshCw,
  Send,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  GRADE_META,
  SEVERITY_META,
  type DefectReviewStatus,
  type InspectionRecord,
} from '../types/inspection';
import { imageUrlToBase64 } from '../utils/imageUtils';

interface InspectionWorkbenchProps {
  records: InspectionRecord[];
  activeRecord: InspectionRecord;
  onSelectRecord: (id: string) => void;
  onUpdateRecord: (updated: InspectionRecord) => void;
  onOpenUploadModal: () => void;
  onOpenReport: () => void;
}

type InspectorTab = 'defects' | 'recommendations' | 'qa';

export function InspectionWorkbench({
  records,
  activeRecord,
  onSelectRecord,
  onUpdateRecord,
  onOpenUploadModal,
  onOpenReport,
}: InspectionWorkbenchProps) {
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(
    activeRecord.defects[0]?.id ?? null,
  );
  const [showBoxes, setShowBoxes] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<InspectorTab>('defects');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Engineering Q&A state
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const prevRecordIdRef = useRef(activeRecord.id);
  if (prevRecordIdRef.current !== activeRecord.id) {
    prevRecordIdRef.current = activeRecord.id;
    const nextFirst = activeRecord.defects[0]?.id ?? null;
    if (selectedDefectId !== nextFirst) {
      setSelectedDefectId(nextFirst);
    }
    if (zoom !== 1) setZoom(1);
    if (analysisError) setAnalysisError(null);
    if (qaError) setQaError(null);
  }

  const gradeInfo = GRADE_META[activeRecord.safetyGrade];
  const visibleDefects = useMemo(
    () => activeRecord.defects.filter((d) => d.status !== 'dismissed'),
    [activeRecord.defects],
  );
  const urgentCount = useMemo(
    () =>
      visibleDefects.filter((d) => d.severity === '긴급' || d.severity === '심각').length,
    [visibleDefects],
  );

  const handleToggleDefectStatus = (defectId: string, nextStatus: DefectReviewStatus) => {
    const updatedDefects = activeRecord.defects.map((d) =>
      d.id === defectId ? { ...d, status: d.status === nextStatus ? 'pending' : nextStatus } : d,
    );
    onUpdateRecord({
      ...activeRecord,
      defects: updatedDefects,
    });
  };

  const handleRunLiveAiDiagnosis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const { base64, mimeType } = await imageUrlToBase64(activeRecord.imageUrl);
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          facilityType: activeRecord.facilityType,
          facilityName: activeRecord.facilityName,
          inspectionNotes: `촬영 고도 ${activeRecord.altitudeM}m, 촬영 장비 ${activeRecord.cameraSpec}`,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'AI 정밀 진단에 실패했습니다.');
      }

      const updated: InspectionRecord = {
        ...activeRecord,
        safetyGrade: payload.safetyGrade,
        gradeLabel: payload.gradeLabel,
        summary: payload.summary,
        defects: payload.defects,
        recommendations: payload.recommendations,
        nextFlightGuidance: payload.nextFlightGuidance,
        analyzedAt: payload.analyzedAt || new Date().toISOString(),
        isLiveAiAnalyzed: true,
      };
      onUpdateRecord(updated);
      setSelectedDefectId(updated.defects[0]?.id ?? null);
      setActiveTab('defects');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'AI 정밀 진단 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setQaError(null);
    try {
      const { base64, mimeType } = await imageUrlToBase64(activeRecord.imageUrl);
      const contextLines = [
        `시설물: ${activeRecord.facilityName} (${activeRecord.facilityType})`,
        `안전등급: ${activeRecord.safetyGrade}등급 (${activeRecord.gradeLabel})`,
        `진단 요약: ${activeRecord.summary}`,
        '검출 결함:',
        ...activeRecord.defects.map(
          (d, i) =>
            `${i + 1}. ${d.type} [${d.severity}] - ${d.locationDesc} (${d.estimatedSize}): ${d.description}`,
        ),
      ].join('\n');

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          question: trimmed,
          inspectionContext: contextLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '질의 처리 중 오류가 발생했습니다.');
      }

      const nextQa = [
        ...(activeRecord.qaHistory ?? []),
        {
          id: `qa-${Date.now()}`,
          question: trimmed,
          answer: data.answer,
          timestamp: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ];
      onUpdateRecord({
        ...activeRecord,
        qaHistory: nextQa,
      });
      setQuestionInput('');
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'AI 기술 질의에 실패했습니다.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleZoomOut = () => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))));
  const handleZoomIn = () => setZoom((z) => Math.min(2.25, Number((z + 0.25).toFixed(2))));

  const hasImgError = Boolean(imageErrorMap[activeRecord.id]);

  return (
    <div className="flex flex-col gap-5">
      {/* Facility Context Bar — unboxed typographic metadata + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-mono-tabular">
            <span>{activeRecord.code}</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans text-slate-700 font-medium">{activeRecord.facilityType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans">{activeRecord.location}</span>
            <span aria-hidden="true">·</span>
            <span>고도 {activeRecord.altitudeM.toFixed(1)}m</span>
            <span aria-hidden="true">·</span>
            <span>풍속 {activeRecord.windSpeedMs.toFixed(1)}m/s</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {activeRecord.facilityName}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>진단 보고서</span>
          </button>
          <button
            type="button"
            onClick={handleRunLiveAiDiagnosis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{isAnalyzing ? 'AI 정밀 판독 중...' : 'AI 정밀 재진단'}</span>
          </button>
        </div>
      </div>

      {analysisError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{analysisError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAnalysisError(null)}
            className="text-red-600 hover:text-red-800 p-0.5 cursor-pointer"
            aria-label="오류 메시지 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Split Workspace: Drone Image Canvas (left 7 cols) + Engineering Inspector (right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Primary Focal Anchor — Drone Image Canvas + Filmstrip */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {/* Viewer Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-mono-tabular">
                <span>{activeRecord.droneModel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-sans">{activeRecord.cameraSpec}</span>
                <span aria-hidden="true">·</span>
                <span>{activeRecord.capturedAt}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowBoxes((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showBoxes
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {showBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>결함 박스</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGrid((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showGrid
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>측정 격자</span>
                </button>
                <div className="flex items-center border border-slate-200 rounded bg-white ml-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                    aria-label="축소"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-xs font-mono-tabular text-slate-700 min-w-[44px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoom >= 2.25}
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                    aria-label="확대"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Image Viewport */}
            <div className="relative bg-slate-900 overflow-auto max-h-[620px]">
              {hasImgError ? (
                <div className="aspect-[4/3] w-full flex flex-col items-center justify-center bg-slate-800 text-slate-300 p-8 text-center">
                  <ImageOff className="w-10 h-10 text-slate-500 mb-3" />
                  <p className="text-sm font-medium text-slate-200">{activeRecord.facilityName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    드론 영상을 불러오지 못했습니다. 새 영상을 업로드하여 진단을 진행해 주세요.
                  </p>
                </div>
              ) : (
                <div
                  className="relative mx-auto transition-transform duration-150 origin-top-left"
                  style={{
                    width: `${zoom * 100}%`,
                  }}
                >
                  <div className="relative w-full">
                    <img
                      src={activeRecord.imageUrl}
                      alt={`${activeRecord.facilityName} 드론 안전진단 항공 영상`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImageErrorMap((prev) => ({ ...prev, [activeRecord.id]: true }))
                      }
                      className="block w-full h-auto select-none"
                    />

                    {/* Optional Precision Engineering Measurement Grid */}
                    {showGrid && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage:
                            'linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)',
                          backgroundSize: '10% 10%',
                        }}
                      />
                    )}

                    {/* AI Bounding Box Overlay */}
                    {showBoxes &&
                      activeRecord.defects.map((defect, index) => {
                        if (defect.status === 'dismissed') return null;
                        const [ymin, xmin, ymax, xmax] = defect.box2d;
                        const topPct = ymin / 10;
                        const leftPct = xmin / 10;
                        const heightPct = Math.max(2, (ymax - ymin) / 10);
                        const widthPct = Math.max(2, (xmax - xmin) / 10);
                        const isSelected = selectedDefectId === defect.id;
                        const sevStyle = SEVERITY_META[defect.severity];

                        return (
                          <button
                            key={defect.id}
                            type="button"
                            onClick={() => {
                              setSelectedDefectId(defect.id);
                              setActiveTab('defects');
                            }}
                            aria-label={`결함 ${index + 1}: ${defect.type} (${defect.severity})`}
                            style={{
                              top: `${topPct}%`,
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                              borderColor: sevStyle.borderColor,
                              backgroundColor: isSelected
                                ? sevStyle.fillRgba
                                : 'rgba(15, 23, 42, 0.06)',
                              boxShadow: isSelected
                                ? `0 0 0 2px rgba(255,255,255,0.92), 0 0 0 4px ${sevStyle.borderColor}`
                                : 'none',
                            }}
                            className="absolute border-2 transition-all duration-150 cursor-pointer focus-visible:outline-none group"
                          >
                            <span
                              style={{ backgroundColor: sevStyle.badgeBg }}
                              className="absolute -top-6 left-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-white rounded-sm whitespace-nowrap shadow-sm font-mono-tabular"
                            >
                              <span>#{index + 1}</span>
                              <span className="font-sans">{defect.severity}</span>
                            </span>
                          </button>
                        );
                      })}

                    {/* Live AI Analysis Overlay */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
                        <p className="text-sm font-semibold">
                          AI 비전 모델이 드론 영상의 구조 결함을 정밀 판독하고 있습니다
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          균열 폭·박락 범위·부식 징후 및 국토부 안전등급(A~E)을 산출 중입니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Legend Bar inside Canvas Frame */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-white text-xs text-slate-600">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                  <span>긴급</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-orange-600 inline-block" />
                  <span>심각</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                  <span>주의</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  <span>경미</span>
                </span>
              </div>
              <div className="text-slate-500 font-mono-tabular">
                유효 결함 {visibleDefects.length}건 ·{' '}
                {activeRecord.isLiveAiAnalyzed ? '실시간 AI 판독 완료' : '기준 점검 데이터'}
              </div>
            </div>
          </div>

          {/* Inspection Case Filmstrip Selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h2 className="text-xs font-semibold text-slate-700">
                점검 영상 목록 ({records.length}건)
              </h2>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>드론 사진 추가</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {records.map((rec) => {
                const isActive = rec.id === activeRecord.id;
                const recGrade = GRADE_META[rec.safetyGrade];
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => onSelectRecord(rec.id)}
                    className={`group text-left rounded-md border overflow-hidden transition-colors cursor-pointer ${
                      isActive
                        ? 'border-blue-700 ring-1 ring-blue-700 bg-blue-50/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={rec.imageUrl}
                        alt={rec.facilityName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-150"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-[11px] font-mono-tabular font-semibold text-white">
                        {rec.safetyGrade}등급 · {recGrade.label}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {rec.facilityName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                        {rec.facilityType} · 결함{' '}
                        {rec.defects.filter((d) => d.status !== 'dismissed').length}건
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Structured Engineering Inspector Panel */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          {/* Safety Grade Header Block */}
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">시설물 안전등급 판정</p>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span
                    className={`text-3xl font-bold tracking-tight font-mono-tabular ${gradeInfo.textClass}`}
                  >
                    {activeRecord.safetyGrade}등급
                  </span>
                  <span className={`text-sm font-semibold ${gradeInfo.textClass}`}>
                    {activeRecord.gradeLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{gradeInfo.shortDesc}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-right shrink-0">
                <div>
                  <p className="text-[11px] text-slate-500">검출 결함</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900 font-mono-tabular">
                    {visibleDefects.length}건
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">긴급·심각</p>
                  <p
                    className={`mt-0.5 text-lg font-semibold font-mono-tabular ${
                      urgentCount > 0 ? 'text-red-700' : 'text-slate-900'
                    }`}
                  >
                    {urgentCount}건
                  </p>
                </div>
              </div>
            </div>

            {/* Grade Scale A -> E Indicator */}
            <div className="mt-4 grid grid-cols-5 gap-1">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => {
                const active = activeRecord.safetyGrade === g;
                return (
                  <div
                    key={g}
                    className={`py-1 text-center text-[11px] font-mono-tabular rounded-xs border ${
                      active
                        ? `${GRADE_META[g].surfaceClass} ${GRADE_META[g].borderClass} ${GRADE_META[g].textClass} font-semibold`
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    {g} · {GRADE_META[g].label}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-slate-700">
              {activeRecord.summary}
            </p>
          </div>

          {/* Segmented Tabs inside Inspector */}
          <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-slate-50/70">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-md">
              <button
                type="button"
                onClick={() => setActiveTab('defects')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'defects'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                검출 결함 ({activeRecord.defects.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recommendations')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'recommendations'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                보수 권고 ({activeRecord.recommendations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qa')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'qa'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AI 기술 질의
              </button>
            </div>
          </div>

          {/* Tab Panel Content */}
          <div className="flex-1 divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
            {activeTab === 'defects' && (
              <>
                {activeRecord.defects.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-800">검출된 결함이 없습니다</p>
                    <p className="mt-1 text-xs text-slate-500">
                      현재 영상에서 육안상 특이 손상이 발견되지 않았습니다.
                    </p>
                  </div>
                ) : (
                  activeRecord.defects.map((defect, index) => {
                    const isSelected = selectedDefectId === defect.id;
                    const sevStyle = SEVERITY_META[defect.severity];
                    const isDismissed = defect.status === 'dismissed';
                    return (
                      <div
                        key={defect.id}
                        onClick={() => setSelectedDefectId(defect.id)}
                        className={`p-4 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                        } ${isDismissed ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <span className="font-mono-tabular font-semibold text-slate-900">
                                #{index + 1}
                              </span>
                              <span className={`font-semibold ${sevStyle.textClass}`}>
                                {defect.severity}
                              </span>
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono-tabular text-slate-500">
                                신뢰도 {defect.confidence}%
                              </span>
                              {defect.status === 'verified' && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-emerald-700 font-medium">검토 완료</span>
                                </>
                              )}
                              {isDismissed && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-slate-500">오탐 제외</span>
                                </>
                              )}
                            </div>
                            <h3 className="mt-1 text-sm font-semibold text-slate-900">
                              {defect.type}
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDefectId(defect.id);
                              setShowBoxes(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded cursor-pointer shrink-0"
                            title="영상에서 위치 강조"
                            aria-label="영상에서 위치 강조"
                          >
                            <Crosshair className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>{defect.locationDesc}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-slate-700">
                            {defect.estimatedSize}
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {defect.description}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleDefectStatus(defect.id, 'verified');
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                              defect.status === 'verified'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>검토 확인</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleDefectStatus(defect.id, 'dismissed');
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                              isDismissed
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                            }`}
                          >
                            <X className="w-3 h-3" />
                            <span>{isDismissed ? '복원' : '오탐 제외'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'recommendations' && (
              <div className="divide-y divide-slate-200">
                {activeRecord.recommendations.map((rec, idx) => {
                  const priorityColor =
                    rec.priority === '즉시 조치'
                      ? 'text-red-700'
                      : rec.priority === '단기 보수'
                        ? 'text-amber-700'
                        : 'text-slate-600';
                  return (
                    <div key={rec.id} className="p-4">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-slate-400">
                            0{idx + 1}.
                          </span>
                          <span className={`font-semibold ${priorityColor}`}>{rec.priority}</span>
                        </div>
                        <span className="font-mono-tabular text-slate-500">{rec.timeframe}</span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-slate-900">{rec.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{rec.method}</p>
                    </div>
                  );
                })}

                <div className="p-4 bg-slate-50/80">
                  <p className="text-xs font-semibold text-slate-800">후속 드론 재촬영 가이드</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {activeRecord.nextFlightGuidance}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'qa' && (
              <div className="p-4 flex flex-col gap-4">
                <div className="text-xs text-slate-600 leading-relaxed">
                  현재 선택된 드론 영상과 결함 데이터를 바탕으로 보수 공법, 구조 위험도, 추가 점검
                  기준 등에 대해 AI 기술사에게 질문할 수 있습니다.
                </div>

                {/* Quick engineering prompt buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '가장 시급한 보수 공법과 예상 공정 순서는?',
                    '현 상태에서 사용 제한 또는 통제가 필요한가요?',
                    '다음 드론 비행 시 열화상 촬영이 필요한 부위는?',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuestionInput(preset)}
                      className="text-left px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {qaError && (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {qaError}
                  </div>
                )}

                {/* Q&A History */}
                <div className="space-y-3">
                  {(activeRecord.qaHistory ?? []).length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-md">
                      아직 질의 기록이 없습니다. 아래 입력창에서 기술 질문을 입력해 보세요.
                    </div>
                  ) : (
                    (activeRecord.qaHistory ?? []).map((item) => (
                      <div key={item.id} className="space-y-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 font-mono-tabular">
                          <span className="font-sans font-medium text-slate-700">현장 질의</span>
                          <span>{item.timestamp}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-900">{item.question}</p>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                          {item.answer}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input form */}
                <form onSubmit={handleAskQuestion} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="영상 결함에 대한 기술 질문을 입력하세요..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !questionInput.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isAsking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>질의</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
