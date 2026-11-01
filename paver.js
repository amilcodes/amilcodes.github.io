const NS = 'http://www.w3.org/2000/svg';
const asset = name => `assets/paver-graph/${name}`;
const node = (name, attrs = {}, parent) => {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (parent) parent.append(el);
  return el;
};
const text = (parent, value, attrs) => { const el = node('text', attrs, parent); el.textContent = value; return el; };
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => n*n*(3-2*n);
const mix = (a,b,t) => a+(b-a)*t;
const curve = (a,b,c,t) => (1-t)*(1-t)*a+2*(1-t)*t*b+t*t*c;

// Real GPS, source masks and RGB; the lift/alignment sequence is explanatory.
export async function setupPaver({ reducedMotion }) {
  const figure = document.querySelector('#paver-network');
  const mount = document.querySelector('#paver-map');
  const motion = document.querySelector('#paver-motion');
  const caption = document.querySelector('#paver-step');
  if (!figure || !mount || !motion) return;
  let data;
  try {
    const response = await fetch(asset('graph-v2.json'));
    if (!response.ok) throw new Error('Unable to load panorama evidence');
    data = await response.json();
  } catch (error) {
    mount.textContent = 'Panorama map unavailable.';
    motion.hidden = true;
    console.error(error);
    return;
  }
  document.querySelector('#paver-graph-method').textContent = data.method;
  const svg = node('svg', {viewBox:'0 0 540 580', role:'img', 'aria-labelledby':'paver-map-title paver-map-desc'}, mount);
  node('title', {id:'paver-map-title'},svg).textContent='Strasbourg map and observed-pixel transfer';
  node('desc',{id:'paver-map-desc'},svg).textContent='Actual streets, buildings and five capture positions at Quai Saint-Nicolas. Panorama A and panorama B each highlight their observed road patch, lift it out, align it and place it into the target. Matching colors connect each source to its recovered region. A third panorama only provides supporting matches; the unmatched capture has no evidence edge.';
  const defs=node('defs',{},svg);
  const world=node('g',{'aria-hidden':'true'},svg);
  node('image',{href:asset('street-context.svg'),x:0,y:0,width:540,height:330},world);
  const positions={prev2:{x:43,y:274,r:25},prev1:{x:84,y:94,r:64},next1:{x:456,y:94,r:64},next2:{x:497,y:274,r:25}};
  const target={x:142,y:314,size:256,cx:270,cy:442};
  const colors=[{ink:'#9a3f2c',light:'#ffc6a0',letter:'A'},{ink:'#19594c',light:'#b9f0d6',letter:'B'}];
  const routeD=`M${data.captures.map(c=>`${c.mapX},${c.mapY}`).join(' L')}`;
  node('path',{d:routeD,class:'paver-capture-route'},world);
  const rings={},sourceOutlines={};
  for(const c of data.captures) {
    const p=positions[c.id];
    const isTarget=c.id==='target';
    if(isTarget) {
      node('path',{d:`M${c.mapX},${c.mapY} L${target.cx},${target.y}`,class:'paver-target-leader'},world);
      node('rect',{x:c.mapX-5,y:c.mapY-5,width:10,height:10,class:'paver-route-target'},world);
      text(world,'Target',{x:c.mapX+14,y:c.mapY+6,class:'paver-map-label'});
      continue;
    }
    const donorIndex=data.donors.findIndex(d=>d.id===c.id);
    const color=colors[donorIndex];
    node('path',{d:`M${c.mapX},${c.mapY} L${p.x},${p.y}`,class:'paver-photo-leader'},world);
    node('circle',{cx:c.mapX,cy:c.mapY,r:4,fill:color?.ink||'#6d6747',stroke:'#f5e6ae','stroke-width':1},world);
    const clip=node('clipPath',{id:`paver-photo-${c.id}`},defs);
    node('circle',{cx:p.x,cy:p.y,r:p.r},clip);
    node('image',{href:asset(c.thumbnail),x:p.x-p.r,y:p.y-p.r,width:p.r*2,height:p.r*2,'clip-path':`url(#paver-photo-${c.id})`},world);
    const clipping=node('g',{'clip-path':`url(#paver-photo-${c.id})`},world);
    sourceOutlines[c.id]=node('path',{d:c.sourceOutline||'',transform:`translate(${p.x-p.r} ${p.y-p.r}) scale(${p.r*2/(c.sourceSize||384)})`,fill:color?.light||'#f7efcc',stroke:color?.light||'#f7efcc','fill-opacity':.12,'stroke-width':2,'vector-effect':'non-scaling-stroke','fill-rule':'evenodd',opacity:donorIndex<0?0:1},clipping);
    rings[c.id]=node('circle',{cx:p.x,cy:p.y,r:p.r+2,fill:'none',stroke:color?.ink||'#827236','stroke-width':donorIndex<0?1:2},world);
    if(color) {
      node('rect',{x:p.x-13,y:p.y-p.r-21,width:26,height:26,fill:color.ink},world);
      text(world,color.letter,{x:p.x,y:p.y-p.r-1,'text-anchor':'middle',class:'paver-node-letter'});
    }
  }
  // North-up geographic map. Leaders offset thumbnails, not the capture points.
  text(world,'N',{x:270,y:26,'text-anchor':'middle',class:'paver-map-label'});
  node('path',{d:'M270,35 L270,58 M265,42 L270,35 L275,42',class:'paver-north'},world);
  node('path',{d:'M20,310 L65,310 M20,305 L20,310 M65,305 L65,310',class:'paver-scale'},world);
  text(world,'10 m',{x:72,y:315,class:'paver-map-label'});
  node('path',{d:'M63,286 Q94,332 172,359',class:'paver-support-edge'},world);
  const edges=data.donors.map((d,i)=>node('path',{d:i?'M456,159 C463,252 405,301 341,336':'M84,159 C77,252 135,301 199,336',fill:'none',stroke:colors[i].ink,'stroke-width':2,'stroke-dasharray':'3 5',class:'paver-evidence-edge'},world));
  const targetClip=node('clipPath',{id:'paver-target-clip'},defs);
  node('circle',{cx:target.cx,cy:target.cy,r:128},targetClip);
  const base=node('g',{'clip-path':'url(#paver-target-clip)'},world);
  node('image',{href:'assets/paver-strasbourg-before.webp',x:target.x,y:target.y,width:target.size,height:target.size},base);
  const layers=data.donors.map(d=>node('image',{href:asset(d.patch),x:target.x,y:target.y,width:target.size,height:target.size,opacity:0},base));
  const completed=node('image',{href:'assets/paver-strasbourg-after.webp',x:target.x,y:target.y,width:target.size,height:target.size,opacity:0},base);
  const targetOutlines=data.donors.map((d,i)=>node('path',{d:d.outline,transform:`translate(${target.x} ${target.y}) scale(.4)`,fill:'none',stroke:colors[i].light,'stroke-width':2,'vector-effect':'non-scaling-stroke',opacity:.3},base));
  node('circle',{cx:target.cx,cy:target.cy,r:130,fill:'none',stroke:'#262a26','stroke-width':1},world);
  const tags=data.donors.map((d,i)=>{
    const g=node('g',{opacity:0},world);
    const x=target.x+d.targetCentroid[0]*.4, y=target.y+d.targetCentroid[1]*.4;
    node('rect',{x:x-11,y:y-11,width:22,height:22,fill:colors[i].ink},g);
    text(g,colors[i].letter,{x,y:y+6,'text-anchor':'middle',class:'paver-patch-letter'});
    return g;
  });
  const floaters=data.donors.map((d,i)=>{
    const group=node('g',{opacity:0},world);
    const source=node('g',{},group), aligned=node('g',{},group);
    node('image',{href:asset(d.sourcePatch),width:d.sourceSize,height:d.sourceSize},source);
    node('path',{d:d.sourceOutline,fill:colors[i].light,'fill-opacity':.15,stroke:colors[i].light,'stroke-width':2.5,'vector-effect':'non-scaling-stroke','fill-rule':'evenodd'},source);
    node('image',{href:asset(d.patch),width:640,height:640},aligned);
    node('path',{d:d.outline,fill:'none',stroke:colors[i].light,'stroke-width':2.5,'vector-effect':'non-scaling-stroke'},aligned);
    const tag=node('g',{},group);
    node('rect',{x:-12,y:-12,width:24,height:24,fill:colors[i].ink},tag);
    text(tag,colors[i].letter,{x:0,y:6,'text-anchor':'middle',class:'paver-patch-letter'});
    return {group,source,aligned,tag};
  });
  let paused=reducedMotion.matches, visible=false, elapsed=0, last=0, frame=0, captionText='';
  function render(ms, complete=false) {
    const cycle=ms%11800;
    let nextCaption='Recovered from A + B';
    completed.setAttribute('opacity',complete||cycle>=8400?1:0);
    for(let i=0;i<2;i++) {
      const d=data.donors[i], p=positions[d.id], f=floaters[i], color=colors[i];
      const local=cycle-i*4200;
      const active=!complete&&local>=0&&local<4200;
      const arrived=complete||local>=3400;
      layers[i].setAttribute('opacity',arrived?1:0);
      sourceOutlines[d.id].setAttribute('fill-opacity',active?.4:.1);
      sourceOutlines[d.id].setAttribute('stroke-width',active?3:1.25);
      rings[d.id].setAttribute('stroke-width',active?4:2);
      edges[i].setAttribute('stroke-dasharray',active?'none':'3 5');
      edges[i].setAttribute('stroke-width',active?3:1.5);
      targetOutlines[i].setAttribute('opacity',active||arrived?.95:.25);
      tags[i].setAttribute('opacity',arrived?1:0);
      const transfer=active&&local>=900&&local<3400;
      f.group.setAttribute('opacity',transfer?1:0);
      if(active) nextCaption=`${color.letter} · ${local<900?'find the visible road pixels':local<1800?'lift the observed patch':local<2400?'align it to the target':local<3400?'place it in the missing region':'road pixels recovered'}`;
      if(transfer) {
        const sourceScale=p.r*2/d.sourceSize;
        const start={x:p.x-p.r+d.sourceCentroid[0]*sourceScale,y:p.y-p.r+d.sourceCentroid[1]*sourceScale};
        const mid={x:i?398:142,y:255};
        const end={x:target.x+d.targetCentroid[0]*.4,y:target.y+d.targetCentroid[1]*.4};
        const sb=d.sourceBounds,tb=d.targetBounds;
        const sourceLarge=142/Math.max(sb[2]-sb[0],sb[3]-sb[1]);
        const targetLarge=130/Math.max(tb[2]-tb[0],tb[3]-tb[1]);
        const lift=ease(clamp((local-900)/900));
        const align=ease(clamp((local-1800)/600));
        const place=ease(clamp((local-2400)/1000));
        let x,y;
        if(local<1800) {x=curve(start.x,i?485:55,mid.x,lift);y=mix(start.y,mid.y,lift);}
        else {x=mix(mid.x,end.x,place);y=mix(mid.y,end.y,place);}
        const ss=mix(sourceScale,sourceLarge,lift),ts=mix(targetLarge,.4,place);
        f.source.setAttribute('transform',`translate(${x-d.sourceCentroid[0]*ss} ${y-d.sourceCentroid[1]*ss}) scale(${ss})`);
        f.aligned.setAttribute('transform',`translate(${x-d.targetCentroid[0]*ts} ${y-d.targetCentroid[1]*ts}) scale(${ts})`);
        f.source.setAttribute('opacity',1-align);
        f.aligned.setAttribute('opacity',align);
        f.tag.setAttribute('transform',`translate(${x} ${y})`);
      }
    }
    if(complete) nextCaption='Recovered from A + B';
    if(nextCaption!==captionText) {caption.textContent=nextCaption;captionText=nextCaption;}
    figure.dataset.phase=complete?'complete':cycle<4200?'A':cycle<8400?'B':'complete';
  }
  function tick(now) {if(last)elapsed+=Math.min(now-last,80);last=now;render(elapsed);frame=requestAnimationFrame(tick);}
  function sync() {
    cancelAnimationFrame(frame);frame=0;last=0;
    motion.textContent=paused?'Play':'Pause';
    motion.setAttribute('aria-label',`${paused?'Play':'Pause'} panorama animation`);
    motion.setAttribute('aria-pressed',String(paused));
    if(reducedMotion.matches&&paused)render(0,true);
    if(!paused&&visible&&!document.hidden)frame=requestAnimationFrame(tick);
  }
  motion.onclick=()=>{paused=!paused;sync();};
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.15}).observe(figure);
  document.addEventListener('visibilitychange',sync);
  reducedMotion.addEventListener('change',()=>{paused=reducedMotion.matches;sync();});
  render(0,paused);sync();
}
