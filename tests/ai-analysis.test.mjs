import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYSIS_JSON_SCHEMA,
  buildAnalyzeImageRequest,
  buildQwenAnalyzeImageRequest,
  dataUrlToImageInput,
  extractQwenResponseText,
  normalizeAnalysisResult,
} from '../api/_lib/ai-analysis.js';

test('dataUrlToImageInput accepts supported image data URLs', () => {
  const input = dataUrlToImageInput('data:image/png;base64,abc123');

  assert.equal(input.type, 'input_image');
  assert.equal(input.image_url, 'data:image/png;base64,abc123');
});

test('dataUrlToImageInput rejects non-image data URLs', () => {
  assert.throws(() => dataUrlToImageInput('data:text/plain;base64,abc123'), /仅支持图片 data URL/);
});

test('normalizeAnalysisResult fills arrays and required text fields', () => {
  const normalized = normalizeAnalysisResult({
    pageType: '工作台首页',
    industry: 'SaaS',
    deviceType: 'Web',
    styleTags: ['卡片化', '卡片化', ''],
    componentTags: ['导航栏'],
    layoutSummary: '模块清晰',
    aiSummary: '适合作为工作台参考',
    designHighlights: ['信息前置'],
    reusableSuggestions: ['复用卡片布局'],
  });

  assert.deepEqual(normalized.styleTags, ['卡片化']);
  assert.deepEqual(normalized.componentTags, ['导航栏']);
  assert.equal(normalized.pageType, '工作台首页');
});

test('normalizeAnalysisResult prefers existing library tags and normalizes synonyms', () => {
  const normalized = normalizeAnalysisResult(
    {
      pageType: '仪表盘',
      industry: '企业服务',
      deviceType: '网页端',
      styleTags: ['卡片布局', '清晰层级'],
      componentTags: ['顶部导航', '统计卡'],
    },
    {
      pageTypes: ['工作台首页'],
      industries: ['SaaS'],
      deviceTypes: ['Web'],
      styleTags: ['卡片化', '信息层级清晰'],
      componentTags: ['导航栏', '数据卡片'],
    }
  );

  assert.equal(normalized.pageType, '工作台首页');
  assert.equal(normalized.industry, 'SaaS');
  assert.equal(normalized.deviceType, 'Web');
  assert.deepEqual(normalized.styleTags, ['卡片化', '信息层级清晰']);
  assert.deepEqual(normalized.componentTags, ['导航栏', '数据卡片']);
});

test('buildAnalyzeImageRequest creates a structured OpenAI Responses payload', () => {
  const request = buildAnalyzeImageRequest({
    fileName: 'dashboard.png',
    dataUrl: 'data:image/png;base64,abc123',
  });

  assert.equal(request.model, 'gpt-5-mini');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.name, 'designref_image_analysis');
  assert.deepEqual(request.text.format.schema.required, ANALYSIS_JSON_SCHEMA.required);
  assert.equal(request.input[0].role, 'user');
  assert.equal(request.input[0].content[1].type, 'input_image');
});

test('buildQwenAnalyzeImageRequest creates an OpenAI-compatible chat payload', () => {
  const request = buildQwenAnalyzeImageRequest({
    fileName: 'dashboard.png',
    dataUrl: 'data:image/png;base64,abc123',
  });

  assert.equal(request.model, 'qwen-vl-max');
  assert.equal(request.response_format.type, 'json_object');
  assert.equal(request.messages[0].role, 'user');
  assert.equal(request.messages[0].content[0].type, 'text');
  assert.equal(request.messages[0].content[1].type, 'image_url');
  assert.equal(request.messages[0].content[1].image_url.url, 'data:image/png;base64,abc123');
});

test('buildQwenAnalyzeImageRequest includes the existing tag library for matching first', () => {
  const request = buildQwenAnalyzeImageRequest({
    fileName: 'dashboard.png',
    dataUrl: 'data:image/png;base64,abc123',
    tagLibrary: {
      pageTypes: ['工作台首页'],
      industries: ['SaaS'],
      deviceTypes: ['Web'],
      styleTags: ['卡片化'],
      componentTags: ['导航栏'],
    },
  });

  const promptText = request.messages[0].content[0].text;
  assert.match(promptText, /优先从已有标签库中选择/);
  assert.match(promptText, /工作台首页/);
  assert.match(promptText, /卡片化/);
});

test('extractQwenResponseText reads chat completion content', () => {
  const text = extractQwenResponseText({
    choices: [{ message: { content: '{"pageType":"首页"}' } }],
  });

  assert.equal(text, '{"pageType":"首页"}');
});
