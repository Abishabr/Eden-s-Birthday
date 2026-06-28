/**
 * Eden's Birthday — Cinematic Experience
 * Production-quality vanilla JS + Three.js + GSAP + Lenis
 */

'use strict';

// ─── CDN Imports via dynamic loading ────────────────────────────────────────
const CDN = {
  threejs: 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js',
  gsap:    'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  lenis:   'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js'
};

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  scene: 1,
  muted: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  isTouchDevice: false,
  mouse: { x: 0, y: 0 },
  threeReady: false,
  transitioning: false,
  audioStarted: false
};

// ─── Utility ─────────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function loadModule(src) {
  return import(src);
}

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  body: document.body,
  muteBtn: $('muteToggle'),
  iconMuted: $('iconMuted'),
  iconUnmuted: $('iconUnmuted'),
  scene1: $('scene1'),
  scene2: $('scene2'),
  scene3: $('scene3'),
  scene4: $('scene4'),
  scene5: $('scene5'),
  openGiftBtn: $('openGiftBtn'),
  envelope: $('envelope'),
  envelopeHint: document.querySelector('.envelope-hint'),
  letterOverlay: $('letterOverlay'),
  continueBtn: $('continueBtn'),
  reservedLabel: $('reservedLabel'),
  arrivalCopy: $('arrivalCopy'),
  roseWrapper: $('roseWrapper'),
  cakeWrapper: $('cakeWrapper'),
  surpriseText: $('surpriseText'),
  sLine1: $('sLine1'),
  sLine2: $('sLine2'),
  sLine3: $('sLine3'),
  celebHeading: $('celebHeading'),
  celebSub: $('celebSub'),
  threeCanvas: $('threeCanvas'),
  celebrationCanvas: $('celebrationCanvas'),
};

// ─── Audio Manager ───────────────────────────────────────────────────────────
const AudioManager = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let ambientGain, orchestralGain, currentNode = null;
  let muted = false;
  let masterGain;

  function init() {
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(masterGain);

    orchestralGain = ctx.createGain();
    orchestralGain.gain.value = 0;
    orchestralGain.connect(masterGain);
  }

  // Synthesize a gentle ambient drone using oscillators (no external files needed)
  function createAmbientTone() {
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();
      const gain3 = ctx.createGain();
      const reverb = ctx.createConvolver();
      const filter = ctx.createBiquadFilter();

      // Create a simple reverb impulse
      const irLength = ctx.sampleRate * 3;
      const irBuffer = ctx.createBuffer(2, irLength, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = irBuffer.getChannelData(ch);
        for (let i = 0; i < irLength; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 2.5);
        }
      }
      reverb.buffer = irBuffer;

      osc1.type = 'sine'; osc1.frequency.value = 110;
      osc2.type = 'sine'; osc2.frequency.value = 165;
      osc3.type = 'sine'; osc3.frequency.value = 220;

      gain1.gain.value = 0.12;
      gain2.gain.value = 0.07;
      gain3.gain.value = 0.04;

      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      osc1.connect(gain1); osc2.connect(gain2); osc3.connect(gain3);
      gain1.connect(filter); gain2.connect(filter); gain3.connect(filter);
      filter.connect(reverb);
      reverb.connect(ambientGain);

      osc1.start(); osc2.start(); osc3.start();

      // Gentle frequency drift for organic feel
      const drift = () => {
        const now = ctx.currentTime;
        osc1.frequency.setTargetAtTime(110 + Math.random() * 4 - 2, now, 3);
        osc2.frequency.setTargetAtTime(165 + Math.random() * 4 - 2, now, 3);
      };
      const driftInterval = setInterval(drift, 4000);

      return { stop: () => { clearInterval(driftInterval); osc1.stop(); osc2.stop(); osc3.stop(); } };
    } catch(e) { console.warn('Audio synthesis failed:', e); return null; }
  }

  // Orchestral swell - richer harmonics
  function createOrchestralTone() {
    try {
      const notes = [261.63, 329.63, 392.00, 523.25];
      const oscs = [];
      const gains = [];
      const reverb = ctx.createConvolver();
      const masterOrcGain = ctx.createGain();
      masterOrcGain.gain.value = 0.6;

      const irLength = ctx.sampleRate * 4;
      const irBuffer = ctx.createBuffer(2, irLength, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = irBuffer.getChannelData(ch);
        for (let i = 0; i < irLength; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 1.8);
        }
      }
      reverb.buffer = irBuffer;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        g.gain.value = 0.06 / (i + 1);
        osc.connect(g);
        g.connect(reverb);
        osc.start();
        oscs.push(osc);
        gains.push(g);
      });

      reverb.connect(masterOrcGain);
      masterOrcGain.connect(orchestralGain);

      return { stop: () => oscs.forEach(o => { try { o.stop(); } catch(e){} }) };
    } catch(e) { console.warn('Orchestral synthesis failed:', e); return null; }
  }

  let ambientNode = null, orchNode = null;

  function startAmbient() {
    if (ctx.state === 'suspended') ctx.resume();
    if (!ambientNode) ambientNode = createAmbientTone();
    if (ambientGain) {
      ambientGain.gain.cancelScheduledValues(ctx.currentTime);
      ambientGain.gain.setTargetAtTime(0.6, ctx.currentTime, 2);
    }
  }

  function transitionToOrchestral() {
    if (!orchNode) orchNode = createOrchestralTone();
    const now = ctx.currentTime;
    if (ambientGain) ambientGain.gain.setTargetAtTime(0.15, now, 1.5);
    if (orchestralGain) orchestralGain.gain.setTargetAtTime(0.8, now, 2);
  }

  function peakOrchestral() {
    const now = ctx.currentTime;
    if (orchestralGain) orchestralGain.gain.setTargetAtTime(1.0, now, 2);
  }

  function setMute(val) {
    muted = val;
    if (masterGain) {
      masterGain.gain.setTargetAtTime(val ? 0 : 1, ctx.currentTime, 0.1);
    }
  }

  return { init, startAmbient, transitionToOrchestral, peakOrchestral, setMute };
})();

// ─── Three.js Gift Box ────────────────────────────────────────────────────────
let THREE_MODULE = null;
let threeRenderer, threeScene, threeCamera;
let giftGroup, boxBody, boxLid, ribbonH, ribbonV, ribbonBow;
let floatTween, threeAF;
let targetRotX = 0, targetRotY = 0, currentRotX = 0, currentRotY = 0;
let lidOpen = false;
let goldLight, pointLight1;

async function initThreeJS() {
  try {
    THREE_MODULE = await loadModule(CDN.threejs);
    const THREE = THREE_MODULE;
    setupThreeScene(THREE);
    state.threeReady = true;
    return true;
  } catch (e) {
    console.warn('Three.js failed, using CSS fallback:', e);
    dom.threeCanvas.style.display = 'none';
    $('fallbackBox').style.display = 'block';
    return false;
  }
}

function setupThreeScene(THREE) {
  const wrapper = $('canvasWrapper');
  const W = wrapper.clientWidth || 300;
  const H = wrapper.clientHeight || 300;

  threeRenderer = new THREE.WebGLRenderer({
    canvas: dom.threeCanvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  threeRenderer.setSize(W, H);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.2;

  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  threeCamera.position.set(0, 0.3, 4.5);

  // Lighting
  const ambient = new THREE.AmbientLight(0x1a1510, 0.4);
  threeScene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  keyLight.position.set(3, 5, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 20;
  threeScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xc9a86a, 0.3);
  fillLight.position.set(-3, 1, -2);
  threeScene.add(fillLight);

  pointLight1 = new THREE.PointLight(0xc9a86a, 0, 3);
  pointLight1.position.set(0, 0.5, 0);
  threeScene.add(pointLight1);

  goldLight = new THREE.PointLight(0xffcc66, 0, 5);
  goldLight.position.set(0, 1.5, 0);
  threeScene.add(goldLight);

  // Materials
  const matteMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e10,
    roughness: 0.92,
    metalness: 0.08,
    envMapIntensity: 0.5
  });

  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xc9a86a,
    roughness: 0.3,
    metalness: 0.6,
    envMapIntensity: 1.0
  });

  const lidMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e10,
    roughness: 0.9,
    metalness: 0.08
  });

  // Gift group
  giftGroup = new THREE.Group();
  threeScene.add(giftGroup);

  // Box body
  const bodyGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
  boxBody = new THREE.Mesh(bodyGeo, matteMat);
  boxBody.position.y = -0.15;
  boxBody.castShadow = true;
  boxBody.receiveShadow = true;
  giftGroup.add(boxBody);

  // Box lid
  const lidGeo = new THREE.BoxGeometry(1.68, 0.3, 1.68);
  boxLid = new THREE.Mesh(lidGeo, lidMat);
  boxLid.position.y = 0.6;
  boxLid.castShadow = true;
  giftGroup.add(boxLid);

  // Ribbon H
  const ribbonHGeo = new THREE.BoxGeometry(1.7, 0.08, 0.14);
  ribbonH = new THREE.Mesh(ribbonHGeo, ribbonMat);
  ribbonH.position.y = 0.75;
  giftGroup.add(ribbonH);

  // Ribbon V
  const ribbonVGeo = new THREE.BoxGeometry(0.14, 0.08, 1.7);
  ribbonV = new THREE.Mesh(ribbonVGeo, ribbonMat);
  ribbonV.position.y = 0.75;
  giftGroup.add(ribbonV);

  // Bow — two looped shapes
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, 0.82, 0);

  const torusGeo = new THREE.TorusGeometry(0.2, 0.045, 12, 36);
  const bow1 = new THREE.Mesh(torusGeo, ribbonMat);
  bow1.position.set(-0.18, 0.02, 0);
  bow1.rotation.set(0.3, 0.2, -0.4);
  const bow2 = new THREE.Mesh(torusGeo, ribbonMat);
  bow2.position.set(0.18, 0.02, 0);
  bow2.rotation.set(0.3, -0.2, 0.4);
  bowGroup.add(bow1, bow2);

  const knotGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const knot = new THREE.Mesh(knotGeo, ribbonMat);
  bowGroup.add(knot);
  giftGroup.add(bowGroup);
  ribbonBow = bowGroup;

  // Ground plane (subtle shadow catcher)
  const planeGeo = new THREE.PlaneGeometry(10, 10);
  const planeMat = new THREE.ShadowMaterial({ opacity: 0.3 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.8;
  plane.receiveShadow = true;
  threeScene.add(plane);

  // Start render loop
  renderThree();

  // Handle resize
  window.addEventListener('resize', () => {
    const nw = wrapper.clientWidth;
    const nh = wrapper.clientHeight;
    threeCamera.aspect = nw / nh;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(nw, nh);
  });
}

function renderThree() {
  threeAF = requestAnimationFrame(renderThree);
  if (!threeRenderer || !threeScene || !threeCamera) return;

  // Smooth parallax
  if (!state.isTouchDevice) {
    currentRotX = lerp(currentRotX, targetRotX, 0.05);
    currentRotY = lerp(currentRotY, targetRotY, 0.05);
    if (giftGroup) {
      giftGroup.rotation.x = currentRotX;
      giftGroup.rotation.y = currentRotY + Math.PI * 0.05;
    }
  }

  threeRenderer.render(threeScene, threeCamera);
}

// ─── GSAP Animations ──────────────────────────────────────────────────────────
let gsap;

function animateArrival() {
  const dur = state.reducedMotion ? 0.15 : 1;
  gsap.to(dom.reservedLabel, { opacity: 1, y: 0, duration: dur * 1.2, ease: 'power2.out', delay: 0.3 });
  gsap.fromTo(dom.arrivalCopy, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: dur * 1.4, ease: 'power2.out', delay: 0.7 });
  gsap.to(dom.openGiftBtn, { opacity: 1, duration: dur, ease: 'power2.out', delay: 1.2 });

  // Floating animation for gift group
  if (state.threeReady && giftGroup && !state.reducedMotion) {
    floatTween = gsap.to(giftGroup.position, {
      y: 0.12,
      duration: 3.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
  }
}

async function animateSceneOpening() {
  if (state.transitioning) return;
  state.transitioning = true;

  // Start audio on first gesture
  if (!state.audioStarted) {
    try { AudioManager.startAmbient(); state.audioStarted = true; } catch(e) {}
  }

  // Disable scroll
  document.body.style.overflow = 'hidden';

  const dur = state.reducedMotion ? 0.15 : 1;
  const tl = gsap.timeline({ onComplete: () => { transitionToScene3(); } });

  // Pause float
  if (floatTween) floatTween.pause();

  // Fade out arrival text
  tl.to([dom.reservedLabel, dom.arrivalCopy, dom.openGiftBtn], {
    opacity: 0, y: -10, duration: dur * 0.5, ease: 'power2.in', stagger: 0.08
  });

  // Zoom camera
  if (state.threeReady && threeCamera && !state.reducedMotion) {
    tl.to(threeCamera.position, {
      z: 2.2, y: 0.5,
      duration: dur * 2,
      ease: 'power2.inOut'
    }, '-=0.2');

    // Untie ribbon — flatten bow scale
    if (ribbonBow) {
      tl.to(ribbonBow.scale, {
        x: 0, z: 0,
        duration: dur * 0.8,
        ease: 'power2.inOut'
      }, '-=1.2');
      tl.to(ribbonBow.position, { y: ribbonBow.position.y - 0.1, duration: dur * 0.5, ease: 'power2.in' }, '<');
    }

    // Untie ribbon strips
    if (ribbonH) tl.to(ribbonH.scale, { x: 0, duration: dur * 0.4, ease: 'power1.in' }, '-=0.3');
    if (ribbonV) tl.to(ribbonV.scale, { z: 0, duration: dur * 0.4, ease: 'power1.in' }, '<');

    // Lift lid
    if (boxLid) {
      tl.to(boxLid.position, {
        y: 2.8,
        duration: dur * 1.8,
        ease: 'power1.inOut'
      }, '-=0.2');
      tl.to(boxLid.rotation, {
        x: -0.3,
        duration: dur * 1.8,
        ease: 'power1.inOut'
      }, '<');
    }

    // Golden light from inside
    if (goldLight) {
      tl.to(goldLight, { intensity: 3.5, duration: dur * 1.2, ease: 'power2.out' }, '-=1.2');
    }
    if (pointLight1) {
      tl.to(pointLight1, { intensity: 1.5, duration: dur * 0.8, ease: 'power2.out' }, '-=0.8');
    }
  } else {
    tl.to({}, { duration: dur * 2 }); // placeholder timing
  }

  // Transition audio
  tl.call(() => {
    try { AudioManager.transitionToOrchestral(); } catch(e) {}
  }, [], '-=1');
}

function transitionToScene3() {
  // Show scene 3
  dom.scene3.classList.add('active');
  dom.scene3.setAttribute('aria-hidden', 'false');

  gsap.to(dom.scene1, { opacity: 0, duration: 0.8, ease: 'power2.inOut', onComplete: () => {
    dom.scene1.style.display = 'none';
  }});

  gsap.fromTo($('envelopeWrapper'), {
    opacity: 0, y: 60
  }, {
    opacity: 1, y: 0,
    duration: state.reducedMotion ? 0.15 : 1.8,
    ease: 'power1.out',
    delay: 0.4,
    onComplete: () => { state.transitioning = false; }
  });
}

// ─── Scene 3: Envelope open ───────────────────────────────────────────────────
function openEnvelope() {
  if (state.transitioning) return;
  const envelope = dom.envelope;
  envelope.classList.add('opening');
  if (dom.envelopeHint) dom.envelopeHint.style.opacity = '0';

  setTimeout(() => {
    showLetter();
  }, state.reducedMotion ? 150 : 950);
}

function showLetter() {
  dom.letterOverlay.classList.add('visible');
  dom.letterOverlay.setAttribute('aria-hidden', 'false');
  $('envelopeWrapper').style.opacity = '0';
  $('envelopeWrapper').style.pointerEvents = 'none';

  // Focus management
  const firstFocusable = dom.letterOverlay.querySelector('button, [tabindex]');
  if (firstFocusable) firstFocusable.focus();
}

// ─── Scene 4: Hidden Surprise ─────────────────────────────────────────────────
function transitionToScene4() {
  if (state.transitioning) return;
  state.transitioning = true;

  const dur = state.reducedMotion ? 0.15 : 1;

  // Fold letter away
  gsap.to(dom.letterOverlay, {
    opacity: 0,
    scaleY: 0.92,
    duration: dur,
    ease: 'power2.in',
    onComplete: () => {
      dom.scene3.classList.remove('active');
      dom.scene3.setAttribute('aria-hidden', 'true');
      showScene4();
    }
  });
}

function showScene4() {
  dom.scene4.classList.add('active');
  dom.scene4.setAttribute('aria-hidden', 'false');

  buildCake();
  initScene4Canvas();

  const dur = state.reducedMotion ? 0.15 : 1;
  const tl = gsap.timeline({ onComplete: () => {
    showSurpriseText();
  }});

  tl.to(dom.scene4, { opacity: 1, duration: dur * 0.6, ease: 'power2.out' });

  // Rose appears
  tl.fromTo(dom.roseWrapper, {
    opacity: 0, y: 20, scale: 0.8
  }, {
    opacity: 1, y: 0, scale: 1,
    duration: dur * 1.2,
    ease: 'power2.out'
  }, '+=0.3');

  // Cake rises
  tl.fromTo(dom.cakeWrapper, {
    opacity: 0, y: 40
  }, {
    opacity: 1, y: 0,
    duration: dur * 1.5,
    ease: 'power1.out'
  }, '-=0.5');
}

function buildCake() {
  dom.cakeWrapper.innerHTML = `
    <div class="cake" aria-label="Birthday cake">
      <div class="cake-candle">
        <div class="cake-flame"></div>
      </div>
      <div class="cake-tier cake-tier-3"></div>
      <div class="cake-tier cake-tier-2"></div>
      <div class="cake-tier cake-tier-1"></div>
    </div>
  `;
}

function showSurpriseText() {
  const dur = state.reducedMotion ? 0.15 : 0.6;
  const delay = state.reducedMotion ? 0 : 0.4;

  gsap.to(dom.sLine1, { opacity: 1, y: 0, duration: dur, ease: 'power2.out' });
  gsap.to(dom.sLine2, { opacity: 1, y: 0, duration: dur, ease: 'power2.out', delay: delay });
  gsap.to(dom.sLine3, { opacity: 1, y: 0, duration: dur, ease: 'power2.out', delay: delay * 2,
    onComplete: () => {
      state.transitioning = false;
      // Auto transition to scene 5 after 2s
      setTimeout(transitionToScene5, state.reducedMotion ? 500 : 2200);
    }
  });
}

// ─── Scene 4 Canvas: floating ambient lights ─────────────────────────────────
function initScene4Canvas() {
  const canvas = $('scene4Canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 18 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 3 + 1,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -Math.random() * 0.5 - 0.2,
    alpha: Math.random() * 0.4 + 0.1
  }));

  let af4;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grad.addColorStop(0, `rgba(201,168,106,${p.alpha})`);
      grad.addColorStop(1, 'rgba(201,168,106,0)');
      ctx.fillStyle = grad;
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.vx; p.y += p.vy;
      if (p.y < -20) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
    });
    af4 = requestAnimationFrame(draw);
  }
  draw();
}

// ─── Scene 5: Celebration ─────────────────────────────────────────────────────
function transitionToScene5() {
  dom.scene4.classList.remove('active');
  dom.scene5.classList.add('active');
  dom.scene5.setAttribute('aria-hidden', 'false');

  try { AudioManager.peakOrchestral(); } catch(e) {}

  initCelebrationCanvas();

  const dur = state.reducedMotion ? 0.15 : 1;
  const tl = gsap.timeline();

  tl.fromTo(dom.celebHeading, {
    opacity: 0, y: 30
  }, {
    opacity: 1, y: 0,
    duration: dur * 1.5,
    ease: 'power2.out',
    delay: 0.4
  });

  tl.fromTo(dom.celebSub, {
    opacity: 0
  }, {
    opacity: 1,
    duration: dur,
    ease: 'power2.out'
  }, '-=0.5');

  // Camera pull-back: subtle scale on content
  if (!state.reducedMotion) {
    tl.fromTo($('celebrationContent'), {
      scale: 1.08
    }, {
      scale: 1,
      duration: 3,
      ease: 'power1.out'
    }, '<');
  }
}

// ─── Celebration Canvas: particles + fireworks ───────────────────────────────
function initCelebrationCanvas() {
  const canvas = dom.celebrationCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Golden floating particles
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height + Math.random() * 100,
    r: Math.random() * 2.5 + 0.5,
    vx: (Math.random() - 0.5) * 0.8,
    vy: -(Math.random() * 1.2 + 0.4),
    alpha: Math.random() * 0.6 + 0.2,
    color: Math.random() > 0.5 ? '201,168,106' : '255,240,200'
  }));

  // Fireworks bursts
  const fireworks = [];
  let fwTimer = 0;

  function createFirework() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.5;
    const count = 20 + Math.floor(Math.random() * 15);
    const color = `rgba(${Math.floor(180+Math.random()*60)},${Math.floor(140+Math.random()*60)},${Math.floor(60+Math.random()*60)}`;
    const sparks = Array.from({ length: count }, () => {
      const angle = (Math.random() * Math.PI * 2);
      const speed = Math.random() * 2 + 0.5;
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.9,
        r: Math.random() * 2 + 0.5
      };
    });
    fireworks.push({ sparks, color });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Particles
    particles.forEach(p => {
      ctx.beginPath();
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      g.addColorStop(0, `rgba(${p.color},${p.alpha})`);
      g.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = g;
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.vx + Math.sin(Date.now() * 0.001 + p.r) * 0.15;
      p.y += p.vy;
      p.alpha -= 0.0005;
      if (p.y < -20 || p.alpha < 0.05) {
        p.y = canvas.height + 10;
        p.x = Math.random() * canvas.width;
        p.alpha = Math.random() * 0.6 + 0.2;
      }
    });

    // Fireworks
    fwTimer++;
    if (fwTimer % 90 === 0) createFirework();

    fireworks.forEach((fw, fi) => {
      let allDead = true;
      fw.sparks.forEach(s => {
        if (s.alpha <= 0) return;
        allDead = false;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${fw.color},${s.alpha})`;
        ctx.fill();

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.04; // gravity
        s.vx *= 0.97;
        s.alpha -= 0.018;
        s.r *= 0.98;
      });
      if (allDead) fireworks.splice(fi, 1);
    });

    requestAnimationFrame(draw);
  }

  // First firework after a brief delay
  setTimeout(createFirework, 800);
  setTimeout(createFirework, 1600);
  draw();
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function bindEvents() {
  // Mouse parallax for gift box
  document.addEventListener('mousemove', e => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    targetRotY = ((e.clientX - cx) / cx) * 0.26;
    targetRotX = -((e.clientY - cy) / cy) * 0.18;
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
  });

  // Touch detection
  window.addEventListener('touchstart', () => {
    state.isTouchDevice = true;
    // Idle auto-rotation instead
    if (giftGroup && !state.reducedMotion) {
      gsap.to(giftGroup.rotation, {
        y: '+=6.28',
        duration: 14,
        ease: 'none',
        repeat: -1
      });
    }
  }, { once: true });

  // Open gift button
  dom.openGiftBtn.addEventListener('click', () => {
    animateSceneOpening();
  });
  dom.openGiftBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); animateSceneOpening(); }
  });

  // Envelope click
  dom.envelope.addEventListener('click', openEnvelope);
  dom.envelope.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

  // Continue button
  dom.continueBtn.addEventListener('click', transitionToScene4);
  dom.continueBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); transitionToScene4(); }
  });

  // Mute toggle
  dom.muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    dom.iconMuted.style.display = state.muted ? 'block' : 'none';
    dom.iconUnmuted.style.display = state.muted ? 'none' : 'block';
    dom.muteBtn.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
    try { AudioManager.setMute(state.muted); } catch(e) {}
  });

  // Visibility change — pause/resume GSAP
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gsap.globalTimeline.pause();
    } else {
      gsap.globalTimeline.resume();
    }
  });

  // Window resize — rebuild celebration canvas
  window.addEventListener('resize', () => {
    const cc = dom.celebrationCanvas;
    if (cc) { cc.width = window.innerWidth; cc.height = window.innerHeight; }
  });
}

// ─── Lenis Smooth Scroll ──────────────────────────────────────────────────────
async function initLenis() {
  try {
    await loadScript(CDN.lenis);
    if (window.Lenis) {
      const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }
  } catch (e) {
    console.warn('Lenis failed to load:', e);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  // Load GSAP
  await loadScript(CDN.gsap);
  gsap = window.gsap;
  if (!gsap) { console.error('GSAP failed'); return; }

  // Init audio (context, gains)
  try { AudioManager.init(); } catch(e) { console.warn('AudioContext:', e); }

  // Init Three.js (non-blocking)
  initThreeJS().then(() => {
    // Kick off arrival animations after Three.js is ready
    animateArrival();
  });

  // If Three.js hasn't loaded within 3s, show arrival anyway
  setTimeout(() => {
    if (!state.threeReady) animateArrival();
  }, 3000);

  // Bind all event listeners
  bindEvents();

  // Lenis smooth scroll (lazy)
  initLenis();

  // Reveal body
  document.body.classList.add('loaded');
}

// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
