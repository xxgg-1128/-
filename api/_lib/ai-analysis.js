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
const DEFAULT_QWEN_MODEL = process.env.QWEN_ANALYSIS_MODEL || 'qwen-vl-max';
const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;
const ANALYSIS_PROMPT_LINES = [
  '你是 DesignRef 的 UI 截图分析助手。',
  '请分析这张竞品截图。',
  '输出必须是中文，聚焦页面结构、行业、端类型、视觉风格、关键组件、可复用设计模式。',
  '标签要短，适合后续筛选和 Prompt 生成。',
  '优先从已有标签库中选择标签；只有标签库确实没有合适选项时，才创建新的短标签。',
  '只输出 JSON，不要 Markdown，不要解释。',
];
const TAG_SYNONYMS = {
  pageTypes: {
    工作台首页: ['仪表盘', '控制台', '后台首页', '后台工作台', 'Dashboard', 'dashboard'],
    管理后台: ['后台管理', '管理系统', 'Admin', 'admin'],
    登录页: ['登陆页', '登录界面'],
    落地页: ['官网首页', '营销页', 'Landing Page', 'landing page'],
  },
  industries: {
    SaaS: ['企业服务', 'B端', 'B 端', '软件服务', 'ToB', 'to b'],
    电商: ['购物', '商城', '零售'],
    'AI 工具': ['AIGC', '人工智能', 'AI产品', 'AI 产品'],
  },
  deviceTypes: {
    Web: ['网页端', '桌面端', 'PC', 'pc', '浏览器'],
    App: ['移动端', '手机端', 'iOS', 'Android'],
    小程序: ['微信小程序', 'Mini Program', 'mini program'],
  },
  styleTags: {
    卡片化: ['卡片布局', '卡片式', '卡片设计'],
    信息层级清晰: ['清晰层级', '层级清晰', '信息清晰', '结构清晰'],
    极简: ['简洁', '简约', '极简风'],
    数据可视化: ['图表', '数据图表', '可视化'],
  },
  componentTags: {
    导航栏: ['顶部导航', '侧边导航', '侧边栏', '导航菜单'],
    数据卡片: ['统计卡', '指标卡', '数据概览卡', 'KPI卡片', 'KPI 卡片'],
    搜索框: ['搜索栏', '检索框'],
    状态标签: ['状态徽标', '状态标记', 'Badge', 'badge'],
    表格: ['数据表', '列表表格'],
  },
};

function compactStrings(items = []) {
  return Array.from(new Set(items.map((item) => String(item ?? '').trim()).filter(Boolean)));
}

function normalizeString(value, fallback) {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeComparable(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-·/]+/g, '');
}

function compactLibraryGroup(library = {}, groupKey) {
  return compactStrings(library[groupKey] ?? []);
}

function canonicalTagForCandidate(groupKey, candidate) {
  const comparableCandidate = normalizeComparable(candidate);
  const synonyms = TAG_SYNONYMS[groupKey] ?? {};
  return Object.entries(synonyms).find(([canonical, aliases]) => {
    const comparableCanonical = normalizeComparable(canonical);
    return (
      comparableCandidate === comparableCanonical ||
      aliases.some((alias) => normalizeComparable(alias) === comparableCandidate)
    );
  })?.[0];
}

function matchLibraryTag(groupKey, candidate, tagLibrary = {}, fallback) {
  const normalizedCandidate = normalizeString(candidate, fallback);
  const library = compactLibraryGroup(tagLibrary, groupKey);
  const comparableCandidate = normalizeComparable(normalizedCandidate);
  const canonical = canonicalTagForCandidate(groupKey, normalizedCandidate);
  const comparableCanonical = normalizeComparable(canonical);

  return (
    library.find((tag) => normalizeComparable(tag) === comparableCandidate) ??
    library.find((tag) => canonical && normalizeComparable(tag) === comparableCanonical) ??
    library.find((tag) => {
      const comparableTag = normalizeComparable(tag);
      return comparableCandidate.includes(comparableTag) || comparableTag.includes(comparableCandidate);
    }) ??
    canonical ??
    normalizedCandidate
  );
}

function matchLibraryTags(groupKey, tags = [], tagLibrary = {}) {
  return compactStrings(tags.map((tag) => matchLibraryTag(groupKey, tag, tagLibrary, '')).filter(Boolean));
}

function formatTagLibraryForPrompt(tagLibrary = {}) {
  const groups = [
    ['pageTypes', '页面标签'],
    ['industries', '行业标签'],
    ['deviceTypes', '端类型标签'],
    ['styleTags', '风格标签'],
    ['componentTags', '组件标签'],
    ['userTags', '用户标签'],
  ];
  const lines = groups
    .map(([key, label]) => {
      const tags = compactLibraryGroup(tagLibrary, key);
      return tags.length ? `${label}: ${tags.join('、')}` : '';
    })
    .filter(Boolean);

  if (!lines.length) return '';
  return ['已有标签库如下，请优先从已有标签库中选择:', ...lines].join('\n');
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

export function normalizeAnalysisResult(result = {}, tagLibrary = {}) {
  return {
    pageType: matchLibraryTag('pageTypes', result.pageType, tagLibrary, '未分类页面'),
    industry: matchLibraryTag('industries', result.industry, tagLibrary, '未分类行业'),
    deviceType: matchLibraryTag('deviceTypes', result.deviceType, tagLibrary, 'Web'),
    styleTags: matchLibraryTags('styleTags', result.styleTags, tagLibrary),
    componentTags: matchLibraryTags('componentTags', result.componentTags, tagLibrary),
    layoutSummary: normalizeString(result.layoutSummary, '暂无页面结构分析。'),
    aiSummary: normalizeString(result.aiSummary, '暂无 AI 分析。'),
    designHighlights: compactStrings(result.designHighlights),
    reusableSuggestions: compactStrings(result.reusableSuggestions),
  };
}

export function buildAnalyzeImageRequest({ fileName, dataUrl, tagLibrary }) {
  const tagLibraryPrompt = formatTagLibraryForPrompt(tagLibrary);
  return {
    model: DEFAULT_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              ANALYSIS_PROMPT_LINES[0],
              `请分析这张竞品截图，文件名：${fileName || '未命名图片'}。`,
              ...ANALYSIS_PROMPT_LINES.slice(2),
              tagLibraryPrompt,
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

export function buildQwenAnalyzeImageRequest({ fileName, dataUrl, tagLibrary }) {
  const tagLibraryPrompt = formatTagLibraryForPrompt(tagLibrary);
  return {
    model: DEFAULT_QWEN_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              ANALYSIS_PROMPT_LINES[0],
              `请分析这张竞品截图，文件名：${fileName || '未命名图片'}。`,
              ...ANALYSIS_PROMPT_LINES.slice(2),
              tagLibraryPrompt,
              `JSON 字段必须包含：${ANALYSIS_JSON_SCHEMA.required.join('、')}。`,
            ].join('\n'),
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrlToImageInput(dataUrl).image_url,
            },
          },
        ],
      },
    ],
    response_format: {
      type: 'json_object',
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

export function extractQwenResponseText(qwenResponse = {}) {
  return qwenResponse.choices?.[0]?.message?.content ?? '';
}
