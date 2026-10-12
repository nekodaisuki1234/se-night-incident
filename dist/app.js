import {createGame,start,send,requestApproval,tick,answerCall,time,commands,parseCommandReport} from './engine.js';
const $=id=>document.getElementById(id);let g=createGame(),paused=false,pending='',sound=true,audio=null,last=Date.now(),rung=false,draftId=null,draftText='',rendered=0;
function item(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function ring(){if(!sound||!audio)return;try{const now=audio.currentTime;for(let i=0;i<4;i++){const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=i%2?660:880;v.gain.setValueAtTime(0,now+i*.2);v.gain.linearRampToValueAtTime(.04,now+i*.2+.02);v.gain.linearRampToValueAtTime(0,now+i*.2+.15);o.connect(v);v.connect(audio.destination);o.start(now+i*.2);o.stop(now+i*.2+.16);}}catch{}}
const labels={internal:'社内',customer:'顧客メール',operations:'操作報告'};
function scrollLatest(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});$('new-messages').hidden=true;}
function render(){
 $('time').textContent=time(g);$('trust').value=g.trust;$('trust-num').textContent=g.trust;$('procedure').value=g.procedure;$('procedure-num').textContent=g.procedure;
 $('state').textContent=g.secondary?'追加障害：ACCOUNT_SYNC 停止':g.recovered?'SALES_IMPORT · 正常終了':'SALES_IMPORT · 異常終了';
 $('objective').textContent=g.secondary?'誤停止したACCOUNT_SYNCの再開を確認し、追加障害も復旧する。':g.recovered?'後続の正常終了と処理件数を確認し、顧客に復旧を報告する。':g.file?'当日ファイルと未処理履歴を検証し、再実行の確認を取る。':'ログとファイル一覧を確認し、必要なら連携元へ問い合わせる。';
 const near=document.documentElement.scrollHeight-window.scrollY-window.innerHeight<110;
 if(rendered<g.timeline.length){for(const m of g.timeline.slice(rendered)){const box=item('article','','message '+m.channel+(m.sender==='あなた'?' mine':''));const h=item('div','','message-head');h.append(item('span',`${labels[m.channel]} · ${m.sender}`),item('span',`${String(Math.floor(m.time/60)).padStart(2,'0')}:${String(m.time%60).padStart(2,'0')}`));box.append(h,item('p',m.text));$('timeline').append(box);}rendered=g.timeline.length;if(near)requestAnimationFrame(scrollLatest);else $('new-messages').hidden=false;}
 if(g.ended){for(const id of ['call','approval'])if($(id).open)$(id).close();$('result-title').textContent=g.result;$('result-summary').textContent=g.result==='対応交代'?'障害対応を引き継がれました。次は根拠を集め、報告と操作を進めましょう。':'復旧対応が終了しました。確認・操作・報告の経緯を振り返りましょう。';$('result-stats').replaceChildren(item('span','信用'),item('b',g.trust+' / 100'),item('span','手順'),item('b',g.procedure+' / 100'),item('span','操作・連絡'),item('b',g.actions+'回'));$('review').replaceChildren(...g.events.map(e=>item('li',`${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')} ${e.text}`)));if(!$('result').open)$('result').showModal();}
 if(g.call&&!g.ended&&!$('approval').open&&!paused){if(!$('call').open)$('call').showModal();if(!rung){ring();rung=true;}}else if(!g.call)rung=false;
}
function setDraft(text,channel='internal',id=null){$('chat-input').value=text;$('recipient').value=channel;draftId=id;draftText=text;$('options').open=false;resizeComposer();}
function resizeComposer(){document.documentElement.style.setProperty('--composer-height',$('options').open?'410px':`${Math.ceil(document.querySelector('.composer').getBoundingClientRect().height)}px`);}
for(const [label,command] of commands){const b=item('button',label,command.includes('stop')?'risky':'');b.type='button';b.onclick=()=>setDraft(`「${command}」を入力しました。`);$('commands').append(b);}
const texts={ack:'現地到着。ログから確認します。','request-file':'当日ファイルの確認を連携元にお願いします。',initial:'現在調査中です。影響を確認し、5分後に進捗を報告します。',complete:'売上取込・後続集計の正常終了と1,248件の一致を確認しました。復旧を報告します。'};
document.querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>{const id=b.dataset.draft;let text=texts[id];if(id==='file-report')text=g.file?'当日ファイルが到着しました。内容を検証し、承認後に再実行します。':'当日ファイルの未着を確認しました。連携元への確認を進めています。業務影響は引き続き確認中です。';setDraft(text,['ack','request-file'].includes(id)?'internal':'customer',id);});
document.querySelectorAll('[data-approval]').forEach(b=>b.onclick=()=>{setDraft(`${b.dataset.approval}の再実行を確認します。`,'internal','approval:'+b.dataset.approval);});
function submit(){const text=$('chat-input').value.trim();if(!text||g.ended)return;const id=text===draftText?draftId:null,command=parseCommandReport(text);
 if(command&&/^job (rerun|stop) /i.test(command)){pending=text;$('pending-command').textContent=text;const target=command.split(/\s+/).at(-1).toUpperCase();const approved=g.approved.has(target)&&/^job rerun /i.test(command);$('approval-note').textContent=approved?'この対象の再実行は承認済みです。報告を送ると実行済みとして反映します。':'報告を送ると、この操作を実行済みとして反映します。リーダー確認または無断実行を選べます。';$('run-direct').textContent=approved?'操作報告を送信する':'無断で実行したと報告する';$('approval').showModal();return;}
 if(id?.startsWith('approval:'))requestApproval(g,id.split(':')[1]);else send(g,$('recipient').value,text,id);$('chat-input').value='';draftId=null;render();requestAnimationFrame(scrollLatest);
}
$('chat-form').onsubmit=e=>{e.preventDefault();submit();};
$('run-direct').onclick=()=>{$('approval').close();send(g,'internal',pending);$('chat-input').value='';draftId=null;render();requestAnimationFrame(scrollLatest);};
$('ask-approval').onclick=()=>{const command=parseCommandReport(pending),target=command.split(/\s+/).at(-1).toUpperCase();$('approval').close();if(/^job stop /i.test(command))send(g,'internal',`${target}を停止してよいですか。`);else requestApproval(g,target);render();requestAnimationFrame(scrollLatest);};
$('cancel-operation').onclick=()=>$('approval').close();
$('start').onclick=()=>{try{audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}$('intro').close();start(g);last=Date.now();render();resizeComposer();};
document.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{answerCall(g,b.dataset.call);$('call').close();render();requestAnimationFrame(scrollLatest);});
$('guide-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;};
$('pause').onclick=()=>{if(!g.started||g.ended)return;paused=true;$('paused').showModal();};$('resume').onclick=()=>{paused=false;last=Date.now();$('paused').close();render();};
for(const id of ['sound','mute'])$(id).onclick=()=>{sound=!sound;for(const i of ['sound','mute'])$(i).textContent='着信音：'+(sound?'オン':'オフ');};
$('retry').onclick=()=>location.reload();$('new-messages').onclick=scrollLatest;
$('options').addEventListener('toggle',resizeComposer);new ResizeObserver(resizeComposer).observe(document.querySelector('.composer'));
for(const id of ['intro','call','result','paused'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{last=Date.now();});
setInterval(()=>{const now=Date.now(),seconds=Math.min(2,(now-last)/1000);last=now;if(!document.hidden&&!paused&&!$('approval').open){tick(g,seconds);if(g.started)render();}},1000);
$('intro').showModal();render();resizeComposer();
