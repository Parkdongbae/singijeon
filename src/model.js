// 3D 모형. 단위 m(sim.js mm ÷ 1000), y 위, x 앞(발사 방향)
import * as THREE from 'three';
import { CART, GIJEON, ARROWS } from './sim.js';
import { wood, iron, paper, rope, rbox, cyl, lathe } from './kit/parts.js';
import { canvasTex } from './kit/stage.js';
const M = v => v / 1000;

export const MAT = {
  wood: wood('#a9773f', '#5b3a1a', 1),
  woodD: wood('#7f5129', '#3d240f', 2),
  woodL: wood('#cfa56c', '#8a5f2f', 3),
  key: wood('#dcb77c', '#9a6c34', 4),            // 쐐기·나비장(밝은 나무로 눈에 띄게)
  iron: iron(),
  bamboo: new THREE.MeshStandardMaterial({ color: 0xc9aa63, roughness: .45, envMapIntensity: .7,
    map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,90,30,${.05 + (i * 37 % 10) / 80})`; g.fillRect(0, i * 7 % h, w, 1 + i % 3); } }) }),
  paper: paper(0xece2c8),
  paperIn: paper(0xcfc3a5),
  powder: new THREE.MeshStandardMaterial({ color: 0x242321, roughness: 1, side: THREE.DoubleSide, envMapIntensity: .2 }),
  feather: new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: .9, side: THREE.DoubleSide, envMapIntensity: .3 }),
  bomb: paper(0xb9a37b),
  cord: rope('#8b2f1e'),
  hole: new THREE.MeshBasicMaterial({ color: 0x140d07 }),
};
const box = rbox;

// ---------- 바퀴 ----------
// 바퀴통(가운데가 볼록한 통 + 쇠테) · 깎은 살 12개 · 네모 단면의 휜 테 6조각(나비장이음) · 쇠테
function wheel() {
  const R = M(CART.wheelD) / 2, g = new THREE.Group(), parts = {}, ri = R - .075, ro = R - .008, wz = .062;
  const hub = new THREE.Group(); g.add(hub); parts.hub = hub;
  const barrel = lathe([[.034, -.13], [.07, -.13], [.086, -.07], [.094, 0], [.086, .07], [.07, .13], [.034, .13]], MAT.woodD, 28); barrel.rotation.x = Math.PI / 2; hub.add(barrel);
  for (const s of [-1, 1]) { const band = cyl(.079, .079, .022, MAT.iron, 28, true); band.rotation.x = Math.PI / 2; band.position.z = s * .105; band.material.side = THREE.DoubleSide; hub.add(band); }
  const spokes = new THREE.Group(); g.add(spokes); parts.spokes = spokes;
  const sLen = ri - .078 + .02, sGeo = new THREE.CylinderGeometry(.016, .025, sLen, 10); sGeo.scale(1, 1, 1.35);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, s = new THREE.Mesh(sGeo, MAT.wood), rc = .078 + sLen / 2 - .005; s.castShadow = s.receiveShadow = true; s.position.set(Math.cos(a) * rc, Math.sin(a) * rc, 0); s.rotation.z = a - Math.PI / 2; spokes.add(s); }
  const rim = new THREE.Group(); g.add(rim); parts.rim = rim;
  const seg = Math.PI / 3, gap = .006, sh = new THREE.Shape();
  sh.absarc(0, 0, ro, gap, seg - gap, false); sh.absarc(0, 0, ri, seg - gap, gap, true); sh.closePath();
  const fGeo = new THREE.ExtrudeGeometry(sh, { depth: wz - .008, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 2, curveSegments: 14 }); fGeo.translate(0, 0, -(wz - .008) / 2);
  const bow = new THREE.Shape(); bow.moveTo(-.045, -.022); bow.lineTo(0, -.009); bow.lineTo(.045, -.022); bow.lineTo(.045, .022); bow.lineTo(0, .009); bow.lineTo(-.045, .022); bow.closePath();
  const kGeo = new THREE.ExtrudeGeometry(bow, { depth: .006, bevelEnabled: false });
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(fGeo, MAT.woodD); f.rotation.z = i * seg; f.castShadow = f.receiveShadow = true; rim.add(f);
    const a = i * seg, rk = (ri + ro) / 2;
    for (const s of [-1, 1]) { const k = new THREE.Mesh(kGeo, MAT.key); k.position.set(Math.cos(a) * rk, Math.sin(a) * rk, s > 0 ? wz / 2 - .004 : -wz / 2 - .002); k.rotation.z = a + Math.PI / 2; rim.add(k); }
  }
  const tire = lathe([[ro, -wz / 2], [R, -wz / 2], [R, wz / 2], [ro, wz / 2], [ro, -wz / 2]], MAT.iron, 72); tire.rotation.x = Math.PI / 2; rim.add(tire);
  return { g, parts, R };
}

// ---------- 화차 수레 + 신기전기 ----------
// 차축형: 굴대(차축)는 차체에 고정, 바퀴는 굴대 양 끝에서 돌고 차체 바깥에 있음.
// 차체(수레채)는 옆판으로 굴대보다 높이 올림 → 손잡이를 땅에 대면 수레 전체가 뒤로 기울어 신기전기가 약 40°를 향함 [화차: 최대 40°].
// 받침은 없음. 손잡이를 들수록 각도가 낮아짐. 원공목통은 굴대 바로 위.
// 비례(옆판 높이 0.65m, 굴대 뒤 손잡이 1.5m)는 사진 비례로 정한 가정값.
export const CART_GEO = { raise: .65, back: 1.5 };
export function buildCart() {
  const root = new THREE.Group(), P = {};
  const R = M(CART.wheelD) / 2, L = M(CART.bodyL), W = M(CART.bodyW), zw = W / 2 + .17;
  // 바퀴 2개: 차체 바깥 (굴대 끝)
  const wheels = [];
  for (const s of [-1, 1]) { const w = wheel(); w.g.position.set(0, R, s * zw); root.add(w.g); wheels.push(w); }
  P.hub = wheels.map(w => w.parts.hub); P.spoke = wheels.map(w => w.parts.spokes); P.rim = wheels.map(w => w.parts.rim);
  P.wheels = wheels.map(w => w.g);
  // 기울어지는 부분(굴대 중심이 축)
  const tilt = new THREE.Group(); tilt.position.set(0, R, 0); root.add(tilt); P.tilt = tilt;
  // 굴대: 가운데는 네모(차체에 고정), 양 끝은 둥글게 깎아 바퀴통에 끼움 + 비녀장
  const axle = new THREE.Group(); tilt.add(axle);
  axle.add(box(.085, .085, W + .06, MAT.woodD, 0, 0, 0, .012));
  for (const s of [-1, 1]) { const e = cyl(.034, .034, .36, MAT.woodD, 20); e.rotation.x = Math.PI / 2; e.position.z = s * (W / 2 + .18); axle.add(e);
    const pin = cyl(.007, .009, .12, MAT.iron, 10); pin.position.set(0, 0, s * (zw + .15)); axle.add(pin);
    const head = cyl(.016, .016, .012, MAT.iron, 10); head.position.set(0, .062, s * (zw + .15)); axle.add(head); }
  P.axle = [axle];
  // 옆판(굴대받이): 굴대를 물고 수레채를 받침
  const H = CART_GEO.raise, frame = new THREE.Group(); tilt.add(frame);
  for (const s of [-1, 1]) frame.add(box(.75, H + .04, .05, MAT.woodD, 0, (H - .04) / 2, s * (W / 2 - .025), .01));   // 위끝이 수레채 밑면에 닿음
  // 수레채 2개(길이 2.3m): 굴대 앞 0.8m, 뒤 1.5m(손잡이)
  const back = CART_GEO.back, front = L - back, ys = H + .045;
  for (const s of [-1, 1]) { frame.add(box(L, .09, .08, MAT.wood, (front - back) / 2, ys, s * (W / 2 - .04), .014));
    // 손잡이 끝을 둥글게 깎고 쇠띠를 두름
    const grip = cyl(.036, .04, .22, MAT.woodL, 16); grip.rotation.z = Math.PI / 2; grip.position.set(-back - .1, ys, s * (W / 2 - .04)); frame.add(grip);
    const ring = cyl(.043, .043, .02, MAT.iron, 16, true); ring.rotation.z = Math.PI / 2; ring.position.set(-back + .02, ys, s * (W / 2 - .04)); frame.add(ring); }
  const wedges = new THREE.Group();
  for (const x of [-1.2, -.6, -.3, .3, .7]) { frame.add(box(.07, .07, W + .08, MAT.woodD, x, ys, 0, .01)); for (const s of [-1, 1]) wedges.add(box(.02, .055, .034, MAT.key, x + .04, ys + .004, s * (W / 2 + .03), .004)); }
  frame.add(wedges);
  P.frame = [frame];
  const deck = new THREE.Group(); tilt.add(deck);
  for (let i = 0; i < 6; i++) deck.add(box(1.2 / 6 - .004, .025, W - .16, i % 2 ? MAT.woodL : MAT.wood, -.6 + (i + .5) * 1.2 / 6, ys + .055, 0, .005));
  P.deck = [deck];
  // 신기전기: 원공목통 면(앞)이 굴대 바로 위. 상자는 수레채를 따라 뒤로 1,149.4mm
  const G = GIJEON, tw = M(G.tube.W), tl = M(G.tube.L), bw = 15 * tw + .04, bh = M(G.H), bl = M(G.L);
  const yd = ys + .07, xf = tl / 2;   // 원공목통 가운데가 굴대 위
  const boxG = new THREE.Group(); boxG.position.set(xf, yd, 0); tilt.add(boxG);
  boxG.add(box(tl + .02, .02, bw, MAT.woodD, -tl / 2, .01, 0, .004));
  // 상자는 원공목통 부분만(뒤는 트여 화살대가 나옴)
  for (const s of [-1, 1]) boxG.add(box(tl + .02, bh, .02, MAT.woodD, -tl / 2, bh / 2, s * (bw / 2 - .01), .004));
  boxG.add(box(tl + .02, .02, bw, MAT.woodD, -tl / 2, bh - .01, 0, .004));
  const dove = new THREE.Group(); for (const s of [-1, 1]) for (let k = 0; k < 4; k++) dove.add(box(.024, .05, .026, MAT.key, -.004, .04 + k * .095, s * (bw / 2 - .01), .003)); boxG.add(dove);
  P.box = [boxG];
  // 원공목통: 구멍이 실제로 뚫린 네모 나무통 100개
  const tubes = new THREE.Group(), holes = []; boxG.add(tubes);
  const sq = new THREE.Shape(), q = tw / 2 - .0012; sq.moveTo(-q, -q); sq.lineTo(q, -q); sq.lineTo(q, q); sq.lineTo(-q, q); sq.closePath();
  const hp = new THREE.Path(); hp.absarc(0, 0, M(G.tube.hole) / 2, 0, Math.PI * 2, true); sq.holes.push(hp);
  const tg = new THREE.ExtrudeGeometry(sq, { depth: tl, bevelEnabled: false, curveSegments: 14 }); tg.translate(0, 0, -tl / 2); tg.rotateY(Math.PI / 2);
  G.rows.forEach((n, layer) => { for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * tw, y = .02 + tw / 2 + layer * tw;
    const t = new THREE.Mesh(tg, (i + layer) % 2 ? MAT.wood : MAT.woodL); t.position.set(-tl / 2, y, z); t.castShadow = t.receiveShadow = true; tubes.add(t);
    holes.push([y, z, layer]);
  } });
  P.tubes = [tubes];
  P.prop = []; P.posts = [];
  // 중신기전 100발
  const arrows = new THREE.Group(); boxG.add(arrows); P.load = [arrows];
  const jA = ARROWS.jung, stickL = M(jA.stick), tubeL = M(jA.tube.L), tubeD = M(jA.tube.D);
  const stG = new THREE.CylinderGeometry(.004, .005, stickL, 6); stG.rotateZ(Math.PI / 2);
  const tbG = new THREE.CylinderGeometry(tubeD / 2, tubeD / 2, tubeL, 12); tbG.rotateZ(Math.PI / 2);
  const hdG = new THREE.ConeGeometry(.007, .04, 6); hdG.rotateZ(-Math.PI / 2);
  const ftG = new THREE.PlaneGeometry(.12, .028);
  const arrowList = [];
  for (const [y, z, layer] of holes) {
    const a = new THREE.Group(); a.position.set(.12, y, z);
    const st = new THREE.Mesh(stG, MAT.bamboo); st.position.x = -stickL / 2 + .05; a.add(st);
    const tb = new THREE.Mesh(tbG, MAT.paper); tb.position.x = .05 + tubeL / 2; tb.castShadow = true; a.add(tb);
    const hd = new THREE.Mesh(hdG, MAT.iron); hd.position.x = .05 + tubeL + .02; a.add(hd);
    const ft = new THREE.Mesh(ftG, MAT.feather); ft.position.x = -stickL + .1; a.add(ft); const ft2 = ft.clone(); ft2.rotation.x = Math.PI / 2; a.add(ft2);
    a.userData = { layer, home: a.position.clone() }; arrows.add(a); arrowList.push(a);
  }
  P.arrowList = arrowList;
  const fuse = new THREE.Group(); for (let l = 0; l < 7; l++) { const c = cyl(.0035, .0035, bw * .9, MAT.cord, 6); c.rotation.x = Math.PI / 2; c.position.set(.03, .02 + tw / 2 + l * tw - tw * .35, 0); fuse.add(c); } boxG.add(fuse); P.load.push(fuse);
  // 손잡이 끝이 땅에 닿는 각도(최대 발사각): R + ys·cosθ − back·sinθ = 0
  let maxA = 0; for (let a = 0; a < 80; a += .05) { const t = a * Math.PI / 180; if (R + ys * Math.cos(t) - back * Math.sin(t) <= 0) { maxA = a; break; } }
  root.userData = { yb: R, R, ys, back, maxAngle: maxA };
  const setA = deg => { tilt.rotation.z = Math.min(deg, maxA) * Math.PI / 180; };
  // 원공목통 앞면 아래쪽(세계 좌표): 발사 시작점 계산용
  const front_ = deg => { const a = Math.min(deg, maxA) * Math.PI / 180, px = xf, py = yd; return { x: px * Math.cos(a) - py * Math.sin(a), y: R + px * Math.sin(a) + py * Math.cos(a), a, tw }; };
  const handleH = deg => { const t = Math.min(deg, maxA) * Math.PI / 180; return Math.max(0, R + ys * Math.cos(t) - back * Math.sin(t)); };
  return { root, P, setAngle: setA, boxLen: bl, front: front_, handleH, maxAngle: maxA };
}

// ---------- 신기전 한 발(구조 보기용, 실제 크기) ----------
export function buildArrow(key, { cut = false } = {}) {
  const A = ARROWS[key], g = new THREE.Group(), parts = {}, big = key === 'dae' || key === 'sanhwa';
  const stL = M(A.stick), T = A.tube, tL = M(T.L), tR = M(T.D) / 2;
  const top = M(A.total);   // 앞끝 x = top
  // 안정막대(대나무): 뒤 0 → 앞 stL. 위가 가늘고 아래가 굵음(대: 윗둘레 1촌, 아래둘레 3촌)
  const r1 = big ? M(31.2) / Math.PI / 2 * 3 : .006, r0 = big ? M(31.2) / 2 : .004;
  const st = cyl(r0 * .9, r1 * .9, stL, MAT.bamboo, 14); st.rotation.z = -Math.PI / 2; st.position.x = stL / 2; g.add(st); parts.stick = st;
  // 마디: 살짝 볼록한 고리
  const nodeMat = MAT.bamboo.clone(); nodeMat.color.set(0xa98845);
  for (let x = .3; x < stL - .1; x += big ? .35 : .12) { const rr = r1 * .9 + (r0 - r1) * .9 * (x / stL), n = new THREE.Mesh(new THREE.TorusGeometry(rr, rr * .13, 6, 16), nodeMat); n.rotation.y = Math.PI / 2; n.position.x = x; g.add(n); }
  // 깃 3장
  const fL = Math.min(.5, stL * .12), fW = big ? .1 : .025, fs = new THREE.Shape();
  fs.moveTo(0, 0); fs.lineTo(fL, 0); fs.quadraticCurveTo(fL * .9, fW, fL * .55, fW); fs.quadraticCurveTo(fL * .12, fW * .95, 0, fW * .25); fs.closePath();
  const fG = new THREE.ShapeGeometry(fs, 8); fG.translate(.02, r1 * .9, 0);
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(fG, MAT.feather); f.rotation.x = k * Math.PI * 2 / 3; f.castShadow = true; g.add(f); }
  // 약통: 안정막대 앞쪽 끝에 묶음
  const tubeX0 = top - tL - (A.bomb && !A.bomb.inner ? M(A.bomb.L) : 0);
  // 약통은 안정막대 옆에 나란히 묶음(단면 보기에서는 막대가 뒤로 가게)
  const tube = new THREE.Group(); tube.position.set(tubeX0, cut ? 0 : tR + r1 * .9, cut ? tR + r1 : 0); g.add(tube); parts.tube = tube;
  const phi = cut ? Math.PI : Math.PI * 2;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR, tL, 40, 1, !cut ? false : true, 0, phi), MAT.paper); shell.rotation.z = -Math.PI / 2; shell.position.x = tL / 2; shell.castShadow = true; tube.add(shell);
  if (cut) {
    const inR = M(T.d) / 2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(inR, inR, tL, 40, 1, true, 0, phi), MAT.paperIn); inner.rotation.z = -Math.PI / 2; inner.position.x = tL / 2; tube.add(inner);
    // 단면 벽(한지 겹)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(tL, tR - inR), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .95, map: canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#e8dcbf'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b3a27c'; c.lineWidth = .8; for (let y = 0; y < h; y += 2) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }) }));
    for (const s of [-1, 1]) { const wm = wall.clone(); wm.rotation.x = -Math.PI / 2; wm.position.set(tL / 2, 0, s * (inR + (tR - inR) / 2)); tube.add(wm); }
    // 화약(추진제): 뒤쪽 분사구멍부터 앞 칸막이까지, 가운데 원뿔 구멍(약선구멍 — 뾰족한 쇠심 자리)
    const fillL = key === 'sanhwa' ? tL - M(3.7 * 31.2) : tL * .9, coreR = M(T.nozzle) / 2;
    const prof = [new THREE.Vector2(coreR, 0), new THREE.Vector2(inR, 0), new THREE.Vector2(inR, fillL), new THREE.Vector2(.002, fillL), new THREE.Vector2(.002, fillL * .55), new THREE.Vector2(coreR, 0)];
    const pw = new THREE.Mesh(new THREE.LatheGeometry(prof, 40, 0, phi), MAT.powder); pw.rotation.z = -Math.PI / 2; tube.add(pw); parts.powder = pw;
    // 앞 마개(종이 여러 겹) · 약선
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(inR, inR, tL * .06, 24, 1, false, 0, phi), MAT.paperIn); plug.rotation.z = -Math.PI / 2; plug.position.x = fillL + tL * .03; tube.add(plug);
    const fuse = cyl(.003, .003, tL * .3, MAT.cord, 6); fuse.rotation.z = Math.PI / 2; fuse.position.x = fillL + tL * .12; tube.add(fuse); parts.fuse = fuse;
  } else {
    // 약통을 막대에 묶은 끈(약통과 막대를 함께 감음)
    const yc = -(tR + r1 * .9) / 2, ry = (tR * 2 + r1 * 1.8) / 2 + .002;
    for (const x of [tL * .12, tL * .5, tL * .88]) { const c = new THREE.Mesh(new THREE.TorusGeometry(1, big ? .0045 : .0018, 6, 28), MAT.cord); c.rotation.y = Math.PI / 2; c.scale.set(tR + .002, ry, 1); c.scale.z = 1; c.position.set(x, yc, 0); tube.add(c); }
    // 분사구멍(뒤쪽 끝)
    const noz = new THREE.Mesh(new THREE.CircleGeometry(M(T.nozzle) / 2, 20), MAT.hole); noz.rotation.y = -Math.PI / 2; noz.position.x = -.0008; tube.add(noz);
  }
  // 발화통(폭탄)
  if (A.bomb && !A.bomb.inner) {
    const bL = M(A.bomb.L), bR = M(A.bomb.D) / 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR, bL, 28, 1, false, 0, phi), MAT.bomb); b.rotation.z = -Math.PI / 2; b.position.x = tL + bL / 2; b.castShadow = true; tube.add(b); parts.bomb = b;
    if (!cut && big) for (const x of [.03, bL - .03]) { const c = new THREE.Mesh(new THREE.TorusGeometry(bR + .002, .004, 6, 24), MAT.cord); c.rotation.y = Math.PI / 2; c.position.x = tL + x; tube.add(c); }
  }
  // 단면은 자른 면이 +z(보는 쪽)를 향하게
  if (cut) tube.rotation.x = Math.PI / 2;
  // 중·소: 화살촉(버들잎 모양)
  if (!big) { const h = lathe([[0, 0], [.0035, .004], [.0065, .018], [.004, .034], [0, .045]], MAT.iron, 8); h.scale.z = .45; h.rotation.z = -Math.PI / 2; h.position.x = top - .012; g.add(h); }
  g.userData = { len: top, tubeX0, tL };
  return { g, parts };
}

// ---------- 결구 확대 모형 ----------
// 각각 { group, anim(u) } : u 0 = 맞춤, 1 = 떨어짐
export function buildJoint(kind) {
  const g = new THREE.Group(), W = MAT.wood, D = MAT.woodD, L = MAT.woodL, K = MAT.key;
  let anim = () => {};
  if (kind === 'mortise') {   // 장부맞춤: 기둥(구멍) + 장부
    const post = new THREE.Group(); g.add(post);
    post.add(box(.4, .12, .04, D, 0, .14, 0), box(.4, .12, .04, D, 0, -.14, 0), box(.4, .16, .03, D, 0, 0, .035), box(.4, .16, .03, D, 0, 0, -.035));
    const beam = new THREE.Group(); g.add(beam); beam.add(box(.3, .16, .1, W, .3, 0, 0), box(.18, .158, .04, L, .06, 0, 0));
    anim = u => { beam.position.x = .05 + u * .3; };
    beam.position.x = .05;
  } else if (kind === 'wedge') {   // 관통장부 + 쐐기
    const post = new THREE.Group(); g.add(post); post.add(box(.12, .5, .12, D));
    const tenon = new THREE.Group(); g.add(tenon); tenon.add(box(.35, .1, .08, W, -.24, 0, 0), box(.2, .08, .04, L, .02, 0, 0));
    const wedge = box(.03, .1, .02, K, .12, 0, 0); g.add(wedge);
    anim = u => { tenon.position.x = -u * .3; wedge.position.y = Math.min(1, u * 2) * .25; };
  } else if (kind === 'butterfly') {   // 나비장이음
    g.add(box(.3, .06, .16, D, -.15, 0, 0), box(.3, .06, .16, D, .15, 0, 0));
    const sh = new THREE.Shape(); sh.moveTo(-.07, -.04); sh.lineTo(0, -.015); sh.lineTo(.07, -.04); sh.lineTo(.07, .04); sh.lineTo(0, .015); sh.lineTo(-.07, .04); sh.closePath();
    const key = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .03, bevelEnabled: false }), K); key.rotation.x = -Math.PI / 2; g.add(key);
    anim = u => { key.position.y = .016 + u * .2; g.children[0].position.x = -.15 - u * .03; g.children[1].position.x = .15 + u * .03; };
  } else if (kind === 'pin') {   // 굴대 + 바퀴통 + 비녀장
    const ax = cyl(.04, .04, .6, D); ax.rotation.z = Math.PI / 2; g.add(ax);
    const hub = lathe([[.045, -.1], [.075, -.1], [.092, 0], [.075, .1], [.045, .1]], W, 24); hub.rotation.z = Math.PI / 2; g.add(hub);
    const pin = cyl(.008, .008, .14, MAT.iron, 8); pin.position.x = .25; g.add(pin);
    anim = u => { hub.position.x = .1 + u * .12; pin.position.y = u * .25; };
  } else if (kind === 'tongue') {   // 제혀쪽매
    const a = new THREE.Group(), b = new THREE.Group(); g.add(a, b);
    a.add(box(.4, .03, .14, W, 0, 0, -.07, .002), box(.4, .012, .025, L, 0, 0, .0125, .001));
    b.add(box(.4, .009, .14, D, 0, .0105, .07, .001), box(.4, .009, .14, D, 0, -.0105, .07, .001), box(.4, .012, .115, D, 0, 0, .0825, .001));
    anim = u => { b.position.z = .002 + u * .12; };
  } else if (kind === 'dovetail') {   // 사개(주먹장)맞춤 — 상자 모서리
    const A = new THREE.Group(), B = new THREE.Group(); g.add(A, B);
    A.add(box(.3, .3, .03, D, -.15, 0, 0)); B.add(box(.03, .3, .3, W, 0, 0, .15));
    for (let k = 0; k < 3; k++) A.add(box(.04, .05, .03, D, .02, -.1 + k * .1, 0, .002));
    anim = u => { A.position.x = -u * .25; };
  } else if (kind === 'halflap') {   // 반턱맞춤
    const A = new THREE.Group(), B = new THREE.Group(); g.add(A, B);
    A.add(box(.5, .04, .08, W, 0, -.02, 0), box(.21, .04, .08, W, -.145, .02, 0), box(.21, .04, .08, W, .145, .02, 0));
    B.add(box(.08, .04, .5, D, 0, .02, 0), box(.08, .04, .21, D, 0, -.02, -.145), box(.08, .04, .21, D, 0, -.02, .145));
    anim = u => { B.position.y = u * .2; };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
  return { g, anim };
}

// ---------- 대신기전 발사대 (실험: 레일 6m, 다리) ----------
// 긴 들보 위에 안내 레일, 들보는 A자 다리 세 쌍이 받친다
export function buildRack(railLen = 3.3) {
  const g = new THREE.Group(), pivot = new THREE.Group(); g.add(pivot);
  pivot.add(box(6, .09, .15, MAT.woodD, 3, 0, 0, .012));
  for (const s of [-1, 1]) pivot.add(box(railLen, .045, .025, MAT.wood, 6 - railLen / 2 - .1, .066, s * .045, .005));
  pivot.add(box(.3, .16, .26, MAT.woodD, .1, -.02, 0, .012));   // 땅에 닿는 받침목
  const legGeo = new THREE.BoxGeometry(.07, 1, .07); legGeo.translate(0, -.5, 0);
  const legs = [], ties = [];
  for (let i = 0; i < 3; i++) { const pair = [-1, 1].map(s => { const l = new THREE.Mesh(legGeo, MAT.woodD); l.castShadow = true; l.userData.s = s; g.add(l); return l; }); legs.push(pair);
    const tie = box(.05, .05, 1, MAT.wood); g.add(tie); ties.push(tie); }
  return { g, pivot, set: deg => {
    const a = deg * Math.PI / 180; pivot.rotation.z = a;
    [2.2, 4.0, 5.5].forEach((d, i) => { const x = Math.cos(a) * d, y = Math.sin(a) * d, sp = .25 + y * .22, len = Math.hypot(y, sp);
      for (const l of legs[i]) { l.position.set(x, y, 0); l.scale.y = len; l.rotation.x = -l.userData.s * Math.atan2(sp, y); }
      ties[i].position.set(x, y * .35, 0); ties[i].scale.z = sp * 1.3 + .1; });
  } };
}
