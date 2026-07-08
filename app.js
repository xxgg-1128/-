import {
  createImageRecord,
  filterImages,
  filterPrompts,
  generatePrompt,
  imageTags,
  uniqueTags,
} from './app-core.js';

const STORAGE_KEY = 'designref-local-prototype-v1';
const IMAGE_VIEWS = ['全部', '收藏', '已生成 Prompt', '未生成 Prompt'];
const PROMPT_TYPES = ['UI 生成', '生图', '组件复刻', '设计分析'];
const TAG_GROUPS = [
  { key: 'pageTypes', title: '页面标签', imageField: 'pageType', mode: 'single' },
  { key: 'industries', title: '行业标签', imageField: 'industry', mode: 'single' },
  { key: 'deviceTypes', title: '端类型标签', imageField: 'deviceType', mode: 'single' },
  { key: 'styleTags', title: '风格标签', imageField: 'styleTags', mode: 'list' },
  { key: 'componentTags', title: '组件标签', imageField: 'componentTags', mode: 'list' },
  { key: 'userTags', title: '用户标签', imageField: 'userTags', mode: 'list' },
];

const DEFAULT_TAG_LIBRARY = {
  pageTypes: [],
  industries: [],
  deviceTypes: [],
  styleTags: [],
  componentTags: [],
  userTags: [],
};

const state = {
  images: [],
  prompts: [],
  tagLibrary: structuredClone(DEFAULT_TAG_LIBRARY),
  currentView: 'images',
  imageView: '全部',
  promptType: '全部',
  activeTag: '全部',
  search: '',
  selectedImageId: null,
  selectedPromptId: null,
  draftPrompt: null,
  editingTag: null,
};

const els = {
  appShell: document.querySelector('.app-shell'),
  navItems: document.querySelectorAll('.nav-item'),
  views: {
    images: document.querySelector('#imagesView'),
    prompts: document.querySelector('#promptsView'),
    tags: document.querySelector('#tagsView'),
  },
  pageTitle: document.querySelector('#pageTitle'),
  search: document.querySelector('#globalSearch'),
  searchButton: document.querySelector('#searchButton'),
  fileInput: document.querySelector('#fileInput'),
  uploadTriggers: document.querySelectorAll('[data-upload-trigger]'),
  dropZone: document.querySelector('#dropZone'),
  imageGrid: document.querySelector('#imageGrid'),
  imageEmpty: document.querySelector('#imageEmpty'),
  promptList: document.querySelector('#promptList'),
  promptEmpty: document.querySelector('#promptEmpty'),
  tagFilters: document.querySelector('#tagFilters'),
  tagBoard: document.querySelector('#tagBoard'),
  tagEmpty: document.querySelector('#tagEmpty'),
  detailPanel: document.querySelector('#detailPanel'),
  toast: document.querySelector('#toast'),
  stats: {
    images: document.querySelector('#statImages'),
    prompts: document.querySelector('#statPrompts'),
    tags: document.querySelector('#statTags'),
  },
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => els.toast.classList.remove('visible'), 2600);
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        images: state.images,
        prompts: state.prompts,
        tagLibrary: state.tagLibrary,
      })
    );
  } catch (error) {
    showToast('本地存储空间不足，当前改动可能无法持久保存。');
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.images = Array.isArray(data.images) ? data.images : [];
    state.prompts = Array.isArray(data.prompts) ? data.prompts : [];
    state.tagLibrary = normalizeTagLibrary(data.tagLibrary);
    syncTagLibraryFromImages();
    state.selectedImageId = null;
  } catch (error) {
    showToast('本地数据读取失败，已进入空白状态。');
  }
}

function normalizeTag(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function compactTagList(tags = []) {
  return Array.from(new Set(tags.map(normalizeTag).filter(Boolean))).sort();
}

function normalizeTagLibrary(library = {}) {
  return TAG_GROUPS.reduce((result, group) => {
    result[group.key] = compactTagList(library[group.key] ?? []);
    return result;
  }, structuredClone(DEFAULT_TAG_LIBRARY));
}

function groupValuesFromImage(image, group) {
  const value = image[group.imageField];
  return group.mode === 'single' ? [value].filter(Boolean) : value ?? [];
}

function syncTagLibraryFromImages() {
  TAG_GROUPS.forEach((group) => {
    const imageTags = state.images.flatMap((image) => groupValuesFromImage(image, group));
    state.tagLibrary[group.key] = compactTagList([...(state.tagLibrary[group.key] ?? []), ...imageTags]);
  });
}

function findLibraryTag(groupKey, candidate) {
  const normalizedCandidate = normalizeTag(candidate);
  const candidateLower = normalizedCandidate.toLowerCase();
  const library = state.tagLibrary[groupKey] ?? [];
  return (
    library.find((tag) => tag.toLowerCase() === candidateLower) ??
    library.find((tag) => {
      const lowerTag = tag.toLowerCase();
      return candidateLower.includes(lowerTag) || lowerTag.includes(candidateLower);
    }) ??
    normalizedCandidate
  );
}

function normalizeImageToTagLibrary(image) {
  TAG_GROUPS.forEach((group) => {
    if (group.mode === 'single') {
      const matchedTag = findLibraryTag(group.key, image[group.imageField]);
      image[group.imageField] = matchedTag;
      state.tagLibrary[group.key] = compactTagList([...(state.tagLibrary[group.key] ?? []), matchedTag]);
      return;
    }

    const matchedTags = groupValuesFromImage(image, group).map((tag) => findLibraryTag(group.key, tag));
    image[group.imageField] = compactTagList(matchedTags);
    state.tagLibrary[group.key] = compactTagList([...(state.tagLibrary[group.key] ?? []), ...matchedTags]);
  });
}

function replaceTagInList(tags = [], oldTag, newTag) {
  return compactTagList(tags.map((tag) => (tag === oldTag ? newTag : tag)));
}

function renameLibraryTag(groupKey, oldTag, newTag) {
  const group = TAG_GROUPS.find((item) => item.key === groupKey);
  const normalizedOld = normalizeTag(oldTag);
  const normalizedNew = normalizeTag(newTag);
  if (!group || !normalizedOld || !normalizedNew) return false;

  state.tagLibrary[groupKey] = compactTagList((state.tagLibrary[groupKey] ?? []).map((tag) => (tag === normalizedOld ? normalizedNew : tag)));
  state.images.forEach((image) => {
    if (group.mode === 'single') {
      if (image[group.imageField] === normalizedOld) image[group.imageField] = normalizedNew;
    } else {
      image[group.imageField] = replaceTagInList(image[group.imageField] ?? [], normalizedOld, normalizedNew);
    }
  });
  state.prompts.forEach((prompt) => {
    prompt.tags = replaceTagInList(prompt.tags ?? [], normalizedOld, normalizedNew);
  });
  return true;
}

function deleteLibraryTag(groupKey, tag) {
  const group = TAG_GROUPS.find((item) => item.key === groupKey);
  const normalizedTag = normalizeTag(tag);
  if (!group || !normalizedTag) return false;

  state.tagLibrary[groupKey] = (state.tagLibrary[groupKey] ?? []).filter((item) => item !== normalizedTag);
  state.images.forEach((image) => {
    if (group.mode === 'single') {
      if (image[group.imageField] === normalizedTag) image[group.imageField] = '';
    } else {
      image[group.imageField] = (image[group.imageField] ?? []).filter((item) => item !== normalizedTag);
    }
  });
  state.prompts.forEach((prompt) => {
    prompt.tags = (prompt.tags ?? []).filter((item) => item !== normalizedTag);
  });
  return true;
}

function addLibraryTag(groupKey, tag) {
  const normalizedTag = normalizeTag(tag);
  if (!TAG_GROUPS.some((group) => group.key === groupKey) || !normalizedTag) return false;
  state.tagLibrary[groupKey] = compactTagList([...(state.tagLibrary[groupKey] ?? []), normalizedTag]);
  return true;
}

function promptCountByImage(imageId) {
  return state.prompts.filter((prompt) => prompt.sourceImageId === imageId).length;
}

function imagesWithPromptCount() {
  return state.images.map((image) => ({
    ...image,
    promptCount: promptCountByImage(image.id),
  }));
}

function selectedImage() {
  return state.images.find((image) => image.id === state.selectedImageId) ?? null;
}

function activeDetailImage() {
  const detailImageId = els.detailPanel.querySelector('[data-detail-image-id]')?.dataset.detailImageId;
  return selectedImage() ?? state.images.find((image) => image.id === detailImageId) ?? null;
}

function switchView(view) {
  state.currentView = view;
  state.search = '';
  state.activeTag = '全部';
  els.search.value = '';
  els.pageTitle.textContent = view === 'images' ? '图片库' : view === 'prompts' ? 'Prompt 库' : '标签管理';
  els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  Object.entries(els.views).forEach(([key, el]) => el.classList.toggle('active-view', key === view));
  render();
}

function showPrompt(promptId) {
  state.currentView = 'prompts';
  state.promptType = '全部';
  state.search = '';
  state.selectedPromptId = promptId;
  state.activeTag = '全部';
  els.search.value = '';
  els.pageTitle.textContent = 'Prompt 库';
  els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === 'prompts'));
  Object.entries(els.views).forEach(([key, el]) => el.classList.toggle('active-view', key === 'prompts'));
  document.querySelectorAll('[data-prompt-type]').forEach((button) => {
    button.classList.toggle('active', button.dataset.promptType === '全部');
  });
  render();
  window.requestAnimationFrame(() => {
    document.querySelector(`[data-prompt-id="${promptId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char];
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

async function handleFiles(files) {
  const list = Array.from(files).slice(0, 20);
  if (!list.length) return;

  let added = 0;
  for (const file of list) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = createImageRecord({
        name: file.name,
        dataUrl,
        size: file.size,
        type: file.type,
      });
      normalizeImageToTagLibrary(image);

      image.status = '分析中';
      state.images.unshift(image);
      state.selectedImageId = image.id;
      render();

      window.setTimeout(() => {
        const current = state.images.find((item) => item.id === image.id);
        if (!current) return;
        current.status = '分析成功';
        saveState();
        render();
      }, 500 + added * 120);
      added += 1;
    } catch (error) {
      showToast(`${file.name}: ${error.message}`);
    }
  }

  if (added) {
    saveState();
    switchView('images');
    showToast(`已上传 ${added} 张图片，正在模拟 AI 分析。`);
  }
}

function setImageView(view) {
  if (!IMAGE_VIEWS.includes(view)) view = '全部';
  state.imageView = view;
  document.querySelectorAll('[data-image-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.imageView === view);
  });
  renderImages();
}

function createCustomPrompt(image) {
  const prompt = generatePrompt(image, '自定义');
  return {
    ...prompt,
    title: `${image.pageType} 自定义 Prompt`,
    content: '',
  };
}

function saveDraftPrompt() {
  if (!state.draftPrompt) return;
  const title = document.querySelector('#draftTitle')?.value.trim() || state.draftPrompt.title;
  const content = document.querySelector('#draftContent')?.value.trim() ?? '';
  if (!content) {
    showToast('请先输入 Prompt 内容。');
    document.querySelector('#draftContent')?.focus();
    return;
  }

  const savedPrompt = {
    ...state.draftPrompt,
    title,
    content,
    updateTime: new Date().toISOString(),
  };
  state.prompts.unshift(savedPrompt);
  state.selectedPromptId = savedPrompt.id;
  state.draftPrompt = null;
  saveState();
  render();
  showToast('Prompt 已保存。');
}

function setPromptType(type) {
  state.promptType = type;
  document.querySelectorAll('[data-prompt-type]').forEach((button) => {
    button.classList.toggle('active', button.dataset.promptType === type);
  });
  renderPrompts();
}

function renderStats() {
  const tags = compactTagList(TAG_GROUPS.flatMap((group) => state.tagLibrary[group.key] ?? []));
  els.stats.images.textContent = state.images.length;
  els.stats.prompts.textContent = state.prompts.length;
  els.stats.tags.textContent = tags.length;
}

function renderTagFilters() {
  const tags = ['全部', ...compactTagList([...TAG_GROUPS.flatMap((group) => state.tagLibrary[group.key] ?? []), ...uniqueTags(state.images, state.prompts)]).slice(0, 24)];
  els.tagFilters.innerHTML = tags
    .map(
      (tag) =>
        `<button class="pill ${state.activeTag === tag ? 'active' : ''}" type="button" data-filter-tag="${escapeText(tag)}">${escapeText(tag)}</button>`
    )
    .join('');
}

function renderImages() {
  renderTagFilters();
  const filtered = filterImages(imagesWithPromptCount(), {
    query: state.search,
    activeTag: state.activeTag,
    view: state.imageView,
  });

  els.imageGrid.innerHTML = filtered
    .map((image) => {
      const tags = imageTags(image).slice(0, 5);
      return `
        <article class="image-card ${image.id === state.selectedImageId ? 'selected' : ''}" data-image-id="${image.id}">
          <button class="thumb" type="button" data-select-image="${image.id}" aria-label="查看 ${escapeText(image.name)}">
            <img src="${image.dataUrl}" alt="${escapeText(image.name)}" />
            <span class="status-badge">${escapeText(image.status)}</span>
          </button>
          <div class="card-body">
            <div class="card-title">
              <strong>${escapeText(image.name)}</strong>
              <button class="icon-button ${image.isFavorite ? 'active' : ''}" type="button" title="收藏" data-toggle-image-favorite="${image.id}">★</button>
            </div>
            <div class="card-meta">${escapeText(image.pageType)} · ${escapeText(image.industry)} · ${escapeText(image.deviceType)}</div>
            <div class="tag-list">${tags.map((tag) => `<span class="tag-chip">${escapeText(tag)}</span>`).join('')}</div>
            <div class="card-actions">
              <button class="secondary-button" type="button" data-select-image="${image.id}">详情</button>
              <button class="danger-button" type="button" data-delete-image="${image.id}">删除</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  els.imageEmpty.classList.toggle('visible', filtered.length === 0);
}

function renderDetail() {
  const image = selectedImage();
  els.appShell.classList.toggle('detail-collapsed', !image);
  els.detailPanel.setAttribute('aria-hidden', image ? 'false' : 'true');

  if (!image) {
    els.detailPanel.innerHTML = '';
    return;
  }

  const tags = imageTags(image);
  const savedPrompts = state.prompts.filter((prompt) => prompt.sourceImageId === image.id);
  const draft = state.draftPrompt;

  els.detailPanel.innerHTML = `
    <div class="detail-content" data-detail-image-id="${image.id}">
      <div class="preview">
        <img src="${image.dataUrl}" alt="${escapeText(image.name)}" />
      </div>

      <section class="panel-section">
        <div class="detail-header">
          <div>
            <h3>${escapeText(image.name)}</h3>
            <div class="card-meta">${new Date(image.uploadTime).toLocaleString()} · ${escapeText(image.status)}</div>
          </div>
          <div class="detail-header-actions">
            <button class="icon-button ${image.isFavorite ? 'active' : ''}" type="button" data-toggle-image-favorite="${image.id}" title="收藏">★</button>
            <button class="icon-button" type="button" data-action="close-detail" aria-label="关闭图片详情" title="关闭">×</button>
          </div>
        </div>
        <div class="tag-list">${tags.map((tag) => `<span class="tag-chip">${escapeText(tag)}</span>`).join('')}</div>
      </section>

      <details class="analysis-block">
        <summary>
          <strong>AI 分析</strong>
          <span data-analysis-toggle-label>点击展开</span>
        </summary>
        <div class="analysis-content">
          <p>${escapeText(image.aiSummary)}</p>
          <p><b>页面结构：</b>${escapeText(image.layoutSummary)}</p>
          <p><b>页面类型：</b>${escapeText(image.pageType)}　<b>行业：</b>${escapeText(image.industry)}　<b>端类型：</b>${escapeText(image.deviceType)}</p>
          <p><b>组件：</b>${escapeText((image.componentTags ?? []).join('、'))}</p>
          <ul>${(image.designHighlights ?? []).map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>
        </div>
      </details>

      <section class="panel-section">
        <h3>自定义标签</h3>
        <div class="tag-list">
          ${(image.userTags ?? [])
            .map((tag) => `<span class="tag-chip">${escapeText(tag)} <button type="button" data-remove-tag="${escapeText(tag)}">×</button></span>`)
            .join('')}
        </div>
        <form class="inline-form" id="tagForm">
          <input id="tagInput" type="text" placeholder="添加标签，如 我的项目" />
          <button class="secondary-button" type="submit">添加</button>
        </form>
      </section>

      <section class="panel-section">
        <h3>备注</h3>
        <textarea id="noteInput" placeholder="记录设计亮点、适用项目或复用想法">${escapeText(image.note ?? '')}</textarea>
      </section>

      <section class="panel-section">
        <h3>Prompt 生成</h3>
        <div class="prompt-type-grid">
          ${PROMPT_TYPES.map((type) => `<button class="secondary-button" type="button" data-action="generate-prompt" data-prompt-kind="${type}">${type}</button>`).join('')}
          <button class="secondary-button custom-prompt-button" type="button" data-action="create-custom-prompt">自定义</button>
        </div>
        ${
          draft
            ? `<div class="prompt-editor">
                <input id="draftTitle" type="text" value="${escapeText(draft.title)}" />
                <textarea id="draftContent" placeholder="输入你想保存的 Prompt 内容">${escapeText(draft.content)}</textarea>
                <div class="prompt-actions">
                  <button class="primary-button" type="button" data-action="save-draft">保存 Prompt</button>
                  <button class="secondary-button" type="button" data-action="copy-draft">复制</button>
                  <button class="secondary-button" type="button" data-action="cancel-draft">取消</button>
                </div>
              </div>`
            : ''
        }
      </section>

      <section class="panel-section">
        <h3>关联 Prompt (${savedPrompts.length})</h3>
        <div class="tag-list">
          ${
            savedPrompts
              .map(
                (prompt) =>
                  `<button class="tag-chip prompt-link-chip ${prompt.id === state.selectedPromptId ? 'active' : ''}" type="button" data-open-prompt="${prompt.id}" title="查看 ${escapeText(prompt.title)}">${escapeText(prompt.type)}</button>`
              )
              .join('') || '<span class="muted">暂无</span>'
          }
        </div>
      </section>

      <div class="panel-actions">
        <button class="secondary-button" type="button" data-reanalyze="${image.id}">重新分析</button>
        <button class="danger-button" type="button" data-delete-image="${image.id}">删除图片</button>
      </div>
    </div>
  `;
  bindDetailPanelActions();
}

function bindDetailPanelActions() {
  els.detailPanel.querySelector('.analysis-block')?.addEventListener('toggle', (event) => {
    const label = event.currentTarget.querySelector('[data-analysis-toggle-label]');
    if (label) label.textContent = event.currentTarget.open ? '点击收起' : '点击展开';
  });

  els.detailPanel.querySelectorAll('[data-action="generate-prompt"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const image = activeDetailImage();
      if (!image) return;
      state.selectedImageId = image.id;
      state.draftPrompt = generatePrompt(image, button.dataset.promptKind);
      renderDetail();
    });
  });

  els.detailPanel.querySelector('[data-action="create-custom-prompt"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    const image = activeDetailImage();
    if (!image) return;
    state.selectedImageId = image.id;
    state.draftPrompt = createCustomPrompt(image);
    renderDetail();
    document.querySelector('#draftContent')?.focus();
  });

  els.detailPanel.querySelector('[data-action="save-draft"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    saveDraftPrompt();
  });

  els.detailPanel.querySelector('[data-action="copy-draft"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    const content = document.querySelector('#draftContent')?.value ?? state.draftPrompt?.content;
    copyText(content);
  });

  els.detailPanel.querySelector('[data-action="cancel-draft"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.draftPrompt = null;
    renderDetail();
  });

  els.detailPanel.querySelector('[data-action="close-detail"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.selectedImageId = null;
    state.draftPrompt = null;
    render();
  });
}

function renderPrompts() {
  const filtered = filterPrompts(state.prompts, {
    query: state.search,
    type: state.promptType,
  });

  els.promptList.innerHTML = filtered
    .map((prompt) => {
      const source = state.images.find((image) => image.id === prompt.sourceImageId);
      return `
        <article class="prompt-card" data-prompt-id="${prompt.id}">
          ${
            source
              ? `<button class="prompt-source" type="button" data-select-image="${source.id}" aria-label="查看来源图片 ${escapeText(source.name)}">
                  <img src="${source.dataUrl}" alt="${escapeText(source.name)}" />
                  <span>来源图片</span>
                </button>`
              : ''
          }
          <div class="card-title">
            <strong>${escapeText(prompt.title)}</strong>
            <button class="icon-button ${prompt.isFavorite ? 'active' : ''}" type="button" title="收藏" data-toggle-prompt-favorite="${prompt.id}">★</button>
          </div>
          <div class="card-meta">${escapeText(prompt.type)} · ${new Date(prompt.updateTime).toLocaleString()}</div>
          ${source ? `<div class="card-meta">来源：${escapeText(source.name)}</div>` : ''}
          <textarea data-prompt-content="${prompt.id}">${escapeText(prompt.content)}</textarea>
          <div class="tag-list">${(prompt.tags ?? []).slice(0, 6).map((tag) => `<span class="tag-chip">${escapeText(tag)}</span>`).join('')}</div>
          <div class="prompt-actions">
            <button class="secondary-button" type="button" data-save-prompt-edit="${prompt.id}">保存编辑</button>
            <button class="secondary-button" type="button" data-copy-prompt="${prompt.id}">复制</button>
            <button class="danger-button" type="button" data-delete-prompt="${prompt.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join('');

  els.promptEmpty.classList.toggle('visible', filtered.length === 0);
}

function renderTags() {
  const html = TAG_GROUPS.map((group) => {
      const tags = state.tagLibrary[group.key] ?? [];
      return `
        <section class="tag-group" data-tag-group="${group.key}">
          <h3>${group.title}</h3>
          <div class="tag-library-list">
            ${
              tags
                .map(
                  (tag) => {
                    const isEditing = state.editingTag?.groupKey === group.key && state.editingTag?.tag === tag;
                    return isEditing
                      ? `
                        <div class="tag-edit-row">
                          <input type="text" value="${escapeText(tag)}" data-tag-value="${escapeText(tag)}" data-tag-group="${group.key}" aria-label="编辑${escapeText(tag)}" />
                          <button class="secondary-button" type="button" data-rename-library-tag="${escapeText(tag)}" data-tag-group="${group.key}">保存</button>
                          <button class="secondary-button" type="button" data-cancel-tag-edit>取消</button>
                          <button class="danger-button" type="button" data-delete-library-tag="${escapeText(tag)}" data-tag-group="${group.key}">删除</button>
                        </div>
                      `
                      : `<button class="tag-chip tag-manage-chip" type="button" data-edit-library-tag="${escapeText(tag)}" data-tag-group="${group.key}" title="编辑 ${escapeText(tag)}">${escapeText(tag)}</button>`;
                  }
                )
                .join('') || '<span class="muted">暂无标签</span>'
            }
          </div>
          <form class="inline-form tag-add-form" data-add-tag-group="${group.key}">
            <input type="text" placeholder="新增${group.title}" />
            <button class="secondary-button" type="submit">添加</button>
          </form>
        </section>
      `;
    })
    .join('');

  els.tagBoard.innerHTML = html;
  els.tagEmpty.classList.toggle('visible', !html);
}

function render() {
  renderStats();
  renderImages();
  renderDetail();
  renderPrompts();
  renderTags();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板。');
  } catch (error) {
    showToast('复制失败，请手动选择文本复制。');
  }
}

function deleteImage(id) {
  state.images = state.images.filter((image) => image.id !== id);
  state.prompts = state.prompts.filter((prompt) => prompt.sourceImageId !== id);
  if (state.selectedImageId === id) {
    state.selectedImageId = state.images[0]?.id ?? null;
    state.draftPrompt = null;
  }
  saveState();
  render();
  showToast('图片已删除。');
}

function runSearch() {
  state.search = els.search.value;
  render();
  els.search.focus();
}

function bindEvents() {
  els.navItems.forEach((item) => item.addEventListener('click', () => switchView(item.dataset.view)));
  els.searchButton.addEventListener('click', runSearch);
  els.uploadTriggers.forEach((trigger) => trigger.addEventListener('click', () => els.fileInput.click()));
  els.fileInput.addEventListener('change', (event) => {
    handleFiles(event.target.files);
    event.target.value = '';
  });

  els.search.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });

  els.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    els.dropZone.classList.add('dragging');
  });

  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragging'));
  els.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    els.dropZone.classList.remove('dragging');
    handleFiles(event.dataTransfer.files);
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');

    if (!target) {
      const imageCard = event.target.closest('.image-card');
      if (imageCard?.dataset.imageId) {
        state.selectedImageId = imageCard.dataset.imageId;
        state.draftPrompt = null;
        render();
      }
      return;
    }

    if (target.dataset.imageView) setImageView(target.dataset.imageView);
    if (target.dataset.promptType) setPromptType(target.dataset.promptType);
    if (target.dataset.filterTag) {
      state.activeTag = target.dataset.filterTag;
      renderImages();
    }
    if (target.dataset.selectImage) {
      state.selectedImageId = target.dataset.selectImage;
      state.draftPrompt = null;
      render();
    }
    if (target.dataset.openPrompt) {
      showPrompt(target.dataset.openPrompt);
    }
    if (target.dataset.action === 'close-detail') {
      state.selectedImageId = null;
      state.draftPrompt = null;
      render();
    }
    if (target.dataset.toggleImageFavorite) {
      const image = state.images.find((item) => item.id === target.dataset.toggleImageFavorite);
      if (image) image.isFavorite = !image.isFavorite;
      saveState();
      render();
    }
    if (target.dataset.deleteImage) deleteImage(target.dataset.deleteImage);
    if (target.dataset.reanalyze) {
      const image = state.images.find((item) => item.id === target.dataset.reanalyze);
      if (image) {
        const fresh = createImageRecord({
          name: image.name,
          dataUrl: image.dataUrl,
          size: image.size,
          type: image.type,
          now: image.uploadTime,
        });
        normalizeImageToTagLibrary(fresh);
        Object.assign(image, fresh, { id: image.id, isFavorite: image.isFavorite, userTags: image.userTags, note: image.note });
        saveState();
        render();
        showToast('已重新生成模拟 AI 分析。');
      }
    }
    if (target.dataset.action === 'generate-prompt') {
      const image = activeDetailImage();
      if (!image) return;
      state.draftPrompt = generatePrompt(image, target.dataset.promptKind);
      renderDetail();
    }
    if (target.dataset.action === 'create-custom-prompt') {
      const image = activeDetailImage();
      if (!image) return;
      state.draftPrompt = createCustomPrompt(image);
      renderDetail();
      document.querySelector('#draftContent')?.focus();
    }
    if (target.dataset.action === 'save-draft') {
      saveDraftPrompt();
    }
    if (target.dataset.action === 'copy-draft') {
      const content = document.querySelector('#draftContent')?.value ?? state.draftPrompt?.content;
      copyText(content);
    }
    if (target.dataset.action === 'cancel-draft') {
      state.draftPrompt = null;
      renderDetail();
    }
    if (target.dataset.togglePromptFavorite) {
      const prompt = state.prompts.find((item) => item.id === target.dataset.togglePromptFavorite);
      if (prompt) prompt.isFavorite = !prompt.isFavorite;
      saveState();
      renderPrompts();
      renderStats();
    }
    if (target.dataset.savePromptEdit) {
      const prompt = state.prompts.find((item) => item.id === target.dataset.savePromptEdit);
      const textarea = document.querySelector(`[data-prompt-content="${target.dataset.savePromptEdit}"]`);
      if (prompt && textarea) {
        prompt.content = textarea.value;
        prompt.updateTime = new Date().toISOString();
        saveState();
        renderPrompts();
        showToast('Prompt 编辑已保存。');
      }
    }
    if (target.dataset.copyPrompt) {
      const prompt = state.prompts.find((item) => item.id === target.dataset.copyPrompt);
      if (prompt) copyText(prompt.content);
    }
    if (target.dataset.deletePrompt) {
      state.prompts = state.prompts.filter((prompt) => prompt.id !== target.dataset.deletePrompt);
      saveState();
      render();
      showToast('Prompt 已删除。');
    }
    if (target.dataset.removeTag) {
      const image = selectedImage();
      if (!image) return;
      image.userTags = (image.userTags ?? []).filter((tag) => tag !== target.dataset.removeTag);
      saveState();
      render();
    }
    if (target.dataset.editLibraryTag) {
      state.editingTag = {
        groupKey: target.dataset.tagGroup,
        tag: target.dataset.editLibraryTag,
      };
      renderTags();
    }
    if (target.dataset.cancelTagEdit !== undefined) {
      state.editingTag = null;
      renderTags();
    }
    if (target.dataset.renameLibraryTag) {
      const groupKey = target.dataset.tagGroup;
      const oldTag = target.dataset.renameLibraryTag;
      const input = Array.from(document.querySelectorAll(`input[data-tag-group="${groupKey}"]`)).find((item) => item.dataset.tagValue === oldTag);
      if (renameLibraryTag(groupKey, oldTag, input?.value)) {
        if (state.activeTag === oldTag) state.activeTag = normalizeTag(input?.value);
        state.editingTag = null;
        saveState();
        render();
        showToast('标签已更新。');
      }
    }
    if (target.dataset.deleteLibraryTag) {
      if (!window.confirm(`删除标签「${target.dataset.deleteLibraryTag}」？已使用该标签的图片和 Prompt 也会同步移除。`)) return;
      if (deleteLibraryTag(target.dataset.tagGroup, target.dataset.deleteLibraryTag)) {
        if (state.activeTag === target.dataset.deleteLibraryTag) state.activeTag = '全部';
        state.editingTag = null;
        saveState();
        render();
        showToast('标签已删除。');
      }
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.dataset.addTagGroup) {
      event.preventDefault();
      const input = event.target.querySelector('input');
      if (addLibraryTag(event.target.dataset.addTagGroup, input?.value)) {
        input.value = '';
        state.editingTag = null;
        saveState();
        render();
        showToast('标签已添加。');
      }
      return;
    }

    if (event.target.id !== 'tagForm') return;
    event.preventDefault();
    const image = selectedImage();
    const input = document.querySelector('#tagInput');
    const tag = input?.value.trim();
    if (!image || !tag) return;
    image.userTags = Array.from(new Set([...(image.userTags ?? []), tag]));
    addLibraryTag('userTags', tag);
    input.value = '';
    saveState();
    render();
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'noteInput') {
      const image = selectedImage();
      if (!image) return;
      image.note = event.target.value;
      saveState();
      renderStats();
    }
  });
}

loadState();
bindEvents();
render();
