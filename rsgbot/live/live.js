// Live tab: polls the EC2 feed (status.json + one JPEG per instance) and renders each run as an inventory panel.
// Self-contained: adds its own menu tab and view panel. Include BEFORE site.js so a #live link opens it:
//   <link rel="stylesheet" href="live/live.css">
//   <script src="live/live.js" data-feed="https://FEED-BASE-URL/"></script>
(() => {
  const script = document.currentScript;
  const FEED = (script && script.dataset.feed) || 'live/sample/';
  const ICONS = 'assets/minecraft/';
  const STALE_MS = 90000;
  const ITEMS = [ // [feed key, label, icon or null]
    ['blaze_rod', 'Blaze rods', 'blaze_rod'], ['ender_pearl', 'Ender pearls', 'ender_pearl'], ['ender_eye', 'Eyes of ender', 'ender_eye'],
    ['iron_pickaxe', 'Iron pickaxe', 'iron_pickaxe'], ['flint_and_steel', 'Flint and steel', 'flint_and_steel'],
    ['water_bucket', 'Water bucket', 'water_bucket'], ['lava_bucket', 'Lava bucket', 'lava_bucket'], ['bucket', 'Bucket', 'bucket'],
    ['obsidian', 'Obsidian', 'obsidian'], ['golden_boots', 'Gold boots', null], ['shield', 'Shield', null],
    ['oak_boat', 'Boat', null], ['bed', 'Bed', null], ['bread', 'Bread', null],
  ];
  const DIM = {nether: ['netherrack', 'Nether'], overworld: ['grass_block_side', 'Overworld'], end: ['end_stone', 'End']};
  const startOpen = location.hash === '#live';
  let tab, panel, grid, foot, timer = null, period = 5000, cards = {};

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const icon = name => { const i = el('img'); i.src = ICONS + name + '.png'; i.alt = ''; return i; };
  const setText = (sel, t) => { const e = document.querySelector(sel); if (e) e.textContent = t; };
  const ago = s => s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;

  function init() {
    const nav = document.querySelector('nav.tabs');
    const status = document.querySelector('.window-status');
    if (!nav || !status) return;
    tab = el('button', 'menu-tab live-tab');
    tab.dataset.view = 'live';
    tab.setAttribute('aria-pressed', 'false');
    tab.append(icon('clock_00'), el('span', '', 'Live'), el('i', 'live-dot'));
    nav.insertBefore(tab, nav.querySelector('[data-view="bench"]'));
    panel = el('div', 'view-panel live-view');
    panel.id = 'live-view';
    panel.hidden = true;
    grid = el('div', 'live-grid');
    foot = el('div', 'live-foot', 'Connecting…');
    panel.append(grid, foot);
    status.parentNode.insertBefore(panel, status);
    tab.addEventListener('click', open);
    nav.addEventListener('click', e => { const b = e.target.closest('.menu-tab'); if (b && b !== tab) close(); });
    document.addEventListener('visibilitychange', () => { if (!panel.hidden) schedule(document.hidden ? 30000 : 0); });
    if (startOpen) open(); else { poll(); schedule(60000); } // the tab's dot shows whether the runs are live while closed
  }

  function open() {
    document.querySelectorAll('.menu-tab').forEach(b => { const on = b === tab; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    document.querySelectorAll('#diagram-view, .view-panel').forEach(p => { p.hidden = p !== panel; });
    for (const s of ['.system-switch', '.map-tools']) { const e = document.querySelector(s); if (e) e.hidden = true; }
    setText('#view-title', 'Live');
    setText('#view-note', 'EC2 · 2 instances');
    setText('#status-text', 'Practice runs streaming from EC2 · game time frozen while the model thinks');
    const v = document.querySelector('#run-video'); if (v) v.pause();
    history.replaceState(null, '', '#live');
    schedule(0);
  }

  function close() { panel.hidden = true; schedule(60000); }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(async () => { await poll(); schedule(panel.hidden || document.hidden ? 60000 : period); }, ms);
  }

  async function poll() {
    let doc;
    try {
      const r = await fetch(FEED + 'status.json?t=' + Date.now(), {cache: 'no-store'});
      if (!r.ok) throw new Error(r.status);
      doc = await r.json();
    } catch (e) {
      tab.classList.remove('is-live');
      foot.textContent = 'Feed offline: the runs are not streaming right now.';
      grid.classList.add('stale');
      return;
    }
    period = Math.max(3000, (doc.period_s || 5) * 1000);
    const age = (Date.now() - Date.parse(doc.updated)) / 1000;
    const stale = age * 1000 > STALE_MS;
    grid.classList.toggle('stale', stale);
    const runs = doc.runs || [];
    tab.classList.toggle('is-live', !stale && runs.some(r => r.state === 'live'));
    runs.forEach(run => render(run, doc.updated, stale));
    foot.textContent = stale ? `Feed paused · last update ${ago(age)} ago` : `Updated ${ago(Math.max(0, age))} ago · every ${Math.round(period / 1000)} s · position and items from the practice harness, never shown to the model`;
  }

  function render(run, stamp, stale) {
    let c = cards[run.id];
    if (!c) {
      c = cards[run.id] = {root: el('article', 'inventory-panel live-card')};
      const cap = el('div', 'panel-caption');
      c.dimIcon = icon('netherrack');
      c.title = el('span');
      c.sub = el('small');
      c.badge = el('b', 'live-badge');
      cap.append(c.dimIcon, c.title, c.sub, c.badge);
      const shot = el('div', 'live-shot');
      c.img = el('img');
      c.img.alt = 'Latest frame from ' + (run.label || run.id);
      c.age = el('span', 'live-age');
      shot.append(c.img, c.age);
      c.stats = el('dl', 'live-stats');
      c.items = el('div', 'live-items');
      c.doing = el('p', 'live-doing');
      c.root.append(cap, shot, c.stats, c.items, c.doing);
      grid.append(c.root);
    }
    const [dimIcon, dimName] = DIM[run.dimension] || ['grass_block_side', run.dimension || '—'];
    c.dimIcon.src = ICONS + dimIcon + '.png';
    c.title.textContent = `${run.label || run.id}${run.world ? ' · ' + run.world : ''}`;
    c.sub.textContent = [run.model, dimName].filter(Boolean).join(' · ');
    const state = stale ? 'offline' : run.state || 'offline';
    c.badge.textContent = state.toUpperCase();
    c.badge.dataset.state = state;
    c.root.dataset.state = state;
    if (run.frame) {
      const next = new Image();
      next.onload = () => { c.img.src = next.src; };
      next.src = FEED + run.frame + '?t=' + encodeURIComponent(stamp);
      c.age.textContent = run.frame_age_s != null ? ago(run.frame_age_s) + ' old' : '';
    }
    c.stats.replaceChildren();
    const rows = [
      ['Health', run.health != null ? `${run.health}/20` : '—'], ['Food', run.food != null ? `${run.food}/20` : '—'],
      ['Position', (run.pos || []).join(' ') || '—'], ['Step', run.step != null ? '#' + run.step : '—'],
      ['Deaths', run.deaths_this_attempt != null ? String(run.deaths_this_attempt) : '—'],
      ['Restores', run.restores != null ? String(run.restores) : '—'],
      ['World time', run.world_time_min != null ? `${run.world_time_min} min` : '—'],
    ];
    for (const [k, v] of rows) { c.stats.append(el('dt', '', k), el('dd', '', v)); }
    c.items.replaceChildren();
    const have = run.items || {};
    for (const [key, label, ic] of ITEMS) {
      if (!have[key]) continue;
      const chip = el('span', 'live-item');
      chip.title = label;
      if (ic) chip.append(icon(ic)); else chip.append(el('em', '', label));
      chip.append(el('b', '', String(have[key])));
      c.items.append(chip);
    }
    if (!c.items.childElementCount) c.items.append(el('span', 'live-none', 'Empty-handed'));
    c.doing.replaceChildren(el('b', '', 'Now '), document.createTextNode(run.doing || run.seeing || '—'));
  }

  window.rsgLive = {open, poll};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
