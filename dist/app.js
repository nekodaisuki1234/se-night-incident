import {createGame,start,tick,answerCall,time,nextChoices,chooseAction,messageSurface,objectiveText,serializeGame,restoreGame} from './engine.js';
const $=id=>document.getElementById(id);let g=createGame(),paused=false,sound=true,audio=null,last=Date.now(),rung=false,rendered=0,visible=0,busy=false,choiceKey='',customerUnread=0;
function item(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function ring(){if(!sound||!audio)return;try{const now=audio.currentTime;for(let i=0;i<4;i++){const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=i%2?660:880;v.gain.setValueAtTime(0,now+i*.2);v.gain.linearRampToValueAtTime(.04,now+i*.2+.02);v.gain.linearRampToValueAtTime(0,now+i*.2+.15);o.connect(v);v.connect(audio.destination);o.start(now+i*.2);o.stop(now+i*.2+.16);}}catch{}}
const SAVE_KEY='se-night-incident-progress-v1';
function saveProgress(){if(!g.started)return;try{localStorage.setItem(SAVE_KEY,serializeGame(g));localStorage.setItem(SAVE_KEY+'-sound',JSON.stringify(sound));$('save-status').textContent='自動保存済み';}catch{$('save-status').textContent='このブラウザでは進行状況を保存できません';}}
function restoreProgress(){try{const saved=restoreGame(localStorage.getItem(SAVE_KEY));if(saved){g=saved;visible=g.dispatch?.phase==='arrived'&&Number.isInteger(g.endingStart)&&Number.isInteger(g.endingVisible)?Math.max(0,Math.min(g.timeline.length,Math.max(g.endingStart,g.endingVisible))):g.timeline.length;const preference=JSON.parse(localStorage.getItem(SAVE_KEY+'-sound')??'true');sound=preference!==false;for(const id of ['sound','mute'])$(id).textContent='通知・着信音：'+(sound?'オン':'オフ');$('save-status').textContent='前回の続きから再開しました';return true;}}catch{}return false;}
function enableAudio(){if(!sound)return;try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
document.addEventListener('pointerdown',enableAudio,{passive:true});
const labels={internal:'社内',customer:'顧客メール',operations:'操作報告'};
function scrollLatest(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});$('new-messages').hidden=true;}
function render(){
 $('time').textContent=time(g);$('trust').value=g.trust;$('trust-num').textContent=g.trust;$('mental').value=g.mental;$('mental-num').textContent=g.mental;
 $('state').textContent=g.dispatch?(g.dispatch.phase==='travelling'?'操作停止 · 鬼塚がタクシーで移動中':'GAME OVER · 鬼塚が現場に到着'):g.secondary?'追加障害：ACCOUNT_SYNC 停止':g.recovered?'SALES_IMPORT · 正常終了':g.lockEncountered&&!g.lockReleased?'再実行失敗 · DBロック':g.fileDamaged&&g.mismatchSeen?'受信ファイル · 件数不一致':'SALES_IMPORT · 異常終了';
 $('objective').textContent=objectiveText(g);
 renderChoices();
 const near=document.documentElement.scrollHeight-window.scrollY-window.innerHeight<110;
 if(rendered<visible){for(const m of g.timeline.slice(rendered,visible)){if(messageSurface(m)==='customer'){const card=item('article','','mail-card'+(m.sender==='あなた'?' sent':''));card.append(item('small',m.sender+' · '+time({minutes:m.time})),item('p',m.text));$('mail-log').append(card);$('mail-empty').hidden=true;if(!$('customer-mail').open&&m.sender!=='あなた')customerUnread++;$('mail-badge').textContent=customerUnread?String(customerUnread):'';$('mail-badge').hidden=!customerUnread;continue;}const boss=m.sender.startsWith('鬼塚'),critic=m.sender.startsWith('田山');const box=item('article','','message '+m.channel+(m.sender==='あなた'?' mine':'')+(boss?' boss':'')+(critic?' critic':''));const avatar=item('div',m.sender==='あなた'?'私':boss?'鬼':critic?'田':m.sender.startsWith('森')?'森':m.sender.startsWith('高橋')?'高':'⌘','chat-avatar');avatar.setAttribute('aria-hidden','true');const content=item('div','','message-content');const h=item('div','','message-head');h.append(item('span',m.presentation==='onsite'&&boss?'鬼塚（対面）':m.sender),item('span',`${String(Math.floor(m.time/60)).padStart(2,'0')}:${String(m.time%60).padStart(2,'0')}`));content.append(h,item('p',m.text));content.append(item('small',m.presentation==='onsite'?'現地・対面':labels[m.channel],'message-channel'));box.append(avatar,content);$('timeline').append(box);}rendered=visible;if(near)requestAnimationFrame(scrollLatest);else $('new-messages').hidden=false;}
 if(g.ended&&!g.callReason&&!busy&&rendered===g.timeline.length){for(const id of ['call','approval','customer-mail'])if($(id).open)$(id).close();$('result-title').textContent=g.dispatch?'GAME OVER：担当交代':g.result;$('result-summary').textContent=g.dispatch?'鬼塚が現場に到着し、担当交代となりました。出動を招いた操作：'+g.dispatch.operation+'。理由：'+g.dispatch.reason:g.result==='対応交代'?'障害対応を引き継がれました。次は根拠を集め、報告と操作を進めましょう。':'復旧対応が終了しました。確認・操作・報告の経緯を振り返りましょう。';$('result-stats').replaceChildren(item('span','信用'),item('b',g.trust+' / 100'),item('span','メンタル'),item('b',g.mental+' / 100'),item('span','操作・連絡'),item('b',g.actions+'回'));$('review').replaceChildren(...g.events.map(e=>item('li',`${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')} ${e.text}`)));if(!$('result').open)$('result').showModal();}
 if(g.dispatch){for(const id of ['call','approval','customer-mail'])if($(id).open)$(id).close();}
 if(g.call&&(!g.ended||g.callReason)&&!$('approval').open&&!paused&&!busy&&!$('customer-mail').open){$('call-script').textContent=g.callReason||'影響件数は何件ですか？ 復旧見込みはいつですか？ 朝の業務に間に合うんですか？';if(!$('call').open)$('call').showModal();if(!rung){ring();rung=true;}}else if(!g.call)rung=false;
}
function resizeComposer(){document.documentElement.style.setProperty('--composer-height',`${Math.ceil(document.querySelector('.composer').getBoundingClientRect().height)}px`);}
function renderChoices(){const choices=nextChoices(g),key=JSON.stringify(choices)+busy+(g.dispatch?.phase||'');if(key===choiceKey)return;choiceKey=key;const buttons=choices.map((choice,i)=>{const b=item('button','','choice');b.type='button';b.disabled=busy;b.append(item('span',String(i+1),'choice-number'),item('span',(choice.channel==='customer'?'✉ 顧客メール：':'')+choice.label,'choice-label'));b.onclick=()=>{if(busy)return;chooseAction(g,choice);saveProgress();playReplies(choice.channel==='customer');};return b;});$('choices').replaceChildren(...buttons);if(g.dispatch){const status=item('p',g.dispatch.phase==='travelling'?'🚕 鬼塚が移動中 · 操作できません':'担当交代 · 対応終了','tag');status.setAttribute('role','status');$('choices').append(status);}resizeComposer();}
$('start').onclick=()=>{try{audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}$('intro').close();start(g);saveProgress();last=Date.now();playReplies();resizeComposer();};
document.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{if(busy)return;answerCall(g,b.dataset.call);saveProgress();$('call').close();playReplies(true);});
$('guide-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;};
$('pause').onclick=()=>{if(!g.started||g.ended)return;paused=true;$('paused').showModal();};$('resume').onclick=()=>{paused=false;last=Date.now();$('paused').close();render();};
for(const id of ['sound','mute'])$(id).onclick=()=>{sound=!sound;if(sound)enableAudio();saveProgress();for(const i of ['sound','mute'])$(i).textContent='通知・着信音：'+(sound?'オン':'オフ');};
function openCustomerMail(){if(g.dispatch)return;customerUnread=0;$('mail-badge').hidden=true;if(!$('customer-mail').open)$('customer-mail').showModal();$('mail-log').scrollTop=$('mail-log').scrollHeight;}
$('open-mail').onclick=openCustomerMail;
$('close-mail').onclick=()=>{$('customer-mail').close();last=Date.now();render();};
$('customer-mail').addEventListener('cancel',()=>{last=Date.now();});
function restartGame(){g=createGame();try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();}
$('restart').onclick=()=>{const confirmed=window.confirm('最初からやり直しますか？ 今の進行状況はリセットされます。');last=Date.now();if(confirmed)restartGame();};
$('retry').onclick=restartGame;$('new-messages').onclick=scrollLatest;
new ResizeObserver(resizeComposer).observe(document.querySelector('.composer'));
for(const id of ['intro','call','result','paused'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{saveProgress();last=Date.now();});
window.addEventListener('pagehide',saveProgress);
setInterval(()=>{const now=Date.now(),seconds=Math.min(2,(now-last)/1000);last=now;if(!document.hidden&&!paused&&!busy&&!$('approval').open&&!$('customer-mail').open){tick(g,seconds);saveProgress();if(g.started){if(rendered<g.timeline.length)playReplies();else render();}}},1000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function playReplies(showCustomerReply=false){
 if(busy)return;busy=true;renderChoices();
 try{while(rendered<g.timeline.length){
  while(paused||document.hidden)await delay(200);
  const message=g.timeline[rendered];
  if(message.presentation==='onsite'){$('typing').hidden=true;await delay(message.pauseBefore||500);while(document.hidden)await delay(200);}
  else if(!g.callReason&&message.sender!=='あなた'&&messageSurface(message)==='teams'){
   $('typing').hidden=false;$('typing-name').textContent=message.sender==='操作結果'?'操作結果を確認中':message.sender.split('｜')[0]+'が入力中';requestAnimationFrame(scrollLatest);
   await delay(g.dispatch?450:message.sender==='操作結果'?450:700+Math.min(700,message.text.length*5));
   while(paused||document.hidden)await delay(200);
  }
  if(message.presentation!=='onsite'&&!g.callReason&&message.channel==='internal'&&message.sender!=='あなた')chatSound();
  $('typing').hidden=true;visible=rendered+1;render();requestAnimationFrame(scrollLatest);
  if(message.presentation==='onsite'){g.endingVisible=visible;saveProgress();if(message.text==='〜完〜')await delay(1200);}
 }}finally{busy=false;last=Date.now();$('typing').hidden=true;if(showCustomerReply&&!g.ended&&!g.callReason&&!g.dispatch)openCustomerMail();render();resizeComposer();}
}
const resumed=restoreProgress();if(!resumed)$('intro').showModal();render();resizeComposer();if(resumed){requestAnimationFrame(scrollLatest);if(rendered<g.timeline.length)playReplies();}

// An original two-note notification inspired by workplace chat apps.
function chatSound(){if(!sound||!audio||document.hidden||paused)return;try{const now=audio.currentTime;for(const [i,freq] of [880,1174.66].entries()){const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.value=freq;v.gain.setValueAtTime(0,now+i*.12);v.gain.linearRampToValueAtTime(.035,now+i*.12+.012);v.gain.exponentialRampToValueAtTime(.001,now+i*.12+.2);o.connect(v);v.connect(audio.destination);o.start(now+i*.12);o.stop(now+i*.12+.22);}}catch{}}
setInterval(()=>{if(g.call&&$('call').open&&!document.hidden&&!paused)ring();},3000);
