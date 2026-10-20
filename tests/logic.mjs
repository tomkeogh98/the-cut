const W = location.origin;
const B = await import(W + '/js/body.js?v=1');
const S = await import(W + '/js/schedule.js?v=1');
const M = await import(W + '/js/meals.js?v=1');
const G = await import(W + '/js/goals.js?v=1');
const H = await import(W + '/js/hevy.js?v=1');
const P = await import(W + '/js/program.js?v=1');
const nextDay = (d) => new Date(Date.parse(d + 'T12:00Z') + 864e5).toISOString().slice(0, 10);
const p = { ...B.DEFAULT_PROFILE, sex: 'male', startKg: 98 };
console.log('age', B.age('1998-08-04', '2026-10-14'), 'bmr98', B.bmr({ weightKg: 98, heightCm: 200.7, ageYears: 28, sex: 'male' }));
console.log('targets98', B.targets(p, 98, '2026-10-14'));
console.log('targets84', B.targets({ ...p, startKg: 84 }, 84, '2026-10-14'));
// schedule
const st = { startDate: '2026-09-28', sessions: {}, excuses: {}, shifts: {}, checks: {}, weights: {}, journal: {}, photos: {}, hevy: { workouts: {} }, milestones: {} };
const add = (d, t) => (st.sessions[d + t] = { id: d + t, date: d, type: t, updatedAt: 1 });
add('2026-09-28', 'upperA'); add('2026-09-29', 'lowerA'); add('2026-09-30', 'run'); add('2026-10-01', 'upperB'); add('2026-10-02', 'lowerB');
add('2026-10-05', 'upperA'); // Tue 6 missed
add('2026-10-07', 'run');
st.shifts['2026-10-08'] = { to: '2026-10-11', updatedAt: 1 }; // move Thu -> Sun; Fri 9 not trained -> broken
add('2026-10-11', 'upperB');
const now = '2026-10-14';
for (let d = '2026-10-05'; d <= '2026-10-18'; d = nextDay(d)) console.log(d, S.dayStatus(st, d, now), S.scheduledType(st, d));
console.log('week', S.weekSummary(st, '2026-10-05', now));
console.log('slack', S.slackReport(st, now), S.nudgeCheck(st, now)?.kind);
console.log('shiftCheck wed 14', S.shiftCheck(st, '2026-10-14', now));
console.log('shiftCheck thu 15', S.shiftCheck(st, '2026-10-15', now));
st.shifts['2026-10-15'] = { to: '2026-10-17', updatedAt: 1 };
console.log('shiftCheck fri 16 after thu moved', S.shiftCheck(st, '2026-10-16', now));
console.log('locked fri 16', S.lockedBy(st, '2026-10-16'));
delete st.shifts['2026-10-15'];
console.log('prev', S.previousDay(st, '2026-10-14'), S.previousDay(st, '2026-10-12'));
// meals
const plan = M.dayPlan('2026-10-14', 2850, {}, true);
plan.forEach(({ slot, meal }) => console.log(slot.key, meal.name, meal.kcal, meal.p, meal.items.map(M.portion).join('; ')));
console.log('total', plan.reduce((a, x) => a + x.meal.kcal, 0));
for (const m of M.MEALS) { const x = M.macros(m.items); const chk = x.p * 4 + x.c * 4 + x.f * 9; if (Math.abs(chk - x.kcal) / x.kcal > 0.12) console.log('macro mismatch', m.id, x, chk); }
for (const m of M.MEALS) { for (const kc of [450, 900]) { const s = M.scaleMeal(m, kc); if (Math.abs(s.kcal - kc) / kc > 0.25) console.log('scale off', m.id, kc, s.kcal); } }
// weights & goals
let k = 98;
for (let i = 0; i < 30; i++) { const d = new Date(Date.parse('2026-09-14T12:00Z') + i * 864e5).toISOString().slice(0, 10); k -= 0.06; st.weights[d] = { kg: +(k + Math.sin(i) * 0.4).toFixed(1), updatedAt: 1 }; }
const wst = G.weightStatus(st, p, now); console.log('ws', wst.current, wst.rate, wst.series.length);
console.log(G.weightMilestones(wst, now).map((m) => `${m.title} ${m.done} ${m.due}`));
// hevy CSV
const csv = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Upper A","13 Oct 2026, 18:02","13 Oct 2026, 19:05","","Bench Press (Barbell)","","","0","warmup","40","10","","",""
"Upper A","13 Oct 2026, 18:02","13 Oct 2026, 19:05","","Bench Press (Barbell)","","","1","normal","80","8","","",""
"Upper A","13 Oct 2026, 18:02","13 Oct 2026, 19:05","","Bench Press (Barbell)","","","2","normal","80","8","","",""
"Upper A","13 Oct 2026, 18:02","13 Oct 2026, 19:05","","Bench Press (Barbell)","","","3","normal","80","7","","",""
"Upper A","13 Oct 2026, 18:02","13 Oct 2026, 19:05","","Pull Up","","","0","normal","","9","","",""`;
const imp = H.importCSV(csv); console.log(JSON.stringify(imp));
st.hevy.workouts = imp;
console.log('lift', H.liftNow(st, 'bench', now), H.lastPerformance(st, P.SESSIONS.upperA.exercises[0]));
console.log(G.liftGoals(st, now).map((g) => [g.lift, g.value, g.nextPR, g.tiers.map((t) => `${t.value}${t.done ? '✓' : ''}@${t.due}`).join(' ')]));
console.log(G.level(st, 96, now));
console.log(G.habitGoals(st, p, now).map((h) => `${h.id} ${h.have}/${h.need}`).join(', '));
console.log('matchType', S.matchType('Upper A · Chest & back thickness'), S.typeOn(st, '2026-10-13'));
console.log('season', P.seasonInfo('2026-09-28', now));
console.log('perfect', S.perfectStreak(st, p, now));
// field-level merge: water on one device, guitar on another, same day → both survive
const ST = await import(W + '/js/store.js?v=3');
const phone = { water: 2000, _f: { water: 200 }, updatedAt: 200 };
const laptop = { guitar: true, _f: { guitar: 300 }, updatedAt: 300 };
const m1 = ST.mergeRec(phone, laptop), m2 = ST.mergeRec(laptop, phone);
console.log('mergeRec', JSON.stringify(m1), m1.water === 2000 && m1.guitar === true && m2.water === 2000 && m2.guitar === true ? 'OK' : 'FAIL');
const older = { water: 1000, _f: { water: 100 }, updatedAt: 100 };
console.log('mergeRec newer field wins', ST.mergeRec(phone, older).water === 2000 && ST.mergeRec(older, phone).water === 2000 ? 'OK' : 'FAIL');
const legacy = { water: 500, updatedAt: 50 }; // record written before field stamps existed
console.log('mergeRec legacy', ST.mergeRec(legacy, laptop).water === 500 && ST.mergeRec(legacy, laptop).guitar === true ? 'OK' : 'FAIL');
const tomb = { deleted: true, _f: { deleted: 400 }, updatedAt: 400 };
console.log('mergeRec tombstone', ST.mergeRec(phone, tomb).deleted === true ? 'OK' : 'FAIL');
ST.saveSettings({ token: 'github_pat_TEST' }); const code = ST.pairLink().split('#/pair/')[1];
console.log('pair roundtrip', JSON.stringify(ST.readPairCode(code)), ST.readPairCode('garbage') === null ? 'OK' : 'FAIL');
// Smart-scale weigh-ins through Apple Health → Hevy: fill gaps and missing body fat / lean, never overwrite
const must = (cond, msg) => { if (!cond) throw new Error('hevy weigh-in: ' + msg); };
const hm = { kg: 82.4, fat: 18.23, lean: 67.1 };
let r = H.weighInFromHevy(undefined, hm);
must(r.kg === 82.4 && r.fat === 18.2 && r.lean === 67.1 && r.source === 'hevy' && r.updatedAt === 1, 'new day ' + JSON.stringify(r));
r = H.weighInFromHevy({ kg: 82.0, source: 'site', _f: { kg: 5 }, updatedAt: 5 }, hm);
must(r.kg === 82.0 && r.fat === 18.2 && r.lean === 67.1 && r._f.kg === 5 && r._f.fat > 5, 'adds body fat to a typed weigh-in, keeps its weight ' + JSON.stringify(r));
must(H.weighInFromHevy({ kg: 82.0, fat: 17, lean: 66, updatedAt: 5 }, hm) === null, 'nothing new → null');
must(H.weighInFromHevy({ kg: 82.0, deleted: true, updatedAt: 5 }, hm) === null, 'deleted day stays deleted');
must(H.weighInFromHevy(undefined, { kg: 82.4, fat: null, lean: null }).fat === undefined, 'weight-only measurement');
console.log('hevy weigh-in OK');
