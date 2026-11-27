import React from 'react';
import { AlertTriangle, ArrowUpRight, BellRing, X } from 'lucide-react';
import type { SafetyAlertItem } from '../utils/alerts';

interface AlertToastStackProps {
  alerts: SafetyAlertItem[];
  onDismiss: (id: string) => void;
  onInspectRecord: (recordId: string) => void;
  onOpenDashboard: () => void;
}

export function AlertToastStack({
  alerts,
  onDismiss,
  onInspectRecord,
  onOpenDashboard,
}: AlertToastStackProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="no-print fixed top-16 right-4 z-50 w-full max-w-md space-y-2.5 pointer-events-none"
    >
      {alerts.map((alert) => {
        const isGradeE = alert.safetyGrade === 'E';
        return (
          <div
            key={alert.id}
            role="alert"
            className={`pointer-events-auto rounded-lg border shadow-lg p-4 ${
              isGradeE
                ? 'bg-red-50 border-red-300 text-red-950'
                : 'bg-white border-red-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    isGradeE ? 'text-red-700' : 'text-red-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-mono-tabular font-bold text-red-700">
                      {alert.safetyGrade}등급 · {alert.gradeLabel} 경보
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono-tabular text-slate-500">{alert.code}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                    {alert.facilityName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {alert.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span>{alert.facilityType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">유효 결함 {alert.defectCount}건</span>
                    {alert.browserNotified && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <BellRing className="w-3 h-3" />
                          <span>브라우저 알림 발송됨</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(alert.id)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
                aria-label="알림 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-red-200/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenDashboard();
                  onDismiss(alert.id);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                대시보드 확인
              </button>
              <button
                type="button"
                onClick={() => {
                  onInspectRecord(alert.recordId);
                  onDismiss(alert.id);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-red-700 rounded hover:bg-red-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>즉시 판독 보기</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
