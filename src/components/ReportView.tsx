import React from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import {
  GRADE_META,
  SEVERITY_META,
  type InspectionRecord,
} from '../types/inspection';
import { downloadInspectionCsv, downloadInspectionJson } from '../utils/imageUtils';

interface ReportViewProps {
  records: InspectionRecord[];
  activeRecord: InspectionRecord;
  onSelectRecord: (id: string) => void;
}

export function ReportView({
  records,
  activeRecord,
  onSelectRecord,
}: ReportViewProps) {
  const gradeInfo = GRADE_META[activeRecord.safetyGrade];
  const activeDefects = activeRecord.defects.filter((d) => d.status !== 'dismissed');

  return (
    <div className="space-y-5">
      {/* Report Action Bar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            시설물 안전진단 보고서
          </h1>
          <select
            aria-label="보고서 대상 시설물 선택"
            value={activeRecord.id}
            onChange={(e) => onSelectRecord(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-700"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                [{r.code}] {r.facilityName} ({r.safetyGrade}등급)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadInspectionCsv(activeRecord)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV 저장</span>
          </button>
          <button
            type="button"
            onClick={() => downloadInspectionJson(activeRecord)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON 내보내기</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>보고서 인쇄 · PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Formal Engineering Report Sheet */}
      <article className="print-only-full bg-white border border-slate-200 rounded-lg max-w-4xl mx-auto p-8 space-y-8">
        {/* Document Header */}
        <header className="border-b-2 border-slate-900 pb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              드론 항공 영상 기반 구조물 정밀 안전진단 결과서
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {activeRecord.facilityName}
            </h2>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono-tabular space-y-0.5">
            <div>문서번호: {activeRecord.code}</div>
            <div>촬영일시: {activeRecord.capturedAt}</div>
            <div className="font-sans">담당 기술사: {activeRecord.inspectorName}</div>
          </div>
        </header>

        {/* Section 1: Facility Metadata & Safety Grade Verdict */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">01. 시설물 및 촬영 개요</h3>
            <dl className="grid grid-cols-2 border-t border-slate-200 text-xs">
              <div className="py-2.5 pr-4 border-b border-slate-200">
                <dt className="text-slate-500">시설물 유형</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{activeRecord.facilityType}</dd>
              </div>
              <div className="py-2.5 pl-4 border-b border-slate-200">
                <dt className="text-slate-500">현장 소재지</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{activeRecord.location}</dd>
              </div>
              <div className="py-2.5 pr-4 border-b border-slate-200">
                <dt className="text-slate-500">투입 기체 · 광학 센서</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {activeRecord.droneModel} · {activeRecord.cameraSpec}
                </dd>
              </div>
              <div className="py-2.5 pl-4 border-b border-slate-200">
                <dt className="text-slate-500">촬영 고도 · 기상 풍속</dt>
                <dd className="mt-0.5 font-mono-tabular font-medium text-slate-900">
                  {activeRecord.altitudeM.toFixed(1)}m · {activeRecord.windSpeedMs.toFixed(1)}m/s
                </dd>
              </div>
            </dl>
          </div>

          <div className="md:col-span-4 border border-slate-200 rounded-md p-4 bg-slate-50/70">
            <p className="text-xs font-medium text-slate-500">종합 안전등급 판정</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-bold font-mono-tabular ${gradeInfo.textClass}`}>
                {activeRecord.safetyGrade}등급
              </span>
              <span className={`text-sm font-semibold ${gradeInfo.textClass}`}>
                ({activeRecord.gradeLabel})
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">{gradeInfo.criteria}</p>
          </div>
        </section>

        {/* Section 2: Annotated Drone Image Evidence */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            02. AI 결함 판독 영상 및 종합 소견
          </h3>
          <div className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-900">
            <img
              src={activeRecord.imageUrl}
              alt={`${activeRecord.facilityName} 판독 영상`}
              referrerPolicy="no-referrer"
              className="block w-full h-auto"
            />
            {activeDefects.map((defect, index) => {
              const [ymin, xmin, ymax, xmax] = defect.box2d;
              const sevStyle = SEVERITY_META[defect.severity];
              return (
                <div
                  key={defect.id}
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    width: `${Math.max(2, (xmax - xmin) / 10)}%`,
                    height: `${Math.max(2, (ymax - ymin) / 10)}%`,
                    borderColor: sevStyle.borderColor,
                  }}
                  className="absolute border-2"
                >
                  <span
                    style={{ backgroundColor: sevStyle.badgeBg }}
                    className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-mono-tabular font-semibold text-white whitespace-nowrap"
                  >
                    #{index + 1} {defect.severity}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-800">{activeRecord.summary}</p>
        </section>

        {/* Section 3: Detailed Defect Table */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            03. 세부 결함 검출 내역 ({activeDefects.length}건)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-12">번호</th>
                  <th className="py-2.5 px-3">결함 유형</th>
                  <th className="py-2.5 px-3 w-16">심각도</th>
                  <th className="py-2.5 px-3">발생 위치 · 추정 규격</th>
                  <th className="py-2.5 px-3">공학적 판독 소견</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeDefects.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-500">#{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{d.type}</td>
                    <td
                      className={`py-2.5 px-3 font-semibold whitespace-nowrap ${SEVERITY_META[d.severity].textClass}`}
                    >
                      {d.severity}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>{d.locationDesc}</div>
                      <div className="font-mono-tabular text-[11px] text-slate-500">
                        {d.estimatedSize}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 leading-relaxed">{d.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Maintenance & Repair Recommendations */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            04. 보수·보강 권고안 및 후속 비행 가이드
          </h3>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
            {activeRecord.recommendations.map((rec, idx) => (
              <div key={rec.id} className="p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    <span className="font-mono-tabular text-slate-400 mr-2">0{idx + 1}.</span>
                    <span
                      className={
                        rec.priority === '즉시 조치'
                          ? 'text-red-700 mr-2'
                          : rec.priority === '단기 보수'
                            ? 'text-amber-700 mr-2'
                            : 'text-slate-600 mr-2'
                      }
                    >
                      [{rec.priority}]
                    </span>
                    <span>{rec.title}</span>
                  </div>
                  <span className="font-mono-tabular text-slate-500 whitespace-nowrap">
                    {rec.timeframe}
                  </span>
                </div>
                <p className="mt-1.5 text-slate-600 leading-relaxed">{rec.method}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            <strong className="font-semibold text-slate-800">후속 드론 점검 권고: </strong>
            {activeRecord.nextFlightGuidance}
          </p>
        </section>

        {/* Section 5: Standard Safety Grade Criteria Reference */}
        <section className="pt-4 border-t border-slate-200">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">
            참고: 시설물 안전등급(A~E) 판정 기준표
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
            {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => (
              <div key={g} className="p-2.5 border border-slate-200 rounded bg-slate-50/50">
                <div className={`font-mono-tabular font-semibold ${GRADE_META[g].textClass}`}>
                  {g}등급 · {GRADE_META[g].label}
                </div>
                <p className="mt-1 text-slate-600 leading-snug">{GRADE_META[g].shortDesc}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
