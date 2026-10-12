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
test('行動の返答を表示中は時計を止め、要求を返答後に表示してから三択を更新する',async()=>{
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');visible=g.timeline.length;render();g.techIdle=89;");
 const choices=h.el('choices').children;
 h.run("chooseAction(g,nextChoices(g).find(c=>c.command==='ls -l /data/inbox'));playReplies();");
 assert.equal(h.run('busy'),true);assert.equal(h.el('choices').children,choices);assert.ok(choices.every(b=>b.disabled));const clock=h.run('g.clock');h.run('last=Date.now()-2000');h.intervals[0]();assert.equal(h.run('g.clock'),clock);
 await h.drain();assert.ok(h.el('choices').children.some(b=>b.children[1]?.textContent==='現在の状況と次の対応を報告する'));assert.ok(h.el('choices').children.every(b=>!b.disabled));assert.equal(h.run('visible'),h.run('g.timeline.length'));
});
test('タップ中はボタンを差し替えず失効した選択から別操作を実行しない',async()=>{
 const h=ui();const buttons=h.el('choices').children;const dangerous=buttons.find(b=>b.children[1].textContent.includes('SALES_IMPORTを再実行'));assert.ok(dangerous);dangerous.onpointerdown();h.run("g.internalRequest={id:99,reason:'timer',at:g.clock};renderChoices();");assert.equal(h.el('choices').children,buttons);const actions=h.run('g.actions');dangerous.onclick();await h.drain();assert.equal(h.run('g.actions'),actions);assert.equal(h.run('g.dispatch'),null);assert.equal(h.run('g.mistakes'),0);assert.ok(h.el('choices').children.some(b=>b.children[1]?.textContent==='現在の状況と次の対応を報告する'));
});
test('着信ダイアログ中とタップ中は報告遅延の時計を進めない',()=>{
 const h=ui();for(const setup of ["$('call').showModal();", "$('call').close();pressedChoice=$('choices').children[0];"]){h.run(setup);const clock=h.run('g.clock');h.run('last=Date.now()-2000');h.intervals[0]();assert.equal(h.run('g.clock'),clock);}
});
test('期限直前の調査は一度だけ実行し古い催促を後から追加しない',async()=>{
 const h=ui();h.run('g.techIdle=89;g.replyIdle=0;');const log=h.el('choices').children.find(b=>b.children[1].textContent.includes('ログ'));const actions=h.run('g.actions');log.onclick();log.onclick();await h.drain();assert.equal(h.run('g.actions'),actions+1);assert.equal(h.run('g.techIdle'),0);h.run('last=Date.now()-1000');h.intervals[0]();assert.equal(h.run('g.internalRequest'),null);assert.equal(h.run("g.timeline.filter(m=>m.text.startsWith('状況の共有を頼む')).length"),0);
});

test('Zoom画面は操作結果の表示後に開き、通常三択を閉じ会議終了後に戻す',async()=>{
 const h=ui();h.run("g.setbacks=true;g.file=true;g.fileDamaged=true;g.facts.log=true;g.facts.files=true;execute(g,'check /data/inbox/sales_20261012.csv');playReplies();");assert.equal(h.el('meeting').open,false);await h.drain();assert.equal(h.el('meeting').open,true);assert.equal(h.el('meeting-choices').children.length,3);assert.equal(h.el('choices').children.length,0);const clock=h.run('g.clock');h.run('last=Date.now()-2000');h.intervals[0]();assert.equal(h.run('g.clock'),clock);
 h.el('meeting-choices').children[0].onclick();assert.equal(h.run('g.timeline[visible-1].sender'),'あなた');assert.equal(h.el('meeting-log').children.at(-1).children[0].textContent,'あなた');await h.drain();h.el('meeting-choices').children[0].onclick();assert.equal(h.run('g.timeline[visible-1].sender'),'あなた');await h.drain();assert.equal(h.el('meeting-return').hidden,false);h.el('meeting-return').onclick();await h.drain();assert.equal(h.el('meeting').open,false);assert.equal(h.el('choices').children.length,3);assert.equal(h.run('g.mismatchSeen'),true);
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
 const button=h.el('choices').children.find(b=>b.children[1]?.textContent.includes('根拠のない復旧時刻を訂正'));assert.ok(button);button.onclick();await h.drain();
 assert.equal(h.el('choices').children.length,3);const facts=h.el('choices').children.find(b=>b.children[1]?.textContent.includes('鬼塚へ共有'));assert.ok(facts);const at=h.run('g.minutes');facts.onclick();facts.onclick();await h.drain();assert.equal(h.run('g.minutes'),at+5);assert.equal(h.run('g.customerPromise.explanationCompleted'),true);assert.equal(h.run('g.recovered'),false);
 assert.ok(h.run("g.timeline.some(m=>m.channel==='customer'&&m.text.includes('業務側へ再案内します'))"));const saved=h.run('serializeGame(g)');const resumed=ui(saved);await resumed.drain();assert.equal(resumed.run('g.minutes'),at+5);assert.equal(resumed.run('g.customerPromise.explanationCompleted'),true);
});

test('4回目のSQL後に方針三択を表示し、連打・再開でも方針整理を二重実行しない',async()=>{
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');for(let i=0;i<4;i++)execute(g,\"SELECT * FROM batch_history WHERE business_date = '20261012';\");playReplies();");await h.drain();
 assert.equal(h.el('choices').children.length,3);const a=h.el('choices').children.find(b=>b.children[1]?.textContent.includes('確認済みの事実と未確認事項を整理'));assert.ok(a);const at=h.run('g.minutes'),credit=h.run('g.trust');a.onclick();a.onclick();await h.drain();assert.equal(h.run('g.minutes'),at);assert.equal(h.run('g.trust'),credit);assert.equal(h.run('g.facts.files'),false);assert.ok(h.el('choices').children.some(b=>b.children[1]?.textContent.includes('受信ファイルの一覧')));
 const saved=h.run('serializeGame(g)'),resumed=ui(saved);await resumed.drain();assert.equal(resumed.run('g.historyReview.resolved'),true);assert.equal(resumed.run('g.trust'),credit);assert.equal(resumed.el('choices').children.length,3);
});
