import test from 'node:test'; import assert from 'node:assert/strict';
import * as S from '../src/sim.js';
const rng = (r, a, b, tol = 0) => r >= a * (1 - tol) && r <= b * (1 + tol);
test('신기전기 원공목통 100개 (10 + 15×6)', () => assert.equal(S.GIJEON_COUNT, 100));
test('신기전기 높이 ≈ 7층 × 통 너비', () => assert.ok(Math.abs(S.GIJEON.rows.length * S.GIJEON.tube.W - S.GIJEON.H) < 15));
test('중신기전 약통은 겉지름 ≈ 안지름 + 2×두께, 대신기전은 기록(102)과 계산(95.5)이 달라 복원 약통이 95.5를 씀', () => {
  { const t = S.ARROWS.jung.tube; assert.ok(Math.abs(t.d + 2 * t.t - t.D) < .1); }   // 소신기전도 20 vs 22로 2mm 다름
  const b = S.TUBE_BUILT; assert.ok(Math.abs(b.d + 2 * b.t - b.D) < .1); assert.ok(S.ARROWS.dae.tube.D - b.D > 6);
});
test('대신기전 2차 실험 #3 (3,000g, 철침 350, 60°) → 900~1,000m', () => assert.ok(rng(S.fly({ type: 'dae', prop: 3, core: 350, angle: 60 }).range, 900, 1000)));
test('1차 실험 #3·4 (3,300g, 철침 280, 60°, 짧은 레일) → 500~700m (±15%)', () => assert.ok(rng(S.fly({ type: 'dae', prop: 3.3, core: 280, angle: 60, rail: 1.2 }).range, 500, 700, .15)));
test('1차 실험 #2 (41°) 는 60°보다 훨씬 짧다 (250~300m, ±20%)', () => assert.ok(rng(S.fly({ type: 'dae', prop: 3, core: 280, angle: 41, rail: 1.2 }).range, 250, 300, .2)));
test('발화통을 달면 텀블링으로 짧아진다(실험 표5)', () => {
  const r = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => S.fly({ type: 'dae', bomb: true, seed }));
  assert.ok(r.filter(x => x.tumble).length >= 4); assert.ok(Math.min(...r.map(x => x.range)) < 500);
});
test('중신기전 200~250m, 소신기전 100~150m (시험 사거리)', () => {
  assert.ok(rng(S.fly({ type: 'jung', angle: 40 }).range, 200, 250)); assert.ok(rng(S.fly({ type: 'so', angle: 40 }).range, 100, 150));
});
test('화약이 많을수록 멀리, 총추력 = 비추력 × 화약 무게', () => {
  const a = S.fly({ type: 'dae', prop: 2 }), b = S.fly({ type: 'dae', prop: 3 });
  assert.ok(b.range > a.range); assert.ok(Math.abs(b.I - 925.6) < 1);
});
test('화차 일제 발사 100발, 위층부터 차례로', () => { const v = S.volley({ type: 'jung', angle: 30 }); assert.equal(v.length, 100); assert.equal(v[0].layer, 0); assert.equal(v[99].n, 10); });
test('피해 반경: 가정값이 있고, 면적은 반경과 함께 커짐', () => {
  const v = S.volley({ type: 'jung', angle: 40 }), pts = v.map(r => [r.range, r.lat]);
  const a = S.impactStats(pts, 1), b = S.impactStats(pts, 3);
  assert.ok(b.area > a.area); assert.ok(a.area <= v.length * Math.PI * 1.1);
  assert.ok(a.len > 0 && a.wid > 0);
  const one = S.impactStats([[0, 0]], 5); assert.ok(Math.abs(one.area - Math.PI * 25) / (Math.PI * 25) < .03);
});
// ---------- v2 ----------
test('만들기 10단계 모두 쉬운 설명이 있다', () => { assert.equal(S.BUILD.length, 10); assert.ok(S.BUILD.every(b => b.easy && b.easy.length > 20)); });
test('미션 별: 실패 0, 성공 1, 절반 이내 +1, 3번 이하 시도 +1', () => {
  const m = S.MISSIONS[0];
  assert.equal(S.missionStars(m, 230, 1), 0); assert.equal(S.missionStars(m, 213, 5), 1);
  assert.equal(S.missionStars(m, 205, 5), 2); assert.equal(S.missionStars(m, 213, 3), 2); assert.equal(S.missionStars(m, 200.4, 1), 3);
});
test('미션 시작 조건으로는 바로 성공하지 않고, 조절하면 성공할 수 있다', () => {
  const mean = o => { const v = S.volley(o); return v.reduce((a, r) => a + r.range, 0) / v.length; };
  const [m1, m2, m3] = S.MISSIONS;
  assert.equal(S.missionStars(m1, mean({ type: 'jung', angle: 40 }), 1), 0);
  assert.equal(S.missionStars(m2, mean({ type: 'so', angle: 25 }), 1), 0);
  assert.equal(S.missionStars(m3, S.fly({ type: 'dae', angle: 60, prop: 3 }).range, 1), 0);
  const hit = (m, f) => { for (let a = 10; a <= 60; a++) if (S.missionStars(m, f(a), 1) > 0) return true; return false; };
  assert.ok(hit(m1, a => mean({ type: 'jung', angle: Math.min(a, 40) })));
  assert.ok(hit(m2, a => mean({ type: 'so', angle: Math.min(a, 40) })));
  assert.ok(hit(m3, a => S.fly({ type: 'dae', angle: a, prop: 2.5 }).range));
});
test('퀴즈 8문항, 별 4·6·8 기준, 배지 8개', () => {
  assert.equal(S.QUIZ.length, 8); assert.ok(S.QUIZ.every(q => q[1][q[2]] && q[4]));
  assert.deepEqual([3, 4, 5, 6, 7, 8].map(S.quizStars), [0, 1, 1, 2, 2, 3]); assert.equal(S.BADGES.length, 8);
});
