const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const runs = [
  {
    "id": "rsg-overworld-kit-v6",
    "title": "Crafting the first stone pickaxe",
    "video": "assets/rsg-overworld-kit-v6.mp4",
    "poster": "assets/rsg-overworld-kit-v6.jpg",
    "note": "A continuous early-game excerpt: gathering logs, crafting a table and wooden pickaxe, mining cobblestone, then crafting and using the first stone pickaxe. Native inventory views are enlarged for readability. The recording is an archival timelapse at 2\u00d7 site playback; controls follow accepted command batches, including inventory clicks, not measured key-down events."
  },
  {
    "id": "rsg-portal-complete-v2",
    "title": "Casting a portal",
    "video": "assets/rsg-portal-clean-v5.mp4",
    "poster": "assets/rsg-portal-clean-v5.jpg",
    "note": "Complete outdoor portal construction: lava-pool preparation, frame casting, ignition, and arrival in the Nether. Excerpt from an archival agent run, with thinking time accelerated. The control strip follows the recorded command log, not measured key-down events."
  },
  {
    "id": "rsg-fortress-crossing-v3",
    "title": "Bridging to a fortress",
    "video": "assets/rsg-fortress-clean-v5.mp4",
    "poster": "assets/rsg-fortress-clean-v5.jpg",
    "note": "An archival agent run extending a netherrack bridge across natural Nether terrain and reaching the fortress. The landing takes damage; this clip shows the crossing, not success of the later fight. Thinking intervals are accelerated. The control strip follows the recorded command log, not measured key-down events."
  },
  {
    "id": "rsg-bastion-gold-v4",
    "title": "Mining gold at a bastion",
    "video": "assets/rsg-bastion-clean-v5.mp4",
    "poster": "assets/rsg-bastion-clean-v5.jpg",
    "note": "An archival run crossing open Nether terrain to a bastion exterior, then mining nearby nether-gold ore. Nuggets are visible by the end. This excerpt does not imply a completed bastion raid or full-run success. The original timelapse is accelerated; the control strip follows its recorded commands, not measured key-down events."
  }
];
const quad = document.querySelector('#rsg-quad');
quad.innerHTML = runs.map(r=>`<figure class="run"><button class="run-open" data-run="${r.id}" aria-label="Open ${r.title} recording"><video autoplay muted loop playsinline preload="auto" poster="${r.poster}" aria-label="${r.note}"><source src="${r.video}" type="video/mp4"></video><span class="run-label">${r.title}</span></button></figure>`).join('');

quad.querySelectorAll('video').forEach(video=>{video.defaultPlaybackRate=2;video.playbackRate=2;});

const dialog=document.querySelector('#recording-dialog');
const dialogVideo=dialog.querySelector('video');
const stemVideo=document.querySelector('#stem-capture video');
const soundButton=document.querySelector('#stem-sound');
let stemSound=false;
const sysVideo=document.querySelector('#sys-capture video');
sysVideo.defaultPlaybackRate=5;sysVideo.playbackRate=5;
function syncSound(){
  stemVideo.muted=!stemSound;
  soundButton.textContent=stemSound?'Mute sound':'Unmute sound';
  soundButton.setAttribute('aria-pressed',String(stemSound));
}
soundButton.onclick=()=>{
  stemSound=!stemSound;
  syncSound();
  if(stemSound){const group=groups.find(g=>g.element.id==='stem-capture');group.paused=false;syncMedia();}
};
const groups=[...document.querySelectorAll('[data-motion-for]')].map(button=>({button,element:document.getElementById(button.dataset.motionFor),paused:reducedMotion.matches,visible:false}));
const play=video=>video.play().catch(()=>{});
function syncMedia(){
  for(const group of groups){

    group.button.textContent=group.paused?'Play':'Pause';
    group.button.setAttribute('aria-pressed',String(group.paused));
    for(const video of group.element.querySelectorAll('video')){
      video.muted=video===stemVideo?!stemSound:true;
      if(group.paused||!group.visible||document.hidden||dialog.open)video.pause();else play(video);
    }
  }
}
const observer=new IntersectionObserver(entries=>{for(const entry of entries){const group=groups.find(g=>g.element===entry.target);group.visible=entry.isIntersecting;}syncMedia();},{threshold:.05});
for(const group of groups){observer.observe(group.element);group.button.onclick=()=>{group.paused=!group.paused;syncMedia();};}
document.querySelectorAll('[data-run]').forEach(button=>button.onclick=()=>{
  const run=runs.find(r=>r.id===button.dataset.run);
  dialogVideo.dataset.run=run.id;
  dialogVideo.src=run.video;dialogVideo.muted=true;dialogVideo.defaultPlaybackRate=2;dialogVideo.playbackRate=2;
  document.querySelector('#recording-title').textContent=run.note;
  dialog.showModal();syncMedia();play(dialogVideo);
});
const captureNotes={
 'sysvrc-autonomous-skills-5x':'Team 6121C’s autonomous skills run in VRC Spin Up. Original physical-robot footage at 5× speed.',
 'sysvrc-driver-skills-5x':'Team 6121C’s driver-controlled skills run in VRC Spin Up. Original physical-robot footage at 5× speed.',
 'sysvrc-dashboard-full':'Full available 60-second Gazebo skills recording at 5×. The solid robot is the simulated pose; the white outline is the controller’s odometry estimate. Its drift beyond the field is present in the recorded data. The view includes the entire estimate, with a short hold at the recording’s end.',
 'wild-viewer-film':'The original Qt viewer, rendered directly from its application widgets. Recorded synthetic foothill scenario, greedy assignment baseline, seed 20260726. Minutes 24–144 at four simulated minutes per second. Vehicle selection and layer changes use the application’s own controls.',
 'stemp-boombap':'The native SwiftUI instrument rebuilt in a compact landscape layout with a vermilion finish. Rendered during playback of the original 90 BPM “After hours” boom-bap session, with synchronized sound captured directly from the app’s audio engine. This is a playback demonstration, not a separation-inference run.'
};
document.querySelectorAll('[data-capture]').forEach(button=>button.onclick=()=>{
  const id=button.dataset.capture;
  delete dialogVideo.dataset.run;
  dialogVideo.src=`assets/${id}.mp4`;
  const rate=id==='sysvrc-dashboard-full'?5:1;
  dialogVideo.defaultPlaybackRate=rate;dialogVideo.playbackRate=rate;
  dialogVideo.muted=id==='stemp-boombap'?!stemSound:true;
  if(id==='stemp-boombap')dialogVideo.currentTime=stemVideo.currentTime;
  document.querySelector('#recording-title').textContent=captureNotes[button.dataset.capture];
  dialog.showModal();syncMedia();play(dialogVideo);
});
document.querySelector('#close-recording').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{
  dialogVideo.pause();
  if(dialogVideo.getAttribute('src')==='assets/stemp-boombap.mp4'){
    stemSound=!dialogVideo.muted;stemVideo.currentTime=dialogVideo.currentTime;syncSound();
  }
  syncMedia();
});
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
document.addEventListener('visibilitychange',syncMedia);
reducedMotion.addEventListener('change',()=>{for(const group of groups)group.paused=reducedMotion.matches;syncMedia();});
syncMedia();
import { setupBenchmarks } from './benchmarks.js';
setupBenchmarks({ reducedMotion });


import { setupProjectVisuals } from './projects.js?v=paver-orange1';
setupProjectVisuals({ reducedMotion });

import { setupRecordedInputs } from './rsg-inputs.js?v=overworld6';
setupRecordedInputs({ quad, dialogVideo });
