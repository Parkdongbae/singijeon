import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ARROWS, FLY, BUILD, JOINTS, CART, CORES, TUBE_BUILT, DAMAGE, DAMAGE_MAX, fly, volley, impactStats } from './sim.js';
import { MAT, ground, buildCart, buildArrow, buildJoint, buildRack, label } from './model.js';

const $ = id => document.getElementById(id);
const at = (o, x, y, z) => (o.position.set(x, y, z), o);
const cv = $('cv');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
cv.prepend(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, .02, 6000);
const ctl = new OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * .495; ctl.minDistance = .2; ctl.maxDistance = 3000;
scene.add(new THREE.HemisphereLight(0xf4efe4, 0x6f6a58, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(3, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun);
ground(scene);
window.__cam = cam;

function resize() { const r = cv.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(cv);
let camAnim = null, homeView = [[3.2, 2.2, 3.4], [0, .9, 0]];
function view(pos, target, dur = 1) {
  resize();
  const t1 = new THREE.Vector3(...target), k = cam.aspect < 1 ? Math.pow(1 / cam.aspect, .8) : 1;
  camAnim = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: new THREE.Vector3(...pos).sub(t1).multiplyScalar(k).add(t1), t1, u: 0, dur };
}
$('zi').onclick = () => cam.position.lerp(ctl.target, .2);
$('zo').onclick = () => cam.position.sub(ctl.target).multiplyScalar(1.25).add(ctl.target);
$('zr').onclick = () => view(...homeView);
const tags = new THREE.Group(); scene.add(tags);
function setTags(list) { tags.clear(); for (const [t, p, c] of list) { const s = label(t, c); s.position.set(...p); tags.add(s); } }

// ================= 제작 =================
const cart = buildCart(); scene.add(cart.root);
const P = cart.P;
const groups = { hub: [...P.hub], spoke: [...P.spoke], rim: [...P.rim], axle: P.axle, frame: P.frame, deck: P.deck, box: P.box, tubes: P.tubes, mount: P.prop, load: P.load };
const order = BUILD.map(b => b.key);
let step = 0, stepT = 1, bPlaying = false, bTimer = 0;
$('steps').innerHTML = BUILD.map((s, i) => `<button data-i="${i}">${s.t}</button>`).join('');
$('steps').onclick = e => { const b = e.target.closest('button'); if (b) setStep(+b.dataset.i); };
// 결구 확대창 (작은 렌더러)
const jr = new THREE.WebGLRenderer({ canvas: $('jcv'), antialias: true, alpha: true }); jr.setPixelRatio(Math.min(2, devicePixelRatio)); jr.setSize(150, 110, false);
const js = new THREE.Scene(); js.add(new THREE.HemisphereLight(0xffffff, 0x777766, 1.6)); const jl = new THREE.DirectionalLight(0xffffff, 1.6); jl.position.set(2, 3, 2); js.add(jl);
const jc = new THREE.PerspectiveCamera(35, 150 / 110, .01, 10); jc.position.set(.7, .55, .8); jc.lookAt(0, 0, 0);
let joint = null, jt = 0;
function setJoint(kind) {
  if (joint) js.remove(joint.g);
  $('jbox').hidden = !kind; if (!kind) { joint = null; return; }
  joint = buildJoint(kind); js.add(joint.g); $('jN').textContent = JOINTS[kind].nm + ' (추정)'; $('jD').textContent = JOINTS[kind].d;
}
const STEP_VIEW = { hub: [[.9, .8, 1.6], [0, .45, .3]], spoke: [[.9, .8, 1.6], [0, .45, .3]], rim: [[.9, .8, 1.6], [0, .45, .3]], axle: [[.4, .9, 1.8], [0, .45, 0]],
  frame: [[2.6, 2.4, 2.8], [-.3, .9, 0]], deck: [[2.2, 2.5, 2.4], [-.2, 1.1, 0]], box: [[2.4, 2.2, 2.4], [-.2, 1.3, 0]], tubes: [[2.2, 1.7, 1.6], [.1, 1.35, 0]], mount: [[.6, 1.5, 3.6], [-.3, .9, 0]], load: [[2.8, 2.2, 2.8], [.2, 1.4, 0]] };
function setStep(i) {
  step = Math.max(0, Math.min(BUILD.length - 1, i)); stepT = 0;
  const s = BUILD[step]; $('bT').textContent = s.t; $('bD').textContent = s.d; $('cap').textContent = s.t.replace(/^\d+\. /, '');
  $('bTags').innerHTML = (s.rec ? `<span class="rec">기록: ${s.rec}</span>` : '') + (s.est ? `<span class="est">추정: ${s.est}</span>` : '');
  [...$('steps').children].forEach((b, k) => b.classList.toggle('on', k === step));
  setJoint(s.joint); homeView = STEP_VIEW[s.key]; view(...homeView);
  const yb = cart.root.userData.yb;
  setTags(s.key === 'rim' ? [['바퀴 지름 870mm', [0, .95, .45]]] : s.key === 'frame' ? [['차체 2,300 × 740mm', [-.6, 1.4, .45]], ['옆판으로 높인 차체', [0, .85, .5], '#2f6ea8']]
    : s.key === 'box' ? [['신기전기 길이 1,149.4mm', [0, 1.55, .5]]] : s.key === 'tubes' ? [['원공목통 100개 · 7층', [.75, 1.45, .3]], ['구멍 지름 46mm', [.75, 1.0, .5]]]
    : s.key === 'mount' ? [[`손잡이를 땅에 대면 약 ${Math.round(cart.maxAngle)}°`, [-.9, .5, .5]], ['원공목통 아래 굴대', [.1, .45, .6], '#2f6ea8']] : s.key === 'load' ? [['15발씩 위층부터 차례로', [.8, 1.75, .3]]] : []);
}
function buildFrame(dt) {
  stepT = Math.min(1, stepT + dt / 1.1); const e = 1 - (1 - stepT) ** 3, k = order[step];
  const xray = $('xray').checked;
  for (const [key, objs] of Object.entries(groups)) {
    const idx = order.indexOf(key), vis = idx <= step;
    objs.forEach(o => { o.visible = vis; if (!o.userData.home) o.userData.home = o.position.clone();
      const off = key === k ? (1 - e) * .5 : 0, xo = xray && vis ? ({ hub: 0, spoke: 0, rim: 0, axle: -.2, frame: .35, deck: .55, box: .9, tubes: 1.1, mount: .7, load: 1.1 })[key] : 0;
      o.position.copy(o.userData.home); o.position.y += off + xo; });
  }
  cart.setAngle(order.indexOf('mount') <= step ? cart.maxAngle * (k === 'mount' ? e : 1) : 0);
  if (bPlaying && stepT >= 1) { bTimer += dt; if (bTimer > 3.4) { bTimer = 0; if (step < BUILD.length - 1) setStep(step + 1); else { bPlaying = false; $('bPlay').textContent = '▶ 차례로 보기'; } } }
  if (joint) { jt += dt; const u = (Math.sin(jt * 1.6) + 1) / 2; joint.anim(u * u); joint.g.rotation.y = jt * .3; jr.render(js, jc); }
}
$('bPrev').onclick = () => setStep(step - 1); $('bNext').onclick = () => setStep(step + 1);
$('bPlay').onclick = () => { bPlaying = !bPlaying; bTimer = 0; $('bPlay').textContent = bPlaying ? '⏸ 멈춤' : '▶ 차례로 보기'; if (bPlaying && step === BUILD.length - 1) setStep(0); };

// ================= 신기전 구조 =================
const arrowG = new THREE.Group(); scene.add(arrowG);
let aMode = 'all';
const AKEYS = ['dae', 'sanhwa', 'jung', 'so'];
$('aTbl').innerHTML = `<tr><th></th>${AKEYS.map(k => `<th>${ARROWS[k].nm.replace('신기전', '')}</th>`).join('')}</tr>` +
  [['총길이', a => a.total], ['안정막대', a => a.stick], ['약통 길이', a => a.tube.L], ['약통 겉지름', a => a.tube.D], ['약통 안지름', a => a.tube.d], ['통 두께', a => a.tube.t], ['분사구멍', a => a.tube.nozzle], ['발화통 길이', a => a.bomb ? a.bomb.L : '—'], ['발화통 지름', a => a.bomb ? a.bomb.D : '—']]
    .map(([n, f]) => `<tr><td>${n}</td>${AKEYS.map(k => `<td>${f(ARROWS[k]).toLocaleString()}</td>`).join('')}</tr>`).join('');
const ADESC = {
  all: '실제 크기로 나란히 놓았습니다(위부터 대·산화·중·소). 대신기전은 5.6m로, 당시 가장 큰 대포 장군화통의 대전(1.9m)보다 훨씬 깁니다.',
  dae: '대나무 안정막대(길이 17척, 윗둘레 1촌·아래둘레 3촌) 앞끝에 종이 약통을 묶고, 그 앞에 대신기전 발화통(폭탄)을 얹습니다. 약통 윗면과 발화통 아랫면 가운데 구멍을 약선으로 이어, 날아가는 도중이나 거의 다 날아갔을 때 발화통이 저절로 터지게 했습니다.',
  sanhwa: '크기는 대신기전과 같으나 발화통을 얹지 않고, 약통 위끝에서 3촌7분을 비워 그 안에 지화(작은 로켓)와 소발화(작은 폭탄)를 묶어 넣었습니다. 추진제가 다 타면 약선으로 지화에 불이 붙어 사방으로 흩어집니다.',
  jung: '대나무 앞에 화살촉, 그 뒤에 약통, 약통 위에 소발화통, 끝에 새 깃. 추진 화약이 다 타면 속 심지로 소발화통이 터집니다. 화차의 신기전기에 100발을 꽂아 쏘았습니다. 시험 사거리 200~250m.',
  so: '길이 100cm 남짓한 대나무, 앞에 화살촉, 약통만 있고 발화통은 없습니다. 맞혀서 다치게 하는 화살입니다. 사거리 100~150m.',
  tube: `대신기전 약통을 반으로 잘라 보았습니다. 한지를 말아 만든 통(두께 16.2mm) 속에 화약을 다져 넣고, 가운데 끝이 뾰족한 쇠심을 꽂았다 빼서 원뿔 모양 「약선구멍」을 남깁니다 — 불이 타는 면이 넓어져 추력이 커집니다. 아래에는 분사구멍(지름 37.5mm), 위는 종이를 여러 겹 접어 막고 약선으로 발화통에 잇습니다.<br><span class="m">복원 약통(이용우 외 2008): 한지 홑지 ${TUBE_BUILT.sheets}을 ${TUBE_BUILT.layers} 말고 녹말풀로 붙임, 안지름 ${TUBE_BUILT.d} · 겉지름 ${TUBE_BUILT.D} · 길이 ${TUBE_BUILT.L}mm, 무게 ${TUBE_BUILT.kg}kg. 병기도설 환산 겉지름 102mm는 안지름+두께×2(95.5mm)와 맞지 않아 복원은 두께 기록을 따랐습니다.</span>`,
};
function setArrow(mode) {
  aMode = mode; arrowG.clear();
  [...$('aSel').children].forEach(b => b.classList.toggle('on', b.dataset.a === mode));
  $('aD').innerHTML = ADESC[mode];
  if (mode === 'all') {
    AKEYS.forEach((k, i) => { const a = buildArrow(k); a.g.position.set(-2.8, .9, -.9 + i * .6); arrowG.add(a.g); });
    // 1m 자
    for (let m = 0; m <= 5; m++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.01, .01, .1), MAT.iron); t.position.set(-2.8 + m, .9, 1.6); arrowG.add(t); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5, .006, .01), MAT.iron); bar.position.set(-.3, .9, 1.6); arrowG.add(bar);
    homeView = [[0, 4.6, 6.6], [0, .9, .3]];
    setTags([['대신기전 5,588mm', [-.2, 1.15, -.9]], ['산화신기전 5,310.8mm', [-.2, 1.15, -.3]], ['중신기전 1,455mm', [-2.1, 1.05, .3]], ['소신기전 1,152mm', [-2.2, 1.05, .9]], ['5m', [2.2, 1, 1.6]]]);
  } else if (mode === 'tube') {
    const a = buildArrow('dae', { cut: true }); a.g.position.set(-a.g.userData.tubeX0 - .35, .9, 0); arrowG.add(a.g);
    homeView = [[.05, 1.05, 1.1], [.05, .9, .08]];
    setTags([['한지 약통 벽 16.2mm', [0, .98, .1]], ['화약(추진제)', [-.1, .925, .1], '#2f6ea8'], ['약선구멍(쇠심 자리)', [-.22, .9, .1], '#9e2f1e'], ['분사구멍 37.5mm', [-.33, .85, .1]], ['종이 마개 · 약선', [.25, .96, .1]], ['발화통', [.45, .96, .1]]]);
  } else {
    const a = buildArrow(mode); const L = a.g.userData.len; a.g.position.set(-L / 2, .9, 0); arrowG.add(a.g);
    homeView = [[0, 1.2 + L * .25, Math.max(.8, L * .55)], [0, .9, 0]];
    const tx = -L / 2 + a.g.userData.tubeX0 + a.g.userData.tL / 2;
    setTags([['약통', [tx, .99 + (L > 3 ? .06 : 0), 0]], ['안정막대(대나무)', [-L / 4, .97, 0]], ['깃', [-L / 2 + .1, 1.0, 0]]].concat(ARROWS[mode].bomb && !ARROWS[mode].bomb.inner ? [['발화통', [L / 2 - .08, 1.04, 0], '#9e2f1e']] : []));
  }
  view(...homeView);
}
$('aSel').onclick = e => { const b = e.target.closest('button'); if (b) setArrow(b.dataset.a); };

// ================= 화약 =================
const powderG = new THREE.Group(); scene.add(powderG);
{
  const piles = [['염초(질산칼륨)', 75, 0xf3f0e8], ['숯', 15, 0x2a2826], ['유황', 10, 0xd9c23a]];
  piles.forEach(([n, pct, c], i) => { const r = .1 + Math.cbrt(pct) * .045; const m = new THREE.Mesh(new THREE.ConeGeometry(r, r * .7, 32), new THREE.MeshStandardMaterial({ color: c, roughness: 1 })); m.position.set(-.7 + i * .55, r * .35 + .7, 0); m.castShadow = true; powderG.add(m);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(r + .05, r + .07, .02, 32), MAT.woodD); plate.position.set(-.7 + i * .55, .69, 0); powderG.add(plate); });
  powderG.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, .05, .9), MAT.wood), -.15, .65, 0));
  for (const [x, z] of [[-1.15, -.38], [-1.15, .38], [.85, -.38], [.85, .38]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .65, .06), MAT.woodD); l.position.set(x, .325, z); powderG.add(l); }
}
// 약통에 화약 다지기(병기도설): 반 자른 종이통 + 뾰족한 쇠심 + 속 빈 쇠막대
const tamp = new THREE.Group(); tamp.position.set(.95, .68, 0); tamp.rotation.y = Math.PI / 2; powderG.add(tamp);
const tH = .5, tRo = .06, tRi = .04;
tamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(tRo, tRo, tH, 32, 1, true, 0, Math.PI), MAT.paper), 0, tH / 2, 0));
tamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(tRi, tRi, tH, 32, 1, true, 0, Math.PI), MAT.paperIn), 0, tH / 2, 0));
const spike = new THREE.Mesh(new THREE.ConeGeometry(.012, tH * .75, 12), MAT.iron); spike.position.y = tH * .375; tamp.add(spike);
const fill = new THREE.Mesh(new THREE.CylinderGeometry(tRi - .001, tRi - .001, 1, 32, 1, false, 0, Math.PI), MAT.powder); fill.geometry.translate(0, .5, 0); tamp.add(fill);
const ram = new THREE.Group(); tamp.add(ram);
ram.add(at(new THREE.Mesh(new THREE.CylinderGeometry(tRi - .002, tRi - .002, .5, 24, 1, true), MAT.iron), 0, .25, 0));
const POWDER_HTML = `<h2>화약 <small>흑색화약 · 염초 만들기 · 약통 채우기</small></h2>
 <div class="d">조선에서 만들 수 있었던 화약은 오늘날 <b>흑색화약</b>이라 부르는 것뿐이었습니다. 염초·숯·유황을 대략 <b>75 : 15 : 10</b>으로 섞은 것으로 알려져 있습니다. 숯과 유황은 연료, 염초(질산칼륨)는 타는 데 필요한 산소를 내놓는 산화제라 공기가 없는 약통 속에서도 탑니다.</div>
 <div class="d" style="margin-top:8px"><b>왜 염초가 가장 귀했나</b> — 숯은 쉽게 얻고 유황은 적게 들지만, 염초는 흙 속 질산염을 잿물과 섞어 끓여 얻어 양이 매우 적었습니다. 최무선은 부뚜막·마루 밑 흙과 재에서 염초를 얻는 법을 알아내 고려 말 화약을 만들었습니다(최무선의 『화약수련법』은 전하지 않음). 조선은 유황·염초가 모자라 신기전의 화약 소비가 큰 부담이었습니다.</div>
 <div class="d" style="margin-top:8px"><b>『신전자초방』(김지남)의 10단계</b></div>
 ${['흙 모으기(取土) — 오래된 집 안·부뚜막·마루 밑·담장 밑·구들 밑·길 위의 흙', '재 받기(取灰) — 다북쑥·곡식대·콩깍지 등을 태운 재(소나무 재는 쓰지 않음)', '섞기(交合) — 흙과 재를 섞음', '물 거르기(篩水) — 바닥 뚫린 독에 넣고 물을 부어 우려냄', '물 달이기(熬水) — 우린 물을 졸여 거친 염초(모초)를 얻음', '재련(再煉) — 다시 녹여 끓이고 식혀 결정을 얻음', '삼련(三煉) — 한 번 더 같은 방법으로 깨끗이', '풀 베기(刈草)', '아교 넣기(膠水)', '섞어 찧기(合製) — 염초·숯·유황을 합침'].map((t, i) => `<div class="step"><b>${i + 1}</b><span>${t}</span></div>`).join('')}
 <div class="m">과학으로 보면: 사람이 사는 곳 흙에는 유기물이 분해되어 생긴 <b>질산 이온</b>이, 풀을 태운 재에는 <b>칼륨 이온</b>이 많습니다. 둘을 물에 녹여 졸이면 질산칼륨 결정이 생기고, 녹는 정도 차이(분별 결정)로 여러 번 정제합니다. 재현 실험에서 마루 밑 흙과 쑥 재가 가장 좋았고, 1:1 혼합에서 순도 68%, 정제 후 약 14% 높아졌습니다(김준수 외 2015).</div>
 <div class="d" style="margin-top:8px"><b>약통에 채우기</b>(병기도설, 3D 오른쪽) — 약통 가운데 끝이 뾰족한 긴 쇠심을 꽂고, 화약을 조금씩 넣고 <b>가운데가 빈 둥근 쇠막대</b>로 다지기를 되풀이한 뒤 쇠심을 빼면 그 자리가 <b>약선구멍</b>이 됩니다. 구멍이 너무 크면 압력이 커서 통이 터지고, 너무 작으면 추력이 모자랐습니다(채연석).</div>
 <div class="safe">⚠ 화약은 마찰·충격·불꽃에 쉽게 불이 붙고 폭발합니다. 이 내용은 역사와 원리를 배우기 위한 것으로 실제 제조 방법이 아닙니다. 화약류를 만들거나 다루는 것은 법으로 금지되어 있습니다(총포·도검·화약류 등의 안전관리에 관한 법률).</div>
 <div class="src">출처: 김준수·김지훈·장미경(2015) 『화약·발파』 33(2) · 채연석 「세종시대 로켓과 화약무기의 기술」 · 박재광(2007)</div>`;
$('powderbox').innerHTML = POWDER_HTML;
let pt = 0;
function powderFrame(dt) {
  pt += dt; const cycle = 1.6, n = Math.floor(pt / cycle) % 8, u = (pt % cycle) / cycle;
  const level = Math.min(tH * .92, (n + Math.min(1, u * 2)) * tH * .115);
  fill.scale.y = Math.max(.001, level); ram.position.y = level + (u < .5 ? .3 : .3 - Math.sin((u - .5) * 2 * Math.PI) * .28 * (u < .75 ? 1 : 0));
  spike.visible = !(n === 7 && u > .6); if (!spike.visible) ram.position.y = tH + .4;
}

// ================= 발사 시뮬레이션 =================
const launchG = new THREE.Group(); scene.add(launchG);
const lcart = buildCart(); launchG.add(lcart.root); lcart.root.rotation.y = 0;
let rack = buildRack(3.3); launchG.add(rack.g);
const markers = new THREE.Group(); launchG.add(markers);
for (let d = 100; d <= 1500; d += 100) { const m = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, 6), new THREE.MeshBasicMaterial({ color: d % 500 ? 0xd8d0b8 : 0xb5612a })); m.position.set(d, .01, 0); markers.add(m); const s = label(d + 'm'); s.position.set(d, 2, 3); markers.add(s); }
const flyG = new THREE.Group(); launchG.add(flyG);
const dmgG = new THREE.Group(); launchG.add(dmgG);
const dmgMat = new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: .28, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x9e2f1e, side: THREE.DoubleSide });
// 탄착점과 피해 반경을 땅에 그림 + 위에서 내려다보기
function showDamage(moveCam) {
  dmgG.clear(); if (!lastResult) return;
  const r = +$('lDmg').value, x0 = shots.length ? shots[0].x0 ?? 0 : 0;
  const pts = shots.map(s => [(['dae', 'sanhwa'].includes(lastType) ? Math.cos(lastAng) * 1.5 : s.x0) + s.r.range, s.z0 + s.r.lat]);
  const st = impactStats(pts, r);
  const disk = new THREE.CircleGeometry(Math.max(r, .05), 40), dot = new THREE.CircleGeometry(.12, 10);
  pts.forEach(([x, z]) => {
    if (r > 0) { const d = new THREE.Mesh(disk, dmgMat); d.rotation.x = -Math.PI / 2; d.position.set(x, .03, z); dmgG.add(d); }
    const p = new THREE.Mesh(dot, ringMat); p.rotation.x = -Math.PI / 2; p.position.set(x, .04, z); dmgG.add(p);
  });
  // 전체 범위 테두리
  const w = st.x1 - st.x0, h = st.y1 - st.y0, edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), new THREE.LineBasicMaterial({ color: 0x2b2620 }));
  edge.rotation.x = -Math.PI / 2; edge.position.set((st.x0 + st.x1) / 2, .05, (st.y0 + st.y1) / 2); dmgG.add(edge);
  const lab = label(`피해 면적 약 ${Math.round(st.area).toLocaleString()}m² (반경 ${r}m, 가정)`, '#9e2f1e'); lab.position.set(st.cx, Math.max(3, w * .15), st.cy); dmgG.add(lab);
  $('oDL').textContent = st.len.toFixed(1) + 'm'; $('oDW').textContent = st.wid.toFixed(1) + 'm'; $('oDA').textContent = Math.round(st.area).toLocaleString() + 'm²'; $('oDN').textContent = pts.length + '발';
  if (moveCam) { const span = Math.max(w, h, 8); view([st.cx - span * .25, span * 1.3, st.cy + span * .9], [st.cx, 0, st.cy], 1.2); }
}
let lastType = 'jung', lastAng = 0;
const trailMat = new THREE.LineBasicMaterial({ color: 0x9e2f1e });
let shots = [], simT = 0, firing = false, lastResult = null;
const opt = () => {
  const type = $('lType').value, F = FLY[type], u = +$('lProp').value / 100;
  return { type, prop: F.propMin + (F.propMax - F.propMin) * u, angle: +$('lAng').value, core: +$('lCore').value, rail: type === 'dae' || type === 'sanhwa' ? +$('lRail').value : F.rail, bomb: $('lBomb').checked, wind: +$('lWind').value, seed: Math.floor(Math.random() * 1e6) };
};
function syncUI() {
  const o = opt(), big = o.type === 'dae' || o.type === 'sanhwa';
  $('lPropV').textContent = big ? (o.prop * 1000).toFixed(0) + 'g' : (o.prop * 1000).toFixed(0) + 'g (가정)';
  $('lAngV').textContent = o.angle + '°' + (!big ? (o.angle > lcart.maxAngle ? ` ⚠ 최대 ${Math.round(lcart.maxAngle)}°` : ` · 손잡이 높이 ${Math.round(lcart.handleH(o.angle) * 100)}cm`) : '');
  $('lDmgV').textContent = (+$('lDmg').value).toFixed(1) + 'm' + (o.type === 'so' ? ' (화살 맞은 자리)' : o.type === 'sanhwa' ? ' (지화·소발화 흩어짐)' : ' (발화통 폭발)');
  $('lWindV').textContent = o.wind === 0 ? '없음' : (o.wind > 0 ? '뒷바람 ' : '맞바람 ') + Math.abs(o.wind) + 'm/s';
  $('rowCore').hidden = $('rowRail').hidden = !big; $('rowBomb').hidden = o.type !== 'dae';
  lcart.root.visible = !big; rack.g.visible = big;
  if (big) rack.set(o.angle); else lcart.setAngle(Math.min(o.angle, lcart.maxAngle));
}
$('lDmg').addEventListener('input', () => { syncUI(); if (lastResult && !firing) showDamage(); });
['lType', 'lProp', 'lAng', 'lCore', 'lRail', 'lBomb', 'lWind'].forEach(id => $(id).addEventListener('input', () => {
  if (id === 'lRail') { launchG.remove(rack.g); rack = buildRack(+$('lRail').value); launchG.add(rack.g); }
  if (id === 'lType') { const big = ['dae', 'sanhwa'].includes($('lType').value); $('lAng').value = big ? 60 : 40; setPropDefault(); setDmgDefault(); resetShots(); homeView = big ? [[-6, 4, 9], [3, 2, 0]] : [[-3, 2.4, 4.5], [0, 1, 0]]; view(...homeView); }
  syncUI();
}));
function setDmgDefault() { const t = $('lType').value; $('lDmg').max = DAMAGE_MAX[t]; $('lDmg').value = DAMAGE[t]; }
setDmgDefault();
function setPropDefault() { const F = FLY[$('lType').value]; $('lProp').value = Math.round((F.prop - F.propMin) / (F.propMax - F.propMin) * 100); }
setPropDefault();
function resetShots() { dmgG.clear(); ['oDL', 'oDW', 'oDA', 'oDN'].forEach(i => ($(i).textContent = '—'));  flyG.clear(); shots = []; firing = false; simT = 0; $('hud').hidden = true; P.arrowList.forEach(a => (a.visible = true)); lcart.P.arrowList.forEach(a => (a.visible = true)); }
$('lReset').onclick = () => { resetShots(); view(...homeView); };
const arrowProto = {};
function protoFor(type) { if (!arrowProto[type]) arrowProto[type] = buildArrow(type).g; return arrowProto[type]; }
$('lFire').onclick = () => {
  resetShots(); const o = opt(), big = o.type === 'dae' || o.type === 'sanhwa';
  const res = big ? [{ ...fly(o), delay: 0, layer: 0, col: 0, n: 1 }] : volley({ ...o, angle: Math.min(o.angle, lcart.maxAngle) });
  const proto = protoFor(o.type), len = proto.userData.len;
  // 발사 위치(세계): 대 = 발사대 레일 위, 화차 = 신기전기 앞
  const yb = lcart.root.userData.yb;
  res.forEach((r, i) => {
    const g = proto.clone(); g.visible = false; flyG.add(g);
    const fr = lcart.front(Math.min(o.angle, lcart.maxAngle)), lay = 6 - r.layer, ly = .02 + fr.tw / 2 + lay * fr.tw;
    const z0 = big ? 0 : (r.col - (r.n - 1) / 2) * fr.tw, y0 = big ? .2 : fr.y + Math.cos(fr.a) * ly, x0 = big ? 0 : fr.x - Math.sin(fr.a) * ly;
    const line = new THREE.Line(new THREE.BufferGeometry(), trailMat); flyG.add(line);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(big ? .08 : .02, big ? .7 : .2, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 })); flame.rotation.z = Math.PI / 2; g.add(flame); flame.position.x = big ? (proto.userData.tubeX0 - .3) : proto.userData.tubeX0 - .1;
    shots.push({ r, g, line, z0, y0, x0, len, flame, pts: [] });
  });
  if (!big) { const hide = res.map(r => r.layer); lcart.P.arrowList.forEach(a => (a.userData.fired = false)); }
  firing = true; simT = 0; lastResult = res; lastType = o.type; lastAng = o.angle * Math.PI / 180;
  const main = res[0], ranges = res.map(r => r.range), mean = ranges.reduce((a, b) => a + b) / ranges.length;
  $('oR').textContent = big ? main.range.toFixed(0) + 'm' : `${mean.toFixed(0)}m (${Math.min(...ranges).toFixed(0)}~${Math.max(...ranges).toFixed(0)})`;
  $('oH').textContent = main.maxH.toFixed(0) + 'm'; $('oT').textContent = main.time.toFixed(1) + 's'; $('oV').textContent = main.vExit.toFixed(1) + 'm/s';
  $('oF').textContent = main.thrust.toFixed(main.thrust < 20 ? 1 : 0) + 'N'; $('oI').textContent = main.I.toFixed(main.I < 20 ? 1 : 0) + 'Ns';
  const w = [];
  if (big && o.bomb && main.tumble) w.push('텀블링! 발화통 무게로 약통 앞이 무거워져 이륙 약 1초 뒤 빙글빙글 돌며 떨어졌습니다(2차 실험 1·2·4번과 같음).');
  if (big && o.angle < 50 && o.core === 280) w.push('낮은 각도 + 약한 추력: 1차 실험 41° 발사(1·2번)처럼 일찍 고개를 숙여 멀리 못 갑니다.');
  if (big && o.type === 'sanhwa') w.push('산화신기전: 추진제가 다 타면(약 ' + main.tb.toFixed(1) + 's) 지화·소발화가 흩어집니다. 산화신기전의 비행 시험값은 없어 대신기전 값으로 계산했습니다.');
  if (!big && o.angle > lcart.maxAngle) w.push(`손잡이를 땅에 대었을 때가 최대(약 ${Math.round(lcart.maxAngle)}°)라 그 각도로 쏘았습니다.`);
  if (!big) w.push(`받침 없이 손잡이를 ${Math.round(lcart.handleH(Math.min(o.angle, lcart.maxAngle)) * 100)}cm 높이에 두어 각도를 맞춤.`);
  if (!big) w.push('100발이 15발씩 위층부터 0.6초 간격(가정)으로 날아갑니다. 각도 퍼짐 ±2.5°(가정).');
  $('warn').hidden = !w.length; $('warn').innerHTML = w.join('<br>');
  drawTraj(res, o);
};
function drawTraj(res, o) {
  const svg = $('traj'), W = 340, H = 170, L = 34, B = 18, T = 8, R = 8;
  const maxX = Math.max(...res.map(r => r.range), 100) * 1.1, maxY = Math.max(...res.map(r => r.maxH), 20) * 1.15;
  const sc = Math.max(maxX / (W - L - R), maxY / (H - T - B));   // 가로·세로 같은 비율
  const x = v => L + v / sc, y = v => H - B - v / sc;
  let s = '';
  const step = maxX > 1000 ? 200 : maxX > 400 ? 100 : 50;
  for (let d = 0; d <= maxX; d += step) s += `<line x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${H - B}" stroke="var(--grid)"/><text x="${x(d)}" y="${H - 5}" text-anchor="middle">${d}</text>`;
  s += `<text x="${L - 4}" y="${y(0)}" text-anchor="end">0</text><text x="${W - R}" y="${H - 5}" text-anchor="end">m</text>`;
  // 실험·시험 사거리 띠
  const band = { dae: [900, 1000, '2차 실험 3번'], jung: [200, 250, '시험 사거리'], so: [100, 150, '시험 사거리'] }[o.type];
  if (band) s += `<rect x="${x(band[0])}" y="${T}" width="${x(band[1]) - x(band[0])}" height="${H - T - B}" fill="var(--c3)" opacity=".18"/><text x="${x(band[1]) + 2}" y="${T + 10}">${band[2]} ${band[0]}~${band[1]}m</text>`;
  res.slice(0, 100).forEach((r, i) => { const d = r.path.map((p, k) => (k ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(''); s += `<path d="${d}" fill="none" stroke="${r.tumble ? 'var(--ac)' : 'var(--c2)'}" stroke-width="${res.length > 1 ? .6 : 1.8}" opacity="${res.length > 1 ? .5 : 1}"/>`; });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mut)"/>`;
  svg.innerHTML = s;
  $('trajLeg').innerHTML = `<span><i style="background:var(--c2)"></i>궤적(가로·세로 같은 비율)</span>${res.some(r => r.tumble) ? '<span><i style="background:var(--ac)"></i>텀블링</span>' : ''}${band ? '<span><i class="sq" style="background:var(--c3);opacity:.4"></i>' + band[2] + '</span>' : ''}`;
}
function launchFrame(dt) {
  if (!firing) return;
  simT += dt * ($('lType').value === 'dae' || $('lType').value === 'sanhwa' ? 1.5 : 1);
  let lead = null, alive = 0;
  const big = ['dae', 'sanhwa'].includes($('lType').value), ang = (big ? +$('lAng').value : Math.min(+$('lAng').value, lcart.maxAngle)) * Math.PI / 180;
  const yb = lcart.root.userData.yb;
  shots.forEach(s => {
    const t = simT - s.r.delay; if (t < 0) return;
    const p = s.r.path; let k = p.findIndex(q => q[2] >= t); const done = k < 0; if (done) k = p.length - 1;
    const a = p[Math.max(0, k - 1)], b = p[k], f = done ? 1 : (t - a[2]) / Math.max(1e-6, b[2] - a[2]);
    const px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f;
    const x0 = big ? Math.cos(ang) * 1.5 : s.x0, wy = s.y0 + pz, wx = x0 + px;
    s.g.visible = true; s.g.position.set(wx - s.len, wy, s.z0);
    const dir = Math.atan2(b[1] - a[1], b[0] - a[0] || 1e-6); s.g.rotation.z = isFinite(dir) && k > 0 ? dir : ang;
    const wz = s.z0 + s.r.lat * (s.r.range ? Math.min(1, px / s.r.range) : 0);
    s.g.position.set(wx - Math.cos(s.g.rotation.z) * s.len, wy - Math.sin(s.g.rotation.z) * s.len, wz);
    s.flame.visible = t < s.r.tb && !done; s.flame.scale.setScalar(.8 + Math.random() * .4);
    if (!done && (!s.pts.length || Math.abs(s.pts[s.pts.length - 1].x - wx) > (big ? 2 : .5))) { s.pts.push(new THREE.Vector3(wx, wy, wz)); s.line.geometry.setFromPoints(s.pts); }
    if (!done) { alive++; if (!lead || px > lead.px) lead = { px, wx, wy, s }; }
  });
  if (!big) lcart.P.arrowList.forEach(a => { a.visible = simT < (6 - a.userData.layer) * .6; });
  if (lead && $('lFollow').checked) { const tgt = new THREE.Vector3(lead.wx, lead.wy, 0), back = big ? 22 : 9; ctl.target.lerp(tgt, .5); cam.position.lerp(new THREE.Vector3(lead.wx - back * .5, lead.wy + back * .2, back), .35); camAnim = null; }
  $('hud').hidden = false; $('hud').textContent = `t = ${simT.toFixed(1)}s · ${lead ? '앞선 신기전 ' + lead.px.toFixed(0) + 'm' : '모두 떨어짐'}`;
  if (!alive && simT > 1) { firing = false; showDamage(true); }
}

// ================= 탭 =================
let tab = 'build';
function setTab(t) {
  tab = t; document.querySelectorAll('#tabs button[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('buildbox').hidden = t !== 'build'; $('arrowbox').hidden = t !== 'arrow'; $('powderbox').hidden = t !== 'powder'; $('launchbox').hidden = $('physbox').hidden = t !== 'launch';
  cart.root.visible = t === 'build'; arrowG.visible = t === 'arrow'; powderG.visible = t === 'powder'; launchG.visible = t === 'launch';
  $('hud').hidden = true; $('cap').textContent = ''; setTags([]);
  if (t === 'build') setStep(step);
  if (t === 'arrow') setArrow(aMode);
  if (t === 'powder') { homeView = [[.35, 1.6, 2.7], [.2, .85, 0]]; view(...homeView); setTags([['염초 75', [-.7, 1.05, 0]], ['숯 15', [-.15, .98, 0]], ['유황 10', [.4, .96, 0]], ['약통 다지기(병기도설)', [1, 1.35, 0], '#2f6ea8'], ['뾰족한 쇠심', [1.12, .9, .05], '#9e2f1e']]); $('cap').textContent = '흑색화약의 재료와 약통 채우기'; }
  if (t === 'launch') { syncUI(); const big = ['dae', 'sanhwa'].includes($('lType').value); homeView = big ? [[-6, 4, 9], [3, 2, 0]] : [[-3, 2.4, 4.5], [0, 1, 0]]; view(...homeView); $('cap').textContent = '옵션을 고르고 🔥 발사'; }
}
document.querySelectorAll('#tabs button[data-tab]').forEach(b => (b.onclick = () => setTab(b.dataset.tab)));

// ================= 퀴즈 =================
const Q = [
  ['신기전이라는 이름은 언제부터 쓰였나?', ['고려 말 최무선 때', '1448년(세종 30) 무렵', '임진왜란 때', '정조 때'], 1, '세종 29년까지 「주화」로 불리다가 『총통등록』(1448) 무렵부터 신기전으로 바뀌었습니다.'],
  ['신기전을 앞으로 날아가게 하는 힘은?', ['활의 탄성', '약통에서 뒤로 뿜는 연소 가스의 반작용', '바람', '화차가 밀어 줌'], 1, '약통 속 화약이 타며 가스를 뒤로 뿜고, 그 반작용(추력)으로 날아갑니다 — 오늘날 로켓과 같은 원리.'],
  ['신기전기 하나에 꽂는 중신기전은 몇 발?', ['50발', '70발', '100발', '150발'], 2, '아래층 10개 + 위 6층 × 15개 = 100개의 원공목통.'],
  ['문종 화차 차체를 바퀴 위에 올린 까닭으로 알맞은 것은?', ['보기 좋게', '발사각을 크게(최대 40°) 하고 좁은 길도 다니려고', '무게를 줄이려고', '바퀴를 보호하려고'], 1, '차체를 바퀴 축보다 높여 신기전기를 크게 기울일 수 있었고, 바퀴 간격을 차체보다 좁게 했습니다(박재광).'],
  ['약통 가운데에 쇠심을 꽂았다 빼서 「약선구멍」을 만든 까닭은?', ['무게를 줄이려고', '타는 면을 넓혀 추력을 키우려고', '화약을 아끼려고', '소리를 크게 하려고'], 1, '구멍이 너무 크면 통이 터지고 너무 작으면 추력이 모자랐습니다. 복원 실험에서 철침 280→350mm로 평균 추력이 약 60% 늘었습니다.'],
  ['대신기전 복원 실험에서 발화통(모조물)을 단 신기전이 멀리 못 간 까닭은?', ['바람', '이륙 1초 뒤 텀블링', '화약이 젖어서', '발사대가 부러져서'], 1, '4발 중 3발이 텀블링을 일으켜 궤도를 벗어났습니다(이용우·허환일 2009).'],
  ['흑색화약에서 산소를 내놓는 재료(산화제)는?', ['숯', '유황', '염초(질산칼륨)', '아교'], 2, '염초가 산소를 내놓아 공기가 없는 약통 속에서도 탑니다. 가장 얻기 어려운 재료였습니다.'],
  ['화차의 결구 방법(짜임·맞춤·이음)은 어디에 근거했나?', ['병기도설에 자세히 기록됨', '기록이 없어 전통 목공 기법으로 복원한 추정', '실물 유물을 분해함', '중국 책'], 1, '병기도설에는 치수와 그림이 있을 뿐 결구법은 없습니다. 이 앱은 추정임을 단계마다 표시했습니다.'],
];
let qi = 0, qs = 0;
function showQ() {
  const [q, o, a, ex] = Q[qi]; $('qn').textContent = `${qi + 1} / ${Q.length} · 맞힌 수 ${qs}`; $('qq').textContent = q; $('qe').textContent = '';
  $('qopts').innerHTML = o.map((t, i) => `<button data-i="${i}">${t}</button>`).join(''); $('qnext').disabled = true;
  $('qopts').onclick = e => { const b = e.target.closest('button'); if (!b || !$('qnext').disabled) return; const i = +b.dataset.i; if (i === a) qs++;
    b.classList.add(i === a ? 'ok' : 'no'); $('qopts').children[a].classList.add('ok'); $('qe').textContent = (i === a ? '정답! ' : '아쉬워요. ') + ex; $('qnext').disabled = false;
    $('qn').textContent = `${qi + 1} / ${Q.length} · 맞힌 수 ${qs}`; if (qi === Q.length - 1) $('qnext').textContent = '처음부터'; };
}
$('quizb').onclick = () => { qi = 0; qs = 0; $('qnext').textContent = '다음'; $('quiz').hidden = false; showQ(); };
$('qnext').onclick = () => { if (qi === Q.length - 1) { qi = 0; qs = 0; $('qnext').textContent = '다음'; } else qi++; showQ(); };
$('qclose').onclick = () => ($('quiz').hidden = true);
$('quiz').onclick = e => { if (e.target === $('quiz')) $('quiz').hidden = true; };
addEventListener('keydown', e => { if (e.key === 'Escape') $('quiz').hidden = true; });

// ================= 그리기 =================
cam.position.set(...homeView[0]); ctl.target.set(...homeView[1]);
setTab('build'); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(.05, clock.getDelta());
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt / camAnim.dur); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u);
    cam.position.lerpVectors(camAnim.p0, camAnim.p1, e); ctl.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  if (tab === 'build') buildFrame(dt); else if (tab === 'powder') powderFrame(dt); else if (tab === 'launch') launchFrame(dt);
  ctl.update(); renderer.render(scene, cam);
});
window.__set = { tab: setTab, step: setStep, arrow: setArrow, fire: () => $('lFire').click(), simT: v => { simT = v; } };
window.__state = () => ({ tab, step, simT, firing });
