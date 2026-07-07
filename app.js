import {
  createImageRecord,
  filterImages,
  filterPrompts,
  generatePrompt,
  imageTags,
  uniqueTags,
} from './app-core.js';

const STORAGE_KEY = 'designref-local-prototype-v1';
const PROMPT_TYPES = ['UI 生成', '生图', '组件复刻', '设计分析'];

const state = {
  images: [],
  prompts: [],
  currentView: 'images',
  imageView: '全部',
  promptType: '全部',
  activeTag: '全部',
  search: '',
  selectedImageId: null,
  selectedPromptId: null,
  draftPrompt: null,
};

const els = {
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
    state.selectedImageId = state.images[0]?.id ?? null;
  } catch (error) {
    showToast('本地数据读取失败，已进入空白状态。');
  }
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
  state.imageView = view;
  document.querySelectorAll('[data-image-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.imageView === view);
  });
  renderImages();
}

function setPromptType(type) {
  state.promptType = type;
  document.querySelectorAll('[data-prompt-type]').forEach((button) => {
    button.classList.toggle('active', button.dataset.promptType === type);
  });
  renderPrompts();
}

function renderStats() {
  const tags = uniqueTags(state.images, state.prompts);
  els.stats.images.textContent = state.images.length;
  els.stats.prompts.textContent = state.prompts.length;
  els.stats.tags.textContent = tags.length;
}

function renderTagFilters() {
  const tags = ['全部', ...uniqueTags(state.images, state.prompts).slice(0, 24)];
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
  if (!image) {
    els.detailPanel.innerHTML = `
      <div class="panel-empty">
        <h3>选择一张图片</h3>
        <p>查看 AI 分析、编辑标签，并生成 Prompt。</p>
      </div>
    `;
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

      <section class="analysis-block">
        <strong>AI 分析</strong>
        <p>${escapeText(image.aiSummary)}</p>
        <p><b>页面结构：</b>${escapeText(image.layoutSummary)}</p>
        <p><b>页面类型：</b>${escapeText(image.pageType)}　<b>行业：</b>${escapeText(image.industry)}　<b>端类型：</b>${escapeText(image.deviceType)}</p>
        <p><b>组件：</b>${escapeText((image.componentTags ?? []).join('、'))}</p>
        <ul>${(image.designHighlights ?? []).map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>
      </section>

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
        </div>
        ${
          draft
            ? `<div class="prompt-editor">
                <input id="draftTitle" type="text" value="${escapeText(draft.title)}" />
                <textarea id="draftContent">${escapeText(draft.content)}</textarea>
                <div class="prompt-actions">
                  <button class="primary-button" type="button" data-action="save-draft">保存 Prompt</button>
                  <button class="secondary-button" type="button" data-action="copy-draft">复制</button>
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

  els.detailPanel.querySelector('[data-action="save-draft"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!state.draftPrompt) return;
    state.draftPrompt.title = document.querySelector('#draftTitle')?.value.trim() || state.draftPrompt.title;
    state.draftPrompt.content = document.querySelector('#draftContent')?.value.trim() || state.draftPrompt.content;
    const savedPrompt = { ...state.draftPrompt, updateTime: new Date().toISOString() };
    state.prompts.unshift(savedPrompt);
    state.selectedPromptId = savedPrompt.id;
    state.draftPrompt = null;
    saveState();
    render();
    showToast('Prompt 已保存。');
  });

  els.detailPanel.querySelector('[data-action="copy-draft"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    const content = document.querySelector('#draftContent')?.value ?? state.draftPrompt?.content;
    copyText(content);
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
        <article class="prompt-card ${prompt.id === state.selectedPromptId ? 'selected' : ''}" data-prompt-id="${prompt.id}">
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
  const groups = [
    ['页面标签', (image) => [image.pageType]],
    ['行业标签', (image) => [image.industry]],
    ['端类型标签', (image) => [image.deviceType]],
    ['风格标签', (image) => image.styleTags ?? []],
    ['组件标签', (image) => image.componentTags ?? []],
    ['用户标签', (image) => image.userTags ?? []],
  ];

  const html = groups
    .map(([title, getter]) => {
      const tags = Array.from(new Set(state.images.flatMap(getter).filter(Boolean))).sort();
      if (!tags.length) return '';
      return `
        <section class="tag-group">
          <h3>${title}</h3>
          <div class="tag-list">${tags.map((tag) => `<span class="tag-chip">${escapeText(tag)}</span>`).join('')}</div>
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
    if (!target) return;

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
    if (target.dataset.action === 'save-draft') {
      if (!state.draftPrompt) return;
      state.draftPrompt.title = document.querySelector('#draftTitle')?.value.trim() || state.draftPrompt.title;
      state.draftPrompt.content = document.querySelector('#draftContent')?.value.trim() || state.draftPrompt.content;
      const savedPrompt = { ...state.draftPrompt, updateTime: new Date().toISOString() };
      state.prompts.unshift(savedPrompt);
      state.selectedPromptId = savedPrompt.id;
      state.draftPrompt = null;
      saveState();
      render();
      showToast('Prompt 已保存。');
    }
    if (target.dataset.action === 'copy-draft') {
      const content = document.querySelector('#draftContent')?.value ?? state.draftPrompt?.content;
      copyText(content);
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
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'tagForm') return;
    event.preventDefault();
    const image = selectedImage();
    const input = document.querySelector('#tagInput');
    const tag = input?.value.trim();
    if (!image || !tag) return;
    image.userTags = Array.from(new Set([...(image.userTags ?? []), tag]));
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
