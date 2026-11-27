import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Search,
} from 'lucide-react';
import {
  FACILITY_TYPES,
  GRADE_META,
  type FacilityType,
  type InspectionRecord,
  type SafetyGrade,
} from '../types/inspection';
import type { BrowserNotificationState } from '../utils/alerts';

interface DashboardViewProps {
  records: InspectionRecord[];
  acknowledgedAlertIds: string[];
  notificationState: BrowserNotificationState;
  onRequestNotificationPermission: () => void;
  onTriggerAlertForRecord: (record: InspectionRecord) => void;
  onAcknowledgeAlert: (recordId: string) => void;
  onAcknowledgeAllAlerts: () => void;
  onInspectRecord: (id: string) => void;
  onOpenUploadModal: () => void;
}

export function DashboardView({
  records,
  acknowledgedAlertIds,
  notificationState,
  onRequestNotificationPermission,
  onTriggerAlertForRecord,
  onAcknowledgeAlert,
  onAcknowledgeAllAlerts,
  onInspectRecord,
  onOpenUploadModal,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState<'전체' | FacilityType>('전체');
  const [gradeFilter, setGradeFilter] = useState<'전체' | SafetyGrade>('전체');
  const [onlyCriticalAlerts, setOnlyCriticalAlerts] = useState(false);

  const criticalRecords = useMemo(() => {
    const ackSet = new Set(acknowledgedAlertIds);
    return records
      .filter((r) => r.safetyGrade === 'D' || r.safetyGrade === 'E')
      .sort((a, b) => {
        const aAck = ackSet.has(a.id) ? 1 : 0;
        const bAck = ackSet.has(b.id) ? 1 : 0;
        if (aAck !== bAck) return aAck - bAck;
        if (a.safetyGrade !== b.safetyGrade) {
          return a.safetyGrade === 'E' ? -1 : 1;
        }
        return b.capturedAt.localeCompare(a.capturedAt);
      });
  }, [records, acknowledgedAlertIds]);

  const unacknowledgedCount = useMemo(() => {
    const ackSet = new Set(acknowledgedAlertIds);
    return criticalRecords.filter((r) => !ackSet.has(r.id)).length;
  }, [criticalRecords, acknowledgedAlertIds]);

  const stats = useMemo(() => {
    let totalDefects = 0;
    let criticalDefects = 0;
    let verifiedDefects = 0;
    let immediateActions = 0;

    const gradeCounts: Record<SafetyGrade, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    const defectByFacility: Record<string, number> = {};

    for (const r of records) {
      gradeCounts[r.safetyGrade] += 1;
      const activeDefs = r.defects.filter((d) => d.status !== 'dismissed');
      totalDefects += activeDefs.length;
      defectByFacility[r.facilityType] = (defectByFacility[r.facilityType] || 0) + activeDefs.length;

      for (const d of activeDefs) {
        if (d.severity === '긴급' || d.severity === '심각') criticalDefects += 1;
        if (d.status === 'verified') verifiedDefects += 1;
      }
      for (const rec of r.recommendations) {
        if (rec.priority === '즉시 조치') immediateActions += 1;
      }
    }

    return {
      totalFacilities: records.length,
      totalDefects,
      criticalDefects,
      verifiedDefects,
      immediateActions,
      gradeCounts,
      defectByFacility,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (onlyCriticalAlerts && r.safetyGrade !== 'D' && r.safetyGrade !== 'E') return false;
      if (facilityFilter !== '전체' && r.facilityType !== facilityFilter) return false;
      if (gradeFilter !== '전체' && r.safetyGrade !== gradeFilter) return false;
      if (!q) return true;
      return (
        r.facilityName.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.defects.some((d) => d.type.toLowerCase().includes(q))
      );
    });
  }, [records, searchQuery, facilityFilter, gradeFilter, onlyCriticalAlerts]);

  const maxFacilityDefects = Math.max(
    1,
    ...Object.values(stats.defectByFacility),
  );

  const acknowledgedSet = useMemo(() => new Set(acknowledgedAlertIds), [acknowledgedAlertIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            시설물 안전진단 현황
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            드론 촬영 영상에서 판독된 시설물별 안전등급과 D·E등급 중점 경보 대상을 관리합니다.
          </p>
        </div>

        {/* Browser Notification Permission Control */}
        <div className="flex items-center gap-2 shrink-0">
          {notificationState === 'granted' ? (
            <button
              type="button"
              onClick={() => {
                if (criticalRecords[0]) {
                  onTriggerAlertForRecord(criticalRecords[0]);
                }
              }}
              disabled={criticalRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>브라우저 경보 활성 · 테스트 발송</span>
            </button>
          ) : notificationState === 'denied' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap">
              <BellOff className="w-3.5 h-3.5 text-slate-500" />
              <span>브라우저 알림 차단됨 (화면 내 경보 사용 중)</span>
            </div>
          ) : notificationState === 'default' ? (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-blue-700" />
              <span>D·E등급 브라우저 알림 허용</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap">
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              <span>화면 내 D·E 경보 알림 활성</span>
            </div>
          )}
        </div>
      </div>

      {/* D & E Safety Grade Critical Alert Center */}
      {criticalRecords.length > 0 && (
        <section
          aria-label="D·E등급 안전 경보 목록"
          className="bg-red-50/55 border border-red-200 rounded-lg overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-red-200/80 flex flex-wrap items-center justify-between gap-3 bg-red-50/90">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
              <h2 className="text-sm font-semibold text-red-950">
                D·E등급 중점 경보 시설물 ({criticalRecords.length}개소)
              </h2>
              <span className="text-xs text-red-800 font-mono-tabular">
                · 미확인 {unacknowledgedCount}건
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {unacknowledgedCount > 0 && (
                <button
                  type="button"
                  onClick={onAcknowledgeAllAlerts}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-800 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>모두 확인 처리</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOnlyCriticalAlerts((v) => !v)}
                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  onlyCriticalAlerts
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-white text-red-900 border-red-200 hover:bg-red-50'
                }`}
              >
                {onlyCriticalAlerts ? '전체 목록 보기' : '목록에서 D·E만 필터'}
              </button>
            </div>
          </div>

          <div className="divide-y divide-red-200/70">
            {criticalRecords.map((rec) => {
              const isGradeE = rec.safetyGrade === 'E';
              const isAck = acknowledgedSet.has(rec.id);
              const activeDefects = rec.defects.filter((d) => d.status !== 'dismissed').length;

              return (
                <div
                  key={rec.id}
                  className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                    isAck ? 'bg-white/70' : isGradeE ? 'bg-red-100/55' : 'bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span
                        className={`font-mono-tabular font-bold ${
                          isGradeE ? 'text-red-800' : 'text-red-700'
                        }`}
                      >
                        {rec.safetyGrade}등급 · {rec.gradeLabel}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono-tabular text-slate-600">{rec.code}</span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-700">{rec.facilityType}</span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono-tabular text-slate-600">
                        결함 {activeDefects}건
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className={isAck ? 'text-slate-500' : 'text-red-700 font-medium'}>
                        {isAck ? '확인 완료' : '미확인 경보'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{rec.facilityName}</p>
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-1">{rec.summary}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isAck && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeAlert(rec.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>확인 처리</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onInspectRecord(rec.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-700 rounded hover:bg-red-800 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>즉시 판독</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Flat 4-Column KPI Strip (single elevation, hairline dividers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">총 진단 시설물</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono-tabular">
            {stats.totalFacilities}
            <span className="ml-1 text-xs font-normal font-sans text-slate-500">개소</span>
          </p>
          <p className="mt-1 text-xs text-red-700 font-medium">
            D·E등급 중점관리 {stats.gradeCounts.D + stats.gradeCounts.E}개소
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">유효 검출 결함</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono-tabular">
            {stats.totalDefects}
            <span className="ml-1 text-xs font-normal font-sans text-slate-500">건</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-tabular">
            기술사 검토 완료 {stats.verifiedDefects}건
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">긴급·심각 결함</p>
          <p className="mt-2 text-2xl font-semibold text-red-700 font-mono-tabular">
            {stats.criticalDefects}
            <span className="ml-1 text-xs font-normal font-sans text-slate-500">건</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">우선 정밀 점검 및 보수 필요</p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">즉시 조치 권고</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700 font-mono-tabular">
            {stats.immediateActions}
            <span className="ml-1 text-xs font-normal font-sans text-slate-500">건</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">14일 이내 현장 대응 권장</p>
        </div>
      </div>

      {/* Distribution Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Safety Grade Distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">안전등급(A~E) 분포</h2>
            <span className="text-xs text-slate-500">국토교통부 시설물안전법 기준</span>
          </div>

          <div className="space-y-3">
            {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => {
              const count = stats.gradeCounts[grade];
              const pct = stats.totalFacilities > 0 ? (count / stats.totalFacilities) * 100 : 0;
              const meta = GRADE_META[grade];
              return (
                <div key={grade} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <div className="col-span-3 flex items-center gap-1.5 font-medium text-slate-700">
                    <span className={`font-mono-tabular font-semibold ${meta.textClass}`}>
                      {grade}등급
                    </span>
                    <span className="text-slate-500">{meta.label}</span>
                  </div>
                  <div className="col-span-7 h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className="h-full rounded-xs transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: meta.barColor,
                      }}
                    />
                  </div>
                  <div className="col-span-2 text-right font-mono-tabular text-slate-700">
                    {count}개소
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Defects by Facility Type */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">시설물 유형별 결함 건수</h2>
            <span className="text-xs text-slate-500">오탐 제외 기준</span>
          </div>

          <div className="space-y-3">
            {FACILITY_TYPES.filter((t) => (stats.defectByFacility[t] ?? 0) > 0 || t !== '기타')
              .slice(0, 5)
              .map((type) => {
                const count = stats.defectByFacility[type] ?? 0;
                const pct = (count / maxFacilityDefects) * 100;
                return (
                  <div key={type} className="grid grid-cols-12 items-center gap-3 text-xs">
                    <div className="col-span-3 font-medium text-slate-700 truncate">{type}</div>
                    <div className="col-span-7 h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-slate-800 rounded-xs transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="col-span-2 text-right font-mono-tabular text-slate-700">
                      {count}건
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Inspection Ledger Data Grid with D/E Row Highlighting */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Facility Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
              {(['전체', '교량', '건축물', '태양광', '풍력'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFacilityFilter(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    facilityFilter === tab
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <select
              aria-label="안전등급 필터"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value as '전체' | SafetyGrade)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              <option value="전체">전체 등급</option>
              <option value="A">A등급 (우수)</option>
              <option value="B">B등급 (양호)</option>
              <option value="C">C등급 (보통)</option>
              <option value="D">D등급 (미흡)</option>
              <option value="E">E등급 (불량)</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyCriticalAlerts((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyCriticalAlerts
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>D·E 경보만 ({criticalRecords.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="시설물명, 코드, 결함 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <p className="text-sm font-medium text-slate-800">조건에 맞는 진단 이력이 없습니다</p>
            <p className="mt-1 text-xs text-slate-500">
              필터를 초기화하거나 새 드론 영상을 업로드하여 진단을 시작하세요.
            </p>
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
            >
              새 드론 영상 진단
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4 whitespace-nowrap">진단 코드</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">시설물명</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">유형</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">촬영 일시</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">검출 결함</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">안전등급 · 경보</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">상세 판독</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRecords.map((rec) => {
                  const gradeInfo = GRADE_META[rec.safetyGrade];
                  const activeDefectCount = rec.defects.filter(
                    (d) => d.status !== 'dismissed',
                  ).length;
                  const isGradeE = rec.safetyGrade === 'E';
                  const isGradeD = rec.safetyGrade === 'D';
                  const isCritical = isGradeE || isGradeD;
                  const isUnacked = isCritical && !acknowledgedSet.has(rec.id);

                  const rowBgClass = isGradeE
                    ? 'bg-red-50/90 hover:bg-red-100/70'
                    : isGradeD
                      ? 'bg-red-50/45 hover:bg-red-50/85'
                      : 'hover:bg-slate-50';

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => onInspectRecord(rec.id)}
                      className={`transition-colors cursor-pointer ${rowBgClass}`}
                    >
                      <td className="py-3 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                        {rec.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{rec.facilityName}</span>
                          {isUnacked && (
                            <span className="text-[11px] font-semibold text-red-700 whitespace-nowrap">
                              · 미확인 경보
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{rec.location}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {rec.facilityType}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                        {rec.capturedAt}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-900 whitespace-nowrap">
                        {activeDefectCount}건
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {isCritical && (
                            <AlertTriangle
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isGradeE ? 'text-red-800' : 'text-red-600'
                              }`}
                            />
                          )}
                          <span className={`font-semibold font-mono-tabular ${gradeInfo.textClass}`}>
                            {rec.safetyGrade}등급 · {rec.gradeLabel}
                          </span>
                          {isCritical && (
                            <span className="text-[11px] text-red-700 font-medium">
                              ({isGradeE ? '긴급 경보' : '중점 관리'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectRecord(rec.id);
                          }}
                          className={`inline-flex items-center gap-1 text-xs font-medium cursor-pointer ${
                            isCritical
                              ? 'text-red-700 hover:text-red-900'
                              : 'text-blue-700 hover:text-blue-800'
                          }`}
                        >
                          <span>판독 보기</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

