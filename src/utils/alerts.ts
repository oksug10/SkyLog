import { GRADE_META, type InspectionRecord } from '../types/inspection';

export type BrowserNotificationState = NotificationPermission | 'unsupported';

export interface SafetyAlertItem {
  id: string;
  recordId: string;
  code: string;
  facilityName: string;
  facilityType: string;
  safetyGrade: 'D' | 'E';
  gradeLabel: string;
  defectCount: number;
  summary: string;
  createdAt: string;
  browserNotified: boolean;
}

export function getBrowserNotificationState(): BrowserNotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission;
  }
}

/**
 * Play a short, restrained two-tone engineering alert chime using Web Audio API.
 * Fails silently if browser autoplay policy restricts audio before gesture.
 */
export function playCriticalAlertChime(grade: 'D' | 'E'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const freqs = grade === 'E' ? [880, 660, 880] : [740, 587];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.13);
    });

    window.setTimeout(() => {
      void ctx.close();
    }, 650);
  } catch {
    // Ignore audio context restrictions
  }
}

/**
 * Dispatch a browser-native Notification when a D or E safety grade facility is recorded.
 * Returns true if the native browser Notification was successfully dispatched.
 */
export function sendCriticalGradeBrowserAlert(
  record: InspectionRecord,
  onClickFocus?: () => void,
): boolean {
  if (record.safetyGrade !== 'D' && record.safetyGrade !== 'E') {
    return false;
  }

  playCriticalAlertChime(record.safetyGrade);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    const gradeMeta = GRADE_META[record.safetyGrade];
    const activeDefects = record.defects.filter((d) => d.status !== 'dismissed').length;
    const title = `[${record.safetyGrade}등급 · ${gradeMeta.label}] 드론 안전진단 긴급 경보`;
    const body = `${record.facilityName} (${record.facilityType}) — 유효 결함 ${activeDefects}건 검출. ${gradeMeta.shortDesc}`;

    const notification = new window.Notification(title, {
      body,
      tag: `safety-alert-${record.id}`,
      requireInteraction: record.safetyGrade === 'E',
    });

    notification.onclick = () => {
      window.focus();
      onClickFocus?.();
      notification.close();
    };

    return true;
  } catch {
    return false;
  }
}
