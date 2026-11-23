// 공통 키트 — 3D 무대: 렌더러, 하늘, 땅, 조명, 품질 단계, 카메라 이동, 이름표, 입자(연기·불꽃)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// 품질 단계: 화소 비율 상한, 그림자 지도 크기(0 = 끔), 입자 수
export const QUALITY = {
  low: { pr: 1, shadow: 0, puffs: 150 },
  mid: { pr: 1.5, shadow: 2048, puffs: 450 },
  high: { pr: 2, shadow: 4096, puffs: 900 },
};
const LOOKS = {
  day: { elev: 40, azim: 215, turbidity: 3, rayleigh: 1.7, exposure: .62, sun: 4.2, sunCol: 0xfff1dc, hemi: [0xdfeaf5, 0x8a7d62, 1.1], fog: 0xc3d1d6, env: [0x9fc0e0, 0xf4efe2, 0x8d8468], grass: 0xffffff },
  dusk: { elev: 9, azim: 235, turbidity: 8, rayleigh: 2.2, exposure: .5, sun: 3.4, sunCol: 0xffc58a, hemi: [0x8c9cc0, 0x4d4338, 1.0], fog: 0x8f8f9c, env: [0x52648f, 0xf0b98a, 0x4a4238], grass: 0xb8b0a8 },
};

export function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  return t;
}
const rnd = seed => { let s = seed * 9301 + 49297; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// opts: { yard: 흙 마당 반지름(m), far: 가장 먼 거리, target/pos: 처음 시점, quality, theme, labels, reducedMotion }
export function createStage(box, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  box.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const far = opts.far ?? 8000;
  const cam = new THREE.PerspectiveCamera(38, 1, .05, far);
  const ctl = new OrbitControls(cam, renderer.domElement);
  Object.assign(ctl, { enableDamping: true, dampingFactor: .08, maxPolarAngle: Math.PI * .49, minDistance: .25, maxDistance: far * .4, zoomSpeed: .9 });

  // ---- 하늘·조명 ----
  const sky = new Sky(); sky.scale.setScalar(far * .55); sky.material.fog = false; sky.renderOrder = -10; scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); scene.add(sun, sun.target);
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .02;
  scene.fog = new THREE.Fog(0xffffff, far * .05, far * .6);
  const sunDir = new THREE.Vector3();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  // 환경맵: 하늘빛(위)·지평선·땅빛(아래) 그라데이션 구. 금속·옻칠 면의 반사와 부드러운 주변광에 쓴다
  function makeEnv(cols) {
    const g = new THREE.SphereGeometry(10, 32, 16), c = [], top = new THREE.Color(cols[0]), mid = new THREE.Color(cols[1]), bot = new THREE.Color(cols[2]), t = new THREE.Color();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; if (y >= 0) t.lerpColors(mid, top, Math.pow(y, .5)); else t.lerpColors(mid, bot, Math.min(1, -y * 4)); c.push(t.r, t.g, t.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const s = new THREE.Scene(); s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    envRT?.dispose(); envRT = pmrem.fromScene(s, .04); scene.environment = envRT.texture; g.dispose();
  }

  // ---- 땅: 풀밭 + 흙 마당 + 먼 산 ----
  const grassMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: .3, depthWrite: false,
    map: canvasTex(512, 512, (c, w, h) => {
      const r = rnd(7); c.fillStyle = '#7f8f55'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const g = 105 + r() * 60 | 0; c.fillStyle = `rgba(${g - 25 + r() * 30 | 0},${g + 14},${g - 62},.55)`; c.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 5); }
      for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(150,135,85,${.05 + r() * .08})`; c.beginPath(); c.arc(r() * w, r() * h, 12 + r() * 40, 0, 7); c.fill(); }
    }, [far / 6, far / 6]) });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(far * 1.6, far * 1.6), grassMat); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; grass.renderOrder = -5; scene.add(grass);   // 땅은 깊이를 쓰지 않음(큰 삼각형의 깊이 오차로 마당과 겹쳐 깜빡이는 것을 막음)
  const yardR = opts.yard ?? 7;
  const yard = new THREE.Mesh(new THREE.CircleGeometry(yardR, 64), new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: .3,
    map: canvasTex(1024, 1024, (c, w, h) => {
      const r = rnd(3), gr = c.createRadialGradient(w / 2, h / 2, w * .28, w / 2, h / 2, w * .5);
      c.fillStyle = '#b9a47c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 16000; i++) { const v = 150 + r() * 60 | 0; c.fillStyle = `rgba(${v + 18},${v},${v - 40},.5)`; c.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
      for (let i = 0; i < 260; i++) { const v = 120 + r() * 70 | 0; c.fillStyle = `rgba(${v},${v - 6},${v - 22},.8)`; c.beginPath(); c.ellipse(r() * w, r() * h, 1.5 + r() * 3.5, 1 + r() * 2.5, r() * 3, 0, 7); c.fill(); }
      gr.addColorStop(0, '#000f'); gr.addColorStop(1, '#0000'); c.globalCompositeOperation = 'destination-in'; c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }) }));
  yard.rotation.x = -Math.PI / 2; yard.position.y = .004; yard.receiveShadow = true; scene.add(yard);
  const hills = new THREE.Group(); hills.renderOrder = -8; scene.add(hills);
  [[far * .42, 260, 0x7f957f, 11], [far * .5, 420, 0x93a7a6, 23]].forEach(([R, H, col, seed]) => {
    const N = 120, pos = [], idx = [], r = rnd(seed), ph = [r() * 6, r() * 6, r() * 6];
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, h = H * (.35 + .3 * (Math.sin(a * 3 + ph[0]) * .5 + .5) + .22 * (Math.sin(a * 7 + ph[1]) * .5 + .5) + .13 * (Math.sin(a * 17 + ph[2]) * .5 + .5));
      pos.push(Math.cos(a) * R, -20, Math.sin(a) * R, Math.cos(a) * R * 1.04, h, Math.sin(a) * R * 1.04); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const hm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); hm.userData.base = col; hm.renderOrder = -8; hills.add(hm);
  });

  // ---- 품질 ----
  let qName = 'mid', auto = false, look = LOOKS.day;
  function setQuality(name) {
    auto = name === 'auto';
    if (auto) name = (navigator.hardwareConcurrency || 4) <= 4 || /Android|iPhone|iPad|CrOS/.test(navigator.userAgent) ? 'mid' : 'high';
    applyQuality(name);
  }
  function applyQuality(name) {
    qName = name; const q = QUALITY[name];
    renderer.setPixelRatio(Math.min(q.pr, devicePixelRatio || 1));
    renderer.shadowMap.enabled = q.shadow > 0; sun.castShadow = q.shadow > 0;
    if (q.shadow && sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => (m.needsUpdate = true)); });
    smoke.limit = fire.limit = q.puffs; resize();
  }
  function setTheme(theme) {
    look = theme === 'dark' ? LOOKS.dusk : LOOKS.day;
    const u = sky.material.uniforms, phi = THREE.MathUtils.degToRad(90 - look.elev), th = THREE.MathUtils.degToRad(look.azim);
    sunDir.setFromSphericalCoords(1, phi, th);
    u.sunPosition.value.copy(sunDir); u.turbidity.value = look.turbidity; u.rayleigh.value = look.rayleigh; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .82;
    renderer.toneMappingExposure = look.exposure;
    sun.color.set(look.sunCol); sun.intensity = look.sun;
    hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2];
    scene.fog.color.set(look.fog); grassMat.color.set(look.grass); yard.material.color.set(look.grass);
    hills.children.forEach(h => h.material.color.set(h.userData.base).lerp(new THREE.Color(look.fog), theme === 'dark' ? .55 : .15));
    makeEnv(look.env);
  }

  // ---- 크기·카메라 ----
  function resize() { const r = box.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(box);
  let camAnim = null, home = [opts.pos || [3, 2, 3.5], opts.target || [0, 1, 0]], reduced = !!opts.reducedMotion;
  function view(pos, target, dur = 1.1) {
    resize();
    // 세로로 긴 화면에서는 물러나서 전체가 보이게 한다
    const t1 = new THREE.Vector3(...target), k = cam.aspect < 1 ? Math.pow(1 / cam.aspect, .8) : 1;
    camAnim = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: new THREE.Vector3(...pos).sub(t1).multiplyScalar(k).add(t1), t1, u: 0, dur: reduced ? .01 : dur };
  }
  const setHome = (pos, target, go = true) => { home = [pos, target]; if (go) view(pos, target); };
  const zoom = f => { cam.position.sub(ctl.target).multiplyScalar(f).add(ctl.target); };

  // ---- 이름표 ----
  const tags = new THREE.Group(); scene.add(tags); tags.visible = opts.labels ?? true;
  function label(text, color = '#26211b') {
    const pad = 16, fs = 34, c = document.createElement('canvas'), g = c.getContext('2d'), font = `700 ${fs}px "Noto Sans KR","Malgun Gothic",sans-serif`;
    g.font = font; const w = Math.ceil(g.measureText(text).width) + pad * 2, h = fs + pad * 1.3;
    c.width = w; c.height = h; g.font = font;
    g.fillStyle = 'rgba(255,253,247,.95)'; g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, h / 2); g.fill(); g.stroke();
    g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, pad, h / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false, fog: false, toneMapped: false }));
    s.scale.set(w / h * .034, .034, 1); s.renderOrder = 10; return s;
  }
  function setTags(list) {
    tags.children.forEach(s => { s.material.map.dispose(); s.material.dispose(); }); tags.clear();
    for (const [t, p, c] of list) { const s = label(t, c); s.position.set(...p); tags.add(s); }
  }

  // ---- 입자 ----
  const smoke = makePuffs(scene, THREE.NormalBlending), fire = makePuffs(scene, THREE.AdditiveBlending);

  // ---- 그리기 ----
  const frames = []; const clock = new THREE.Clock(); let slow = 0, counted = 0;
  function start() {
    resize();
    renderer.setAnimationLoop(() => {
      const raw = clock.getDelta(), dt = Math.min(.05, raw);
      if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt / camAnim.dur); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u);
        cam.position.lerpVectors(camAnim.p0, camAnim.p1, e); ctl.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
      for (const f of frames) f(dt);
      ctl.update();
      sky.position.copy(cam.position); hills.position.set(cam.position.x, 0, cam.position.z);
      // 그림자는 보고 있는 곳 둘레만 (카메라 거리에 맞춰 넓어짐)
      const d = THREE.MathUtils.clamp(cam.position.distanceTo(ctl.target) * .9, 3, 40), sc = sun.shadow.camera;
      if (sc.right !== d) { sc.left = sc.bottom = -d; sc.right = sc.top = d; sc.near = 1; sc.far = 160; sc.updateProjectionMatrix(); }
      sun.target.position.copy(ctl.target); sun.position.copy(ctl.target).addScaledVector(sunDir, 70);
      const px = renderer.domElement.height * .5 / Math.tan(cam.fov * Math.PI / 360);
      smoke.update(dt, px); fire.update(dt, px);
      renderer.render(scene, cam);
      // 자동 품질: 처음 몇 초 동안 느리면 한 단계 낮춘다
      if (auto && counted < 240 && ++counted > 60) { if (raw > .042) slow++; if (counted === 240 && slow > 70 && qName !== 'low') { applyQuality(qName === 'high' ? 'mid' : 'low'); counted = 60; slow = 0; } }
    });
  }

  setQuality(opts.quality || 'auto'); setTheme(opts.theme || 'light');
  cam.position.set(...home[0]); ctl.target.set(...home[1]);
  return { renderer, scene, cam, ctl, sun, yard, smoke, fire, view, setHome, home: () => view(...home), zoom, stopCam: () => { camAnim = null; }, label, setTags, tags,
    setQuality, setTheme, setLabels: v => { tags.visible = v; }, setReducedMotion: v => { reduced = v; }, isReduced: () => reduced,
    quality: () => qName, onFrame: f => frames.push(f), start, resize };
}

// 부드러운 원 입자. emit({p:[x,y,z], v:[x,y,z], size, grow, life, color:[r,g,b], alpha, drag, rise})
function makePuffs(scene, blending) {
  const MAX = 900, pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), size = new Float32Array(MAX), P = [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('rgba', new THREE.BufferAttribute(col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending, uniforms: { px: { value: 500 } },
    vertexShader: 'attribute vec4 rgba;attribute float size;uniform float px;varying vec4 c;void main(){c=rgba;vec4 m=modelViewMatrix*vec4(position,1.);gl_PointSize=min(512.,size*px/max(.1,-m.z));gl_Position=projectionMatrix*m;}',
    fragmentShader: 'varying vec4 c;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.25,d)*c.a;if(a<.004)discard;gl_FragColor=vec4(c.rgb,a);}' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const sys = { limit: MAX,
    emit(o) { if (P.length >= sys.limit) P.shift(); P.push({ p: [...o.p], v: [...(o.v || [0, 0, 0])], size: o.size ?? .2, grow: o.grow ?? 0, life: o.life ?? 1, t: 0, color: o.color || [1, 1, 1], alpha: o.alpha ?? .6, drag: o.drag ?? 1, rise: o.rise ?? 0 }); },
    clear() { P.length = 0; },
    update(dt, px) {
      mat.uniforms.px.value = px;
      for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.t += dt; if (q.t >= q.life) { P.splice(i, 1); continue; }
        const k = Math.exp(-q.drag * dt); q.v[0] *= k; q.v[1] = q.v[1] * k + q.rise * dt; q.v[2] *= k;
        q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; q.size += q.grow * dt; }
      const n = Math.min(P.length, MAX);
      for (let i = 0; i < n; i++) { const q = P[i], u = q.t / q.life; pos.set(q.p, i * 3); size[i] = q.size; col.set([q.color[0], q.color[1], q.color[2], q.alpha * Math.min(1, u * 8) * (1 - u) ** 1.5], i * 4); }
      geo.setDrawRange(0, n); for (const a of ['position', 'rgba', 'size']) geo.attributes[a].needsUpdate = true;
    } };
  return sys;
}
