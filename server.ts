import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_ID = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw === 'GEMINI_API_KEY_MISSING') {
    return {
      status: 503,
      message:
        'AI 진단 엔진의 API 키가 설정되지 않았습니다. Settings > Secrets 패널에서 GEMINI_API_KEY를 확인해 주세요.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message:
        'API 키 인증에 실패했습니다. Settings > Secrets 패널에서 유효한 GEMINI_API_KEY를 확인해 주세요.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: '현재 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 API 요금제 한도를 확인해 주세요.',
    };
  }
  return {
    status: 500,
    message: `AI 영상 분석 중 오류가 발생했습니다: ${raw.slice(0, 180)}`,
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = msg.includes('503') || msg.includes('500') || msg.includes('UNAVAILABLE');
      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

const inspectionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    safetyGrade: {
      type: Type.STRING,
      description: '국토교통부 시설물 안전등급 기준: A, B, C, D, E 중 하나',
    },
    gradeLabel: {
      type: Type.STRING,
      description: '등급 한국어 명칭: 우수(A), 양호(B), 보통(C), 미흡(D), 불량(E)',
    },
    summary: {
      type: Type.STRING,
      description: '시설물 전반의 구조적 상태와 주요 손상 원인을 요약한 2~3문장의 한국어 전문 진단 소견',
    },
    defects: {
      type: Type.ARRAY,
      description: '영상에서 육안으로 확인되는 구체적 결함 목록 (최대 6건)',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description:
              '결함 유형 (예: 구조 균열, 콘크리트 박락, 철근 노출, 백태 및 누수, 실란트 열화, 도장 박리, 유리 파손 및 핫스팟, 낙뢰 탄화 손상, 전연부 침식 등)',
          },
          severity: {
            type: Type.STRING,
            description: '심각도: 경미, 주의, 심각, 긴급 중 하나',
          },
          locationDesc: {
            type: Type.STRING,
            description: '영상 내 결함 위치 설명 (예: 교각 우측 중앙부, 창대 하부 중앙, 패널 4열 중단부)',
          },
          estimatedSize: {
            type: Type.STRING,
            description: '추정 규격 또는 범위 (예: 폭 0.5mm · 길이 620mm, 면적 약 0.45m²)',
          },
          confidence: {
            type: Type.INTEGER,
            description: '검출 신뢰도 (50~99 사이 정수)',
          },
          description: {
            type: Type.STRING,
            description: '결함의 공학적 특징, 진행 위험성 및 추정 원인 (1~2문장)',
          },
          box2d: {
            type: Type.ARRAY,
            description:
              '결함 영역 바운딩 박스 [ymin, xmin, ymax, xmax] (0~1000 정규화 정수 좌표, 이미지 내 실제 결함 위치에 정확히 맞출 것)',
            items: {
              type: Type.INTEGER,
            },
          },
        },
        required: ['type', 'severity', 'locationDesc', 'estimatedSize', 'confidence', 'description', 'box2d'],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      description: '우선순위별 보수·보강 조치 권고안 (2~4건)',
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            description: '우선순위: 즉시 조치, 단기 보수, 정기 추적 중 하나',
          },
          title: {
            type: Type.STRING,
            description: '조치 항목 제목',
          },
          method: {
            type: Type.STRING,
            description: '구체적인 공법 및 현장 조치 방법',
          },
          timeframe: {
            type: Type.STRING,
            description: '권장 이행 기한 (예: 72시간 이내, 30일 이내, 반기별 정밀점검)',
          },
        },
        required: ['priority', 'title', 'method', 'timeframe'],
      },
    },
    nextFlightGuidance: {
      type: Type.STRING,
      description: '추후 드론 재촬영 시 권장 고도, 촬영 각도, 열화상/광학 줌 활용 등 현장 비행 가이드 (1~2문장)',
    },
  },
  required: ['safetyGrade', 'gradeLabel', 'summary', 'defects', 'recommendations', 'nextFlightGuidance'],
};

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL_ID });
  });

  app.post('/api/inspect', async (req, res) => {
    try {
      const { imageBase64, mimeType, facilityType, facilityName, inspectionNotes } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        facilityType?: string;
        facilityName?: string;
        inspectionNotes?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: '분석할 드론 영상 이미지 데이터가 필요합니다.' });
        return;
      }

      const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
      const safeMime = mimeType && allowedMime.includes(mimeType) ? mimeType : 'image/jpeg';

      const ai = getAiClient();

      const systemInstruction = [
        '당신은 대한민국 국토교통부 시설물 안전 및 유지관리 기준(A~E등급)에 정통한 드론 구조안전진단 수석 기술사입니다.',
        '제공된 드론 촬영 이미지를 정밀 판독하여 실제 이미지에 보이는 균열, 콘크리트 박리/박락, 철근 노출, 누수/백태, 실란트 열화, 도장 손상, 태양광 모듈 파손/핫스팟, 풍력 블레이드 낙뢰 손상/침식 등 결함을 정확히 검출하십시오.',
        '각 결함의 box2d 좌표 [ymin, xmin, ymax, xmax]는 0에서 1000 사이의 정수로 이미지 상의 실제 결함 영역을 정밀하게 감싸도록 지정하십시오.',
        '과장된 허위 결함을 지어내지 말고, 이미지에서 객관적으로 관측되는 손상에 근거해 안전등급(A: 우수, B: 양호, C: 보통, D: 미흡, E: 불량)을 판정하십시오.',
        '모든 응답 텍스트는 간결하고 정확한 한국어 공학 용어로 작성하십시오.',
      ].join(' ');

      const prompt = [
        `시설물명: ${facilityName || '미지정 시설물'}`,
        `시설물 유형: ${facilityType || '일반 구조물'}`,
        inspectionNotes ? `현장 특이사항: ${inspectionNotes}` : '',
        '위 드론 촬영 영상을 정밀 분석하여 안전등급, 결함별 위치 좌표(box2d), 심각도, 공학적 원인 및 보수·보강 권고안을 JSON 스키마에 맞춰 반환하십시오.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_ID,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: safeMime,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: inspectionResponseSchema,
          },
        }),
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI 분석 결과가 비어 있습니다. 다시 시도해 주세요.' });
        return;
      }

      const parsed = JSON.parse(rawText);

      const validGrades = ['A', 'B', 'C', 'D', 'E'];
      const gradeMap: Record<string, string> = {
        A: '우수',
        B: '양호',
        C: '보통',
        D: '미흡',
        E: '불량',
      };
      const safetyGrade = validGrades.includes(parsed.safetyGrade) ? parsed.safetyGrade : 'C';

      const normalizedDefects = Array.isArray(parsed.defects)
        ? parsed.defects.map((d: Record<string, unknown>, idx: number) => {
            const rawBox = Array.isArray(d.box2d) ? d.box2d : [200, 200, 500, 500];
            const clamp = (v: unknown, fallback: number) => {
              const n = Number(v);
              if (Number.isNaN(n)) return fallback;
              return Math.max(0, Math.min(1000, Math.round(n)));
            };
            let ymin = clamp(rawBox[0], 200);
            let xmin = clamp(rawBox[1], 200);
            let ymax = clamp(rawBox[2], 500);
            let xmax = clamp(rawBox[3], 500);
            if (ymax <= ymin) ymax = Math.min(1000, ymin + 120);
            if (xmax <= xmin) xmax = Math.min(1000, xmin + 120);

            const validSev = ['경미', '주의', '심각', '긴급'];
            const severity = typeof d.severity === 'string' && validSev.includes(d.severity) ? d.severity : '주의';

            return {
              id: `def-${Date.now()}-${idx + 1}`,
              type: String(d.type || '표면 결함'),
              severity,
              locationDesc: String(d.locationDesc || '주요 점검 부위'),
              estimatedSize: String(d.estimatedSize || '정밀 실측 필요'),
              confidence: Math.max(50, Math.min(99, Math.round(Number(d.confidence) || 85))),
              description: String(d.description || '육안 확인이 필요한 표면 손상 징후가 관측되었습니다.'),
              box2d: [ymin, xmin, ymax, xmax] as [number, number, number, number],
              status: 'pending' as const,
            };
          })
        : [];

      const normalizedRecs = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r: Record<string, unknown>, idx: number) => {
            const validPriorities = ['즉시 조치', '단기 보수', '정기 추적'];
            const priority =
              typeof r.priority === 'string' && validPriorities.includes(r.priority) ? r.priority : '단기 보수';
            return {
              id: `rec-${Date.now()}-${idx + 1}`,
              priority,
              title: String(r.title || '정밀 보수 조치'),
              method: String(r.method || '현장 실측 후 표준 보수 공법 적용'),
              timeframe: String(r.timeframe || '30일 이내'),
            };
          })
        : [];

      res.json({
        safetyGrade,
        gradeLabel: gradeMap[safetyGrade],
        summary: String(parsed.summary || '드론 영상 기반 AI 정밀 진단이 완료되었습니다.'),
        defects: normalizedDefects,
        recommendations: normalizedRecs,
        nextFlightGuidance: String(
          parsed.nextFlightGuidance || '손상 부위 근접 광학 줌 재촬영 및 정기 변화 추적 비행을 권장합니다.',
        ),
        analyzedAt: new Date().toISOString(),
        modelUsed: MODEL_ID,
      });
    } catch (err) {
      const { status, message } = classifyGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ask', async (req, res) => {
    try {
      const { imageBase64, mimeType, question, inspectionContext } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        question?: string;
        inspectionContext?: string;
      };

      if (!question || !question.trim()) {
        res.status(400).json({ error: '질문 내용을 입력해 주세요.' });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (imageBase64 && typeof imageBase64 === 'string') {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: imageBase64,
          },
        });
      }

      parts.push({
        text: [
          '현재 검토 중인 드론 안전진단 정보:',
          inspectionContext || '(정보 없음)',
          '',
          `현장 엔지니어 질문: ${question.trim()}`,
          '',
          '위 드론 영상과 진단 내용을 바탕으로 실무 안전진단 기술사 관점에서 구체적이고 명료하게 한국어로 답변하십시오. 불필요한 서론 없이 핵심 공학적 판단, 기준치, 권장 조치를 4~6줄 이내로 정리하십시오.',
        ].join('\n'),
      });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_ID,
          contents: { parts },
        }),
      );

      const answer = (response.text ?? '').trim();
      if (!answer) {
        res.status(502).json({ error: 'AI 답변을 생성하지 못했습니다. 다시 시도해 주세요.' });
        return;
      }

      res.json({ answer });
    } catch (err) {
      const { status, message } = classifyGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AeroInspect server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp();
