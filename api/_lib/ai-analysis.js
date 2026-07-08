export const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'pageType',
    'industry',
    'deviceType',
    'styleTags',
    'componentTags',
    'layoutSummary',
    'aiSummary',
    'designHighlights',
    'reusableSuggestions',
  ],
  properties: {
    pageType: { type: 'string' },
    industry: { type: 'string' },
    deviceType: { type: 'string' },
    styleTags: { type: 'array', items: { type: 'string' } },
    componentTags: { type: 'array', items: { type: 'string' } },
    layoutSummary: { type: 'string' },
    aiSummary: { type: 'string' },
    designHighlights: { type: 'array', items: { type: 'string' } },
    reusableSuggestions: { type: 'array', items: { type: 'string' } },
  },
};

const DEFAULT_MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini';
const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;

function compactStrings(items = []) {
  return Array.from(new Set(items.map((item) => String(item ?? '').trim()).filter(Boolean)));
}

function normalizeString(value, fallback) {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

export function dataUrlToImageInput(dataUrl) {
  if (!IMAGE_DATA_URL_PATTERN.test(String(dataUrl ?? ''))) {
    throw new Error('仅支持图片 data URL');
  }

  return {
    type: 'input_image',
    image_url: dataUrl,
  };
}

export function normalizeAnalysisResult(result = {}) {
  return {
    pageType: normalizeString(result.pageType, '未分类页面'),
    industry: normalizeString(result.industry, '未分类行业'),
    deviceType: normalizeString(result.deviceType, 'Web'),
    styleTags: compactStrings(result.styleTags),
    componentTags: compactStrings(result.componentTags),
    layoutSummary: normalizeString(result.layoutSummary, '暂无页面结构分析。'),
    aiSummary: normalizeString(result.aiSummary, '暂无 AI 分析。'),
    designHighlights: compactStrings(result.designHighlights),
    reusableSuggestions: compactStrings(result.reusableSuggestions),
  };
}

export function buildAnalyzeImageRequest({ fileName, dataUrl }) {
  return {
    model: DEFAULT_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              '你是 DesignRef 的 UI 截图分析助手。',
              `请分析这张竞品截图，文件名：${fileName || '未命名图片'}。`,
              '输出必须是中文，聚焦页面结构、行业、端类型、视觉风格、关键组件、可复用设计模式。',
              '标签要短，适合后续筛选和 Prompt 生成。',
            ].join('\n'),
          },
          dataUrlToImageInput(dataUrl),
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'designref_image_analysis',
        strict: true,
        schema: ANALYSIS_JSON_SCHEMA,
      },
    },
  };
}

export function extractResponseText(openaiResponse = {}) {
  if (typeof openaiResponse.output_text === 'string') return openaiResponse.output_text;

  const textParts = (openaiResponse.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text);

  return textParts.join('\n');
}
