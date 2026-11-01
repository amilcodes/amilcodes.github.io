import {analyticsConfig} from './analytics-config.js';
import {filterEvent, filterPayload, projects, recordings} from './analytics-policy.mjs';

const optOutKey = 'portfolio-analytics-optout';
function optedOut() {
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
  try { return localStorage.getItem(optOutKey) === '1'; } catch { return true; }
}
const {websiteId, scriptUrl} = analyticsConfig;
const production = ['amilagrawal.com', 'www.amilagrawal.com'].includes(location.hostname);
const supportedPage = ['/', '/index.html', '/rsgbot/', '/rsgbot/index.html'].includes(location.pathname);
if (production && supportedPage && !optedOut() && /^[a-f0-9-]{36}$/i.test(websiteId || '')) {
  window.portfolioAnalyticsFilter = (type, payload) => optedOut() ? false : filterPayload(type, payload, websiteId);
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.defer = true;
  script.dataset.websiteId = websiteId;
  script.dataset.domains = 'amilagrawal.com,www.amilagrawal.com';
  script.dataset.excludeSearch = 'true';
  script.dataset.excludeHash = 'true';
  script.dataset.doNotTrack = 'true';
  script.dataset.performance = 'false';
  script.dataset.errors = 'false';
  script.dataset.beforeSend = 'portfolioAnalyticsFilter';
  script.referrerPolicy = 'no-referrer';
  script.addEventListener('load', setupEvents, {once: true});
  document.head.append(script);
}

function setupEvents() {
  if (!window.umami || optedOut()) return;
  const sent = new Set();
  function track(name, data, once = false) {
    if (optedOut() || document.hidden) return;
    const clean = filterEvent(name, data);
    if (!clean) return;
    const key = JSON.stringify([name, clean]);
    if (once && sent.has(key)) return;
    if (once) sent.add(key);
    try { Promise.resolve(window.umami.track(name, clean)).catch(() => {}); } catch {}
  }
  const projectFor = element => {
    const id = element.closest('.project')?.id;
    return projects.includes(id) ? id : location.pathname.startsWith('/rsgbot') ? 'rsgbot' : 'about';
  };
  function destinationFor(link) {
    let url;
    try { url = new URL(link.href, location.href); } catch { return null; }
    if (url.protocol === 'mailto:') return 'email';
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.pathname.endsWith('/mercury-paper.pdf')) return 'paper';
    if (url.pathname.endsWith('/mercury-poster.pdf')) return 'poster';
    if (url.hostname === 'github.com') return 'github';
    if (url.hostname === 'www.linkedin.com') return 'linkedin';
    if (url.hostname === 'about.emergentconference.org') return 'emergent';
    if (url.hostname === 'brownieresear.ch') return 'brownie-research';
    if (['amilagrawal.com', 'www.amilagrawal.com'].includes(url.hostname) && url.pathname.startsWith('/rsgbot')) return 'project-site';
    if (url.origin !== location.origin) return 'other-reference';
    return null;
  }
  document.addEventListener('click', event => {
    const target = event.target.closest?.('a,button,summary');
    if (!target) return;
    const project = projectFor(target);
    if (target.matches('a')) {
      const destination = destinationFor(target);
      if (destination) track('outbound-click', {project, destination});
    }
    const recording = target.dataset.run || target.dataset.capture;
    if (recordings.includes(recording)) track('recording-open', {project, recording});
    if (target.id === 'stem-sound') track('control-use', {project, control: 'sound', value: target.getAttribute('aria-pressed') === 'true' ? 'unmute' : 'mute'});
    else if (target.matches('.motion')) track('control-use', {project, control: 'motion', value: target.getAttribute('aria-pressed') === 'true' ? 'pause' : 'play'});
    else if (target.dataset.mercuryDegree) track('control-use', {project, control: 'mercury-degree', value: target.dataset.mercuryDegree});
    else if (target.dataset.comparison) track('control-use', {project, control: 'benchmark-comparison', value: target.dataset.comparison});
  });

  document.addEventListener('toggle', event => {
    if (event.target.matches?.('details') && event.target.open) track('notes-open', {project: projectFor(event.target)}, true);
  }, true);

  // Count a project only after its heading stays visible, not while racing past it.
  const visible = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const project = projectFor(entry.target);
      if (entry.isIntersecting && !visible.has(project)) visible.set(project, performance.now());
      else if (!entry.isIntersecting) visible.delete(project);
    }
  }, {threshold: 0.5});
  document.querySelectorAll('.project-heading, .stem-heading').forEach(heading => observer.observe(heading));
  let activeMs = 0;
  let lastTick = performance.now();
  document.addEventListener('visibilitychange', () => {
    lastTick = performance.now();
    for (const id of visible.keys()) visible.set(id, lastTick);
  });
  const timer = setInterval(() => {
    const now = performance.now();
    if (!document.hidden && !optedOut()) {
      activeMs += Math.min(1500, now - lastTick);
      for (const [project, since] of visible) if (now - since >= 1000) track('project-view', {project}, true);
      for (const seconds of [10, 30, 60, 120, 300]) if (activeMs >= seconds * 1000) track('active-time', {seconds}, true);
      const extent = document.documentElement.scrollHeight - innerHeight;
      if (extent > 0) for (const percent of [25, 50, 75, 90]) if (scrollY / extent * 100 >= percent) track('scroll-depth', {percent}, true);
    }
    lastTick = now;
  }, 1000);
  // No player playback events: autoplaying demonstrations are not visitor engagement.
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {clearInterval(timer); observer.disconnect();}
  });
}
