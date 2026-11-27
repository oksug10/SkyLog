import React, { useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import {
  FACILITY_TYPES,
  type FacilityType,
  type InspectionRecord,
} from '../types/inspection';
import { fileToOptimizedDataUrl, imageUrlToBase64 } from '../utils/imageUtils';

const ATTACHED_FIELD_SAMPLES: Array<{
  id: string;
  label: string;
  stageDesc: string;
  imageUrl: string;
  facilityName: string;
  location: string;
  notes: string;
}> = [
  {
    id: 'sample-pier-stage1',
    label: '교각 시계열 1단계',
    stageDesc: '단일 사선 미세 균열',
    imageUrl: '/assets/aistudio/image_82c12d8d.png',
    facilityName: '낙동강 강변교 P-07 교각 (1차)',
    location: '경상남도 김해시 하천횡단 구간',
    notes: '초기 미세 사선 균열 관찰 구간',
  },
  {
    id: 'sample-pier-stage2',
    label: '교각 시계열 2단계',
    stageDesc: '망상 구조 균열 확산',
    imageUrl: '/assets/aistudio/image_c9fdf668.png',
    facilityName: '낙동강 강변교 P-07 교각 (2차)',
    location: '경상남도 김해시 하천횡단 구간',
    notes: '다방향 망상 균열 진전 및 교차 손상 확인',
  },
  {
    id: 'sample-pier-stage3',
    label: '교각 시계열 3단계',
    stageDesc: '관통 균열·철근 노출',
    imageUrl: '/assets/aistudio/image_6878b7c6.png',
    facilityName: '낙동강 강변교 P-07 교각 (3차 긴급)',
    location: '경상남도 김해시 하천횡단 구간',
    notes: '대형 관통 균열, 콘크리트 박락 및 부식 철근 노출 긴급 판독',
  },
];

interface UploadInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInspectionCreated: (record: InspectionRecord) => void;
}

export function UploadInspectModal({
  isOpen,
  onClose,
  onInspectionCreated,
}: UploadInspectModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');

  const [facilityName, setFacilityName] = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>('교량');
  const [location, setLocation] = useState('');
  const [droneModel, setDroneModel] = useState('Matrice 350 RTK');
  const [altitudeM, setAltitudeM] = useState('20.0');
  const [inspectionNotes, setInspectionNotes] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setPreviewDataUrl(null);
    setBase64Data(null);
    setFileName('');
    setFacilityName('');
    setFacilityType('교량');
    setLocation('');
    setAltitudeM('20.0');
    setInspectionNotes('');
    setErrorMsg(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('JPG, PNG, WEBP 형식의 드론 촬영 이미지 파일을 선택해 주세요.');
      return;
    }
    try {
      const optimized = await fileToOptimizedDataUrl(file, 1600);
      setPreviewDataUrl(optimized.dataUrl);
      setBase64Data(optimized.base64);
      setMimeType(optimized.mimeType);
      setFileName(file.name);
      if (!facilityName.trim()) {
        const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        setFacilityName(cleanName.slice(0, 36));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '이미지 처리에 실패했습니다.');
    }
  };

  const handleSelectAttachedSample = async (sample: (typeof ATTACHED_FIELD_SAMPLES)[number]) => {
    setErrorMsg(null);
    try {
      const encoded = await imageUrlToBase64(sample.imageUrl);
      setPreviewDataUrl(sample.imageUrl);
      setBase64Data(encoded.base64);
      setMimeType(encoded.mimeType);
      setFileName(`${sample.label}.png`);
      setFacilityName(sample.facilityName);
      setFacilityType('교량');
      setLocation(sample.location);
      setInspectionNotes(sample.notes);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '첨부 영상을 불러오지 못했습니다.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!base64Data || !previewDataUrl) {
      setErrorMsg('진단할 드론 촬영 이미지를 먼저 업로드해 주세요.');
      return;
    }

    const trimmedName = facilityName.trim() || '신규 점검 시설물';
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          facilityType,
          facilityName: trimmedName,
          inspectionNotes: inspectionNotes.trim(),
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'AI 영상 분석에 실패했습니다.');
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const capturedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const seq = String(Math.floor(500 + Math.random() * 490));

      const newRecord: InspectionRecord = {
        id: `insp-user-${Date.now()}`,
        code: `INS-${now.getFullYear()}-0${seq}`,
        facilityName: trimmedName,
        facilityType,
        location: location.trim() || '현장 업로드 구역',
        capturedAt,
        droneModel: droneModel.trim() || 'Matrice 350 RTK',
        altitudeM: Math.max(1, Number(altitudeM) || 20),
        windSpeedMs: 2.8,
        cameraSpec: '사용자 업로드 드론 영상',
        imageUrl: previewDataUrl,
        mimeType,
        safetyGrade: payload.safetyGrade,
        gradeLabel: payload.gradeLabel,
        summary: payload.summary,
        defects: payload.defects,
        recommendations: payload.recommendations,
        nextFlightGuidance: payload.nextFlightGuidance,
        analyzedAt: payload.analyzedAt || now.toISOString(),
        isLiveAiAnalyzed: true,
        inspectorName: '현장 점검 담당자',
      };

      onInspectionCreated(newRecord);
      resetForm();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI 진단 요청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="upload-modal-title" className="text-base font-semibold text-slate-900">
              새 드론 영상 AI 안전진단
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              드론 촬영 이미지를 업로드하면 AI가 결함 위치와 안전등급(A~E)을 자동 판독합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
            aria-label="창 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Drag & Drop Image Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              드론 촬영 이미지 (JPG · PNG · WEBP)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            {previewDataUrl ? (
              <div className="relative rounded-md border border-slate-200 overflow-hidden bg-slate-900">
                <img
                  src={previewDataUrl}
                  alt="업로드된 드론 영상 미리보기"
                  className="w-full max-h-60 object-contain mx-auto"
                />
                <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-slate-200 text-xs">
                  <span className="text-slate-700 truncate max-w-[340px]">{fileName}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="text-blue-700 font-medium hover:text-blue-800 whitespace-nowrap cursor-pointer"
                  >
                    이미지 변경
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`w-full py-10 px-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
                }`}
              >
                <ImagePlus className="w-7 h-7 text-slate-400 mb-2.5" />
                <p className="text-sm font-medium text-slate-800">
                  드론 이미지를 드래그하거나 클릭하여 선택하세요
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  교량 교각, 건축물 외벽, 태양광 패널, 풍력 블레이드 등 고해상도 사진 권장
                </p>
              </button>
            )}

            {/* Quick-select attached field bridge pier inspection images */}
            <div className="mt-3">
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                첨부된 현장 교각 드론 영상으로 바로 테스트
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ATTACHED_FIELD_SAMPLES.map((sample) => {
                  const isPicked = previewDataUrl === sample.imageUrl;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleSelectAttachedSample(sample)}
                      className={`text-left rounded border overflow-hidden transition-colors cursor-pointer ${
                        isPicked
                          ? 'border-blue-700 ring-1 ring-blue-700 bg-blue-50/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                        <img
                          src={sample.imageUrl}
                          alt={`${sample.label} — ${sample.stageDesc}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-medium text-slate-900 truncate">
                          {sample.label}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">{sample.stageDesc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Facility Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="facility-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                시설물명
              </label>
              <input
                id="facility-name"
                type="text"
                required
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="예: 올림픽대교 P-12 교각"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="facility-type"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                시설물 유형
              </label>
              <select
                id="facility-type"
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value as FacilityType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              >
                {FACILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="facility-location"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                현장 위치
              </label>
              <input
                id="facility-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 서울 송파구 풍납동 구간"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="drone-model"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  드론 기체
                </label>
                <input
                  id="drone-model"
                  type="text"
                  value={droneModel}
                  onChange={(e) => setDroneModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>
              <div>
                <label
                  htmlFor="altitude-m"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  촬영 고도 (m)
                </label>
                <input
                  id="altitude-m"
                  type="number"
                  step="0.1"
                  min="1"
                  max="500"
                  value={altitudeM}
                  onChange={(e) => setAltitudeM(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="inspection-notes"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              현장 특이사항 (선택)
            </label>
            <textarea
              id="inspection-notes"
              rows={2}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder="예: 최근 집중호우 이후 누수 민원 접수, 상부 균열 집중 판독 요청"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !base64Data}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI 결함 판독 중...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>AI 안전진단 시작</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
