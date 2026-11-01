export const projects = ['about', 'rsgbot', 'rapidtinyrec', 'sysvrc', 'paver', 'mercury', 'wild-env', 'stemp'];
export const recordings = ['rsg-overworld-kit-v6', 'rsg-portal-complete-v2', 'rsg-fortress-crossing-v3', 'rsg-bastion-gold-v4', 'sysvrc-autonomous-skills-5x', 'sysvrc-driver-skills-5x', 'sysvrc-dashboard-full', 'wild-viewer-film', 'stemp-boombap'];
const destinations = ['github', 'email', 'linkedin', 'project-site', 'paper', 'poster', 'emergent', 'brownie-research', 'other-reference'];
const controls = ['motion', 'sound', 'mercury-degree', 'benchmark-comparison'];
const values = ['play', 'pause', 'mute', 'unmute', '25', '50', '100', 'shared-prefill', 'batched-constraints', 'gpu-constraints', 'compiled-forward', 'native-gqa'];
const rules = {
  'project-view': {project: projects},
  'outbound-click': {project: projects, destination: destinations},
  'recording-open': {project: projects, recording: recordings},
  'control-use': {project: projects, control: controls, value: values},
  'notes-open': {project: projects},
  'scroll-depth': {percent: [25, 50, 75, 90]},
  'active-time': {seconds: [10, 30, 60, 120, 300]}
};
export function filterEvent(name, data = {}) {
  if (!Object.hasOwn(rules, name) || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const clean = {};
  for (const [key, allowed] of Object.entries(rules[name])) {
    if (!allowed.includes(data[key])) return null;
    clean[key] = data[key];
  }
  return clean;
}
export function filterPayload(type, payload, websiteId) {
  if (type !== 'event' || !payload || payload.website !== websiteId) return false;
  if (!['amilagrawal.com', 'www.amilagrawal.com'].includes(payload.hostname)) return false;
  let url;
  try { url = new URL(payload.url, 'https://amilagrawal.com'); } catch { return false; }
  if (!['amilagrawal.com', 'www.amilagrawal.com'].includes(url.hostname)) return false;
  if (!['/', '/index.html', '/rsgbot/', '/rsgbot/index.html'].includes(url.pathname)) return false;
  const path = url.pathname.startsWith('/rsgbot') ? '/rsgbot/' : '/';
  let referrer = '';
  try {
    const ref = new URL(payload.referrer);
    if (['http:', 'https:'].includes(ref.protocol)) referrer = ref.origin;
  } catch {}
  const clean = {website: websiteId, hostname: payload.hostname, url: path,
    title: path === '/' ? 'Amil Agrawal' : 'RSGbot', referrer};
  if (typeof payload.language === 'string' && /^[a-z]{2,3}(?:[-_][a-z0-9]+)*$/i.test(payload.language)) {
    clean.language = payload.language.split(/[-_]/)[0].toLowerCase();
  }
  if (payload.name) {
    const data = filterEvent(payload.name, payload.data);
    if (!data) return false;
    clean.name = payload.name;
    clean.data = data;
  }
  return clean;
}
