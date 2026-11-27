export type SafetyGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export type FacilityType = '교량' | '건축물' | '태양광' | '풍력' | '송전·플랜트' | '기타';

export type SeverityLevel = '경미' | '주의' | '심각' | '긴급';

export type DefectReviewStatus = 'pending' | 'verified' | 'dismissed';

export interface DefectItem {
  id: string;
  type: string;
  severity: SeverityLevel;
  locationDesc: string;
  estimatedSize: string;
  confidence: number;
  description: string;
  /** Normalized [ymin, xmin, ymax, xmax] on 0..1000 scale */
  box2d: [number, number, number, number];
  status: DefectReviewStatus;
}

export interface RepairRecommendation {
  id: string;
  priority: '즉시 조치' | '단기 보수' | '정기 추적';
  title: string;
  method: string;
  timeframe: string;
}

export interface QaExchange {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

export interface InspectionRecord {
  id: string;
  code: string;
  facilityName: string;
  facilityType: FacilityType;
  location: string;
  capturedAt: string;
  droneModel: string;
  altitudeM: number;
  windSpeedMs: number;
  cameraSpec: string;
  imageUrl: string;
  mimeType: string;
  safetyGrade: SafetyGrade;
  gradeLabel: string;
  summary: string;
  defects: DefectItem[];
  recommendations: RepairRecommendation[];
  nextFlightGuidance: string;
  analyzedAt: string;
  isLiveAiAnalyzed: boolean;
  inspectorName: string;
  qaHistory?: QaExchange[];
}

export interface FlightMission {
  id: string;
  missionCode: string;
  facilityName: string;
  facilityType: FacilityType;
  siteRegion: string;
  flightDate: string;
  droneModel: string;
  pilotName: string;
  altitudeM: number;
  windSpeedMs: number;
  durationMin: number;
  photoCount: number;
  status: '진단 완료' | '검토 중' | '보수 연계';
  linkedInspectionId?: string;
}

export const GRADE_META: Record<
  SafetyGrade,
  {
    label: string;
    shortDesc: string;
    criteria: string;
    textClass: string;
    surfaceClass: string;
    borderClass: string;
    barColor: string;
  }
> = {
  A: {
    label: '우수',
    shortDesc: '문제점이 없는 최상의 상태',
    criteria: '주요 부재에 결함이 없으며 구조적 안전성이 최상인 상태',
    textClass: 'text-emerald-700',
    surfaceClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    barColor: '#16A34A',
  },
  B: {
    label: '양호',
    shortDesc: '보조 부재 경미한 결함',
    criteria: '보조 부재에 경미한 결함이 발생했으나 기능 발휘에 지장이 없는 상태',
    textClass: 'text-emerald-700',
    surfaceClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    barColor: '#22C55E',
  },
  C: {
    label: '보통',
    shortDesc: '보조 부재 광범위 결함 또는 주요 부재 경미 결함',
    criteria: '전체적인 시설물 안전에는 지장이 없으나 내구성·기능성 저하 방지를 위한 보수 필요',
    textClass: 'text-amber-700',
    surfaceClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    barColor: '#D97706',
  },
  D: {
    label: '미흡',
    shortDesc: '주요 부재 결함 발생 · 긴급 보수 필요',
    criteria: '주요 부재에 결함이 발생하여 긴급 보수·보강이 필요하며 사용제한 여부 결정 필요',
    textClass: 'text-red-700',
    surfaceClass: 'bg-red-50',
    borderClass: 'border-red-200',
    barColor: '#DC2626',
  },
  E: {
    label: '불량',
    shortDesc: '주요 부재 심각한 결함 · 즉각 사용 금지',
    criteria: '시설물의 안전에 위험이 있어 즉각 사용을 금지하고 보강 또는 개축을 실시해야 하는 상태',
    textClass: 'text-red-800',
    surfaceClass: 'bg-red-100',
    borderClass: 'border-red-300',
    barColor: '#991B1B',
  },
};

export const SEVERITY_META: Record<
  SeverityLevel,
  {
    textClass: string;
    borderColor: string;
    fillRgba: string;
    badgeBg: string;
    rank: number;
  }
> = {
  긴급: {
    textClass: 'text-red-800',
    borderColor: '#DC2626',
    fillRgba: 'rgba(220, 38, 38, 0.14)',
    badgeBg: '#B91C1C',
    rank: 4,
  },
  심각: {
    textClass: 'text-red-700',
    borderColor: '#EA580C',
    fillRgba: 'rgba(234, 88, 12, 0.14)',
    badgeBg: '#C2410C',
    rank: 3,
  },
  주의: {
    textClass: 'text-amber-700',
    borderColor: '#D97706',
    fillRgba: 'rgba(217, 119, 6, 0.14)',
    badgeBg: '#B45309',
    rank: 2,
  },
  경미: {
    textClass: 'text-emerald-700',
    borderColor: '#16A34A',
    fillRgba: 'rgba(22, 163, 74, 0.14)',
    badgeBg: '#15803D',
    rank: 1,
  },
};

export const FACILITY_TYPES: FacilityType[] = ['교량', '건축물', '태양광', '풍력', '송전·플랜트', '기타'];
