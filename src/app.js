import * as THREE from 'three';
import { ARROWS, FLY, BUILD, JOINTS, TUBE_BUILT, DAMAGE, DAMAGE_MAX, ARROW_EASY, MISSIONS, BADGES, QUIZ, fly, volley, impactStats, missionStars, quizStars } from './sim.js';
import { MAT, buildCart, buildArrow, buildJoint, buildRack } from './model.js';
import { createStage } from './kit/stage.js';
import { initSettings } from './kit/settings.js';
import { initProgress } from './kit/progress.js';
import { initSfx } from './kit/sfx.js';
import { $, help, toast, stars } from './kit/ui.js';
import { rbox } from './kit/parts.js';

const APP = 'singijeon';
const at = (o, x, y, z) => (o.position.set(x, y, z), o);
const isBig = t => t === 'dae' || t === 'sanhwa';

// ================= 공통: 설정 · 소리 · 무대 · 기록 =================
let stage = null, prog = null;
const settings = initSettings(APP, {
  onChange(s, k) {
    if (!stage) return;
    if (k === 'quality') stage.setQuality(s.quality);
    if (k === 'theme') stage.setTheme(s.theme);
    if (k === 'labels') stage.setLabels(s.labels);
    if (k === 'motion') stage.setReducedMotion(settings.reducedMotion());
  },
  onReset() { prog.reset(); toast('기록을 지웠습니다'); },
});
const sfx = initSfx(() => settings.all());
stage = createStage($('cv'), { yard: 9, far: 8000, quality: settings.get('quality'), theme: settings.get('theme'), labels: settings.get('labels'), reducedMotion: settings.reducedMotion(), preserve: true });
const { scene, cam, ctl } = stage;
const MENUS = [{ id: 'build', name: '만들기' }, { id: 'arrow', name: '구조' }, { id: 'powder', name: '화약' }, { id: 'launch', name: '발사' }, { id: 'quiz', name: '퀴즈' }];
prog = initProgress(APP, { menus: MENUS, badges: BADGES, sfx, onChange: drawNav,
  scores: [...MISSIONS.map(m => ({ id: m.id, name: '과녁: ' + m.name })), { id: 'quiz', name: '퀴즈' }] });
const helpDlg = help(APP, [
  { ico: '👆', title: '3D를 돌려 보세요', text: '왼쪽 그림을 끌면 돌아가고, 마우스 휠이나 두 손가락으로 크게·작게 볼 수 있어요.' },
  { ico: '①②③', title: '번호 순서대로 배워요', text: '위쪽 메뉴를 ① 만들기부터 차례로 눌러 보세요. 다 본 메뉴에는 ✓ 표시가 생겨요.' },
  { ico: '⚙️', title: '설정에서 내게 맞게', text: '글자 크기, 화면 색, 소리, 그래픽 품질을 오른쪽 위 ⚙ 설정에서 바꿀 수 있어요.' },
]);
$('btnSet').onclick = () => settings.open(); $('btnProg').onclick = () => prog.open(); $('btnHelp').onclick = () => helpDlg.open();
$('zi').onclick = () => stage.zoom(.8); $('zo').onclick = () => stage.zoom(1.25); $('zr').onclick = () => stage.home();
document.addEventListener('click', e => { if (e.target.closest('button,summary,.k-check')) sfx.play('tap'); });
function drawNav() { document.querySelectorAll('#nav button').forEach(b => { b.classList.toggle('done', prog.isDone(b.dataset.tab)); if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
function finish(menu, badge) { if (!prog.isDone(menu)) { prog.done(menu); toast(`✓ 「${MENUS.find(m => m.id === menu).name}」 다 봤어요`); } if (badge) prog.award(badge); }

// ================= ① 만들기 =================
const cart = buildCart(); scene.add(cart.root);
const P = cart.P;
const groups = { hub: [...P.hub], spoke: [...P.spoke], rim: [...P.rim], axle: P.axle, frame: P.frame, deck: P.deck, box: P.box, tubes: P.tubes, mount: P.prop, load: P.load };
const order = BUILD.map(b => b.key);
let step = 0, stepT = 1, bPlaying = false, bTimer = 0, knocked = true;
$('steps').innerHTML = BUILD.map((s, i) => `<button data-i="${i}">${s.t.replace(/^\d+\. /, '')}</button>`).join('');
$('bDots').innerHTML = BUILD.map((s, i) => `<button data-i="${i}" aria-label="${s.t}"></button>`).join('');
$('steps').onclick = $('bDots').onclick = e => { const b = e.target.closest('button'); if (b) setStep(+b.dataset.i); };
// 짜임 확대창 (작은 렌더러)
const jr = new THREE.WebGLRenderer({ canvas: $('jcv'), antialias: true, alpha: true }); jr.setPixelRatio(Math.min(2, devicePixelRatio)); jr.setSize(152, 112, false);
jr.toneMapping = THREE.ACESFilmicToneMapping; jr.toneMappingExposure = .9;
const js = new THREE.Scene(); js.add(new THREE.HemisphereLight(0xffffff, 0x8a7d62, 2.2)); const jl = new THREE.DirectionalLight(0xfff1dc, 3); jl.position.set(2, 3, 2); js.add(jl);
const jc = new THREE.PerspectiveCamera(35, 152 / 112, .01, 10); jc.position.set(.7, .55, .8); jc.lookAt(0, 0, 0);
let joint = null, jt = 0;
function setJoint(kind) {
  if (joint) js.remove(joint.g);
  $('jbox').hidden = !kind; if (!kind) { joint = null; return; }
  joint = buildJoint(kind); js.add(joint.g); $('jN').innerHTML = JOINTS[kind].nm + ' <span class="k-as">추정</span>'; $('jD').textContent = JOINTS[kind].d;
}
const STEP_VIEW = { hub: [[.9, .8, 1.6], [0, .45, .3]], spoke: [[.9, .8, 1.6], [0, .45, .3]], rim: [[.9, .8, 1.6], [0, .45, .3]], axle: [[.4, .9, 1.8], [0, .45, 0]],
  frame: [[2.6, 2.4, 2.8], [-.3, .9, 0]], deck: [[2.2, 2.5, 2.4], [-.2, 1.1, 0]], box: [[2.4, 2.2, 2.4], [-.2, 1.3, 0]], tubes: [[2.2, 1.7, 1.6], [.1, 1.35, 0]], mount: [[.6, 1.5, 3.6], [-.3, .9, 0]], load: [[2.8, 2.2, 2.8], [.2, 1.4, 0]] };
function setStep(i, quiet) {
  const prev = step; step = Math.max(0, Math.min(BUILD.length - 1, i)); stepT = 0; knocked = false;
  const s = BUILD[step], name = s.t.replace(/^\d+\. /, '');
  $('bK').textContent = `만들기 ${step + 1} / ${BUILD.length}`; $('bT').textContent = name; $('bE').textContent = s.easy; $('bD').textContent = s.d; $('cap').textContent = name;
  $('bTags').innerHTML = (s.rec ? `<span class="k-tag rec">${s.rec}</span>` : '') + (s.est ? `<span class="k-tag est">${s.est}</span>` : '');
  $('bPrev').disabled = step === 0; $('bNext').textContent = step === BUILD.length - 1 ? '② 구조 보러 가기 ▶' : '다음 ▶';
  const n = prog.see('build', s.key);
  [...$('steps').children].forEach((b, k) => b.classList.toggle('on', k === step));
  [...$('bDots').children].forEach((b, k) => { b.className = k === step ? 'on' : prog.seen('build', BUILD[k].key) ? 'seen' : ''; });
  setJoint(s.joint); stage.setHome(...STEP_VIEW[s.key]);
  stage.setTags(s.key === 'rim' ? [['바퀴 지름 870mm', [0, .08, .8]]] : s.key === 'frame' ? [['차체 2,300 × 740mm', [-.6, 1.4, .45]], ['옆판으로 높인 차체', [0, .85, .5], '#2b6aa3']]
    : s.key === 'box' ? [['신기전기 길이 1,149.4mm', [0, 1.55, .5]]] : s.key === 'tubes' ? [['원공목통 100개 · 7층', [.75, 1.45, .3]], ['구멍 지름 46mm', [.75, 1.0, .5]]]
    : s.key === 'mount' ? [[`손잡이를 땅에 대면 약 ${Math.round(cart.maxAngle)}°`, [-.9, .5, .5]], ['원공목통 아래 굴대', [.1, .45, .6], '#2b6aa3']] : s.key === 'load' ? [['15발씩 위층부터 차례로', [.8, 1.75, .3]]] : []);
  if (!quiet && prev !== step) sfx.play('step');
  if (n >= BUILD.length) finish('build', 'joint-master');
}
function buildFrame(dt) {
  stepT = Math.min(1, stepT + dt / (stage.isReduced() ? .05 : 1.1)); const e = 1 - (1 - stepT) ** 3, k = order[step];
  if (stepT >= 1 && !knocked) { knocked = true; if (tab === 'build') sfx.play(k === 'mount' ? 'creak' : 'knock'); }
  const xray = $('xray').checked;
  for (const [key, objs] of Object.entries(groups)) {
    const idx = order.indexOf(key), vis = idx <= step;
    objs.forEach(o => { o.visible = vis; if (!o.userData.home) o.userData.home = o.position.clone();
      const off = key === k ? (1 - e) * .5 : 0, xo = xray && vis ? ({ hub: 0, spoke: 0, rim: 0, axle: -.2, frame: .35, deck: .55, box: .9, tubes: 1.1, mount: .7, load: 1.1 })[key] : 0;
      o.position.copy(o.userData.home); o.position.y += off + xo; });
  }
  cart.setAngle(order.indexOf('mount') <= step ? cart.maxAngle * (k === 'mount' ? e : 1) : 0);
  if (bPlaying && stepT >= 1) { bTimer += dt; if (bTimer > 3.4) { bTimer = 0; if (step < BUILD.length - 1) setStep(step + 1); else stopPlay(); } }
  if (joint && $('jbox').offsetParent) { jt += dt; const u = (Math.sin(jt * 1.6) + 1) / 2; joint.anim(stage.isReduced() ? .6 : u * u); joint.g.rotation.y = jt * .3; jr.render(js, jc); }
}
function showWholeCart() { for (const objs of Object.values(groups)) objs.forEach(o => { o.visible = true; if (o.userData.home) o.position.copy(o.userData.home); }); cart.setAngle(cart.maxAngle); }
function stopPlay() { bPlaying = false; $('bPlay').textContent = '▶ 차례로 보기'; }
$('bPrev').onclick = () => setStep(step - 1);
$('bNext').onclick = () => { if (step === BUILD.length - 1) setTab('arrow'); else setStep(step + 1); };
$('bPlay').onclick = () => { bPlaying = !bPlaying; bTimer = 0; $('bPlay').textContent = bPlaying ? '⏸ 멈춤' : '▶ 차례로 보기'; if (bPlaying && step === BUILD.length - 1) setStep(0); };

// ================= ② 구조 =================
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
  tube: `대신기전 약통을 반으로 잘라 보았습니다. 한지를 말아 만든 통(두께 16.2mm) 속에 화약을 다져 넣고, 가운데 끝이 뾰족한 쇠심을 꽂았다 빼서 원뿔 모양 「약선구멍」을 남깁니다 — 불이 타는 면이 넓어져 추력이 커집니다. 아래에는 분사구멍(지름 37.5mm), 위는 종이를 여러 겹 접어 막고 약선으로 발화통에 잇습니다.<br><span class="k-note">복원 약통(이용우 외 2008): 한지 홑지 ${TUBE_BUILT.sheets}을 ${TUBE_BUILT.layers} 말고 녹말풀로 붙임, 안지름 ${TUBE_BUILT.d} · 겉지름 ${TUBE_BUILT.D} · 길이 ${TUBE_BUILT.L}mm, 무게 ${TUBE_BUILT.kg}kg. 병기도설 환산 겉지름 102mm는 안지름+두께×2(95.5mm)와 맞지 않아 복원은 두께 기록을 따랐습니다.</span>`,
};
// 받침대(신기전을 올려놓는 가대)
function bench(len, wid) { const g = new THREE.Group(); g.add(rbox(len, .05, wid, MAT.woodL, 0, .815, 0, .012)); for (const x of [-len / 2 + .2, 0, len / 2 - .2]) for (const z of [-wid / 2 + .12, wid / 2 - .12]) g.add(rbox(.08, .79, .08, MAT.woodD, x, .395, z, .012)); for (const z of [-wid / 2 + .12, wid / 2 - .12]) g.add(rbox(len - .4, .06, .05, MAT.woodD, 0, .3, z)); return g; }
function setArrow(mode) {
  aMode = mode; arrowG.clear();
  [...$('aSel').children].forEach(b => { b.classList.toggle('on', b.dataset.a === mode); b.setAttribute('aria-pressed', b.dataset.a === mode); });
  $('aE').textContent = ARROW_EASY[mode]; $('aD').innerHTML = ADESC[mode];
  $('cap').textContent = mode === 'all' ? '신기전 네 종류 크기 비교' : mode === 'tube' ? '대신기전 약통 속' : ARROWS[mode].nm;
  if (mode === 'all') {
    AKEYS.forEach((k, i) => { const a = buildArrow(k); a.g.position.set(-2.8, .9, -.9 + i * .6); arrowG.add(a.g); });
    arrowG.add(at(bench(6.4, 3.4), 0, 0, .3));
    // 1m 자
    for (let m = 0; m <= 5; m++) arrowG.add(rbox(.012, .012, .12, MAT.iron, -2.8 + m, .9, 1.6, .002));
    arrowG.add(rbox(5, .008, .012, MAT.iron, -.3, .9, 1.6, .002));
    stage.setHome([0, 4.4, 5.6], [0, .9, .3]);
    stage.setTags([['대신기전 5,588mm', [-.2, 1.2, -.9]], ['산화신기전 5,310.8mm', [-.2, 1.2, -.3]], ['중신기전 1,455mm', [-2.1, 1.1, .3]], ['소신기전 1,152mm', [-2.2, 1.1, .9]], ['5m', [2.2, 1, 1.6]]]);
  } else if (mode === 'tube') {
    const a = buildArrow('dae', { cut: true }); a.g.position.set(-a.g.userData.tubeX0 - .35, .9, 0); arrowG.add(a.g, bench(1.6, .7));
    stage.setHome([.3, 1.3, 1.15], [.05, .9, .08]);
    stage.setTags([['한지 약통 벽 16.2mm', [0, .98, .1]], ['화약(추진제)', [-.1, .925, .1], '#2b6aa3'], ['약선구멍(쇠심 자리)', [-.22, .9, .1], '#a8321f'], ['분사구멍 37.5mm', [-.33, .85, .1]], ['종이 마개 · 약선', [.25, .96, .1]], ['발화통', [.45, .96, .1]]]);
  } else {
    const a = buildArrow(mode), L = a.g.userData.len; a.g.position.set(-L / 2, .9, 0); arrowG.add(a.g, bench(L + .5, .8));
    stage.setHome([0, 1.25 + L * .3, Math.max(1.3, L * .75)], [0, .9, 0]);
    const tx = -L / 2 + a.g.userData.tubeX0 + a.g.userData.tL / 2;
    stage.setTags([['약통', [tx, .99 + (L > 3 ? .06 : 0), 0]], ['안정막대(대나무)', [-L / 4, .97, 0]], ['깃', [-L / 2 + .1, 1.0, 0]]].concat(ARROWS[mode].bomb && !ARROWS[mode].bomb.inner ? [['발화통', [L / 2 - .08, 1.04, 0], '#a8321f']] : []));
  }
  if (prog.see('arrow', mode) >= 6) finish('arrow', 'arrow-explorer');
}
$('aSel').onclick = e => { const b = e.target.closest('button'); if (b) setArrow(b.dataset.a); };

// ================= ③ 화약 =================
const powderG = new THREE.Group(); scene.add(powderG);
{
  const piles = [['염초(질산칼륨)', 75, 0xf3f0e8], ['숯', 15, 0x2a2826], ['유황', 10, 0xd9c23a]];
  piles.forEach(([n, pct, c], i) => { const r = .1 + Math.cbrt(pct) * .045;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, r * .7, 40, 6), new THREE.MeshStandardMaterial({ color: c, roughness: 1, envMapIntensity: .3 }));
    const p = m.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) / (r * .7) + .5, w = 1 + Math.sin(k * 12.9898) * .05 * (1 - y); p.setX(k, p.getX(k) * w * (1 + (1 - y) * .08)); p.setZ(k, p.getZ(k) * w * (1 + (1 - y) * .08)); } m.geometry.computeVertexNormals();
    m.position.set(-.7 + i * .55, r * .35 + .7, 0); m.castShadow = true; powderG.add(m);
    const dish = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [r + .04, 0], [r + .075, .025], [r + .085, .03], [r + .06, .012], [0, .012]].map(([x, y]) => new THREE.Vector2(x, y)), 40), MAT.woodD); dish.position.set(-.7 + i * .55, .676, 0); dish.castShadow = dish.receiveShadow = true; powderG.add(dish); });
  powderG.add(rbox(2.2, .05, .9, MAT.wood, -.15, .65, 0, .012));
  for (const [x, z] of [[-1.15, -.38], [-1.15, .38], [.85, -.38], [.85, .38]]) powderG.add(rbox(.07, .65, .07, MAT.woodD, x, .325, z, .01));
  powderG.add(rbox(1.9, .05, .05, MAT.woodD, -.15, .2, -.38), rbox(1.9, .05, .05, MAT.woodD, -.15, .2, .38));
}
// 약통에 화약 다지기(병기도설): 반 자른 종이통 + 뾰족한 쇠심 + 속 빈 쇠막대
const tamp = new THREE.Group(); tamp.position.set(.95, .68, 0); tamp.rotation.y = Math.PI / 2; powderG.add(tamp);
const tH = .5, tRo = .06, tRi = .04;
tamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(tRo, tRo, tH, 40, 1, true, 0, Math.PI), MAT.paper), 0, tH / 2, 0));
tamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(tRi, tRi, tH, 40, 1, true, 0, Math.PI), MAT.paperIn), 0, tH / 2, 0));
const spike = new THREE.Mesh(new THREE.ConeGeometry(.012, tH * .75, 16), MAT.iron); spike.position.y = tH * .375; tamp.add(spike);
const fill = new THREE.Mesh(new THREE.CylinderGeometry(tRi - .001, tRi - .001, 1, 32, 1, false, 0, Math.PI), MAT.powder); fill.geometry.translate(0, .5, 0); tamp.add(fill);
const ram = new THREE.Group(); tamp.add(ram);
const ramMat = MAT.iron.clone(); ramMat.side = THREE.DoubleSide;
ram.add(at(new THREE.Mesh(new THREE.CylinderGeometry(tRi - .002, tRi - .002, .5, 24, 1, true), ramMat), 0, .25, 0));
const SALT = ['흙 모으기(取土) — 오래된 집 안·부뚜막·마루 밑·담장 밑·구들 밑·길 위의 흙', '재 받기(取灰) — 다북쑥·곡식대·콩깍지 등을 태운 재(소나무 재는 쓰지 않음)', '섞기(交合) — 흙과 재를 섞음', '물 거르기(篩水) — 바닥 뚫린 독에 넣고 물을 부어 우려냄', '물 달이기(熬水) — 우린 물을 졸여 거친 염초(모초)를 얻음', '재련(再煉) — 다시 녹여 끓이고 식혀 결정을 얻음', '삼련(三煉) — 한 번 더 같은 방법으로 깨끗이', '풀 베기(刈草)', '아교 넣기(膠水)', '섞어 찧기(合製) — 염초·숯·유황을 합침'];
const POWDER = [
  { id: 'mix', t: '화약의 세 가지 재료', cap: '흑색화약: 염초 75 · 숯 15 · 유황 10', view: [[-.2, 1.5, 2.3], [-.15, .85, 0]],
    easy: '화약은 염초·숯·유황 세 가지를 섞어 만들어요. 염초가 산소를 내놓아서, 공기가 없는 통 속에서도 탈 수 있어요.',
    d: '조선에서 만들 수 있었던 화약은 오늘날 <b>흑색화약</b>이라 부르는 것뿐이었습니다. 염초·숯·유황을 대략 <b>75 : 15 : 10</b>으로 섞은 것으로 알려져 있습니다. 숯과 유황은 연료, 염초(질산칼륨)는 타는 데 필요한 산소를 내놓는 산화제라 공기가 없는 약통 속에서도 탑니다.' },
  { id: 'salt', t: '가장 귀한 재료, 염초', cap: '염초는 흙과 재에서 얻었다', view: [[-1.3, 1.25, 1.5], [-.7, .85, 0]],
    easy: '세 재료 중 염초가 가장 구하기 어려웠어요. 오래된 집의 흙과 풀을 태운 재를 물에 우리고 끓여서 조금씩 얻었어요.',
    d: `<b>왜 염초가 가장 귀했나</b> — 숯은 쉽게 얻고 유황은 적게 들지만, 염초는 흙 속 질산염을 잿물과 섞어 끓여 얻어 양이 매우 적었습니다. 최무선은 부뚜막·마루 밑 흙과 재에서 염초를 얻는 법을 알아내 고려 말 화약을 만들었습니다(최무선의 『화약수련법』은 전하지 않음). 조선은 유황·염초가 모자라 신기전의 화약 소비가 큰 부담이었습니다.
     <p style="margin-top:.5rem"><b>『신전자초방』(김지남)의 10단계</b></p><div class="k-steps">${SALT.map(t => `<div><span>${t}</span></div>`).join('')}</div>
     <p class="k-note">과학으로 보면: 사람이 사는 곳 흙에는 유기물이 분해되어 생긴 <b>질산 이온</b>이, 풀을 태운 재에는 <b>칼륨 이온</b>이 많습니다. 둘을 물에 녹여 졸이면 질산칼륨 결정이 생기고, 녹는 정도 차이(분별 결정)로 여러 번 정제합니다. 재현 실험에서 마루 밑 흙과 쑥 재가 가장 좋았고, 1:1 혼합에서 순도 68%, 정제 후 약 14% 높아졌습니다(김준수 외 2015).</p>` },
  { id: 'tamp', t: '약통에 화약 채우기', cap: '약통 다지기(병기도설)', view: [[2.1, 1.45, 1.7], [.95, 1.0, 0]],
    easy: '약통 가운데 뾰족한 쇠심을 세우고, 화약을 조금씩 넣으며 꾹꾹 다져요. 쇠심을 빼면 가운데에 구멍(약선구멍)이 남아요.',
    d: '<b>약통에 채우기</b>(병기도설) — 약통 가운데 끝이 뾰족한 긴 쇠심을 꽂고, 화약을 조금씩 넣고 <b>가운데가 빈 둥근 쇠막대</b>로 다지기를 되풀이한 뒤 쇠심을 빼면 그 자리가 <b>약선구멍</b>이 됩니다. 구멍이 너무 크면 압력이 커서 통이 터지고, 너무 작으면 추력이 모자랐습니다(채연석).' },
];
let pIdx = 0, pt = 0, lastTamp = -1;
$('pDots').innerHTML = POWDER.map((c, i) => `<button data-i="${i}" aria-label="${c.t}"></button>`).join('');
$('pDots').onclick = e => { const b = e.target.closest('button'); if (b) setPowder(+b.dataset.i); };
function setPowder(i, quiet) {
  const prev = pIdx; pIdx = Math.max(0, Math.min(POWDER.length - 1, i)); const c = POWDER[pIdx];
  $('pK').textContent = `화약 ${pIdx + 1} / ${POWDER.length}`; $('pT').textContent = c.t; $('pE').textContent = c.easy; $('pD').innerHTML = c.d; $('cap').textContent = c.cap;
  $('pPrev').disabled = pIdx === 0; $('pNext').textContent = pIdx === POWDER.length - 1 ? '④ 발사하러 가기 ▶' : '다음 ▶';
  const n = prog.see('powder', c.id);
  [...$('pDots').children].forEach((b, k) => { b.className = k === pIdx ? 'on' : prog.seen('powder', POWDER[k].id) ? 'seen' : ''; });
  stage.setHome(...c.view);
  stage.setTags(c.id === 'tamp' ? [['속 빈 쇠막대로 다짐', [.95, 1.45, .12], '#2b6aa3'], ['뾰족한 쇠심', [.95, .9, .14], '#a8321f']] : [['염초 75', [-.7, 1.05, 0]], ['숯 15', [-.15, .98, 0]], ['유황 10', [.4, .96, 0]]]);
  if (!quiet && prev !== pIdx) sfx.play('step');
  if (n >= POWDER.length) finish('powder', 'powder-safe');
}
$('pPrev').onclick = () => setPowder(pIdx - 1);
$('pNext').onclick = () => { if (pIdx === POWDER.length - 1) setTab('launch'); else setPowder(pIdx + 1); };
function powderFrame(dt) {
  pt += dt; const cycle = 1.6, n = Math.floor(pt / cycle) % 8, u = (pt % cycle) / cycle;
  const level = Math.min(tH * .92, (n + Math.min(1, u * 2)) * tH * .115);
  fill.scale.y = Math.max(.001, level); ram.position.y = level + (u < .5 ? .3 : .3 - Math.sin((u - .5) * 2 * Math.PI) * .28 * (u < .75 ? 1 : 0));
  spike.visible = !(n === 7 && u > .6); if (!spike.visible) ram.position.y = tH + .4;
  const beat = Math.floor(pt / cycle); if (pIdx === 2 && u > .62 && beat !== lastTamp && n !== 7) { lastTamp = beat; sfx.play('thud'); }
}

// ================= ④ 발사 =================
const launchG = new THREE.Group(); scene.add(launchG);
const lcart = buildCart(); launchG.add(lcart.root);
let rack = buildRack(3.3); launchG.add(rack.g);
const markers = new THREE.Group(); launchG.add(markers);
{ // 거리 표시: 100m마다 흰 띠와 말뚝, 500m마다 붉은 띠
  const lineGeo = new THREE.PlaneGeometry(.5, 14), white = new THREE.MeshBasicMaterial({ color: 0xf2ecd8, transparent: true, opacity: .8 }), red = new THREE.MeshBasicMaterial({ color: 0xb5452a, transparent: true, opacity: .85 });
  for (let d = 100; d <= 1500; d += 100) { const m = new THREE.Mesh(lineGeo, d % 500 ? white : red); m.rotation.x = -Math.PI / 2; m.position.set(d, .03, 0); markers.add(m);
    markers.add(rbox(.12, 2.4, .12, MAT.woodD, d, 1.2, 7.3, .02)); const s = stage.label(d + 'm'); s.position.set(d, 3.2, 7.3); markers.add(s); }
}
const flyG = new THREE.Group(); launchG.add(flyG);
const dmgG = new THREE.Group(); launchG.add(dmgG);
const targetG = new THREE.Group(); launchG.add(targetG);
const dmgMat = new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: .28, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x7d1f12, side: THREE.DoubleSide });
const trailMat = new THREE.LineBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: .75 });
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
// 멀리서 전체를 볼 때(따라가기 끔·움직임 줄이기) 신기전 위치를 알려 주는 점
const leadDot = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd23f, depthTest: false, sizeAttenuation: false, fog: false, toneMapped: false,
  map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#7d1f12'; g.lineWidth = 8; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fill(); g.stroke(); return new THREE.CanvasTexture(c); })() }));
leadDot.scale.set(.022, .022, 1); leadDot.renderOrder = 11; leadDot.visible = false; launchG.add(leadDot);
let lType = 'jung', lastType = 'jung', lastAng = 0, shots = [], simT = 0, firing = false, lastResult = null, mission = null, pending = null, lastLayer = -1;

function showDamage(moveCam) {
  dmgG.clear(); if (!lastResult) return;
  const r = +$('lDmg').value;
  const pts = shots.map(s => [(isBig(lastType) ? Math.cos(lastAng) * 1.5 : s.x0) + s.r.range, s.z0 + s.r.lat]);
  const st = impactStats(pts, r);
  const disk = new THREE.CircleGeometry(Math.max(r, .05), 40), dot = new THREE.CircleGeometry(.14, 10);
  pts.forEach(([x, z]) => {
    if (r > 0) { const d = new THREE.Mesh(disk, dmgMat); d.rotation.x = -Math.PI / 2; d.position.set(x, .05, z); dmgG.add(d); }
    const p = new THREE.Mesh(dot, ringMat); p.rotation.x = -Math.PI / 2; p.position.set(x, .07, z); dmgG.add(p);
  });
  const w = st.x1 - st.x0, h = st.y1 - st.y0, edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), new THREE.LineBasicMaterial({ color: 0x2b2620 }));
  edge.rotation.x = -Math.PI / 2; edge.position.set((st.x0 + st.x1) / 2, .08, (st.y0 + st.y1) / 2); dmgG.add(edge);
  const lab = stage.label(`피해 면적 약 ${Math.round(st.area).toLocaleString()}m² (반경 ${r}m, 가정)`, '#a8321f'); lab.position.set(st.cx, Math.max(3, w * .15), st.cy); dmgG.add(lab);
  $('oDL').textContent = st.len.toFixed(1) + 'm'; $('oDW').textContent = st.wid.toFixed(1) + 'm'; $('oDA').textContent = Math.round(st.area).toLocaleString() + 'm²'; $('oDN').textContent = pts.length + '발';
  if (moveCam) { const span = Math.max(w, h, 8); stage.view([st.cx - span * .25, span * 1.3, st.cy + span * .9], [st.cx, 0, st.cy], 1.2); }
}
const opt = () => {
  const F = FLY[lType], u = +$('lProp').value / 100;
  return { type: lType, prop: F.propMin + (F.propMax - F.propMin) * u, angle: +$('lAng').value, core: +$('lCore').value, rail: isBig(lType) ? +$('lRail').value : F.rail, bomb: $('lBomb').checked, wind: +$('lWind').value, seed: Math.floor(Math.random() * 1e6) };
};
function syncUI() {
  const o = opt(), big = isBig(o.type);
  [...$('lTypes').children].forEach(b => { b.classList.toggle('on', b.dataset.t === lType); b.setAttribute('aria-pressed', b.dataset.t === lType); });
  $('lPropV').textContent = (o.prop * 1000).toFixed(0) + 'g' + (big ? '' : ' (가정)');
  $('lAngV').textContent = o.angle + '°';
  $('lAngN').textContent = big ? '' : o.angle > lcart.maxAngle ? `⚠ 화차는 최대 ${Math.round(lcart.maxAngle)}°까지 기울어져요` : `손잡이 높이 ${Math.round(lcart.handleH(o.angle) * 100)}cm`;
  $('lDmgV').textContent = (+$('lDmg').value).toFixed(1) + 'm';
  $('lWindV').textContent = o.wind === 0 ? '없음' : (o.wind > 0 ? '뒷바람 ' : '맞바람 ') + Math.abs(o.wind) + 'm/s';
  $('rowCore').hidden = $('rowRail').hidden = !big; $('rowBomb').hidden = o.type !== 'dae';
  $('oRn').textContent = big ? '날아간 거리(사거리)' : '100발 평균 사거리';
  lcart.root.visible = !big; rack.g.visible = big;
  if (big) rack.set(o.angle); else lcart.setAngle(Math.min(o.angle, lcart.maxAngle));
}
const launchHome = () => (isBig(lType) ? [[-6, 4, 9], [3, 2, 0]] : [[-3, 2.4, 4.5], [0, 1, 0]]);
function setType(t, keep) {
  lType = t; const F = FLY[t];
  if (!keep) { $('lAng').value = isBig(t) ? 60 : 40; $('lProp').value = Math.round((F.prop - F.propMin) / (F.propMax - F.propMin) * 100); }
  $('lDmg').max = DAMAGE_MAX[t]; $('lDmg').value = DAMAGE[t];
  resetShots(); syncUI(); if (tab === 'launch') stage.setHome(...launchHome());
}
$('lTypes').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (mission && mission.type !== b.dataset.t) setMission(null); setType(b.dataset.t); };
$('lDmg').addEventListener('input', () => { syncUI(); if (lastResult && !firing) showDamage(); });
['lProp', 'lAng', 'lCore', 'lRail', 'lBomb', 'lWind'].forEach(id => $(id).addEventListener('input', () => {
  if (id === 'lRail') { launchG.remove(rack.g); rack = buildRack(+$('lRail').value); launchG.add(rack.g); }
  syncUI();
}));
function resetShots() {
  dmgG.clear(); ['oR', 'oH', 'oT', 'oV', 'oF', 'oI', 'oDL', 'oDW', 'oDA', 'oDN'].forEach(i => ($(i).textContent = '—')); flyG.clear(); shots = []; firing = false; simT = 0; pending = null; lastResult = null;
  leadDot.visible = false; $('hud').hidden = true; $('warn').hidden = true; $('mMsg').hidden = true; $('traj').innerHTML = ''; $('trajLeg').innerHTML = '';
  lcart.P.arrowList.forEach(a => (a.visible = true)); stage.smoke.clear(); stage.fire.clear(); $('lFire').disabled = false;
}
$('lReset').onclick = () => { resetShots(); stage.home(); };
const arrowProto = {};
// 날아가는 신기전 모형. 화차 100발은 마디·끈 같은 잔 부재를 빼고 그림자도 꺼서 가볍게 한다
function protoFor(type) {
  if (!arrowProto[type]) { const g = buildArrow(type).g;
    if (!isBig(type)) { const drop = []; g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; if (o.geometry.type === 'TorusGeometry') drop.push(o); } }); drop.forEach(o => o.parent.remove(o)); }
    arrowProto[type] = g; }
  return arrowProto[type];
}

// ---- 과녁 맞히기 ----
function drawMissions() {
  $('missions').innerHTML = MISSIONS.map((m, i) => `<button class="k-btn${mission === m ? ' on' : ''}" data-i="${i}" aria-pressed="${mission === m}"><span>${'①②③'[i]} ${m.name}</span>${stars(prog.star(m.id))}</button>`).join('') +
    (mission ? `<p class="k-msg">${mission.easy}<br><span class="k-note">허용 오차 ±${mission.tol}m</span></p>` : '');
}
$('missions').onclick = e => { const b = e.target.closest('button'); if (b) setMission(mission === MISSIONS[+b.dataset.i] ? null : MISSIONS[+b.dataset.i]); };
function setMission(m) {
  mission = m; targetG.clear();
  if (m) {
    setType(m.type); $('lAng').value = m.start.angle; if ('bomb' in m.start) $('lBomb').checked = m.start.bomb; syncUI();
    // 과녁: 붉고 흰 고리 + 깃대
    const cols = [0xb5301c, 0xf5efe0, 0xb5301c];
    cols.forEach((c, i) => { const r1 = m.tol * (1 - i / 3), r0 = m.tol * (1 - (i + 1) / 3); const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .38, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(m.target, .04 + i * .005, 0); targetG.add(ring); });
    const poleH = Math.max(6, m.tol * .6); targetG.add(rbox(.2, poleH, .2, MAT.woodD, m.target, poleH / 2, -m.tol - 1, .03));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(poleH * .5, poleH * .3), new THREE.MeshBasicMaterial({ color: 0xb5301c, side: THREE.DoubleSide })); flag.position.set(m.target + poleH * .25, poleH * .85, -m.tol - 1); targetG.add(flag);
    const lab = stage.label(`과녁 ${m.target}m`, '#a8321f'); lab.position.set(m.target, poleH + 2, -m.tol - 1); targetG.add(lab);
    toast(`🎯 ${m.name} — 과녁이 세워졌어요`);
  }
  drawMissions();
}
function judgeMission(range, o) {
  const m = mission; if (!m || o.type !== m.type) return;
  const box = $('mMsg'); box.hidden = false; box.classList.remove('good');
  if (m.id === 'm3' && o.bomb) { box.innerHTML = '발화통을 달면 텀블링으로 어디로 갈지 몰라요. 「고급 조건」에서 발화통을 떼고 해 보세요.'; return; }
  const tries = prog.addTry(m.id), n = missionStars(m, range, tries), diff = Math.round(range) - m.target;
  if (n > 0) {
    box.classList.add('good'); box.innerHTML = `<b>명중!</b> 과녁에서 ${diff >= 0 ? '+' : ''}${diff}m · ${stars(n)}`;
    sfx.play('ok'); prog.setStar(m.id, n); prog.award('first-hit'); if (MISSIONS.every(x => prog.star(x.id) > 0)) prog.award('triple-hit');
  } else {
    box.innerHTML = `과녁에서 <b>${diff >= 0 ? '+' : ''}${diff}m</b> ${diff > 0 ? '(넘어갔어요)' : '(못 미쳤어요)'}. 다시 해 보세요!` + (tries >= 3 ? `<br><span class="k-note">힌트: ${diff > 0 ? m.hintFar : m.hintNear}</span>` : '');
    sfx.play('no');
  }
  drawMissions();
}

$('lFire').onclick = () => {
  resetShots(); const o = opt(), big = isBig(o.type);
  const res = big ? [{ ...fly(o), delay: 0, layer: 0, col: 0, n: 1 }] : volley({ ...o, angle: Math.min(o.angle, lcart.maxAngle) });
  const proto = protoFor(o.type), len = proto.userData.len;
  res.forEach(r => {
    const g = proto.clone(); g.visible = false; flyG.add(g);
    const fr = lcart.front(Math.min(o.angle, lcart.maxAngle)), lay = 6 - r.layer, ly = .02 + fr.tw / 2 + lay * fr.tw;
    const z0 = big ? 0 : (r.col - (r.n - 1) / 2) * fr.tw, y0 = big ? .2 : fr.y + Math.cos(fr.a) * ly, x0 = big ? 0 : fr.x - Math.sin(fr.a) * ly;
    const line = new THREE.Line(new THREE.BufferGeometry(), trailMat); line.frustumCulled = false; flyG.add(line);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(big ? .07 : .018, big ? .8 : .22, 10), glowMat); flame.rotation.z = Math.PI / 2; g.add(flame);
    const nozzle = proto.userData.tubeX0; flame.position.x = nozzle - (big ? .4 : .11);
    shots.push({ r, g, line, z0, y0, x0, len, flame, nozzle, pts: [], landed: false });
  });
  $('cap').textContent = mission ? '🎯 ' + mission.name : ''; firing = true; simT = 0; lastLayer = -1; lastResult = res; lastType = o.type; lastAng = o.angle * Math.PI / 180; $('lFire').disabled = true;
  const main = res[0], ranges = res.map(r => r.range), mean = ranges.reduce((a, b) => a + b) / ranges.length;
  pending = { o, big, main, mean, min: Math.min(...ranges), max: Math.max(...ranges), range: big ? main.range : mean };
  $('oR').textContent = '…';
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
  if (big) sfx.play('launch');
  stage.stopCam(); cam.position.set(...launchHome()[0]); ctl.target.set(...launchHome()[1]);   // 지난 발사의 탄착 시점에서 시작하지 않게
  // 따라가지 않을 때(또는 움직임 줄이기)는 궤적 전체가 보이는 자리에서 본다
  if (!$('lFollow').checked || stage.isReduced()) { const R = pending.max, H = Math.max(...res.map(r => r.maxH)); stage.view([R * .5, H * .5 + 6, Math.max(R * .95, H * 1.6) + 12], [R * .5, H * .4, 0], 1); }
  prog.done('launch'); prog.award('first-fire');
};
function drawTraj(res, o) {
  const svg = $('traj'), W = 340, H = 170, L = 34, B = 18, T = 8, R = 8;
  const maxX = Math.max(...res.map(r => r.range), 100, mission && mission.type === o.type ? mission.target + mission.tol : 0) * 1.1, maxY = Math.max(...res.map(r => r.maxH), 20) * 1.15;
  const sc = Math.max(maxX / (W - L - R), maxY / (H - T - B));   // 가로·세로 같은 비율
  const x = v => L + v / sc, y = v => H - B - v / sc;
  let s = '';
  const stp = maxX > 1000 ? 200 : maxX > 400 ? 100 : 50;
  for (let d = 0; d <= maxX; d += stp) s += `<line x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${H - B}" stroke="var(--grid)"/><text x="${x(d)}" y="${H - 5}" text-anchor="middle">${d}</text>`;
  s += `<text x="${L - 4}" y="${y(0)}" text-anchor="end">0</text><text x="${W - R}" y="${H - 5}" text-anchor="end">m</text>`;
  // 실험·시험 사거리 띠
  const band = { dae: [900, 1000, '2차 실험 3번'], jung: [200, 250, '시험 사거리'], so: [100, 150, '시험 사거리'] }[o.type];
  if (band) s += `<rect x="${x(band[0])}" y="${T}" width="${x(band[1]) - x(band[0])}" height="${H - T - B}" fill="var(--ok)" opacity=".2"/><text x="${x(band[1]) + 2}" y="${T + 10}">${band[2]} ${band[0]}~${band[1]}m</text>`;
  if (mission && mission.type === o.type) s += `<rect x="${x(mission.target - mission.tol)}" y="${y(0) - 4}" width="${x(mission.tol * 2) - x(0)}" height="8" fill="var(--ac)"/><text x="${x(mission.target)}" y="${y(0) - 7}" text-anchor="middle">과녁</text>`;
  res.slice(0, 100).forEach(r => { const d = r.path.map((p, k) => (k ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(''); s += `<path d="${d}" fill="none" stroke="${r.tumble ? 'var(--ac)' : 'var(--info)'}" stroke-width="${res.length > 1 ? .6 : 1.8}" opacity="${res.length > 1 ? .5 : 1}"/>`; });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mut)"/>`;
  svg.innerHTML = s;
  $('trajLeg').innerHTML = `<span><i style="background:var(--info)"></i>궤적(가로·세로 같은 비율)</span>${res.some(r => r.tumble) ? '<span><i style="background:var(--ac)"></i>텀블링</span>' : ''}${band ? '<span><i style="background:var(--ok);opacity:.5;height:10px"></i>' + band[2] + '</span>' : ''}`;
}
function launchFrame(dt) {
  if (!firing) return;
  const big = isBig(lastType); simT += dt * (big ? 1.5 : 1);
  let lead = null, alive = 0;
  const ang = (big ? +$('lAng').value : Math.min(+$('lAng').value, lcart.maxAngle)) * Math.PI / 180;
  if (!big) { const layer = Math.min(6, Math.floor(simT / .6)); if (layer !== lastLayer) { lastLayer = layer; sfx.play('whoosh'); } }
  const nFly = shots.length, puffRate = big ? 1 : Math.min(1, 26 / nFly);
  shots.forEach(s => {
    const t = simT - s.r.delay; if (t < 0) return;
    const p = s.r.path; let k = p.findIndex(q => q[2] >= t); const done = k < 0; if (done) k = p.length - 1;
    const a = p[Math.max(0, k - 1)], b = p[k], f = done ? 1 : (t - a[2]) / Math.max(1e-6, b[2] - a[2]);
    const px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f;
    const x0 = big ? Math.cos(ang) * 1.5 : s.x0, wy = s.y0 + pz, wx = x0 + px;
    const dir = Math.atan2(b[1] - a[1], b[0] - a[0] || 1e-6), rot = isFinite(dir) && k > 0 ? dir : ang; s.g.visible = true; s.g.rotation.z = rot;
    const wz = s.z0 + s.r.lat * (s.r.range ? Math.min(1, px / s.r.range) : 0), c = Math.cos(rot), sn = Math.sin(rot);
    s.g.position.set(wx - c * s.len, wy - sn * s.len, wz);
    const burning = t < s.r.tb && !done; s.flame.visible = burning; s.flame.scale.setScalar(.8 + Math.random() * .4);
    if (burning && Math.random() < puffRate) {
      const nx = s.g.position.x + c * s.nozzle, ny = s.g.position.y + sn * s.nozzle, sz = big ? .5 : .12;
      stage.fire.emit({ p: [nx, ny, wz], v: [-c * 3, -sn * 3, 0], size: sz * 1.2, grow: -sz, life: .25, color: [1, .62, .2], alpha: .9 });
      stage.smoke.emit({ p: [nx - c * sz, ny - sn * sz, wz], v: [-c * 1.5 + (Math.random() - .5), -sn * 1.5 + .4, (Math.random() - .5)], size: sz * 1.6, grow: sz * 3, life: big ? 3.2 : 1.6, color: [.86, .84, .8], alpha: .42, drag: 1.2, rise: .5 });
    }
    if (!done && (!s.pts.length || Math.abs(s.pts[s.pts.length - 1].x - wx) > (big ? 2 : .5))) { s.pts.push(new THREE.Vector3(wx, wy, wz)); s.line.geometry.setFromPoints(s.pts); }
    if (done && !s.landed) { s.landed = true; // 탄착 먼지
      const n = big ? 26 : 2, sz = big ? 1.6 : .5;
      for (let i = 0; i < n; i++) stage.smoke.emit({ p: [wx, .2, wz], v: [(Math.random() - .5) * sz * 5, Math.random() * sz * 3, (Math.random() - .5) * sz * 5], size: sz, grow: sz * 1.5, life: 1.2 + Math.random(), color: [.62, .52, .38], alpha: .5, drag: 2.2 });
      if (big) sfx.play('boom'); else if (Math.random() < .12) sfx.play('thud');
    }
    if (!done) { alive++; if (!lead || px > lead.px) lead = { px, wx, wy, s }; }
  });
  if (!big) lcart.P.arrowList.forEach(a => { a.visible = simT < (6 - a.userData.layer) * .6; });
  const follow = $('lFollow').checked && !stage.isReduced();
  leadDot.visible = !!lead && !follow; if (lead) leadDot.position.set(lead.wx, lead.wy, 0);
  if (lead && follow) { const tgt = new THREE.Vector3(lead.wx, lead.wy, 0), back = big ? 22 : 9; ctl.target.lerp(tgt, .5); cam.position.lerp(new THREE.Vector3(lead.wx - back * .5, lead.wy + back * .2, back), .35); stage.stopCam(); }
  $('hud').hidden = false; $('hud').textContent = `${simT.toFixed(1)}초 · ${lead ? '앞선 신기전 ' + lead.px.toFixed(0) + 'm' : '모두 떨어짐'}`;
  if (!alive && simT > 1) {
    firing = false; $('lFire').disabled = false; const q = pending;
    $('oR').textContent = q.big ? q.main.range.toFixed(0) + 'm' : q.mean.toFixed(0) + 'm'; if (!q.big) $('oRn').textContent = `100발 평균 사거리 (${q.min.toFixed(0)}~${q.max.toFixed(0)}m)`;
    showDamage(true); judgeMission(q.range, q.o);
    if (q.big && q.o.bomb && q.main.tumble) prog.award('tumble-watcher');
  }
}

// ================= ⑤ 퀴즈 =================
let qOrder = [], qPos = 0, qScore = 0, qWrong = [], qFirstRound = true, qAnswered = false;
function startQuiz(list) { qOrder = list || QUIZ.map((_, i) => i); qFirstRound = !list; qPos = 0; qScore = 0; qWrong = []; showQ(); }
function showQ() {
  const [q, o, a] = QUIZ[qOrder[qPos]]; qAnswered = false;
  $('qn').textContent = `퀴즈 ${qPos + 1} / ${qOrder.length} · 맞힌 수 ${qScore}`; $('qq').textContent = q; $('qe').hidden = true; $('qe').classList.remove('good');
  const idx = o.map((_, i) => i).sort(() => Math.random() - .5);   // 보기 순서는 보여 줄 때마다 섞는다
  $('qopts').innerHTML = idx.map(i => `<button class="k-btn" data-i="${i}">${o[i]}</button>`).join('');
  $('qnext').hidden = true; $('qnext').textContent = qPos === qOrder.length - 1 ? '결과 보기 ▶' : '다음 문제 ▶';
}
$('qopts').onclick = e => {
  const b = e.target.closest('button'); if (!b || qAnswered || !('i' in b.dataset)) return; qAnswered = true;
  const [, , a, ex] = QUIZ[qOrder[qPos]], i = +b.dataset.i, ok = i === a;
  if (ok) qScore++; else qWrong.push(qOrder[qPos]);
  [...$('qopts').children].forEach(x => { if (+x.dataset.i === a) { x.classList.add('ok'); x.textContent = '✓ ' + x.textContent; } else if (x === b) { x.classList.add('no'); x.textContent = '✕ ' + x.textContent; } x.disabled = +x.dataset.i !== a && x !== b; });
  $('qe').hidden = false; $('qe').classList.toggle('good', ok); $('qe').innerHTML = `<b>${ok ? '정답!' : '아쉬워요.'}</b> ${ex}`;
  $('qn').textContent = `퀴즈 ${qPos + 1} / ${qOrder.length} · 맞힌 수 ${qScore}`; $('qnext').hidden = false; sfx.play(ok ? 'ok' : 'no');
};
$('qnext').onclick = () => {
  if ('again' in $('qnext').dataset) { delete $('qnext').dataset.again; startQuiz(); return; }
  if (qPos < qOrder.length - 1) { qPos++; showQ(); return; }
  // 결과
  const n = quizStars(qScore), first = qFirstRound;
  if (first) { prog.setStar('quiz', n); finish('quiz', n === 3 ? 'quiz-star' : null); }
  $('qn').textContent = first ? '퀴즈 결과' : '다시 풀기 결과'; $('qq').innerHTML = `${qOrder.length}문제 중 ${qScore}문제 정답 ${first ? stars(n) : ''}`;
  $('qe').hidden = false; $('qe').classList.remove('good');
  $('qe').textContent = qWrong.length ? '틀린 문제만 다시 풀어 볼 수 있어요. 헷갈리면 메뉴로 돌아가 다시 살펴보세요.' : '모두 맞혔어요! 신기전 박사네요.';
  $('qopts').innerHTML = qWrong.length ? '<button class="k-btn" id="qRetry">틀린 문제 다시 풀기</button>' : '';
  if (qWrong.length) { const wrong = [...qWrong]; $('qRetry').onclick = ev => { ev.stopPropagation(); startQuiz(wrong); }; }
  $('qnext').hidden = false; $('qnext').textContent = '처음부터 다시'; $('qnext').dataset.again = 1; qAnswered = true;
};

// ================= 메뉴 =================
let tab = 'build';
function setTab(t) {
  tab = t; drawNav(); stopPlay();
  for (const m of MENUS) $('p-' + m.id).hidden = m.id !== t;
  $('p-mission').hidden = t !== 'launch';
  cart.root.visible = t === 'build' || t === 'quiz'; arrowG.visible = t === 'arrow'; powderG.visible = t === 'powder'; launchG.visible = t === 'launch';
  $('hud').hidden = true; $('cap').textContent = ''; stage.setTags([]); stage.smoke.clear(); stage.fire.clear();
  ctl.autoRotate = t === 'quiz' && !stage.isReduced(); ctl.autoRotateSpeed = .8;
  if (t === 'build') setStep(step, true);
  if (t === 'arrow') setArrow(aMode);
  if (t === 'powder') setPowder(pIdx, true);
  if (t === 'launch') { syncUI(); drawMissions(); stage.setHome(...launchHome()); $('cap').textContent = '조건을 고르고 🔥 발사'; }
  if (t === 'quiz') { showWholeCart(); stage.setHome([3.4, 2.3, 3.6], [0, 1, 0]); $('cap').textContent = '문종 화차'; if (!qOrder.length) startQuiz(); }
  $('panel').scrollTop = 0; settings.apply();
}
$('nav').onclick = e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); };
addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea,dialog') || e.altKey || e.ctrlKey || e.metaKey) return;
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
  if (tab === 'build') setStep(step + d); else if (tab === 'powder') setPowder(pIdx + d);
});

// ================= 시작 =================
setType('jung'); setTab('build');
stage.onFrame(dt => { if (tab === 'build') buildFrame(dt); else if (tab === 'powder') powderFrame(dt); else if (tab === 'launch') launchFrame(dt); });
stage.start();
// 검증·디버그용
window.__set = { tab: setTab, step: setStep, arrow: setArrow, powder: setPowder, type: setType, mission: i => setMission(MISSIONS[i] || null), fire: () => $('lFire').click(), simT: v => { simT = v; } };
window.__state = () => ({ tab, step, simT, firing, quality: stage.quality() });
