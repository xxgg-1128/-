import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeImage,
  createImageRecord,
  createPendingImageRecord,
  filterImages,
  filterPrompts,
  generatePrompt,
  imageTags,
  uniqueTags,
} from '../app-core.js';

test('createImageRecord validates supported image types', () => {
  assert.throws(
    () =>
      createImageRecord({
        name: 'notes.pdf',
        dataUrl: 'data:application/pdf;base64,abc',
        size: 1024,
        type: 'application/pdf',
        now: '2026-07-07T08:00:00.000Z',
      }),
    /支持 PNG、JPG、JPEG、WEBP/
  );
});

test('createPendingImageRecord starts without simulated analysis tags', () => {
  const image = createPendingImageRecord({
    name: 'unknown-upload.png',
    dataUrl: 'data:image/png;base64,abc',
    size: 1024,
    type: 'image/png',
    now: '2026-07-07T08:00:00.000Z',
  });

  assert.equal(image.status, '分析中');
  assert.equal(image.pageType, '');
  assert.equal(image.industry, '');
  assert.equal(image.deviceType, '');
  assert.deepEqual(image.styleTags, []);
  assert.deepEqual(image.componentTags, []);
  assert.deepEqual(imageTags(image), []);
});

test('analyzeImage uses filename hints for page and industry metadata', () => {
  const analysis = analyzeImage('logistics-dashboard-web-dark.png');

  assert.equal(analysis.pageType, '工作台首页');
  assert.equal(analysis.industry, '物流 / SaaS');
  assert.equal(analysis.deviceType, 'Web');
  assert.ok(analysis.styleTags.includes('深色模式'));
  assert.ok(analysis.componentTags.includes('数据卡片'));
});

test('generatePrompt creates an editable prompt linked to the source image', () => {
  const image = createImageRecord({
    name: 'ai-home-web.png',
    dataUrl: 'data:image/png;base64,abc',
    size: 1024,
    type: 'image/png',
    now: '2026-07-07T08:00:00.000Z',
  });

  const prompt = generatePrompt(image, 'UI 生成', '2026-07-07T09:00:00.000Z');

  assert.equal(prompt.type, 'UI 生成');
  assert.equal(prompt.sourceImageId, image.id);
  assert.match(prompt.title, /UI 生成 Prompt/);
  assert.match(prompt.content, /页面结构/);
  assert.ok(prompt.tags.includes(image.pageType));
});

test('filterImages searches across name, tags, analysis and prompt status', () => {
  const image = {
    id: 'img-1',
    name: 'finance-form.png',
    pageType: '表单页',
    industry: '金融',
    deviceType: 'Web',
    styleTags: ['极简'],
    componentTags: ['表单'],
    userTags: ['客户案例'],
    aiSummary: '适合金融开户流程',
    note: '',
    isFavorite: true,
    promptCount: 1,
  };

  assert.equal(filterImages([image], { query: '开户', activeTag: '全部', view: '全部' }).length, 1);
  assert.equal(filterImages([image], { query: '', activeTag: '客户案例', view: '全部' }).length, 1);
  assert.equal(filterImages([image], { query: '', activeTag: '全部', view: '收藏' }).length, 1);
  assert.equal(filterImages([image], { query: '', activeTag: '全部', view: '未生成 Prompt' }).length, 0);
});

test('filterPrompts searches and filters by prompt type', () => {
  const prompts = [
    {
      id: 'prompt-1',
      title: '物流工作台',
      type: 'UI 生成',
      content: '生成物流工作台首页',
      tags: ['物流', '工作台首页'],
      isFavorite: false,
    },
    {
      id: 'prompt-2',
      title: '卡片复刻',
      type: '组件复刻',
      content: '复刻任务卡片',
      tags: ['卡片'],
      isFavorite: true,
    },
  ];

  assert.equal(filterPrompts(prompts, { query: '物流', type: '全部' }).length, 1);
  assert.equal(filterPrompts(prompts, { query: '', type: '组件复刻' }).length, 1);
  assert.equal(filterPrompts(prompts, { query: '', type: '收藏' }).length, 1);
});

test('uniqueTags merges image and prompt tags without duplicates', () => {
  const tags = uniqueTags(
    [
      {
        pageType: '首页',
        industry: 'AI 工具',
        deviceType: 'Web',
        styleTags: ['极简'],
        componentTags: ['导航栏'],
        userTags: ['灵感'],
      },
    ],
    [{ tags: ['灵感', 'Prompt'] }]
  );

  assert.deepEqual(tags, ['AI 工具', 'Prompt', 'Web', '导航栏', '极简', '灵感', '首页']);
});
