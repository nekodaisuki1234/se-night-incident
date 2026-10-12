import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as engine from '../dist/engine.js';

// Execute the actual UI module against a small DOM/timer harness: no browser timing assumptions.
function ui(){
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
 const sandbox={...engine,document,window:{scrollY:0,innerHeight:800,scrollTo(){},addEventListener(){},confirm:()=>false},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{reload(){}},ResizeObserver:class{observe(){}},Date,console,requestAnimationFrame(){},setInterval(fn){intervals.push(fn);},setTimeout(fn){timeouts.push(fn);}};
 const context=vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*\n/,''),context);
 const run=code=>vm.runInContext(code,context);
 run("g=createGame({setbacks:false});start(g);g.firstReportInstruction=false;send(g,'internal',internalStatusText(g),'internal-report');g.callSeen=true;visible=g.timeline.length;$('intro').close();render();");
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
 h.el('meeting-choices').children[0].onclick();await h.drain();h.el('meeting-choices').children[0].onclick();await h.drain();assert.equal(h.el('meeting-return').hidden,false);h.el('meeting-return').onclick();await h.drain();assert.equal(h.el('meeting').open,false);assert.equal(h.el('choices').children.length,3);assert.equal(h.run('g.mismatchSeen'),true);
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
 const h=ui();h.run("execute(g,'tail -n 30 /logs/SALES_IMPORT.log');visible=g.timeline.length;render();g.minutes=284;execute(g,'job status');playReplies();");await h.drain();assert.equal(h.el('deadline').textContent,'4時45分の復旧期限を超過');assert.equal(h.el('result').open,false);h.el('choices').children[0].onclick();assert.equal(h.el('result').open,true);assert.match(h.el('result-summary').textContent,/顛末書.*1ヶ月のなぜなぜ分析/);
});

test('Zoomの選択で期限を超えたら会議画面を閉じて結果へ進める',async()=>{
 const h=ui();h.run("g.setbacks=true;g.file=true;g.fileDamaged=true;g.facts.log=true;g.facts.files=true;execute(g,'check /data/inbox/sales_20261012.csv');playReplies();");await h.drain();assert.equal(h.el('meeting').open,true);
 h.run('g.minutes=284;');h.el('meeting-choices').children[0].onclick();await h.drain();assert.equal(h.run('g.deadlineEnded'),true);assert.equal(h.el('meeting').open,false);assert.equal(h.el('choices').children.length,1);h.el('choices').children[0].onclick();assert.equal(h.el('result').open,true);
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
