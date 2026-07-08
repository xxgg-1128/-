import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYSIS_JSON_SCHEMA,
  buildAnalyzeImageRequest,
  dataUrlToImageInput,
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
