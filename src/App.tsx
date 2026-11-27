import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  LayoutDashboard,
  Menu,
  Navigation,
  ScanEye,
  Upload,
  X,
} from 'lucide-react';
import { AlertToastStack } from './components/AlertToastStack';
import { DashboardView } from './components/DashboardView';
import { InspectionWorkbench } from './components/InspectionWorkbench';
import { MissionsView } from './components/MissionsView';
import { ReportView } from './components/ReportView';
import { UploadInspectModal } from './components/UploadInspectModal';
import { INITIAL_INSPECTIONS, INITIAL_MISSIONS } from './data/initialInspections';
import type { FlightMission, InspectionRecord } from './types/inspection';
import {
  getBrowserNotificationState,
  requestBrowserNotificationPermission,
  sendCriticalGradeBrowserAlert,
  type BrowserNotificationState,
  type SafetyAlertItem,
} from './utils/alerts';

type NavView = 'inspection' | 'dashboard' | 'missions' | 'report';

const STORAGE_RECORDS_KEY = 'aeroinspect_records_v1';
const STORAGE_MISSIONS_KEY = 'aeroinspect_missions_v1';
const STORAGE_ACK_ALERTS_KEY = 'aeroinspect_ack_alerts_v1';

const NAV_ITEMS: Array<{
  id: NavView;
  label: string;
  breadcrumb: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'inspection',
    label: 'AI 영상 정밀 진단',
    breadcrumb: '안전진단 워크벤치 / AI 영상 판독',
    icon: ScanEye,
  },
  {
    id: 'dashboard',
    label: '시설물 진단 대시보드',
    breadcrumb: '안전진단 워크벤치 / 시설물 현황',
    icon: LayoutDashboard,
  },
  {
    id: 'missions',
    label: '드론 비행 이력',
    breadcrumb: '안전진단 워크벤치 / 비행 및 촬영 이력',
    icon: Navigation,
  },
  {
    id: 'report',
    label: '안전진단 보고서',
    breadcrumb: '안전진단 워크벤치 / 공식 결과 보고서',
    icon: FileText,
  },
];

function loadSavedRecords(): InspectionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECORDS_KEY);
    if (!raw) return INITIAL_INSPECTIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_INSPECTIONS;
  } catch {
    return INITIAL_INSPECTIONS;
  }
}

function loadSavedMissions(): FlightMission[] {
  try {
    const raw = localStorage.getItem(STORAGE_MISSIONS_KEY);
    if (!raw) return INITIAL_MISSIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_MISSIONS;
  } catch {
    return INITIAL_MISSIONS;
  }
}

function loadAcknowledgedAlerts(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_ACK_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('inspection');
  const [records, setRecords] = useState<InspectionRecord[]>(loadSavedRecords);
  const [missions, setMissions] = useState<FlightMission[]>(loadSavedMissions);
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] =
    useState<string[]>(loadAcknowledgedAlerts);
  const [activeToasts, setActiveToasts] = useState<SafetyAlertItem[]>([]);
  const [notificationState, setNotificationState] = useState<BrowserNotificationState>(
    getBrowserNotificationState,
  );
  const [activeRecordId, setActiveRecordId] = useState<string>(
    () => loadSavedRecords()[0]?.id ?? INITIAL_INSPECTIONS[0].id,
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
    } catch {
      // Ignore storage quota errors if user uploads multiple very large images
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(missions));
    } catch {
      // Ignore storage errors
    }
  }, [missions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACK_ALERTS_KEY, JSON.stringify(acknowledgedAlertIds));
    } catch {
      // Ignore storage errors
    }
  }, [acknowledgedAlertIds]);

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeRecordId) ?? records[0],
    [records, activeRecordId],
  );

  const urgentFacilityCount = useMemo(
    () => records.filter((r) => r.safetyGrade === 'D' || r.safetyGrade === 'E').length,
    [records],
  );

  const unacknowledgedCriticalCount = useMemo(() => {
    const ackSet = new Set(acknowledgedAlertIds);
    return records.filter(
      (r) => (r.safetyGrade === 'D' || r.safetyGrade === 'E') && !ackSet.has(r.id),
    ).length;
  }, [records, acknowledgedAlertIds]);

  const handleRequestNotificationPermission = async () => {
    const nextState = await requestBrowserNotificationPermission();
    setNotificationState(nextState);
  };

  const triggerCriticalAlert = (record: InspectionRecord) => {
    if (record.safetyGrade !== 'D' && record.safetyGrade !== 'E') return;

    const browserNotified = sendCriticalGradeBrowserAlert(record, () => {
      setActiveRecordId(record.id);
      setActiveView('inspection');
    });

    const alertItem: SafetyAlertItem = {
      id: `alert-${Date.now()}-${record.id}`,
      recordId: record.id,
      code: record.code,
      facilityName: record.facilityName,
      facilityType: record.facilityType,
      safetyGrade: record.safetyGrade,
      gradeLabel: record.gradeLabel,
      defectCount: record.defects.filter((d) => d.status !== 'dismissed').length,
      summary: record.summary,
      createdAt: new Date().toISOString(),
      browserNotified,
    };

    setActiveToasts((prev) => [alertItem, ...prev.slice(0, 3)]);
    setAcknowledgedAlertIds((prev) => prev.filter((id) => id !== record.id));
  };

  const handleUpdateRecord = (updated: InspectionRecord) => {
    const previous = records.find((r) => r.id === updated.id);
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

    const wasReanalyzed = previous && previous.analyzedAt !== updated.analyzedAt;
    if (wasReanalyzed && (updated.safetyGrade === 'D' || updated.safetyGrade === 'E')) {
      triggerCriticalAlert(updated);
    }
  };

  const handleInspectionCreated = (newRecord: InspectionRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
    setActiveRecordId(newRecord.id);
    setActiveView('inspection');

    if (newRecord.safetyGrade === 'D' || newRecord.safetyGrade === 'E') {
      triggerCriticalAlert(newRecord);
    }

    // Also append a corresponding mission record automatically
    const newMission: FlightMission = {
      id: `mis-auto-${Date.now()}`,
      missionCode: `FLT-${newRecord.code.slice(-4)}`,
      facilityName: newRecord.facilityName,
      facilityType: newRecord.facilityType,
      siteRegion: newRecord.location,
      flightDate: newRecord.capturedAt.slice(0, 10),
      droneModel: newRecord.droneModel,
      pilotName: newRecord.inspectorName,
      altitudeM: newRecord.altitudeM,
      windSpeedMs: newRecord.windSpeedMs,
      durationMin: 18,
      photoCount: 1,
      status:
        newRecord.safetyGrade === 'D' || newRecord.safetyGrade === 'E'
          ? '보수 연계'
          : '진단 완료',
      linkedInspectionId: newRecord.id,
    };
    setMissions((prev) => [newMission, ...prev]);
  };

  const handleAcknowledgeAlert = (recordId: string) => {
    setAcknowledgedAlertIds((prev) => (prev.includes(recordId) ? prev : [...prev, recordId]));
  };

  const handleAcknowledgeAllAlerts = () => {
    const allCriticalIds = records
      .filter((r) => r.safetyGrade === 'D' || r.safetyGrade === 'E')
      .map((r) => r.id);
    setAcknowledgedAlertIds((prev) => Array.from(new Set([...prev, ...allCriticalIds])));
  };

  const handleSelectAndInspect = (id: string) => {
    setActiveRecordId(id);
    setActiveView('inspection');
    setIsMobileMenuOpen(false);
  };

  const handleAddMission = (mission: FlightMission) => {
    setMissions((prev) => [mission, ...prev]);
  };

  const currentNavMeta = NAV_ITEMS.find((n) => n.id === activeView) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Left Sidebar Navigation (248px) */}
      <aside className="no-print hidden lg:flex lg:flex-col w-[248px] shrink-0 bg-white border-r border-slate-200">
        <div className="h-14 px-5 flex items-center border-b border-slate-200">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('inspection');
            }}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            에어로인스펙트
          </a>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="주 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'dashboard' && unacknowledgedCriticalCount > 0 && (
                  <span
                    className={`text-xs font-mono-tabular font-semibold ${
                      isActive ? 'text-red-300' : 'text-red-700'
                    }`}
                    title="미확인 D·E등급 경보 건수"
                  >
                    {unacknowledgedCriticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quiet Sidebar Summary Footer */}
        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center justify-between">
            <span>등록 진단 건수</span>
            <span className="font-mono-tabular font-medium text-slate-800">{records.length}건</span>
          </div>
          <div className="flex items-center justify-between">
            <span>D·E등급 중점관리</span>
            <span className="font-mono-tabular font-medium text-red-700">
              {urgentFacilityCount}개소
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/45"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-white border-r border-slate-200 flex flex-col h-full">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                에어로인스펙트
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
                aria-label="메뉴 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Top Header */}
        <header className="no-print h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 rounded"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-medium text-slate-500 truncate">
              {currentNavMeta.breadcrumb}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>새 드론 영상 진단</span>
            </button>
          </div>
        </header>

        {/* Active View Canvas */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeView === 'inspection' && activeRecord && (
            <InspectionWorkbench
              records={records}
              activeRecord={activeRecord}
              onSelectRecord={(id) => setActiveRecordId(id)}
              onUpdateRecord={handleUpdateRecord}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              onOpenReport={() => setActiveView('report')}
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              records={records}
              acknowledgedAlertIds={acknowledgedAlertIds}
              notificationState={notificationState}
              onRequestNotificationPermission={() => void handleRequestNotificationPermission()}
              onTriggerAlertForRecord={triggerCriticalAlert}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onAcknowledgeAllAlerts={handleAcknowledgeAllAlerts}
              onInspectRecord={handleSelectAndInspect}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
            />
          )}

          {activeView === 'missions' && (
            <MissionsView
              missions={missions}
              onAddMission={handleAddMission}
              onInspectLinked={handleSelectAndInspect}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
            />
          )}

          {activeView === 'report' && activeRecord && (
            <ReportView
              records={records}
              activeRecord={activeRecord}
              onSelectRecord={(id) => setActiveRecordId(id)}
            />
          )}
        </main>
      </div>

      {/* Upload & AI Diagnosis Modal */}
      <UploadInspectModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onInspectionCreated={handleInspectionCreated}
      />

      {/* Real-time Browser & In-App Alert Toast Stack for D/E Grades */}
      <AlertToastStack
        alerts={activeToasts}
        onDismiss={(alertId) =>
          setActiveToasts((prev) => prev.filter((item) => item.id !== alertId))
        }
        onInspectRecord={handleSelectAndInspect}
        onOpenDashboard={() => setActiveView('dashboard')}
      />
    </div>
  );
}
