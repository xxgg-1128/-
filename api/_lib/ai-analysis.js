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
const MAX_ANALYZE_IMAGE_BYTES = 4 * 1024 * 1024;
const ANALYSIS_PROMPT_LINES = [
  '你是 DesignRef 的视觉素材分析助手。',
  '请分析这张图片。',
  '第一步：仔细观察这张图究竟画的是什么（可能是完整页面、某个模块、单个图标、插画、3D 素材或组件），description 要具体到画面里真实出现的物体、文字、图形和配色，禁止套用与画面无关的通用描述。',
  '第二步：基于你观察到的真实内容输出标签。不同的图片必须给出不同的、贴合各自画面的标签，严禁对不同图片输出雷同的标签组合。',
  '若图片是单个图标/插画/3D 素材而非完整页面：pageType 用「图标」「插画」「3D 素材」等贴切描述；deviceType 若无法判断填「通用」；不要凭空编造它属于某个页面或行业。',
  '输出必须是中文，标签要短且精准，能反映这张图与其它图的差异，适合后续筛选和 Prompt 生成。',
  '已有标签库仅供风格统一参考；只要能更准确描述画面，可以自由创建新的短标签，不要为了对齐标签库而牺牲准确性。',
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

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  // AI 有时会把数组字段返回成字符串（可能用逗号/顿号/分号分隔）
  if (typeof value === 'string') {
    return value.split(/[,，、;；\n]/).map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function compactStrings(items = []) {
  return Array.from(new Set(toArray(items).map((item) => String(item ?? '').trim()).filter(Boolean)));
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
    canonical ??
    normalizedCandidate
  );
}

function matchLibraryTags(groupKey, tags = [], tagLibrary = {}) {
  return compactStrings(toArray(tags).map((tag) => matchLibraryTag(groupKey, tag, tagLibrary, '')).filter(Boolean));
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
  return ['已有标签库（仅供风格参考，可创建更贴合画面的新标签）:', ...lines].join('\n');
}

export function dataUrlToImageInput(dataUrl) {
  if (!IMAGE_DATA_URL_PATTERN.test(String(dataUrl ?? ''))) {
    throw new Error('仅支持图片 data URL');
  }

  const base64 = String(dataUrl).split(',')[1] ?? '';
  if (!base64) {
    throw new Error('图片数据为空或不完整，请重新上传');
  }

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_ANALYZE_IMAGE_BYTES) {
    throw new Error('图片过大，请压缩后重试（建议 4MB 以内）');
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
              `请分析这张图片，文件名：${fileName || '未命名图片'}。`,
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
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content: '你是 DesignRef 的视觉素材分析助手。只输出合法 JSON，不要 Markdown 格式，不要解释，不要添加任何多余文字。',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: dataUrlToImageInput(dataUrl).image_url,
            },
          },
          {
            type: 'text',
            text: [
              `请分析这张图片，文件名：${fileName || '未命名图片'}。`,
              '第一步：仔细观察这张图究竟画的是什么（可能是完整页面、某个模块、单个图标、插画、3D 素材或组件），描述要具体到画面里真实出现的物体、文字、图形和配色，禁止套用与画面无关的通用描述。',
              '第二步：基于观察到的真实内容输出标签。不同的图片必须给出不同的、贴合各自画面的标签，严禁对不同图片输出雷同的标签组合。',
              '若图片是单个图标/插画/3D 素材而非完整页面：pageType 用「图标」「插画」「3D 素材」等贴切描述；deviceType 若无法判断填「通用」；不要凭空编造它属于某个页面或行业。',
              '输出必须是中文，标签要短且精准，能反映这张图与其它图的差异，适合后续筛选和 Prompt 生成。',
              '已有标签库仅供风格统一参考；只要能更准确描述画面，可以自由创建新的短标签，不要为了对齐标签库而牺牲准确性。',
              tagLibraryPrompt,
              `JSON 字段必须包含：${ANALYSIS_JSON_SCHEMA.required.join('、')}。`,
              '只返回纯 JSON 对象，不要用 ```json 包裹，不要有其他文字。',
            ].filter(Boolean).join('\n'),
          },
        ],
      },
    ],
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
  const content = qwenResponse.choices?.[0]?.message?.content ?? '';
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part.text ?? ''))
      .join('');
  }
  return String(content);
}

export function parseAnalysisJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new Error('AI 没有返回可解析的分析结果');

  try {
    return JSON.parse(raw);
  } catch (error) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) return JSON.parse(fenced);

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }

    throw new Error(`AI 返回内容不是有效 JSON: ${raw.slice(0, 120)}`);
  }
}
