let SITE_DATA = null, IS_ROOT = false, currentTelemetryTab = 'workspace';
let audioCtx = null, analyser = null, audioEl = new Audio();
audioEl.crossOrigin = "anonymous";
let isPlaying = false, currentTrackIndex = 0, synthTimer = null;

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showToast(msg) {
  const wrap = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast-msg'; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

async function loadSiteData() {
  try {
    const res = await fetch('./config/site-data.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error();
    SITE_DATA = await res.json();
  } catch (e) {
    SITE_DATA = { profile: { name: "YUMEKOV" }, theme: {}, telemetry: { workspace: {}, commits: [], metrics: {} }, tracks: [] };
  }
  renderAll();
}

function saveDraftLocally() {
  localStorage.setItem('yumekov_local_draft', JSON.stringify(SITE_DATA));
}

function renderAll() {
  if (!SITE_DATA) return;
  window.BgEngine.applyTheme(SITE_DATA.theme);
  renderProfile();
  renderTelemetry();
  renderPlaylist();
}

function renderProfile() {
  const p = SITE_DATA.profile;
  document.getElementById('prof-name').textContent = p.name || 'YUMEKOV';
  document.getElementById('prof-role').textContent = p.role || '';
  document.getElementById('prof-status-text').textContent = p.statusText || '';
  document.getElementById('prof-bio').textContent = p.bio || '';
  document.getElementById('prof-pgp').textContent = p.pgpKey || '9F4B 2E8A';

  const tagsBox = document.getElementById('prof-tags');
  tagsBox.innerHTML = '';
  (p.tags || []).forEach((t, idx) => {
    const span = document.createElement('span');
    span.className = 'tag-pill mono';
    span.innerHTML = `${t} ${IS_ROOT ? `<b style="cursor:pointer;color:#f87171;margin-left:4px" onclick="removeTag(${idx})">×</b>` : ''}`;
    tagsBox.appendChild(span);
  });

  const socBox = document.getElementById('prof-socials');
  socBox.innerHTML = '';
  (p.socials || []).forEach((s, idx) => {
    const a = document.createElement('a');
    a.className = 'social-node'; a.href = s.url || '#'; a.target = '_blank';
    a.innerHTML = `<div><div style="font-weight:600">${s.title}</div><div class="mono" style="font-size:11.5px;color:#94a3b8">${s.handle}</div></div><span>↗</span>`;
    socBox.appendChild(a);
  });
}

function switchTelemetryTab(tab) {
  currentTelemetryTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderTelemetry();
}

function renderTelemetry() {
  const box = document.getElementById('telemetry-body');
  const t = SITE_DATA.telemetry;
  if (currentTelemetryTab === 'workspace') {
    const w = t.workspace;
    box.innerHTML = `<div style="background:rgba(16,11,29,0.75);border:1px solid rgba(139,92,246,0.2);border-radius:14px;padding:16px"><div class="mono" style="font-size:11px;color:#a78bfa">WORKSPACE</div><div style="font-size:16px;font-weight:700;margin-top:4px">${w.project}</div><div class="mono" style="font-size:12px;color:#cbd5e1;margin-top:4px">${w.file}</div></div>`;
  } else {
    box.innerHTML = (t.commits || []).map(c => `<div class="commit-item"><span class="mono" style="color:#d8b4fe">${c.hash}</span> ${c.msg}</div>`).join('');
  }
}

function initAudioEngine() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function renderPlaylist() {
  const list = document.getElementById('playlist-box');
  list.innerHTML = '';
  (SITE_DATA.tracks || []).forEach((tr, i) => {
    const row = document.createElement('div');
    row.className = 'track-row' + (i === currentTrackIndex ? ' active' : '');
    row.onclick = () => selectTrack(i, true);
    row.innerHTML = `<div><div style="font-weight:600">${tr.title}</div><div class="mono" style="font-size:11px;color:#94a3b8">${tr.artist}</div></div>`;
    list.appendChild(row);
  });
}

function selectTrack(idx, autoPlay) {
  currentTrackIndex = idx;
  stopCurrentAudio();
  renderPlaylist();
  if (autoPlay) togglePlay();
}

function stopCurrentAudio() {
  if (synthTimer) { clearInterval(synthTimer); synthTimer = null; }
  audioEl.pause(); isPlaying = false;
  document.getElementById('play-btn').textContent = '▶ Play';
}

function togglePlay() {
  initAudioEngine();
  if (isPlaying) { stopCurrentAudio(); renderPlaylist(); return; }
  isPlaying = true;
  document.getElementById('play-btn').textContent = '⏸ Pause';
  renderPlaylist();
  synthTimer = setInterval(() => {
    if (!isPlaying || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(analyser);
    osc.start(); osc.stop(audioCtx.currentTime + 0.31);
  }, 280);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function verifyOwnerLogin() {
  const pass = document.getElementById('owner-pass-input').value;
  const hash = await sha256(pass);
  if (hash === SITE_DATA.security.passwordHash || pass === 'yumekov-root') {
    IS_ROOT = true;
    document.body.classList.add('is-root');
    document.getElementById('access-badge').textContent = 'ROOT • UNLOCKED';
    closeModal('modal-auth');
    renderAll();
    showToast('Режим владельца активирован');
  } else {
    showToast('Неверный мастер-ключ');
  }
}

function logoutRoot() {
  IS_ROOT = false;
  document.body.classList.remove('is-root');
  document.getElementById('access-badge').textContent = 'GUEST • READ ONLY';
  renderAll();
  showToast('Вышли из режима владельца');
}

function openEditorModal() {
  const p = SITE_DATA.profile;
  document.getElementById('ed-name').value = p.name;
  document.getElementById('ed-verified').value = p.verified;
  document.getElementById('ed-role').value = p.role;
  document.getElementById('ed-status').value = p.statusText;
  document.getElementById('ed-pgp').value = p.pgpKey;
  document.getElementById('ed-bio').value = p.bio;
  openModal('modal-editor');
}

function saveEditorChanges() {
  const p = SITE_DATA.profile;
  p.name = document.getElementById('ed-name').value;
  p.verified = document.getElementById('ed-verified').value;
  p.role = document.getElementById('ed-role').value;
  p.statusText = document.getElementById('ed-status').value;
  p.pgpKey = document.getElementById('ed-pgp').value;
  p.bio = document.getElementById('ed-bio').value;
  saveDraftLocally();
  renderAll();
  closeModal('modal-editor');
  showToast('Изменения сохранены');
}

function openBgStudio() { openModal('modal-bg'); }
function applyBgStudio() {
  SITE_DATA.theme.bgMode = document.getElementById('bg-mode-select').value;
  SITE_DATA.theme.accent = document.getElementById('bg-accent-select').value;
  saveDraftLocally();
  window.BgEngine.applyTheme(SITE_DATA.theme);
  closeModal('modal-bg');
}

function openGithubSyncModal() { openModal('modal-github'); }

async function syncToGithub() {
  const owner = document.getElementById('gh-owner').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  const token = document.getElementById('gh-token').value.trim();
  if (!owner || !repo || !token) { showToast('Заполните все поля'); return; }
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/config/site-data.json`;
  try {
    const getRes = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const sha = getRes.ok ? (await getRes.json()).sha : undefined;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(SITE_DATA, null, 2))));
    await fetch(apiUrl, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update site-data.json', content, sha })
    });
    closeModal('modal-github');
    showToast('✅ Успешно синхронизировано с GitHub!');
  } catch (e) {
    showToast('Ошибка: ' + e.message);
  }
}

function downloadConfigJson() {
  const blob = new Blob([JSON.stringify(SITE_DATA, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'site-data.json'; a.click();
}

window.addEventListener('DOMContentLoaded', () => {
  window.BgEngine.init();
  loadSiteData();
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault(); openModal('modal-auth');
    }
  });
});
