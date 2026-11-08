// 3D 모형. 단위 m(sim.js mm ÷ 1000), y 위, x 앞(발사 방향)
import * as THREE from 'three';
import { CART, GIJEON, ARROWS } from './sim.js';
const M = v => v / 1000;

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  return t;
}
// 나뭇결
function grain(base, dark, seed = 1) {
  return canvasTex(256, 256, (g, w, h) => {
    let s = seed * 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = dark; g.globalAlpha = .08 + r() * .18; g.lineWidth = .5 + r() * 2; g.beginPath(); let y = r() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3 + (r() - .5) * 2); g.stroke(); }
    g.globalAlpha = 1;
  });
}
export const MAT = {
  wood: new THREE.MeshStandardMaterial({ map: grain('#a7743f', '#5b3a1a', 1), roughness: .8 }),
  woodD: new THREE.MeshStandardMaterial({ map: grain('#8a5a2e', '#4a2c12', 2), roughness: .8 }),
  woodL: new THREE.MeshStandardMaterial({ map: grain('#c79a62', '#7a5228', 3), roughness: .8 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2c2b29, metalness: .6, roughness: .5 }),
  bamboo: new THREE.MeshStandardMaterial({ color: 0xc8a96a, roughness: .6 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: .9, side: THREE.DoubleSide }),
  paperIn: new THREE.MeshStandardMaterial({ color: 0xcfc3a5, roughness: .95, side: THREE.DoubleSide }),
  powder: new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 1, side: THREE.DoubleSide }),
  feather: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: .9, side: THREE.DoubleSide }),
  bomb: new THREE.MeshStandardMaterial({ color: 0xb8a27a, roughness: .9 }),
  cord: new THREE.MeshStandardMaterial({ color: 0x8b2f1e, roughness: .8 }),
  ghost: new THREE.MeshStandardMaterial({ color: 0xb5612a, transparent: true, opacity: .25, depthWrite: false }),
};
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const cyl = (r1, r2, h, mat, seg = 24) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = true; return m; };

export function ground(scene) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ roughness: 1,
    map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#9a9a6c'; c.fillRect(0, 0, w, h); let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 3000; i++) { const v = 120 + r() * 50 | 0; c.fillStyle = `rgb(${v},${v + 6},${v - 30})`; c.fillRect(r() * w, r() * h, 2, 2); } }, [800, 800]) }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g); return g;
}

// ---------- 바퀴 ----------
function wheel() {
  const R = M(CART.wheelD) / 2, g = new THREE.Group(), parts = {};
  const hub = cyl(.085, .085, .24, MAT.woodD, 20); hub.rotation.x = Math.PI / 2; g.add(hub); parts.hub = hub;
  const spokes = new THREE.Group(); g.add(spokes); parts.spokes = spokes;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, s = box(.035, R - .12, .045, MAT.wood); s.position.set(Math.cos(a) * (R / 2 + .02), Math.sin(a) * (R / 2 + .02), 0); s.rotation.z = a - Math.PI / 2; spokes.add(s); }
  const rim = new THREE.Group(); g.add(rim); parts.rim = rim;
  for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.TorusGeometry(R - .035, .035, 8, 16, Math.PI / 3 - .02), MAT.woodD); seg.rotation.z = i * Math.PI / 3; seg.castShadow = true; seg.scale.z = 1.4; rim.add(seg);
    const key = box(.03, .02, .07, MAT.woodL); const a = i * Math.PI / 3; key.position.set(Math.cos(a) * (R - .035), Math.sin(a) * (R - .035), 0); key.rotation.z = a; rim.add(key); }
  const tire = new THREE.Mesh(new THREE.TorusGeometry(R - .002, .008, 6, 64), MAT.iron); tire.scale.z = 4; rim.add(tire);
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
  axle.add(box(.08, .08, W + .06, MAT.woodD));
  for (const s of [-1, 1]) { const e = cyl(.035, .035, .34, MAT.woodD, 16); e.rotation.x = Math.PI / 2; e.position.z = s * (W / 2 + .17); axle.add(e);
    const pin = cyl(.008, .008, .11, MAT.iron, 8); pin.position.set(0, 0, s * (zw + .15)); axle.add(pin); }
  P.axle = [axle];
  // 옆판(굴대받이): 굴대를 물고 수레채를 받침
  const H = CART_GEO.raise, frame = new THREE.Group(); tilt.add(frame);
  for (const s of [-1, 1]) frame.add(box(.75, H + .04, .05, MAT.woodD, 0, (H - .04) / 2, s * (W / 2 - .025)));   // 위끝이 수레채 밑면에 닿음
  // 수레채 2개(길이 2.3m): 굴대 앞 0.8m, 뒤 1.5m(손잡이)
  const back = CART_GEO.back, front = L - back, ys = H + .045;
  for (const s of [-1, 1]) frame.add(box(L, .09, .08, MAT.wood, (front - back) / 2, ys, s * (W / 2 - .04)));
  const wedges = new THREE.Group();
  for (const x of [-1.2, -.6, -.3, .3, .7]) { frame.add(box(.07, .07, W + .08, MAT.woodD, x, ys, 0)); for (const s of [-1, 1]) wedges.add(box(.02, .05, .03, MAT.woodL, x + .04, ys, s * (W / 2 + .03))); }
  frame.add(wedges);
  P.frame = [frame];
  const deck = new THREE.Group(); tilt.add(deck);
  for (let i = 0; i < 6; i++) deck.add(box(1.2 / 6 - .004, .025, W - .16, MAT.woodL, -.6 + (i + .5) * 1.2 / 6, ys + .055, 0));
  P.deck = [deck];
  // 신기전기: 원공목통 면(앞)이 굴대 바로 위. 상자는 수레채를 따라 뒤로 1,149.4mm
  const G = GIJEON, tw = M(G.tube.W), tl = M(G.tube.L), bw = 15 * tw + .04, bh = M(G.H), bl = M(G.L);
  const yd = ys + .07, xf = tl / 2;   // 원공목통 가운데가 굴대 위
  const boxG = new THREE.Group(); boxG.position.set(xf, yd, 0); tilt.add(boxG);
  boxG.add(box(tl + .02, .02, bw, MAT.woodD, -tl / 2, .01, 0));
  // 상자는 원공목통 부분만(뒤는 트여 화살대가 나옴)
  for (const s of [-1, 1]) { const z = s * (bw / 2 - .01);
    boxG.add(box(tl + .02, bh, .02, MAT.woodD, -tl / 2, bh / 2, z)); }
  boxG.add(box(tl + .02, .02, bw, MAT.woodD, -tl / 2, bh - .01, 0));
  const dove = new THREE.Group(); for (const s of [-1, 1]) for (let k = 0; k < 4; k++) dove.add(box(.022, .05, .024, MAT.woodL, -.005, .04 + k * .095, s * (bw / 2 - .01))); boxG.add(dove);
  P.box = [boxG];
  const tubes = new THREE.Group(), holes = []; boxG.add(tubes);
  const tg = new THREE.BoxGeometry(tl, tw - .002, tw - .002), hg = new THREE.CircleGeometry(M(G.tube.hole) / 2, 16);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a120a });
  G.rows.forEach((n, layer) => { for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * tw, y = .02 + tw / 2 + layer * tw;
    const t = new THREE.Mesh(tg, MAT.wood); t.position.set(-tl / 2, y, z); t.castShadow = true; tubes.add(t);
    const h = new THREE.Mesh(hg, holeMat); h.rotation.y = Math.PI / 2; h.position.set(.0006, y, z); tubes.add(h); holes.push([y, z, layer]);
  } });
  P.tubes = [tubes];
  P.prop = []; P.posts = [];
  // 중신기전 100발
  const arrows = new THREE.Group(); boxG.add(arrows); P.load = [arrows];
  const jA = ARROWS.jung, stickL = M(jA.stick), tubeL = M(jA.tube.L), tubeD = M(jA.tube.D);
  const stG = new THREE.CylinderGeometry(.004, .005, stickL, 6); stG.rotateZ(Math.PI / 2);
  const tbG = new THREE.CylinderGeometry(tubeD / 2, tubeD / 2, tubeL, 10); tbG.rotateZ(Math.PI / 2);
  const ftG = new THREE.PlaneGeometry(.12, .025);
  const arrowList = [];
  for (const [y, z, layer] of holes) {
    const a = new THREE.Group(); a.position.set(.12, y, z);
    const st = new THREE.Mesh(stG, MAT.bamboo); st.position.x = -stickL / 2 + .05; a.add(st);
    const tb = new THREE.Mesh(tbG, MAT.paper); tb.position.x = .05 - tubeL / 2 + tubeL; a.add(tb);
    const ft = new THREE.Mesh(ftG, MAT.feather); ft.position.x = -stickL + .1; a.add(ft); const ft2 = ft.clone(); ft2.rotation.x = Math.PI / 2; a.add(ft2);
    a.userData = { layer, home: a.position.clone() }; arrows.add(a); arrowList.push(a);
  }
  P.arrowList = arrowList;
  const fuse = new THREE.Group(); for (let l = 0; l < 7; l++) { const c = cyl(.003, .003, bw * .9, MAT.cord, 5); c.rotation.x = Math.PI / 2; c.position.set(.03, .02 + tw / 2 + l * tw - tw * .35, 0); fuse.add(c); } boxG.add(fuse); P.load.push(fuse);
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
  const A = ARROWS[key], g = new THREE.Group(), parts = {};
  const stL = M(A.stick), T = A.tube, tL = M(T.L), tR = M(T.D) / 2;
  const top = M(A.total);   // 앞끝 x = top
  // 안정막대(대나무): 뒤 0 → 앞 stL. 위가 가늘고 아래가 굵음(대: 윗둘레 1촌, 아래둘레 3촌)
  const r1 = key === 'dae' || key === 'sanhwa' ? M(31.2) / Math.PI / 2 * 3 : .006, r0 = key === 'dae' || key === 'sanhwa' ? M(31.2) / 2 : .004;
  const st = cyl(r0 * .9, r1 * .9, stL, MAT.bamboo, 10); st.rotation.z = -Math.PI / 2; st.position.x = stL / 2; g.add(st); parts.stick = st;
  // 마디
  for (let x = .3; x < stL - .1; x += key === 'dae' || key === 'sanhwa' ? .35 : .12) { const n = cyl(r1 * .95, r1 * .95, .006, MAT.bamboo, 10); n.rotation.z = Math.PI / 2; n.position.x = x; n.scale.setScalar(1 + (1 - x / stL) * .3); g.add(n); }
  // 깃 3장
  const fL = Math.min(.5, stL * .12), fW = key === 'dae' || key === 'sanhwa' ? .1 : .025;
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(fL, fW), MAT.feather); f.position.set(fL / 2 + .02, 0, 0); f.geometry.translate(0, fW / 2 + r1, 0); f.rotation.x = k * Math.PI * 2 / 3; g.add(f); }
  // 약통: 안정막대 앞쪽 끝에 묶음
  const tubeX0 = top - tL - (A.bomb && !A.bomb.inner ? M(A.bomb.L) : 0);
  // 약통은 안정막대 옆에 나란히 묶음(단면 보기에서는 막대가 뒤로 가게)
  const tube = new THREE.Group(); tube.position.set(tubeX0, cut ? 0 : tR + r1 * .9, cut ? tR + r1 : 0); g.add(tube); parts.tube = tube;
  const phi = cut ? Math.PI : Math.PI * 2;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR, tL, 32, 1, true, 0, phi), MAT.paper); shell.rotation.z = -Math.PI / 2; shell.position.x = tL / 2; tube.add(shell);
  if (cut) {
    const inR = M(T.d) / 2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(inR, inR, tL, 32, 1, true, 0, phi), MAT.paperIn); inner.rotation.z = -Math.PI / 2; inner.position.x = tL / 2; tube.add(inner);
    // 단면 벽(한지 겹)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(tL, tR - inR), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#e4d8bb'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b9a984'; for (let y = 0; y < h; y += 2) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }) }));
    for (const s of [-1, 1]) { const wm = wall.clone(); wm.rotation.x = -Math.PI / 2; wm.position.set(tL / 2, 0, s * (inR + (tR - inR) / 2)); tube.add(wm); }
    // 화약(추진제): 뒤쪽 분사구멍부터 앞 칸막이까지, 가운데 원뿔 구멍(약선구멍 — 뾰족한 쇠심 자리)
    const fillL = key === 'sanhwa' ? tL - M(3.7 * 31.2) : tL * .9, coreR = M(T.nozzle) / 2;
    const prof = [new THREE.Vector2(coreR, 0), new THREE.Vector2(inR, 0), new THREE.Vector2(inR, fillL), new THREE.Vector2(.002, fillL), new THREE.Vector2(.002, fillL * .55), new THREE.Vector2(coreR, 0)];
    const pw = new THREE.Mesh(new THREE.LatheGeometry(prof, 32, 0, phi), MAT.powder); pw.rotation.z = -Math.PI / 2; tube.add(pw); parts.powder = pw;
    // 앞 마개(종이 여러 겹) · 약선
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(inR, inR, tL * .06, 24, 1, false, 0, phi), MAT.paperIn); plug.rotation.z = -Math.PI / 2; plug.position.x = fillL + tL * .03; tube.add(plug);
    const fuse = cyl(.003, .003, tL * .3, MAT.cord, 6); fuse.rotation.z = Math.PI / 2; fuse.position.x = fillL + tL * .12; tube.add(fuse); parts.fuse = fuse;
  } else {
    for (const x of [.02, tL - .02]) { const c = cyl(tR * 1.03, tR * 1.03, .012, MAT.cord, 16); c.rotation.z = Math.PI / 2; c.position.x = x; tube.add(c); }
  }
  // 발화통(폭탄)
  if (A.bomb && !A.bomb.inner) {
    const bL = M(A.bomb.L), bR = M(A.bomb.D) / 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR, bL, 24, 1, false, 0, phi), MAT.bomb); b.rotation.z = -Math.PI / 2; b.position.x = tL + bL / 2; tube.add(b); parts.bomb = b;
  }
  // 단면은 자른 면이 +z(보는 쪽)를 향하게
  if (cut) tube.rotation.x = Math.PI / 2;
  // 중·소: 화살촉
  if (key === 'jung' || key === 'so') { const h = new THREE.Mesh(new THREE.ConeGeometry(.006, .035, 8), MAT.iron); h.rotation.z = -Math.PI / 2; h.position.x = top + .01; g.add(h); }
  g.userData = { len: top, tubeX0, tL };
  return { g, parts };
}

// ---------- 결구 확대 모형 ----------
// 각각 { group, anim(u) } : u 0 = 맞춤, 1 = 떨어짐
export function buildJoint(kind) {
  const g = new THREE.Group(), W = MAT.wood, D = MAT.woodD, L = MAT.woodL;
  let anim = () => {};
  if (kind === 'mortise') {   // 장부맞춤: 기둥(구멍) + 장부
    const post = new THREE.Group(); g.add(post);
    post.add(box(.4, .12, .04, D, 0, .14, 0), box(.4, .12, .04, D, 0, -.14, 0), box(.4, .16, .03, D, 0, 0, .035), box(.4, .16, .03, D, 0, 0, -.035));
    const beam = new THREE.Group(); g.add(beam); beam.add(box(.3, .16, .1, W, .3, 0, 0), box(.18, .16, .04, L, .06, 0, 0));
    beam.children[1].scale.y = .99;
    anim = u => { beam.position.x = .05 + u * .3; };
    beam.position.x = .05;
  } else if (kind === 'wedge') {   // 관통장부 + 쐐기
    const post = new THREE.Group(); g.add(post); post.add(box(.12, .5, .12, D));
    const tenon = new THREE.Group(); g.add(tenon); tenon.add(box(.35, .1, .08, W, -.24, 0, 0), box(.2, .08, .04, L, .02, 0, 0));
    const wedge = box(.03, .1, .02, MAT.woodL, .12, 0, 0); wedge.material = new THREE.MeshStandardMaterial({ color: 0xd9b27a }); g.add(wedge);
    anim = u => { tenon.position.x = -u * .3; wedge.position.y = Math.min(1, u * 2) * .25; };
  } else if (kind === 'butterfly') {   // 나비장이음
    g.add(box(.3, .06, .16, D, -.15, 0, 0), box(.3, .06, .16, D, .15, 0, 0));
    const sh = new THREE.Shape(); sh.moveTo(-.07, -.04); sh.lineTo(0, -.015); sh.lineTo(.07, -.04); sh.lineTo(.07, .04); sh.lineTo(0, .015); sh.lineTo(-.07, .04); sh.closePath();
    const key = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .03, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xd9b27a })); key.rotation.x = -Math.PI / 2; g.add(key);
    anim = u => { key.position.y = .016 + u * .2; g.children[0].position.x = -.15 - u * .03; g.children[1].position.x = .15 + u * .03; };
  } else if (kind === 'pin') {   // 굴대 + 바퀴통 + 비녀장
    const ax = cyl(.04, .04, .6, D); ax.rotation.z = Math.PI / 2; g.add(ax);
    const hub = cyl(.09, .09, .18, W, 20); hub.rotation.z = Math.PI / 2; g.add(hub);
    const pin = cyl(.008, .008, .14, MAT.iron, 8); pin.position.x = .25; g.add(pin);
    anim = u => { hub.position.x = .1 + u * .12; pin.position.y = u * .25; pin.position.x = .25 + Math.max(0, u - .5) * 0; };
  } else if (kind === 'tongue') {   // 제혀쪽매
    const a = new THREE.Group(), b = new THREE.Group(); g.add(a, b);
    a.add(box(.4, .03, .14, W, 0, 0, -.07), box(.4, .012, .025, L, 0, 0, .0125));
    b.add(box(.4, .009, .14, D, 0, .0105, .07), box(.4, .009, .14, D, 0, -.0105, .07), box(.4, .012, .115, D, 0, 0, .0825));
    anim = u => { b.position.z = .002 + u * .12; };
  } else if (kind === 'dovetail') {   // 사개(주먹장)맞춤 — 상자 모서리
    const A = new THREE.Group(), B = new THREE.Group(); g.add(A, B);
    A.add(box(.3, .3, .03, D, -.15, 0, 0)); B.add(box(.03, .3, .3, W, 0, 0, .15));
    for (let k = 0; k < 3; k++) { const y = -.1 + k * .1; const pin = box(.04, .05, .03, D, .02, y, 0); A.add(pin); }
    anim = u => { A.position.x = -u * .25; };
  } else if (kind === 'halflap') {   // 반턱맞춤
    const A = new THREE.Group(), B = new THREE.Group(); g.add(A, B);
    A.add(box(.5, .04, .08, W, 0, -.02, 0), box(.21, .04, .08, W, -.145, .02, 0), box(.21, .04, .08, W, .145, .02, 0));
    B.add(box(.08, .04, .5, D, 0, .02, 0), box(.08, .04, .21, D, 0, -.02, -.145), box(.08, .04, .21, D, 0, -.02, .145));
    anim = u => { B.position.y = u * .2; };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { g, anim };
}

// ---------- 대신기전 발사대 (실험: 레일 6m, 다리) ----------
export function buildRack(railLen = 3.3) {
  const g = new THREE.Group(), pivot = new THREE.Group(); g.add(pivot);
  const rail = box(6, .08, .14, MAT.woodD); rail.position.x = 3; pivot.add(rail);
  const guide = box(railLen, .05, .04, MAT.wood); guide.position.set(6 - railLen / 2 - .1, .065, 0); pivot.add(guide);
  const legs = [];
  for (let i = 0; i < 3; i++) { const l = box(.06, 1, .06, MAT.woodD); l.geometry.translate(0, -.5, 0); g.add(l); legs.push(l); }
  return { g, pivot, set: deg => {
    const a = deg * Math.PI / 180; pivot.rotation.z = a;
    [2.2, 4.4, 5.6].forEach((d, i) => { const x = Math.cos(a) * d, y = Math.sin(a) * d; legs[i].position.set(x, y, (i - 1) * .25); legs[i].scale.y = y; });
  } };
}

export function label(text, color = '#2b2620') {
  const pad = 12, fs = 30, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `700 ${fs}px "Noto Sans KR",sans-serif`; const w = Math.ceil(g.measureText(text).width) + pad * 2, h = fs + pad * 1.4;
  c.width = w; c.height = h; g.font = `700 ${fs}px "Noto Sans KR",sans-serif`;
  g.fillStyle = 'rgba(251,247,238,.93)'; g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.roundRect(1.5, 1.5, w - 3, h - 3, 10); g.fill(); g.stroke();
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, pad, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(w / h * .03, .03, 1); s.renderOrder = 10; return s;
}
