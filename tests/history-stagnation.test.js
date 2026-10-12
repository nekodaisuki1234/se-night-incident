import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
const sql="SELECT * FROM batch_history WHERE business_date = '20261012';";
function game(){const g=E.createGame({setbacks:false});E.start(g);E.send(g,'customer','原因は確認中です','initial');E.execute(g,'tail -n 30 /logs/SALES_IMPORT.log');return g;}
function repeat(g,n){for(let i=0;i<n;i++)E.execute(g,sql);}
function pick(g,id){const c=E.nextChoices(g).find(c=>c.id===id);assert.ok(c,JSON.stringify(E.nextChoices(g)));E.chooseAction(g,c);return c;}
test('同一状態で1〜4回の反応と累積減点、SQL時間を区別する',()=>{
 const g=game(),at=g.minutes;repeat(g,1);assert.equal(g.trust,100);assert.equal(g.historyReview.count,1);repeat(g,1);assert.equal(g.trust,100);assert.match(g.timeline.at(-1).text,/何が変わる/);repeat(g,1);assert.equal(g.trust,97);assert.equal(g.mental,97);assert.match(g.timeline.at(-1).text,/復旧には近づかない/);repeat(g,1);assert.equal(g.trust,92);assert.equal(g.mental,92);assert.equal(g.minutes,at+40);assert.equal(g.historyReview.pending,true);assert.equal(E.nextChoices(g).length,3);
});
test('内部報告・顧客報告を挟んでも同一確認は続く',()=>{
 const g=game();repeat(g,1);E.send(g,'internal',E.internalStatusText(g),'internal-report');repeat(g,1);E.send(g,'customer',E.customerStatusText(g),'progress-report');repeat(g,1);assert.equal(g.historyReview.count,3);assert.equal(g.trust,97);
});
test('Aで情報整理のみ、未確認を確定させず同じSQLを封じて受信一覧へ進める',()=>{
 const g=game();repeat(g,4);const facts=JSON.stringify(g.facts),at=g.minutes,actions=g.actions;pick(g,'history-organize');assert.equal(g.minutes,at);assert.equal(g.actions,actions);assert.equal(JSON.stringify(g.facts),facts);assert.equal(g.facts.files,false);assert.equal(E.nextChoices(g).length,3);assert.ok(E.nextChoices(g).some(c=>c.command==='ls -l /data/inbox'));assert.ok(!E.nextChoices(g).some(c=>c.command===sql));
 const saved=E.serializeGame(g);repeat(g,14);assert.equal(E.serializeGame(g),saved);const c=E.nextChoices(g).find(c=>c.command==='ls -l /data/inbox');E.chooseAction(g,c);assert.equal(g.facts.files,true);repeat(g,1);assert.equal(g.historyReview.count,1);assert.equal(g.trust,92);
});
test('Bは一度だけ実際の確認10分と信用−5、Cは減点も時間もなく戻れる',()=>{
 let g=game();repeat(g,4);const at=g.minutes;const b=pick(g,'history-retry');assert.equal(g.minutes,at+10);assert.equal(g.trust,87);assert.equal(g.mental,92);assert.ok(!E.nextChoices(g).some(c=>c.id==='history-retry'));assert.equal(E.nextChoices(g).length,3);const snapshot=E.serializeGame(g);E.chooseAction(g,b);assert.equal(E.serializeGame(g),snapshot);g=E.restoreGame(snapshot);pick(g,'history-consult');assert.equal(g.minutes,at+10);assert.equal(g.trust,87);assert.equal(g.historyReview.resolved,true);assert.ok(g.events.some(e=>e.text.includes('停滞後に事実')));assert.ok(E.nextChoices(g).some(c=>c.command==='ls -l /data/inbox'));
});
test('再送・DB担当作業完了・対象リランは関連変化として再確認可能',()=>{
 for(const change of [g=>{g.file=true;g.fileDamaged=true;g.mismatchSeen=true;E.send(g,'internal','完全なファイル再送','resend-file');},g=>{g.lockInspected=true;E.send(g,'internal','解除確認','release-lock');},g=>{g.approved.add('SALES_IMPORT');E.execute(g,'job rerun SALES_IMPORT');}]){
  const g=game();repeat(g,4);pick(g,'history-organize');change(g);assert.ok(!g.ended);const trust=g.trust;repeat(g,1);assert.equal(g.historyReview.count,1);assert.equal(g.trust,trust);
 }
});
test('SQL表記揺れは同じ確認、別条件の未対応SQLは混同しない',()=>{const g=game();repeat(g,1);E.execute(g,"select * from batch_history where business_date='20261012';");assert.equal(g.historyReview.count,2);E.execute(g,"SELECT * FROM batch_history WHERE business_date = '20261011';");assert.equal(g.historyReview.count,2);assert.equal(g.trust,100);});
test('明示された二重確認・定期監視・別仮説は一回限りの理由付き確認として扱う',()=>{
 for(const kind of ['double-check','scheduled','hypothesis']){const g=game();repeat(g,4);pick(g,'history-organize');g.internalRequest=null;assert.equal(E.instructHistoryCheck(g,{id:kind,kind,dueAt:g.minutes,purpose:kind==='hypothesis'?'new-hypothesis':'rerun-safety'}),true);const c=E.nextChoices(g).find(c=>c.verificationId===kind);assert.ok(c);E.chooseAction(g,c);assert.equal(g.trust,92);assert.equal(g.historyReview.count,1);assert.equal(g.historyDirectives[0].used,true);assert.equal(E.instructHistoryCheck(g,{id:kind,kind}),false);}
 const g=game();repeat(g,4);E.instructHistoryCheck(g,{id:'later',kind:'scheduled',dueAt:g.minutes+30});assert.ok(!E.nextChoices(g).some(c=>c.verificationId==='later'));
});
test('セーブ復帰と再描画で再減点せず、旧セーブと再スタートも安全',()=>{const g=game();repeat(g,4);const saved=E.serializeGame(g);let h=E.restoreGame(saved);for(let i=0;i<10;i++)E.nextChoices(h);assert.equal(E.serializeGame(h),saved);assert.equal(E.serializeGame(E.restoreGame(saved)),saved);const old=JSON.parse(saved);delete old.game.historyReview;delete old.game.historyRevision;delete old.game.historyDirectives;h=E.restoreGame(JSON.stringify(old));assert.equal(h.historyReview,null);assert.equal(E.createGame().historyReview,null);});
test('期限終了を優先し終了後に4回目の叱責を加えない',()=>{const g=game();repeat(g,3);g.minutes=295;const trust=g.trust;repeat(g,1);assert.equal(g.deadlineEnded,true);assert.equal(g.trust,trust);assert.ok(!g.timeline.some(m=>m.text.includes('次に何をするか決められない')));});
test('復旧後の履歴は未処理扱いせず05時以降も確認・整理できる',()=>{const g=game();g.recovered=true;g.recoveredAt=290;g.minutes=310;repeat(g,4);assert.ok(!g.ended);assert.ok(g.timeline.some(m=>m.text.includes('正常終了と1,248件の履歴')));assert.ok(!g.timeline.some(m=>m.text.startsWith('未処理なのはもう')));pick(g,'history-consult');assert.equal(g.historyReview.resolved,true);});
