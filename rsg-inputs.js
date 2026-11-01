// The video's presentation clock drives every strip, including pause, seek,
// loop and playback-rate changes. Command logs never masquerade as OS input.
export function frameAt(frames, time) {
  let low = 0, high = frames.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (frames[middle].t <= time + .00001) low = middle + 1;
    else high = middle;
  }
  return low ? frames[low - 1] : null;
}

export async function setupRecordedInputs({ quad, dialogVideo }) {
  let clips;
  try {
    const response = await fetch('assets/rsg-commands-v6.json');
    if (!response.ok) throw new Error('RSG command traces unavailable');
    ({ clips } = await response.json());
  } catch (error) { console.error(error); return; }

  const keyName = code => typeof code === 'string' ? code : ({32:'space',340:'shift',344:'shift',341:'ctrl',345:'ctrl'}[code] || (code >= 48 && code <= 90 ? String.fromCharCode(code).toLowerCase() : String(code)));
  const buttonName = code => typeof code === 'string' ? code : ['left','right','middle'][code];
  const key = (code, label, title = label) => `<kbd data-key="${code}" title="${title}">${label}</kbd>`;
  function makeStrip() {
    const strip = document.createElement('div');
    strip.className = 'input-strip';
    strip.setAttribute('role', 'img');
    strip.innerHTML = `<span class="input-wasd">${key('w','W')}${key('a','A')}${key('s','S')}${key('d','D')}</span><span class="input-modifiers">${key('space','Space','Jump')}${key('shift','Shift','Sneak')}${key('ctrl','Ctrl','Sprint')}${key('e','E','Inventory')}</span><kbd class="input-extra" title="Requested hotbar or other key">#</kbd><span class="input-mouse"><kbd data-button="left" title="Explicit attack / break request">L</kbd><kbd data-button="right" title="Explicit use / place request">R</kbd></span><svg class="input-look" viewBox="0 0 24 24" aria-hidden="true"><path class="look-axis" d="M12 2v20M2 12h20"/><path class="look-vector" d="M12 12h0"/><rect class="look-tip" x="10.5" y="10.5" width="3" height="3"/></svg><span class="input-readout"><span class="input-mode">Commands</span><span class="input-action">—</span></span>`;
    const keys = [...strip.querySelectorAll('[data-key]')];
    const buttons = [...strip.querySelectorAll('[data-button]')];
    const extra = strip.querySelector('.input-extra');
    const vector = strip.querySelector('.look-vector');
    const tip = strip.querySelector('.look-tip');
    const action = strip.querySelector('.input-action');
    const mode = strip.querySelector('.input-mode');
    let previous, previousClip;
    return { element: strip, render(frame, clip) {
      if (previous === frame && previousClip === clip) return;
      previous = frame; previousClip = clip;
      const commandMode = clip?.kind !== 'applied';
      const held = new Set((frame?.keys || []).map(keyName));
      const pressed = new Set((frame?.buttons || []).map(buttonName));
      // Only measured traces can supply applied events. Command mode displays
      // explicit requested controls, never inferred fight/bridge micro-actions.
      if (!commandMode) for (const event of frame?.events || []) {
        if (event.down && event.kind === 'button') pressed.add(buttonName(event.code));
        if (event.down && event.kind === 'key') held.add(keyName(event.code));
      }
      for (const node of keys) node.classList.toggle('active', held.has(node.dataset.key));
      for (const node of buttons) node.classList.toggle('active', pressed.has(node.dataset.button));
      const other = [...held].filter(code => !['w','a','s','d','space','shift','ctrl','e'].includes(code));
      extra.textContent = other.join('+') || '#';
      extra.classList.toggle('active', other.length > 0);
      const dx = Number(commandMode ? frame?.look?.dyaw : frame?.dx) || 0;
      const dy = Number(commandMode ? frame?.look?.dpitch : frame?.dy) || 0;
      const scale = Math.max(1, Math.hypot(dx, dy) / 9);
      const x = 12 + dx / scale, y = 12 + dy / scale;
      vector.setAttribute('d', `M12 12L${x.toFixed(2)} ${y.toFixed(2)}`);
      tip.setAttribute('x', (x - 1.5).toFixed(2));
      tip.setAttribute('y', (y - 1.5).toFixed(2));
      strip.classList.toggle('looking', dx !== 0 || dy !== 0 || Boolean(frame?.aim));
      strip.dataset.frameTime = frame?.t ?? '';
      mode.textContent = commandMode ? 'Commands' : 'Inputs';
      const actionName = frame?.actions?.find(name => !['Aim','Look','Select slot','Wait'].includes(name)) || frame?.actions?.at(-1) || frame?.action;
      action.textContent = actionName === 'Select slot' ? 'Hotbar' : actionName || (commandMode ? '—' : 'Recorded');
      action.classList.toggle('active', Boolean(frame?.command));
      const description = commandMode ? `Logged command: ${frame?.command || 'none'}. Highlights are requested controls, not measured held keys.` : `Applied keys: ${[...held].join(', ') || 'none'}; mouse: ${[...pressed].join(', ') || 'none'}.`;
      strip.title = description;
      strip.setAttribute('aria-label', description);
    }};
  }
  function follow(video, render) {
    const update = () => render(video.currentTime);
    for (const name of ['seeked', 'loadstart', 'loadeddata', 'emptied']) video.addEventListener(name, update);
    if ('requestVideoFrameCallback' in video) {
      const next = (_, metadata) => { render(metadata.mediaTime); video.requestVideoFrameCallback(next); };
      video.requestVideoFrameCallback(next);
    } else {
      const next = () => { if (!video.paused) update(); requestAnimationFrame(next); };
      requestAnimationFrame(next);
    }
    update();
  }
  for (const button of quad.querySelectorAll('[data-run]')) {
    const clip = clips[button.dataset.run];
    const frames = clip?.frames || clip?.segments;
    if (!frames?.length) continue;
    const strip = makeStrip();
    button.querySelector('video').after(strip.element);
    follow(button.querySelector('video'), time => strip.render(frameAt(frames, time), clip));
  }
  const detail = makeStrip();
  detail.element.hidden = true;
  dialogVideo.after(detail.element);
  follow(dialogVideo, time => {
    const clip = clips[dialogVideo.dataset.run];
    const frames = clip?.frames || clip?.segments;
    detail.element.hidden = !frames?.length;
    detail.render(frames?.length ? frameAt(frames, time) : null, clip);
  });
}
