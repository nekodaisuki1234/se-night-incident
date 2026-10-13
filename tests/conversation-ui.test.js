import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as engine from '../dist/engine.js';

// Execute the actual UI module against a small DOM/timer harness: no browser timing assumptions.
function ui(saved=null){
 class Element {
  constructor(){this.children=[];this.open=false;this.hidden=false;this.disabled=false;this.scrollHeight=100;this.style={setProperty(){}};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(){} addEventListener(){} getBoundingClientRect(){return {height:200};}
  showModal(){this.open=true;} close(){this.open=false;}
 }
 const elements=new Map(),listeners={},intervals=[],timeouts=[];
 const el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const document={hidden:false,documentElement:new Element(),getElementById:el,querySelector:el,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener:(name,fn)=>{listeners[name]=fn;}};
 const sandbox={...engine,document,window:{scrollY:0,innerHeight:800,scrollTo(){},addEventListener(){},confirm:()=>false},localStorage:{getItem:key=>key.endsWith("-sound")?null:saved,setItem(){},removeItem(){}},location:{reload(){}},ResizeObserver:class{observe(){}},Date,console,requestAnimationFrame(){},setInterval(fn){intervals.push(fn);},setTimeout(fn){timeouts.push(fn);}};
 const context=vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*\n/,''),context);
 const run=code=>vm.runInContext(code,context);
 if(!saved)run("g=createGame({setbacks:false});start(g);g.firstReportInstruction=false;send(g,'internal',internalStatusText(g),'internal-report');g.callSeen=true;visible=g.timeline.length;$('intro').close();render();");
 return {run,el,intervals,timeouts,listeners,async drain(){for(let i=0;i<300&&run('busy');i++){const fn=timeouts.shift();if(fn)fn();await Promise.resolve();}assert.equal(run('busy'),false);}};
}
function findButton(h,predicate){const i=h.run(`displayedChoices().findIndex(c=>${predicate})`);return i<0?undefined:h.el('choices').children[i];}
test('行動の返答を表示中は時計を止め、要求を返答後に表示してから三択を更新する',async()=>{
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');visible=g.timeline.length;render();g.techIdle=89;");
 const choices=h.el('choices').children;
 h.run("chooseAction(g,nextChoices(g).find(c=>c.command==='ls -l /data/inbox'));playReplies();");
 assert.equal(h.run('busy'),true);assert.equal(h.el('choices').children,choices);assert.ok(choices.every(b=>b.disabled));const clock=h.run('g.clock');h.run('last=Date.now()-2000');h.intervals[0]();assert.equal(h.run('g.clock'),clock);
 await h.drain();assert.ok(h.el('choices').children.some(b=>b.children[1]?.textContent==='現在の状況と次の対応を報告する'));assert.ok(h.el('choices').children.every(b=>!b.disabled));assert.equal(h.run('visible'),h.run('g.timeline.length'));
});
test('タップ中はボタンを差し替えず失効した選択から別操作を実行しない',async()=>{
 const h=ui();const dangerous=findButton(h,"c.command==='job rerun SALES_IMPORT'");const buttons=h.el('choices').children;assert.ok(dangerous);dangerous.onpointerdown();h.run("g.internalRequest={id:99,reason:'timer',at:g.clock};renderChoices();");assert.equal(h.el('choices').children,buttons);const actions=h.run('g.actions');dangerous.onclick();await h.drain();assert.equal(h.run('g.actions'),actions);assert.equal(h.run('g.dispatch'),null);assert.equal(h.run('g.mistakes'),0);assert.ok(h.el('choices').children.some(b=>b.children[1]?.textContent==='現在の状況と次の対応を報告する'));
});
test('着信ダイアログ中とタップ中は報告遅延の時計を進めない',()=>{
 const h=ui();for(const setup of ["$('call').showModal();", "$('call').close();pressedChoice=$('choices').children[0];"]){h.run(setup);const clock=h.run('g.clock');h.run('last=Date.now()-2000');h.intervals[0]();assert.equal(h.run('g.clock'),clock);}
});
test('期限直前の調査は一度だけ実行し古い催促を後から追加しない',async()=>{
 const h=ui();h.run('g.techIdle=89;g.replyIdle=0;');const log=h.el('choices').children.find(b=>b.children[1].textContent.includes('ログ'));const actions=h.run('g.actions');log.onclick();log.onclick();await h.drain();assert.equal(h.run('g.actions'),actions+1);assert.equal(h.run('g.techIdle'),0);h.run('last=Date.now()-1000');h.intervals[0]();assert.equal(h.run('g.internalRequest'),null);assert.equal(h.run("g.timeline.filter(m=>m.text.startsWith('状況の共有を頼む')).length"),0);
});

test('Zoom画面は操作結果の表示後に開き、通常三択を閉じ会議終了後に戻す',async()=>{
 const h=ui();h.run("g.setbacks=true;g.file=true;g.fileDamaged=true;g.facts.log=true;g.facts.files=true;execute(g,'check /data/inbox/sales_20261012.csv');playReplies();");assert.equal(h.el('meeting').open,false);await h.drain();assert.equal(h.el('meeting').open,true);assert.equal(h.el('meeting-choices').children.length,3);assert.equal(h.el('choices').children.length,0);const clock=h.run('g.clock');h.run('last=Date.now()-2000');h.intervals[0]();assert.equal(h.run('g.clock'),clock);
 h.el('meeting-choices').children[0].onclick();assert.equal(h.run('g.timeline[visible-1].sender'),'あなた');assert.equal(h.el('meeting-log').children.at(-1).children[0].textContent,'あなた');await h.drain();h.el('meeting-choices').children[0].onclick();assert.equal(h.run('g.timeline[visible-1].sender'),'あなた');await h.drain();assert.equal(h.el('meeting-return').hidden,false);h.el('meeting-return').onclick();await h.drain();assert.equal(h.el('meeting').open,false);assert.ok(h.el('choices').children.length>0);assert.ok(h.run("actionCatalog(g).some(c=>c.id==='critic-approval')"));assert.equal(h.run('g.mismatchSeen'),true);
});

test('マネージャー入力中の後に暗転し結果ボタンを押すまで振り返りを表示しない',async()=>{
 const h=ui();h.run("execute(g,'job stop ACCOUNT_SYNC');playReplies();");assert.equal(h.el('result').open,false);assert.equal(h.el('member-count').textContent,'4人');let typingSeen=false;
 for(let i=0;i<300&&h.run('busy');i++){const fn=h.timeouts.shift();if(fn)fn();await Promise.resolve();if(!h.el('typing').hidden&&h.el('typing-name').textContent==='一条（PM）が入力中…')typingSeen=true;}
 assert.ok(typingSeen);assert.equal(h.run('busy'),false);assert.equal(h.el('member-count').textContent,'5人');assert.match(h.el('member-list').textContent,/一条（PM）/);assert.equal(h.el('manager-blackout').hidden,false);assert.equal(h.el('result').open,false);h.el('manager-result').onclick();assert.equal(h.el('result').open,true);assert.equal(h.el('manager-blackout').hidden,true);assert.match(h.el('result-summary').textContent,/job stop ACCOUNT_SYNC.*口座同期/);
});

test('返答演出中はヘッダー時刻と残り時間が進まない',()=>{
 const h=ui();h.run('busy=true;g.minutes=77;g.incidentSeconds=0;last=Date.now()-2000;');const clock=h.run('g.clock');h.intervals[0]();assert.equal(h.run('g.incidentSeconds'),0);assert.equal(h.run('g.clock'),clock);assert.equal(h.el('time').textContent,'01:17');assert.equal(h.el('deadline').textContent,'');assert.equal(h.el('deadline').hidden,true);
});

test('期限終了は会話を読み終えてから結果を手動表示する',async()=>{
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');visible=g.timeline.length;render();g.minutes=299;execute(g,'job status');playReplies();");await h.drain();assert.equal(h.el('deadline').textContent,'05:00の復旧期限を超過');assert.equal(h.el('result').open,false);h.el('choices').children[0].onclick();assert.equal(h.el('result').open,true);assert.match(h.el('result-summary').textContent,/顛末書.*1ヶ月のなぜなぜ分析/);
});

test('Zoomの選択で期限を超えたら会議画面を閉じて結果へ進める',async()=>{
 const h=ui();h.run("g.setbacks=true;g.file=true;g.fileDamaged=true;g.facts.log=true;g.facts.files=true;execute(g,'check /data/inbox/sales_20261012.csv');playReplies();");await h.drain();assert.equal(h.el('meeting').open,true);
 h.run('g.minutes=299;');h.el('meeting-choices').children[0].onclick();await h.drain();assert.equal(h.run('g.deadlineEnded'),true);assert.equal(h.el('meeting').open,false);assert.equal(h.el('choices').children.length,1);h.el('choices').children[0].onclick();assert.equal(h.el('result').open,true);
});


test('Zoomのpointerupとclickの間に再描画しても押したボタンを保持する',async()=>{
 const h=ui();h.run("g.setbacks=true;g.file=true;g.fileDamaged=true;g.facts.log=true;g.facts.files=true;execute(g,'check /data/inbox/sales_20261012.csv');playReplies();");await h.drain();
 const button=h.el('meeting-choices').children[0];
 h.listeners.pointerup();h.timeouts.shift()();
 assert.equal(h.el('meeting-choices').children[0],button);
 const before=h.run('g.actions');button.onclick();button.onclick();await h.drain();
 assert.equal(h.run('g.actions'),before+1);assert.equal(h.run('g.meeting.phase'),'followup');
 const next=h.el('meeting-choices').children[0];assert.notEqual(next,button);
 h.run('render();');assert.equal(h.el('meeting-choices').children[0],next);
 next.onclick();await h.drain();h.el('meeting-return').onclick();await h.drain();assert.equal(h.el('meeting').open,false);
});


test('通常出勤エンドは順番に暗転し手動で結果へ進み復旧・残処理時刻を表示する',async()=>{
 const h=ui();h.run("g.recovered=true;g.recoveredAt=290;g.minutes=340;g.facts.summary=true;g.facts.count=true;g.impactReviewed=true;g.internalReported=true;g.customerCompleted=true;send(g,'internal','対応記録を整理しました','handover');playReplies();");
 assert.equal(h.el('result').open,false);await h.drain();assert.equal(h.el('success-blackout').hidden,false);assert.equal(h.el('success-title').textContent,'END：通常出勤');assert.equal(h.el('result').open,false);
 h.el('success-result').onclick();assert.equal(h.el('result').open,true);assert.equal(h.el('success-blackout').hidden,true);assert.equal(h.el('result-title').textContent,'END：通常出勤');const texts=h.el('result-stats').children.map(e=>e.textContent);assert.ok(texts.includes('04:50'));assert.ok(texts.includes('05:50'));
});


test('成功エンドの暗転途中を保存して再開しても台詞が重複せず結果へ進める',async()=>{
 const h=ui();h.run("g.recovered=true;g.recoveredAt=290;g.minutes=340;g.facts.summary=true;g.facts.count=true;g.impactReviewed=true;g.internalReported=true;g.customerCompleted=true;send(g,'internal','記録','handover');g.endingVisible=g.endingStart+3;");
 const saved=h.run('serializeGame(g)'),n=h.run('g.timeline.length');const resumed=ui(saved);await resumed.drain();assert.equal(resumed.run('g.timeline.length'),n);assert.equal(resumed.el('success-blackout').hidden,false);assert.equal(resumed.el('result').open,false);resumed.el('success-result').onclick();assert.equal(resumed.el('result').open,true);
});

test('顧客了承の表示中に連打・再開しても鬼塚の未了承返信を追加しない',async()=>{
 const h=ui();h.run("g.recovered=true;g.recoveredAt=290;g.minutes=312;g.file=true;g.facts.log=g.facts.files=g.facts.checked=g.facts.history=g.facts.summary=g.facts.count=true;g.impactReviewed=g.internalReported=true;render();");
 const b=h.el('choices').children.find(b=>b.children[1]?.textContent.includes('顧客へ正常終了'));assert.ok(b);const before=h.run('g.actions');b.onclick();b.onclick();const saved=h.run('serializeGame(g)');await h.drain();assert.equal(h.run('g.actions'),before+1);assert.equal(h.run('g.customerCompleted'),true);assert.equal(h.run("g.timeline.filter(m=>m.text.startsWith('顧客の了承は取れたな')).length"),1);assert.equal(h.run("g.timeline.some(m=>m.text.includes('まだ完了として受け取れない'))"),false);
 const resumed=ui(saved);await resumed.drain();assert.equal(resumed.run('g.actions'),before+1);assert.equal(resumed.run("g.timeline.filter(m=>m.text.startsWith('顧客の了承は取れたな')).length"),1);assert.ok(resumed.el('choices').children.some(b=>b.children[1]?.textContent.includes('引き継ぎ事項を記録')));
});

test('PM結果には信用20・独立したメンタル・操作権限停止と後日談を表示する',async()=>{
 const h=ui();h.run("execute(g,'job stop ACCOUNT_SYNC');playReplies();");await h.drain();h.el('manager-result').onclick();
 const texts=h.el('result-stats').children.map(e=>e.textContent);assert.ok(texts.includes('20 / 100'));assert.ok(texts.includes('80 / 100'));assert.ok(texts.includes('本番操作権限停止／担当継続不可'));assert.ok(texts.includes('翌朝、本番環境の操作権限が停止された。以後の対応は別の担当者に引き継がれた。'));
 const saved=h.run('serializeGame(g)');const resumed=ui(saved);await resumed.drain();resumed.el('manager-result').onclick();assert.deepEqual(resumed.el('result-stats').children.map(e=>e.textContent),texts);
});

test('通常出勤の結果画面も報告担当変更と単独報告見送りを保持する',async()=>{
 const h=ui();h.run("g.upperReporter='onizuka';changeTrust(g,0);g.recovered=true;g.recoveredAt=290;g.minutes=340;g.facts.summary=true;g.facts.count=true;g.impactReviewed=true;g.internalReported=true;g.customerCompleted=true;send(g,'internal','記録','handover');playReplies();");
 await h.drain();h.el('success-result').onclick();const texts=h.el('result-stats').children.map(e=>e.textContent);assert.equal(h.el('result-title').textContent,'END：通常出勤');assert.ok(texts.includes('成功'));assert.ok(texts.includes('鬼塚へ担当変更'));assert.ok(texts.includes('現地対応を継続。単独での上席報告は当面見送り。'));assert.ok(texts.includes('60 / 100'));
});

test('顧客への遅い撤回から訂正三択へ進み、材料提出は一度だけ5分で復旧操作はしない',async()=>{
 const h=ui();h.run("answerCall(g,'promise');execute(g,'job status');visible=g.timeline.length;render();");
 const button=findButton(h,"c.label.includes('根拠のない復旧時刻を訂正')");assert.ok(button);button.onclick();await h.drain();
 assert.equal(h.el('choices').children.length,3);const facts=h.el('choices').children.find(b=>b.children[1]?.textContent.includes('鬼塚へ共有'));assert.ok(facts);const at=h.run('g.minutes');facts.onclick();facts.onclick();await h.drain();assert.equal(h.run('g.minutes'),at+5);assert.equal(h.run('g.customerPromise.explanationCompleted'),true);assert.equal(h.run('g.recovered'),false);
 assert.ok(h.run("g.timeline.some(m=>m.channel==='customer'&&m.text.includes('業務側へ再案内します'))"));const saved=h.run('serializeGame(g)');const resumed=ui(saved);await resumed.drain();assert.equal(resumed.run('g.minutes'),at+5);assert.equal(resumed.run('g.customerPromise.explanationCompleted'),true);
});

test('4回目のSQL後に方針三択を表示し、連打・再開でも方針整理を二重実行しない',async()=>{
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');for(let i=0;i<4;i++)execute(g,\"SELECT * FROM batch_history WHERE business_date = '20261012';\");playReplies();");await h.drain();
 assert.equal(h.el('choices').children.length,3);const a=h.el('choices').children.find(b=>b.children[1]?.textContent.includes('確認済みの事実と未確認事項を整理'));assert.ok(a);const at=h.run('g.minutes'),credit=h.run('g.trust');a.onclick();a.onclick();await h.drain();assert.equal(h.run('g.minutes'),at);assert.equal(h.run('g.trust'),credit);assert.equal(h.run('g.facts.files'),false);assert.ok(h.el('choices').children.some(b=>b.children[1]?.textContent.includes('受信ファイル一覧')));
 const saved=h.run('serializeGame(g)'),resumed=ui(saved);await resumed.drain();assert.equal(resumed.run('g.historyReview.resolved'),true);assert.equal(resumed.run('g.trust'),credit);assert.ok(resumed.el('choices').children.length>0);
});

// Only the heading varies: exercise the real renderer, including restored saves.
const lockHeadingCases=[
 ['初回ログ前',"g=createGame({scenario:'active-lock'});start(g);",'SALES_IMPORT · 異常終了'],
 ['初回ログ後・未再実行',"g=createGame({scenario:'active-lock'});start(g);execute(g,'tail -n 30 /logs/SALES_IMPORT.log');",'SALES_IMPORT · DBロック'],
 ['ロック解放後',"g=createGame({scenario:'active-lock'});start(g);execute(g,'tail -n 30 /logs/SALES_IMPORT.log');g.lockReleased=true;",'SALES_IMPORT · 異常終了'],
 ['正常終了がロック表示より優先',"g=createGame({scenario:'active-lock'});start(g);execute(g,'tail -n 30 /logs/SALES_IMPORT.log');g.recovered=true;g.recoveredAt=g.minutes;",'SALES_IMPORT · 正常終了'],
 ['従来のリラン失敗',"g=createGame();start(g);g.firstReportInstruction=false;g.file=true;g.facts.checked=true;g.approved.add('SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');",'再実行失敗 · DBロック'],
];
for(const [name,setup,expected] of lockHeadingCases)test('DBロック見出し：'+name+'、保存復元でも一致',()=>{
 const h=ui();h.run(setup+'visible=g.timeline.length;render();');assert.equal(h.el('state').textContent,expected);
 const resumed=ui(h.run('serializeGame(g)'));assert.equal(resumed.el('state').textContent,expected);
});
test('scenario/variantのない旧セーブは従来のDBロック見出しを維持',()=>{
 const g=engine.createGame();engine.start(g);g.lockEncountered=true;
 const old=JSON.parse(engine.serializeGame(g));delete old.game.scenario;delete old.game.variant;
 const h=ui(JSON.stringify(old));assert.equal(h.el('state').textContent,'再実行失敗 · DBロック');
});

test('関連変化前の確認は作業候補から消え、再送後は過去の結果と未検証状態を維持する',()=>{
 const h=ui();h.run("g.file=true;g.fileAt=80;execute(g,'check /data/inbox/sales_20261012.csv');visible=g.timeline.length;render();");
 assert.equal(h.run("displayedChoices().some(c=>c.command==='check /data/inbox/sales_20261012.csv')"),false);
 const old=h.run('g.observations.at(-1).text');h.run('g.fileAt=150;g.fileDamaged=true;g.facts.checked=false;render();');
 h.run('knownInformation(g)');assert.equal(h.run('knownInformation(g)[0].stale'),true);assert.equal(h.run('g.observations.at(-1).text'),old);assert.equal(h.run('g.facts.checked'),false);
 const resumed=ui(h.run('serializeGame(g)'));assert.equal(resumed.run('knownInformation(g).at(-1).stale'),true);
});
test('旧セーブの存在しない結果を補完せず、新規プレイにも引き継がない',()=>{
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');");const old=JSON.parse(h.run('serializeGame(g)'));delete old.game.observations;
 const resumed=ui(JSON.stringify(old));assert.equal(resumed.run('knownInformation(g).length'),0);
 h.run('restartGame()');assert.equal(h.run('g.observations.length'),0);
});

for(const scenario of ['missing','partial','notification','active-lock'])test('整理後のUIから '+scenario+' の調査・報告・承認・復旧・残処理を完走',async()=>{
 const h=ui();h.run(`g=createGame({scenario:${JSON.stringify(scenario)}});start(g);visible=g.timeline.length;rendered=visible;choiceKey='';render();`);
 async function pick(predicate){
  if(h.run('g.call'))h.run("answerCall(g,'explain');visible=g.timeline.length;rendered=visible;render();");
  if(h.run('meetingActive(g)')){while(h.run('g.meeting.phase')!=='closing'){h.run("chooseAction(g,nextChoices(g).find(c=>c.id==='meeting-good'));visible=g.timeline.length;rendered=visible;render();");}h.run('finishMeeting(g);visible=g.timeline.length;rendered=visible;render();');}
  if(h.run('!!g.internalRequest')&&!predicate.includes('initial')&&!predicate.includes('internal-report')){await pick("c.id==='internal-report'");}
  const b=findButton(h,predicate);assert.ok(b,scenario+' missing '+predicate);assert.ok(!b.disabled);b.onclick();await h.drain();
 }
 const command=c=>pick('c.command==='+JSON.stringify(c));
 await pick("c.id==='initial'");await pick("c.id==='internal-report'");await command('tail -n 30 /logs/SALES_IMPORT.log');await command('ls -l /data/inbox');
 if(scenario==='missing'){
  await pick("c.id==='request-file'");await pick("c.id==='escalate-file'");await command('check /data/inbox/sales_20261012.csv');await pick("c.id==='resend-file'");await command('check /data/inbox/sales_20261012.csv');await command("SELECT * FROM batch_history WHERE business_date = '20261012';");await pick("c.type==='approval'");await command('job rerun SALES_IMPORT');await command("SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");await pick("c.id==='release-lock'");
 }else{
  await command('check /data/inbox/sales_20261012.csv');await command("SELECT * FROM batch_history WHERE business_date = '20261012';");await command("SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");await pick("c.id==='variant-plan'");
  if(scenario==='active-lock'){await command("SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");await pick("c.id==='variant-contact'");await pick("c.id==='variant-wait'");}
 }
 await pick("c.type==='approval'");await command(scenario==='partial'?'job resume SALES_IMPORT --from 625':scenario==='notification'?'job reconcile SALES_IMPORT --notify-only':'job rerun SALES_IMPORT');
 assert.equal(h.run('g.recovered'),true);assert.ok(h.run('g.recoveredAt')<=300);
 await command('job status SALES_SUMMARY');await command("SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");await pick("c.id==='impact-review'");await pick("c.id==='internal-complete'");await pick("c.id==='complete'");await pick("c.id==='handover'");assert.equal(h.run('g.result'),'END：通常出勤');
});

test('関連する変化のみ再確認を有効化し、指示された二重確認は通常候補に残す',()=>{
 const h=ui();h.run("execute(g,'ls -l /data/inbox');execute(g,\"SELECT * FROM batch_history WHERE business_date = '20261012';\");visible=g.timeline.length;render();");
 assert.equal(h.run("inspectionDone(g,{command:'ls -l /data/inbox'})"),true);
 h.run('g.secondary=true;g.minutes+=10;');assert.equal(h.run("knownInformation(g).find(o=>o.key==='files').stale"),false);
 h.run("instructHistoryCheck(g,{id:'double',kind:'double-check'});render();");assert.equal(h.run("displayedChoices().some(c=>c.verificationId==='double')"),true);
 h.run('g.file=true;g.fileAt=g.minutes;');assert.equal(h.run("inspectionDone(g,{command:'ls -l /data/inbox'})"),false);
});
test('ロック解放後の実再確認は保持元の過去の結果を書き換えず現在の解放を返す',()=>{
 for(const scenario of ['missing','active-lock']){
 const h=ui();h.run(`g=createGame({scenario:${JSON.stringify(scenario)},setbacks:false});start(g);g.firstReportInstruction=false;g.lockEncountered=true;execute(g,\"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';\");g.lockReleased=true;`);
 const old=h.run('g.observations[0].text');assert.match(old,/REPORT_EXPORT/);assert.equal(h.run('knownInformation(g)[0].stale'),true);
 h.run('informationRecheck(g,0)');assert.equal(h.run('g.observations[0].text'),old);assert.match(h.run('g.observations.at(-1).text'),/現在のロック待ちはありません/);
 }
});
test('整理後の危険な全件リランは表示内容どおりPMエンドに到達する',async()=>{
 const h=ui();h.run("g=createGame({scenario:'partial'});start(g);chooseAction(g,directChoices(g).find(c=>c.id==='initial'));visible=g.timeline.length;rendered=visible;render();");
 const b=findButton(h,"c.command==='job rerun SALES_IMPORT'");assert.ok(b);b.onclick();b.onclick();await h.drain();assert.equal(h.run('g.actions'),2);assert.equal(h.run('g.result'),'二次障害');assert.equal(h.el('manager-blackout').hidden,false);
});

test('下部には直接行動の三択のみ。メニュー・補足・確認済み情報の入口を置かない',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<footer class="composer"><div id="choices"/);
 assert.doesNotMatch(html,/id="(?:pending-communications|information|open-reports|open-information|back-to-work|close-information)"/);
 const h=ui();assert.equal(h.el('choices').children.length,3);assert.ok(h.run("displayedChoices().every(c=>!['navigation','infra-menu','recheck'].includes(c.type))"));
});

test('選択済みの確認・連絡は直後や復元後に再表示せず、再開に必要な選択肢を残す',async()=>{
 const h=ui();const b=findButton(h,"c.command==='tail -n 30 /logs/SALES_IMPORT.log'");assert.ok(b);b.onclick();await h.drain();
 assert.equal(h.run("displayedChoices().some(c=>c.command==='tail -n 30 /logs/SALES_IMPORT.log')"),false);
 const saved=h.run('serializeGame(g)'),resumed=ui(saved);assert.equal(resumed.run("displayedChoices().some(c=>c.command==='tail -n 30 /logs/SALES_IMPORT.log')"),false);
 assert.ok(resumed.run("displayedChoices().some(c=>c.command==='ls -l /data/inbox')"));
 h.run("g=createGame({setbacks:false});start(g);g.firstReportInstruction=false;g.internalRequest=null;g.facts.log=g.facts.files=g.facts.checked=g.facts.history=true;g.file=true;g.recovered=true;g.recoveredAt=200;g.minutes=200;chooseAction(g,directChoices(g).find(c=>c.id==='complete'));visible=g.timeline.length;render();");
 assert.equal(h.run("directChoices(g).some(c=>c.id==='complete')"),false);
 h.run('g.facts.summary=g.facts.count=g.impactReviewed=g.internalReported=true;g.internalRequest=null;');assert.equal(h.run("directChoices(g).some(c=>c.id==='complete')"),true);
});
