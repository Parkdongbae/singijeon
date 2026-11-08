// 신기전 — 순수 함수 (DOM·three 의존 금지, node에서 테스트). 단위 mm(치수), m·s·kg·N(비행)
// 근거 약호
//  [병기] 『국조오례서례』 병기도설(1474) — 채연석 환산값: 채연석 「세종시대 로켓과 화약무기의 기술」; 박재광 2007 「하늘을 나는 한국 최초의 로켓병기 주화와 신기전」
//  [백과] 한국민족문화대백과 「신기전기」(채연석)
//  [화차] 박재광 2007 「우리나라의 전통무기 ⑨ 화차」(전쟁기념관)
//  [실험] 이용우·허환일 2009 「15세기 조선시대 로켓인 대신기전 복원: 비행실험 결과」(한국추진공학회)
//  [약통] 이용우 외 2008 「대신기전 복원: 약통에 대한 기초연구」
//  [가정] 자료가 없어 정한 값 — 앱에 「가정」으로 표시

// ---------- 신기전 4종 [병기] ----------
export const ARROWS = {
  dae:    { nm: '대신기전', total: 5588, stick: 5310.8, tube: { L: 695, D: 102, t: 16.2, d: 63.1, nozzle: 37.5 }, bomb: { L: 228, D: 78 }, year: 1448 },
  sanhwa: { nm: '산화신기전', total: 5310.8, stick: 5310.8, tube: { L: 695, D: 102, t: 16.2, d: 63.1, nozzle: 37.5 }, bomb: { L: 115, D: 63.1, inner: true }, year: 1448 },
  jung:   { nm: '중신기전', total: 1455, stick: 1406, tube: { L: 200, D: 28, t: 5.7, d: 16.6, nozzle: 7.2 }, bomb: { L: 25, D: 16.6 }, year: 1448 },
  so:     { nm: '소신기전', total: 1152, stick: 1103, tube: { L: 147, D: 22, t: 4.2, d: 11.6, nozzle: 4 }, bomb: null, year: 1448 },
};

// 복원 약통 [약통 표2]: 제작기준 안지름 63.1 · 겉지름 95.5 · 두께 16.2 · 길이 695mm, 평균 무게 1.26kg.
//  병기도설 환산 겉지름(102)은 안지름+2×두께(95.5)와 맞지 않음 — 복원은 두께 기록을 따름. 한지 홑지 25~26장(150~160겹), 녹말풀.
export const TUBE_BUILT = { d: 63.1, D: 95.5, t: 16.2, L: 695, kg: 1.26, sheets: '25~26장', layers: '150~160겹' };

// ---------- 신기전기 [백과] ----------
export const GIJEON = {
  tube: { L: 229.9, W: 55.2, hole: 46.0 },   // 원공목통 하나: 길이 7촌5분, 너비·두께 1촌8분, 구멍 지름 1촌5분
  rows: [10, 15, 15, 15, 15, 15, 15],        // 아래층 10, 2~7층 15
  L: 1149.4, H: 398.5,                       // 신기전기 길이 3척7촌5분, 높이 1척3촌
};
export const GIJEON_COUNT = GIJEON.rows.reduce((a, b) => a + b, 0);   // 100

// ---------- 화차 수레 [화차] ----------
export const CART = { wheelD: 870, bodyL: 2300, bodyW: 740, maxAngle: 40 };

// ---------- 비행 계산 ----------
export const G = 9.81, RHO = 1.2;
// 대신기전 약통 지상연소 [실험 표3]: 철침 280mm → 총추력 575.35Ns, 추진 3.94s / 350mm → 925.60Ns, 3.81s
// 지상연소 약통의 화약량은 논문에 없어 3,000g으로 봄 [가정] → 비추력(Isp) = 총추력 / (화약량 × g)
export const CORES = {
  280: { I: 575.35, tb: 3.94 },
  350: { I: 925.60, tb: 3.81 },
};
export const TEST_PROP_KG = 3.0;
const ispOf = core => CORES[core].I / (TEST_PROP_KG * G);

// 종류별 비행 값. dry = 화약 뺀 무게(kg). cda = 항력계수×단면적(m²) — 시험 사거리에 맞춰 정한 값 [가정·보정]
//  대: [실험 표4] 3번(5.4m, 4.875kg, 화약 3,000g, 60°, 발화통 모조물 없음) 900~1,000m → dry 1.875kg
//  중: 1999년 행주산성 남쪽 한강변 시험 사거리 200~250m(전시 해설), 소: 100~150m(박재광 2007)
//  중·소 화약량: 약통 안지름·길이 비로 줄인 값 [가정]
export const FLY = {
  dae:    { dry: 1.875, prop: 3.0, propMin: 1.5, propMax: 3.5, cda: 0.0074, rail: 3.3, bombKg: 0.25 },
  sanhwa: { dry: 1.875, prop: 3.0, propMin: 1.5, propMax: 3.5, cda: 0.0074, rail: 3.3, bombKg: 0 },
  jung:   { dry: 0.115, prop: 0.035, propMin: 0.015, propMax: 0.05, cda: 0.00097, rail: 0.23, bombKg: 0 },
  so:     { dry: 0.07, prop: 0.012, propMin: 0.005, propMax: 0.018, cda: 0.0003, rail: 0.23, bombKg: 0 },
};

// 결정적 난수(같은 조건이면 같은 결과)
export function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s), s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s, ((s ^ (s >>> 14)) >>> 0) / 4294967296)); }

// 한 발 비행. opts: type, prop(kg), angle(°), core(280|350, 대·산화만), bomb(발화통 장착, 대만), wind(m/s, +뒷바람), rail(m), seed, jitter(°, 화차 퍼짐)
export function fly(o) {
  const F0 = FLY[o.type];
  const prop = o.prop ?? F0.prop, core = o.core ?? 350, isDae = o.type === 'dae' || o.type === 'sanhwa';
  const isp = ispOf(isDae ? core : 350);
  const I = isp * prop * G, tb = (isDae ? CORES[core].tb : 0.9) * (isDae ? 1 : 1);   // 중·소 추진시간 0.9s [가정]
  const thrust = I / tb;
  const bombKg = o.type === 'dae' && o.bomb ? F0.bombKg : 0;
  const R = rng(o.seed ?? 1);
  // 발화통을 단 대신기전: [실험 표5] 4발 중 3발이 이륙 1초 뒤 텀블링(약통 앞이 무거워짐)
  const tumble = o.type === 'dae' && o.bomb && R() < 0.75;
  const ang0 = ((o.angle ?? 60) + (o.jitter ? (R() - .5) * 2 * o.jitter : 0)) * Math.PI / 180;
  // 옆 방향 퍼짐(방위각): 화차 일제 발사 ±1.5° [가정], 텀블링이면 ±15° (실험 표5: '다른 방향으로 비행')
  const yaw = ((o.yawJitter ?? (o.jitter ? 1.5 : 0)) * (R() - .5) * 2 + (tumble ? (R() - .5) * 30 : 0)) * Math.PI / 180;
  const rail = o.rail ?? F0.rail, dt = 0.005;
  let m = F0.dry + prop + bombKg, x = 0, z = 0, vx = 0, vz = 0, t = 0, s = 0, th = ang0;
  const path = [[0, 0, 0]], ev = { railExit: null, burnout: null, tumble: tumble ? 1 : null, apex: null };
  let vExit = 0, maxH = 0, tumbled = false, spin = 0;
  const wind = o.wind ?? 0;
  while (t < 120) {
    const burning = t < tb, F = burning ? thrust : 0;
    if (burning) m -= prop / tb * dt;
    const onRail = s < rail;
    if (onRail) {
      const a = Math.max(0, F / m - G * Math.sin(ang0));
      const v = Math.hypot(vx, vz) + a * dt; vx = v * Math.cos(ang0); vz = v * Math.sin(ang0); s += v * dt;
      if (s >= rail) { vExit = v; ev.railExit = t; }
    } else {
      const rx = vx - wind, rz = vz, vr = Math.hypot(rx, rz) || 1e-6;
      // 몸체는 공기 흐름을 따라 돔(깃의 복원력). 텀블링이면 축이 빙글 돌아 추력 방향이 흩어짐
      if (tumble && t > 1) { if (!tumbled) { tumbled = true; ev.tumble = t; } spin += (3 + R() * 2) * dt; th = Math.atan2(rz, rx) + Math.sin(spin * 6) * 1.6; }
      else th = Math.atan2(rz, rx);
      const cda = F0.cda * (tumbled ? 6 : 1);
      const D = 0.5 * RHO * cda * vr * vr;
      const ax = (F * Math.cos(th) - D * rx / vr) / m, az = (F * Math.sin(th) - D * rz / vr) / m - G;
      vx += ax * dt; vz += az * dt;
    }
    x += vx * dt; z += vz * dt; t += dt;
    if (ev.burnout === null && !burning) ev.burnout = t;
    if (z > maxH) maxH = z; else if (ev.apex === null && t > .5) ev.apex = t;
    if (Math.round(t / dt) % 10 === 0) path.push([x, z, t]);
    if (z < 0 && t > .2) { const k = z / (z - (z - vz * dt)); path.push([x - vx * dt * k, 0, t]); x -= vx * dt * k; break; }
  }
  return { range: Math.max(0, x), lat: Math.max(0, x) * Math.tan(yaw), maxH, time: t, vExit, thrust, I, tb, mass0: F0.dry + prop + bombKg, path, tumble: tumbled, ev, angle: ang0 * 180 / Math.PI };
}

// ---------- 피해 반경 [가정] ----------
// 발화통의 폭발 피해 범위는 기록·실험값이 없음. 알려진 것: 발화통 화약의 27%가 쇳가루(뜨거운 파편, 박재광 2007),
// 대신기전 발화통 길이 228·지름 78mm, 중신기전 소발화통 25×16.6mm, 소신기전은 발화통 없이 화살촉만.
// 아래 값은 크기 비교를 위한 가정값이며 앱에서 바꿔 볼 수 있음.
export const DAMAGE = { dae: 5, sanhwa: 12, jung: 1.5, so: 0.3 };
export const DAMAGE_MAX = { dae: 20, sanhwa: 30, jung: 6, so: 2 };
// 탄착점 통계: 길이·폭, 피해 면적(원들의 합집합, 격자 계산)
export function impactStats(pts, r) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - r, x1 = Math.max(...xs) + r, y0 = Math.min(...ys) - r, y1 = Math.max(...ys) + r;
  const N = 160, dx = (x1 - x0) / N || 1, dy = (y1 - y0) / N || 1; let hit = 0;
  if (r > 0) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = x0 + (i + .5) * dx, y = y0 + (j + .5) * dy; if (pts.some(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 <= r * r)) hit++; }
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { len: Math.max(...xs) - Math.min(...xs), wid: Math.max(...ys) - Math.min(...ys), area: hit * dx * dy, cx: mx, cy: ys.reduce((a, b) => a + b, 0) / ys.length, x0, x1, y0, y1 };
}

// 화차 일제 발사: 신기전기 15발씩 위층부터 차례로 [백과]. 층마다 0.6s 간격 [가정]
export function volley(o) {
  const out = []; let k = 0;
  GIJEON.rows.slice().reverse().forEach((n, layer) => { for (let i = 0; i < n; i++) { const r = fly({ ...o, seed: 1000 + k * 7919 + (o.seed || 0), jitter: o.jitter ?? 2.5 }); out.push({ ...r, layer, delay: layer * 0.6, col: i, n }); k++; } });
  return out;
}

// ---------- 제작(조립) 순서와 결구 ----------
// rec = 기록 치수에 근거, est = 결구 방법은 전통 목공 기법으로 복원한 추정
export const BUILD = [
  { key: 'hub', t: '1. 바퀴통 깎기', joint: 'mortise', d: '굵은 참나무를 깎아 바퀴통(곡)을 만들고 둘레에 바퀴살 구멍(장부 구멍)을 판다.', rec: '바퀴 지름 870mm [화차]', est: '바퀴통·살·테의 결구' },
  { key: 'spoke', t: '2. 바퀴살 끼우기 — 장부맞춤', joint: 'mortise', d: '살 끝을 깎은 장부를 바퀴통 구멍에 박아 끼운다(장부맞춤). 살은 박물관 복원 화차처럼 12개로 했다.', rec: '', est: '살 12개, 장부맞춤' },
  { key: 'rim', t: '3. 바퀴테 잇기 — 이음', joint: 'butterfly', d: '굽은 나무 6조각으로 바퀴테를 두르고 조각끼리 나비장이음으로 잇는다. 살의 바깥 장부가 테에 박힌다. 바깥에 쇠테를 씌워 닳지 않게 한다.', rec: '', est: '테 6조각, 나비장이음, 쇠테' },
  { key: 'axle', t: '4. 굴대(차축)와 비녀장', joint: 'pin', d: '굴대는 차체에 고정되고 돌지 않는다(차축형). 양 끝을 둥글게 깎아 바퀴통을 끼우면 바퀴만 굴대 위에서 돈다. 굴대 끝 구멍에 비녀장을 꽂아 바퀴가 빠지지 않게 한다. 바퀴는 차체 바깥에 있다.', rec: '', est: '굴대 단면·비녀장' },
  { key: 'frame', t: '5. 차체 틀 — 짜임(장부·쐐기)', joint: 'wedge', d: '굴대를 문 옆판 위에 긴 수레채 2개를 얹고 가로대로 짠다. 가로대의 관통장부를 채에 꿰고 쐐기를 박아 조인다. 옆판으로 차체를 굴대보다 높이 올려, 수레를 뒤로 기울였을 때 발사각이 커지게 했다.', rec: '차체 길이 2,300mm · 너비 740mm, 차체를 바퀴 축보다 높임 [화차]', est: '옆판 높이·가로대 수·관통장부·쐐기' },
  { key: 'deck', t: '6. 바닥판 — 쪽매', joint: 'tongue', d: '널을 제혀쪽매로 맞대어 바닥을 깐다(널 한쪽의 혀를 옆 널의 홈에 끼움).', rec: '', est: '제혀쪽매' },
  { key: 'box', t: '7. 신기전기 상자 — 사개맞춤', joint: 'dovetail', d: '네 모서리를 사개(주먹장)맞춤으로 짜 상자를 만든다. 못 없이도 앞뒤로 빠지지 않는다.', rec: '길이 1,149.4mm · 높이 398.5mm [백과]', est: '모서리 사개맞춤' },
  { key: 'tubes', t: '8. 원공목통 100개 쌓기', joint: null, d: '구멍(지름 46mm) 뚫린 네모 나무통(229.9×55.2×55.2mm)을 상자 앞쪽에 7층으로 쌓는다. 맨 아래층 10개, 위 6층은 15개씩 — 모두 100개. 원공목통은 굴대 바로 위에 온다.', rec: '원공목통 치수·층수 [백과]', est: '굴대 위 배치' },
  { key: 'mount', t: '9. 뒤로 기울여 각도 잡기', joint: null, d: '받침은 없다. 손잡이(수레채 뒤끝)를 내려 수레 전체를 뒤로 기울이면 신기전기가 하늘을 향한다. 손잡이를 땅에 대면 가장 크고(약 40°), 손잡이를 들수록 각도가 낮아진다.', rec: '최대 발사각 40° [화차]', est: '옆판 높이·손잡이 길이 비례' },
  { key: 'load', t: '10. 중신기전 장전 · 점화선 모으기', joint: null, d: '구멍마다 중신기전을 꽂고 층마다 점화선을 한데 모은다. 불을 붙이면 15발씩 위층부터 차례로 100발이 날아간다.', rec: '100발, 층별 차례 발사 [백과]', est: '' },
];

// 결구 설명 (전통 목공 용어)
export const JOINTS = {
  mortise: { nm: '장부맞춤', d: '한 부재 끝을 얇게 깎은 「장부」를 다른 부재의 「장부 구멍」에 끼운다. 바퀴살–바퀴통, 살–테.' },
  butterfly: { nm: '나비장이음', d: '두 부재를 맞대고 이음매에 나비 모양 「나비장」을 박아 벌어지지 않게 잇는다. 바퀴테 조각 잇기.' },
  pin: { nm: '비녀장', d: '굴대 끝 구멍에 꽂는 쇠나 나무 못. 바퀴가 굴대에서 빠지지 않게 한다.' },
  wedge: { nm: '관통장부 + 쐐기', d: '장부를 반대편까지 꿰뚫어 내밀고, 장부 끝을 쪼갠 틈이나 옆에 쐐기를 박아 빠지지 않게 조인다. 수레채–가로대.' },
  tongue: { nm: '제혀쪽매', d: '널 한쪽에 「혀」, 다른 쪽에 「홈」을 내어 널끼리 끼워 맞춘다. 바닥판.' },
  dovetail: { nm: '사개맞춤(주먹장)', d: '모서리에서 두 판의 끝을 주먹(사다리꼴) 모양으로 엇갈려 따내어 맞물린다. 상자 모서리.' },
  halflap: { nm: '반턱맞춤', d: '두 부재를 두께의 반씩 따내어 겹쳐 맞춘다. 각도 받침–가로대.' },
};
