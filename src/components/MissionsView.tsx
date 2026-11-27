import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Plus, Search, X } from 'lucide-react';
import {
  FACILITY_TYPES,
  type FacilityType,
  type FlightMission,
} from '../types/inspection';

interface MissionsViewProps {
  missions: FlightMission[];
  onAddMission: (mission: FlightMission) => void;
  onInspectLinked: (inspectionId: string) => void;
  onOpenUploadModal: () => void;
}

export function MissionsView({
  missions,
  onAddMission,
  onInspectLinked,
  onOpenUploadModal,
}: MissionsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'전체' | FlightMission['status']>('전체');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [facilityName, setFacilityName] = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>('교량');
  const [siteRegion, setSiteRegion] = useState('');
  const [droneModel, setDroneModel] = useState('Matrice 350 RTK');
  const [pilotName, setPilotName] = useState('');
  const [altitudeM, setAltitudeM] = useState('25.0');
  const [windSpeedMs, setWindSpeedMs] = useState('3.0');
  const [durationMin, setDurationMin] = useState('30');
  const [photoCount, setPhotoCount] = useState('60');

  const filteredMissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return missions.filter((m) => {
      if (statusFilter !== '전체' && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.facilityName.toLowerCase().includes(q) ||
        m.missionCode.toLowerCase().includes(q) ||
        m.siteRegion.toLowerCase().includes(q) ||
        m.pilotName.toLowerCase().includes(q)
      );
    });
  }, [missions, search, statusFilter]);

  const totalPhotos = useMemo(
    () => missions.reduce((acc, m) => acc + m.photoCount, 0),
    [missions],
  );
  const totalFlightMin = useMemo(
    () => missions.reduce((acc, m) => acc + m.durationMin, 0),
    [missions],
  );

  const handleCreateMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityName.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const codeDate = today.replace(/-/g, '').slice(2);
    const seq = String(missions.length + 1).padStart(2, '0');

    const newMission: FlightMission = {
      id: `mis-${Date.now()}`,
      missionCode: `FLT-${codeDate}-${seq}`,
      facilityName: facilityName.trim(),
      facilityType,
      siteRegion: siteRegion.trim() || '현장 점검 구역',
      flightDate: today,
      droneModel: droneModel.trim() || 'Matrice 350 RTK',
      pilotName: pilotName.trim() || '현장 조종자',
      altitudeM: Math.max(1, Number(altitudeM) || 20),
      windSpeedMs: Math.max(0, Number(windSpeedMs) || 2.5),
      durationMin: Math.max(1, Math.round(Number(durationMin) || 25)),
      photoCount: Math.max(1, Math.round(Number(photoCount) || 40)),
      status: '검토 중',
    };

    onAddMission(newMission);
    setFacilityName('');
    setSiteRegion('');
    setPilotName('');
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            드론 비행 및 촬영 이력
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            현장 투입 기체, 비행 고도, 기상 풍속 및 항공 촬영 매수를 체계적으로 기록합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {showCreateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showCreateForm ? '입력 닫기' : '비행 이력 등록'}</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 bg-white border border-slate-200 rounded-lg divide-x divide-slate-200">
        <div className="p-4">
          <p className="text-xs text-slate-500">누적 비행 임무</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 font-mono-tabular">
            {missions.length}회
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">누적 비행 시간</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 font-mono-tabular">
            {totalFlightMin}분
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">누적 수집 영상</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 font-mono-tabular">
            {totalPhotos.toLocaleString('ko-KR')}매
          </p>
        </div>
      </div>

      {/* Inline New Mission Registration Panel */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateMission}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">신규 드론 비행 임무 등록</h2>
            <span className="text-xs text-slate-500">비행 완료 후 현장 로그 기록</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">시설물명</label>
              <input
                type="text"
                required
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="예: 부산항대교 주탑 북측 구간"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">시설물 유형</label>
              <select
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value as FacilityType)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
              >
                {FACILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">지역</label>
              <input
                type="text"
                value={siteRegion}
                onChange={(e) => setSiteRegion(e.target.value)}
                placeholder="예: 부산 남구"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">드론 기체</label>
              <input
                type="text"
                value={droneModel}
                onChange={(e) => setDroneModel(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">조종자</label>
              <input
                type="text"
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
                placeholder="성명 입력"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">고도(m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={altitudeM}
                  onChange={(e) => setAltitudeM(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">풍속(m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={windSpeedMs}
                  onChange={(e) => setWindSpeedMs(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">비행(분)</label>
                <input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">촬영(매)</label>
                <input
                  type="number"
                  value={photoCount}
                  onChange={(e) => setPhotoCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
            >
              임무 저장
            </button>
          </div>
        </form>
      )}

      {/* Missions Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(['전체', '진단 완료', '검토 중', '보수 연계'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="임무 코드, 시설물, 조종자 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4 whitespace-nowrap">임무 코드</th>
                <th className="py-2.5 px-4 whitespace-nowrap">점검 시설물</th>
                <th className="py-2.5 px-4 whitespace-nowrap">비행 일자</th>
                <th className="py-2.5 px-4 whitespace-nowrap">기체 · 조종자</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">고도 / 풍속</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">촬영 매수</th>
                <th className="py-2.5 px-4 whitespace-nowrap">진행 상태</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">영상 연결</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredMissions.map((m) => {
                const statusColor =
                  m.status === '보수 연계'
                    ? 'text-red-700'
                    : m.status === '진단 완료'
                      ? 'text-emerald-700'
                      : 'text-amber-700';
                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {m.missionCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{m.facilityName}</div>
                      <div className="text-[11px] text-slate-500">
                        {m.facilityType} · {m.siteRegion}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                      {m.flightDate}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {m.droneModel} · {m.pilotName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                      {m.altitudeM.toFixed(1)}m / {m.windSpeedMs.toFixed(1)}m/s
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-900 whitespace-nowrap">
                      {m.photoCount}매
                    </td>
                    <td className={`py-3 px-4 font-medium whitespace-nowrap ${statusColor}`}>
                      {m.status}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {m.linkedInspectionId ? (
                        <button
                          type="button"
                          onClick={() => onInspectLinked(m.linkedInspectionId!)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                        >
                          <span>진단 열기</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenUploadModal}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          영상 업로드
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
