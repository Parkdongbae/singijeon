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
