// 认证模块：邮箱注册/登录 UI + session 管理。
// 登录遮罩层默认覆盖全屏；登录成功后隐藏并回调 onAuthed。
import { getSupabaseClient } from './supabase-client.js';

let overlayEl = null;
let statusEl = null;

function buildOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.className = 'auth-overlay';
  overlayEl.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-mark">D</div>
        <div>
          <h1>DesignRef</h1>
          <p>竞品灵感库</p>
        </div>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" type="button" data-auth-tab="login">登录</button>
        <button class="auth-tab" type="button" data-auth-tab="register">注册</button>
      </div>
      <form class="auth-form" id="authForm">
        <label>邮箱<input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
        <label>密码<input id="authPassword" type="password" autocomplete="current-password" placeholder="至少 6 位" minlength="6" required /></label>
        <button class="primary-button auth-submit" type="submit">登录</button>
        <p class="auth-status" id="authStatus"></p>
      </form>
    </div>
  `;
  document.body.appendChild(overlayEl);
  statusEl = overlayEl.querySelector('#authStatus');
  return overlayEl;
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

// 将 Supabase 返回的常见英文错误映射为中文提示。
function translateAuthError(message = '') {
  const map = {
    'Email not confirmed': '邮箱尚未验证。请到邮箱点击验证链接，或在 Supabase 关闭邮箱验证后重试。',
    'Invalid login credentials': '邮箱或密码错误，请重新输入。',
    'User already registered': '该邮箱已注册，请直接登录。',
    'Password should be at least 6 characters': '密码至少需要 6 位。',
    'Email rate limit exceeded': '操作过于频繁，请稍后再试。',
  };
  return map[message] || message || '操作失败，请重试。';
}

let mode = 'login';

function setMode(next) {
  mode = next;
  overlayEl.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.authTab === next);
  });
  const submit = overlayEl.querySelector('.auth-submit');
  const pwd = overlayEl.querySelector('#authPassword');
  submit.textContent = next === 'login' ? '登录' : '注册';
  pwd.setAttribute('autocomplete', next === 'login' ? 'current-password' : 'new-password');
  setStatus('');
}

function showOverlay() {
  buildOverlay().classList.add('visible');
}

function hideOverlay() {
  overlayEl?.classList.remove('visible');
}

async function handleSubmit(event) {
  event.preventDefault();
  const supabase = getSupabaseClient();
  const email = overlayEl.querySelector('#authEmail').value.trim();
  const password = overlayEl.querySelector('#authPassword').value;
  if (!email || !password) return;

  const submit = overlayEl.querySelector('.auth-submit');
  submit.disabled = true;

  try {
    if (mode === 'register') {
      setStatus('正在注册…');
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        setStatus('注册成功，请前往邮箱完成验证后再登录。');
        setMode('login');
        return;
      }
      setStatus('注册成功，正在进入…');
    } else {
      setStatus('正在登录…');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setStatus('登录成功，正在进入…');
    }
  } catch (error) {
    setStatus(translateAuthError(error.message), true);
  } finally {
    submit.disabled = false;
  }
}

function bindOverlayEvents() {
  overlayEl.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab));
  });
  overlayEl.querySelector('#authForm').addEventListener('submit', handleSubmit);
}

// 初始化认证：监听 session 变化，登录后回调 onAuthed，登出后显示遮罩。
export async function initAuth({ onAuthed, onSignedOut } = {}) {
  const supabase = getSupabaseClient();
  buildOverlay();
  bindOverlayEvents();

  let currentUserId = null;

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (user) {
      if (user.id === currentUserId) return;
      currentUserId = user.id;
      hideOverlay();
      onAuthed?.(user);
    } else {
      currentUserId = null;
      showOverlay();
      onSignedOut?.();
    }
  });

  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    currentUserId = data.session.user.id;
    hideOverlay();
    onAuthed?.(data.session.user);
  } else {
    showOverlay();
  }
}

export async function signOut() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}