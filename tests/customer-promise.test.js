import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
function game(){const g=E.createGame({setbacks:false});E.start(g);g.firstReportInstruction=false;g.callSeen=true;g.minutes=102;E.answerCall(g,'promise');return g;}
function pick(g,id){const c=E.nextChoices(g).find(c=>c.id===id);assert.ok(c,JSON.stringify(E.nextChoices(g)));E.chooseAction(g,c);return c;}
function late(){const g=game();for(let i=0;i<4;i++)E.execute(g,'job status');return g;}
const overdueCount=g=>g.events.filter(e=>e.text.includes('を超過。責任者')).length;
test('01:52確約、02:32の撤回で通常了承に戻らず責任者説明を要求',()=>{
 const g=late();assert.equal(g.customerPromise.madeAt,112);assert.equal(g.customerPromise.promisedAt,117);assert.equal(g.minutes,152);assert.equal(overdueCount(g),1);const from=g.timeline.length;
 pick(g,'progress-report');assert.equal(g.customerPromise.correctedAt,152);assert.equal(g.customerPromise.explanationCompleted,false);assert.match(g.timeline.slice(from).map(m=>m.text).join(' '),/訂正理由.*責任者から説明/);assert.ok(!g.timeline.slice(from).some(m=>m.text.includes('現在の確認状況、承知しました')));assert.equal(E.nextChoices(g).length,3);
});
test('早期訂正は時間超過と区別し、5分の整理だけで説明を終える',()=>{
 const g=game(),trust=g.trust;pick(g,'progress-report');assert.equal(g.customerPromise.correctedAt,112);assert.equal(g.customerPromise.managerRequired,false);assert.equal(g.customerPromise.overdue,false);assert.equal(g.minutes,112);
 const c=pick(g,'promise-facts');assert.equal(g.minutes,117);assert.equal(g.trust,trust);assert.equal(g.customerPromise.explanationCompleted,true);assert.equal(g.customerPromise.nextReportAt,127);const saved=E.serializeGame(g);E.chooseAction(g,c);assert.equal(E.serializeGame(g),saved);E.execute(g,'job status');assert.equal(overdueCount(g),0);assert.equal(g.customerPromise.nextReminder,true);
});
test('期限超過は操作で一度検知し、一般催促による重複減点をしない',()=>{
 let g=game();E.execute(g,'job status');const trust=g.trust;g.replyIdle=74;g.techIdle=0;E.tick(g,2);assert.equal(g.trust,trust);assert.equal(overdueCount(g),1);assert.equal(g.replyLevel,0);const saved=E.serializeGame(g);g=E.restoreGame(saved);assert.equal(E.serializeGame(g),saved);E.execute(g,'job status');assert.equal(overdueCount(g),1);
});
test('B・Cの誤答は一度ずつ消費し、5分の事実整理で訂正説明を完了する',()=>{
 let g=late();pick(g,'progress-report');const before=g.minutes,trust=g.trust;for(const id of ['promise-blame','promise-hurry']){const c=pick(g,id);assert.equal(g.customerPromise.explanationCompleted,false);assert.equal(E.nextChoices(g).length,3);assert.ok(!E.nextChoices(g).some(c=>c.id===id));const saved=E.serializeGame(g);E.chooseAction(g,c);assert.equal(E.serializeGame(g),saved);g=E.restoreGame(saved);}
 pick(g,'promise-facts');assert.equal(g.minutes,before+25);assert.equal(g.trust,trust);assert.equal(g.customerPromise.explanationCompleted,true);assert.equal(g.recovered,false);assert.equal(g.approved.size,0);assert.ok(g.timeline.some(m=>m.channel==='customer'&&m.sender==='鬼塚｜リーダー'&&m.text.includes('【電話・訂正説明】')));assert.ok(g.timeline.some(m=>m.text.includes('業務側へ再案内します')));assert.ok(E.resultAssessment(g).some(([k,v])=>k==='顧客対応'&&v==='復旧見込みの訂正・責任者説明あり'));
});
test('再確約は訂正を完了せず元の約束時刻も延長しない',()=>{const g=late(),at=g.customerPromise.promisedAt;E.answerCall(g,'promise');assert.equal(g.customerPromise.promisedAt,at);assert.equal(g.customerPromise.explanationCompleted,false);assert.equal(overdueCount(g),1);});
test('通常の根拠を区別した電話報告に追加対応は発生しない',()=>{const g=E.createGame();E.start(g);g.firstReportInstruction=false;E.answerCall(g,'explain');assert.equal(g.customerPromise,null);assert.ok(!E.nextChoices(g).some(c=>c.type==='correction'));});
test('復旧しても訂正は残り、5時後に説明・残処理を終えて通常出勤',()=>{
 let g=game();g.minutes=275;g.file=true;g.facts.checked=g.facts.history=true;g.approved.add('SALES_IMPORT');E.execute(g,'job rerun SALES_IMPORT');assert.equal(g.recoveredAt,290);assert.equal(g.customerPromise.recoveredAt,290);assert.equal(g.customerPromise.explanationCompleted,false);assert.match(E.objectiveText(g),/訂正説明が未完了/);
 g.minutes=310;g=E.restoreGame(E.serializeGame(g));assert.ok(!g.deadlineEnded);pick(g,'progress-report');assert.match(E.nextChoices(g).find(c=>c.id==='promise-facts').text,/04:50/);pick(g,'promise-facts');assert.ok(!g.ended);E.execute(g,'job status SALES_SUMMARY');E.execute(g,"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");E.send(g,'internal','整理','impact-review');E.send(g,'internal','社内報告','internal-complete');E.send(g,'customer','復旧報告','complete');E.send(g,'internal','記録','handover');assert.equal(g.result,'END：通常出勤');assert.ok(g.cleanupCompletedAt>300);
});
test('未完了の説明を復旧報告と引き継ぎで飛ばせない',()=>{const g=late();g.recovered=true;g.recoveredAt=150;g.facts.summary=g.facts.count=g.internalReported=g.impactReviewed=true;E.send(g,'customer','完了','complete');assert.equal(g.customerCompleted,false);E.send(g,'internal','記録','handover');assert.equal(g.handoverDone,false);assert.equal(g.ended,false);});
test('重大事故・時間切れが優先され、訂正イベントはその後割り込まない',()=>{for(const command of ['job stop ACCOUNT_SYNC','job status']){const g=game();if(command==='job status')g.minutes=299;E.execute(g,command);assert.equal(g.ended,true);assert.equal(overdueCount(g),0);assert.deepEqual(E.nextChoices(g),[]);assert.ok(command.includes('stop')?g.managerEnding:g.deadlineEnded);}});
test('旧セーブを証拠から補完、再開は二重発火せず、新規プレイはリセット',()=>{const g=game();delete g.customerPromise;g.minutes=152;let h=E.restoreGame(E.serializeGame(g));assert.equal(h.customerPromise.promisedAt,117);assert.equal(overdueCount(h),1);const saved=E.serializeGame(h);h=E.restoreGame(saved);assert.equal(E.serializeGame(h),saved);assert.equal(E.createGame().customerPromise,null);});
