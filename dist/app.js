import {createGame,start,execute,send,requestApproval,tick,answerCall,time,commands} from './engine.js';
const $=id=>document.getElementById(id);let g=createGame(),tab='operations',paused=false,pending='',sound=true,audio=null,last=Date.now(),rung=false;
function item(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function ring(){if(!sound||!audio)return;try{const now=audio.currentTime;for(let i=0;i<4;i++){const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=i%2?660:880;v.gain.setValueAtTime(0,now+i*.2);v.gain.linearRampToValueAtTime(.04,now+i*.2+.02);v.gain.linearRampToValueAtTime(0,now+i*.2+.15);o.connect(v);v.connect(audio.destination);o.start(now+i*.2);o.stop(now+i*.2+.16);}}catch{}}
function render(){
 $('time').textContent=time(g);$('trust').value=g.trust;$('trust-num').textContent=g.trust;$('procedure').value=g.procedure;$('procedure-num').textContent=g.procedure;
 $('state').textContent=g.secondary?'追加障害：ACCOUNT_SYNC 停止':g.recovered?'SALES_IMPORT · 正常終了':'SALES_IMPORT · 異常終了';
 $('objective').textContent=g.secondary?'誤停止したACCOUNT_SYNCの再開を確認し、追加障害も復旧する。':g.recovered?'後続の正常終了と処理件数を確認し、顧客に復旧を報告する。':g.file?'当日ファイルと未処理履歴を検証し、再実行の確認を取る。':'ログとファイル一覧を確認し、必要なら連携元へ問い合わせる。';
 const term=$('terminal'),bottom=term.scrollHeight-term.scrollTop-term.clientHeight<50;term.replaceChildren(...g.terminal.map(e=>item('div',e.text,'entry '+e.kind)));if(bottom)term.scrollTop=term.scrollHeight;
 for(const c of ['internal','customer']){
  if(tab===c)g.unread[c]=0;const badge=$(c+'-badge');badge.textContent=g.unread[c];badge.hidden=!g.unread[c];const messages=$(c+'-messages');const near=messages.scrollHeight-messages.scrollTop-messages.clientHeight<60;
  messages.replaceChildren(...g.messages[c].map(m=>{const box=item('article','','message'+(m.sender==='あなた'?' mine':''));const h=item('div','','message-head');h.append(item('span',m.sender),item('span',`${String(Math.floor(m.time/60)).padStart(2,'0')}:${String(m.time%60).padStart(2,'0')}`));box.append(h,item('p',m.text));return box;}));if(near)messages.scrollTop=messages.scrollHeight;
 }
 const notification=$('notification');const latest=[...g.messages.internal,...g.messages.customer].filter(m=>m.sender!=='あなた').sort((a,b)=>a.time-b.time).at(-1);notification.hidden=!(g.unread.internal+g.unread.customer);if(latest)notification.textContent=latest.sender+'：'+latest.text.slice(0,65);
 if(g.ended){for(const id of ['call','approval'])if($(id).open)$(id).close();$('result-title').textContent=g.result;$('result-summary').textContent=g.result==='対応交代'?'障害対応を引き継がれました。次は根拠を集め、報告と操作を進めましょう。':'復旧対応が終了しました。確認・操作・報告の経緯を振り返りましょう。';$('result-stats').replaceChildren(item('span','信用'),item('b',g.trust+' / 100'),item('span','手順'),item('b',g.procedure+' / 100'),item('span','操作・連絡'),item('b',g.actions+'回'));$('review').replaceChildren(...g.events.map(e=>item('li',`${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')} ${e.text}`)));if(!$('result').open)$('result').showModal();}
 if(g.call&&!g.ended&&!$('approval').open&&!paused){if(!$('call').open)$('call').showModal();if(!rung){ring();rung=true;}}else if(!g.call)rung=false;
}
function choose(t){tab=t;for(const pane of document.querySelectorAll('.pane'))pane.hidden=pane.id!==t;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===t);render();}
for(const [label,command] of commands){const b=item('button',label,command.includes('stop')?'risky':'');b.type='button';b.onclick=()=>{$('command').value=command;$('command-form').scrollIntoView({block:'nearest',behavior:'smooth'});};$('commands').append(b);}
$('start').onclick=()=>{try{audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}$('intro').close();start(g);last=Date.now();render();};
$('command-form').onsubmit=e=>{e.preventDefault();const c=$('command').value.trim();if(!c)return;if(/^job (rerun|stop) /i.test(c)){pending=c;$('pending-command').textContent=c;const target=c.split(/\s+/).at(-1).toUpperCase();$('approval-note').textContent=g.approved.has(target)&&/^job rerun /i.test(c)?'この対象の再実行は承認済みです。対象を確認して実行してください。':'この操作の承認を確認してください。無断でも実行できますが、結果と手順の責任を負います。';$('ask-approval').textContent='リーダーに確認する';$('run-direct').textContent=g.approved.has(target)&&/^job rerun /i.test(c)?'承認済みの操作を実行する':'承認を取らず実行する';$('approval').showModal();}else{execute(g,c);$('command').value='';render();}};
$('run-direct').onclick=()=>{$('approval').close();execute(g,pending);$('command').value='';render();};
$('ask-approval').onclick=()=>{const target=pending.split(/\s+/).at(-1).toUpperCase();$('approval').close();if(/^job stop /i.test(pending)){send(g,'internal',`${target}を停止してよいですか。`);}else requestApproval(g,target);choose('internal');};
$('cancel-operation').onclick=()=>$('approval').close();
const texts={ack:'現地到着。ログから確認します。','request-file':'当日ファイルの確認を連携元にお願いします。',initial:'現在調査中です。影響を確認し、5分後に進捗を報告します。',complete:'売上取込・後続集計の正常終了と1,248件の一致を確認しました。復旧を報告します。'};
document.querySelectorAll('[data-send]').forEach(b=>b.onclick=()=>{let text=texts[b.dataset.id];if(b.dataset.id==='file-report')text=g.file?'当日ファイルが到着しました。内容を検証し、承認後に再実行します。':'当日ファイルの未着を確認しました。連携元への確認を進めています。業務影響は引き続き確認中です。';send(g,b.dataset.send,text,b.dataset.id);render();});
document.querySelectorAll('[data-approval]').forEach(b=>b.onclick=()=>{requestApproval(g,b.dataset.approval);render();});
document.querySelectorAll('[data-chat]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const c=f.dataset.chat;send(g,c,$(c+'-input').value);$(c+'-input').value='';render();});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>choose(b.dataset.tab));
document.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{answerCall(g,b.dataset.call);$('call').close();render();});
$('guide-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;};
$('pause').onclick=()=>{if(!g.started||g.ended)return;paused=true;$('paused').showModal();};$('resume').onclick=()=>{paused=false;last=Date.now();$('paused').close();render();};
for(const id of ['sound','mute'])$(id).onclick=()=>{sound=!sound;for(const i of ['sound','mute'])$(i).textContent='着信音：'+(sound?'オン':'オフ');};
$('retry').onclick=()=>{location.reload();};
for(const id of ['intro','call','result','paused'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{last=Date.now();});
setInterval(()=>{const now=Date.now(),seconds=Math.min(2,(now-last)/1000);last=now;if(!document.hidden&&!paused&&!$('approval').open){tick(g,seconds);if(g.started)render();}},1000);
$('intro').showModal();render();
