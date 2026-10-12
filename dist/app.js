import {createGame,start,tick,answerCall,time,nextChoices,chooseAction} from './engine.js';
const $=id=>document.getElementById(id);let g=createGame(),paused=false,sound=true,audio=null,last=Date.now(),rung=false,rendered=0,visible=0,busy=false,choiceKey='';
function item(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function ring(){if(!sound||!audio)return;try{const now=audio.currentTime;for(let i=0;i<4;i++){const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=i%2?660:880;v.gain.setValueAtTime(0,now+i*.2);v.gain.linearRampToValueAtTime(.04,now+i*.2+.02);v.gain.linearRampToValueAtTime(0,now+i*.2+.15);o.connect(v);v.connect(audio.destination);o.start(now+i*.2);o.stop(now+i*.2+.16);}}catch{}}
const labels={internal:'社内',customer:'顧客メール',operations:'操作報告'};
function scrollLatest(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});$('new-messages').hidden=true;}
function render(){
 $('time').textContent=time(g);$('trust').value=g.trust;$('trust-num').textContent=g.trust;$('procedure').value=g.procedure;$('procedure-num').textContent=g.procedure;
 $('state').textContent=g.secondary?'追加障害：ACCOUNT_SYNC 停止':g.recovered?'SALES_IMPORT · 正常終了':g.lockEncountered&&!g.lockReleased?'再実行失敗 · DBロック':g.fileDamaged&&g.mismatchSeen?'受信ファイル · 件数不一致':'SALES_IMPORT · 異常終了';
 $('objective').textContent=g.secondary?'誤停止したACCOUNT_SYNCの再開を確認し、追加障害も復旧する。':g.recovered?'後続の正常終了と処理件数を確認し、顧客に復旧を報告する。':g.file?'当日ファイルと未処理履歴を検証し、再実行の確認を取る。':'ログとファイル一覧を確認し、必要なら連携元へ問い合わせる。';
 renderChoices();
 const near=document.documentElement.scrollHeight-window.scrollY-window.innerHeight<110;
 if(rendered<visible){for(const m of g.timeline.slice(rendered,visible)){const boss=m.sender.startsWith('鬼塚'),critic=m.sender.startsWith('無能丸');const box=item('article','','message '+m.channel+(m.sender==='あなた'?' mine':'')+(boss?' boss':'')+(critic?' critic':''));const avatar=item('div',m.sender==='あなた'?'私':boss?'鬼':critic?'無':m.sender.startsWith('森')?'森':m.sender.startsWith('高橋')?'高':'⌘','chat-avatar');avatar.setAttribute('aria-hidden','true');const content=item('div','','message-content');const h=item('div','','message-head');h.append(item('span',m.sender),item('span',`${String(Math.floor(m.time/60)).padStart(2,'0')}:${String(m.time%60).padStart(2,'0')}`));content.append(h,item('p',m.text));content.append(item('small',labels[m.channel],'message-channel'));box.append(avatar,content);$('timeline').append(box);}rendered=visible;if(near)requestAnimationFrame(scrollLatest);else $('new-messages').hidden=false;}
 if(g.ended&&!busy&&rendered===g.timeline.length){for(const id of ['call','approval'])if($(id).open)$(id).close();$('result-title').textContent=g.result;$('result-summary').textContent=g.result==='対応交代'?'障害対応を引き継がれました。次は根拠を集め、報告と操作を進めましょう。':'復旧対応が終了しました。確認・操作・報告の経緯を振り返りましょう。';$('result-stats').replaceChildren(item('span','信用'),item('b',g.trust+' / 100'),item('span','手順'),item('b',g.procedure+' / 100'),item('span','操作・連絡'),item('b',g.actions+'回'));$('review').replaceChildren(...g.events.map(e=>item('li',`${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')} ${e.text}`)));if(!$('result').open)$('result').showModal();}
 if(g.call&&!g.ended&&!$('approval').open&&!paused&&!busy){if(!$('call').open)$('call').showModal();if(!rung){ring();rung=true;}}else if(!g.call)rung=false;
}
function resizeComposer(){document.documentElement.style.setProperty('--composer-height',`${Math.ceil(document.querySelector('.composer').getBoundingClientRect().height)}px`);}
function renderChoices(){const choices=nextChoices(g),key=JSON.stringify(choices)+busy;if(key===choiceKey)return;choiceKey=key;const buttons=choices.map((choice,i)=>{const b=item('button','','choice');b.type='button';b.disabled=busy;b.append(item('span',String(i+1),'choice-number'),item('span',choice.label,'choice-label'));b.onclick=()=>{if(busy)return;chooseAction(g,choice);playReplies();};return b;});$('choices').replaceChildren(...buttons);resizeComposer();}
$('start').onclick=()=>{try{audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}$('intro').close();start(g);last=Date.now();playReplies();resizeComposer();};
document.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{if(busy)return;answerCall(g,b.dataset.call);$('call').close();playReplies();});
$('guide-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;};
$('pause').onclick=()=>{if(!g.started||g.ended)return;paused=true;$('paused').showModal();};$('resume').onclick=()=>{paused=false;last=Date.now();$('paused').close();render();};
for(const id of ['sound','mute'])$(id).onclick=()=>{sound=!sound;for(const i of ['sound','mute'])$(i).textContent='着信音：'+(sound?'オン':'オフ');};
$('retry').onclick=()=>location.reload();$('new-messages').onclick=scrollLatest;
new ResizeObserver(resizeComposer).observe(document.querySelector('.composer'));
for(const id of ['intro','call','result','paused'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{last=Date.now();});
setInterval(()=>{const now=Date.now(),seconds=Math.min(2,(now-last)/1000);last=now;if(!document.hidden&&!paused&&!busy&&!$('approval').open){tick(g,seconds);if(g.started){if(rendered<g.timeline.length)playReplies();else render();}}},1000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function playReplies(){
 if(busy)return;busy=true;renderChoices();
 try{while(rendered<g.timeline.length){
  while(paused||document.hidden)await delay(200);
  const message=g.timeline[rendered];
  if(message.sender!=='あなた'){
   $('typing').hidden=false;$('typing-name').textContent=message.sender==='操作結果'?'操作結果を確認中':message.sender.split('｜')[0]+'が入力中';requestAnimationFrame(scrollLatest);
   await delay(message.sender==='操作結果'?450:700+Math.min(700,message.text.length*5));
   while(paused||document.hidden)await delay(200);
  }
  $('typing').hidden=true;visible=rendered+1;render();requestAnimationFrame(scrollLatest);
 }}finally{busy=false;last=Date.now();$('typing').hidden=true;render();resizeComposer();}
}
$('intro').showModal();render();resizeComposer();
