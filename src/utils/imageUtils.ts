import type { InspectionRecord } from '../types/inspection';

/**
 * Resize large uploaded drone images client-side (max 1600px) to keep
 * base64 upload payloads fast while preserving crisp crack & surface detail.
 */
export async function fileToOptimizedDataUrl(
  file: File,
  maxDimension = 1600,
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('지원하지 않는 이미지 형식입니다.'));
    image.src = rawDataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const [, b64 = ''] = rawDataUrl.split(',');
    return { dataUrl: rawDataUrl, base64: b64, mimeType: file.type || 'image/jpeg' };
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const optimizedUrl = canvas.toDataURL(outputMime, 0.88);
  const [, base64 = ''] = optimizedUrl.split(',');
  return { dataUrl: optimizedUrl, base64, mimeType: outputMime };
}

/**
 * Fetch an existing image URL (data URL or /src/assets/images/...) and return base64 + mimeType
 * so any loaded inspection record can be sent to /api/inspect or /api/ask.
 */
export async function imageUrlToBase64(
  imageUrl: string,
): Promise<{ base64: string; mimeType: string }> {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error('원본 드론 영상을 불러오지 못했습니다.');
  }
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('이미지 인코딩에 실패했습니다.'));
    reader.readAsDataURL(blob);
  });
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('이미지 데이터 형식이 올바르지 않습니다.');
  }
  return { mimeType: match[1], base64: match[2] };
}

export function downloadInspectionCsv(record: InspectionRecord): void {
  const headers = [
    '진단코드',
    '시설물명',
    '시설유형',
    '안전등급',
    '결함번호',
    '결함유형',
    '심각도',
    '위치',
    '추정규격',
    '신뢰도(%)',
    '검토상태',
    '상세설명',
  ];

  const statusLabel = (s: string) =>
    s === 'verified' ? '검토완료' : s === 'dismissed' ? '오탐제외' : '미검토';

  const rows = record.defects.map((d, idx) => [
    record.code,
    record.facilityName,
    record.facilityType,
    `${record.safetyGrade}등급(${record.gradeLabel})`,
    `#${idx + 1}`,
    d.type,
    d.severity,
    d.locationDesc,
    d.estimatedSize,
    String(d.confidence),
    statusLabel(d.status),
    d.description,
  ]);

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csvContent =
    '\uFEFF' + [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.code}_결함내역.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadInspectionJson(record: InspectionRecord): void {
  const exportObj = {
    ...record,
    imageUrl: record.imageUrl.startsWith('data:') ? '[uploaded-image-omitted]' : record.imageUrl,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.code}_안전진단리포트.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
