import {createGame,start,tick,answerCall,time,nextChoices,chooseAction,messageSurface,objectiveText,serializeGame,restoreGame,meetingActive,finishMeeting,advanceIncidentTime,deadlineText} from './engine.js';
const $=id=>document.getElementById(id);let g=createGame(),paused=false,sound=true,audio=null,last=Date.now(),rung=false,rendered=0,visible=0,busy=false,choiceKey='',customerUnread=0,resultRequested=false,pressedChoice=null;
function item(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function ring(){if(!sound||!audio)return;try{const now=audio.currentTime;for(let i=0;i<4;i++){const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=i%2?660:880;v.gain.setValueAtTime(0,now+i*.2);v.gain.linearRampToValueAtTime(.04,now+i*.2+.02);v.gain.linearRampToValueAtTime(0,now+i*.2+.15);o.connect(v);v.connect(audio.destination);o.start(now+i*.2);o.stop(now+i*.2+.16);}}catch{}}
const SAVE_KEY='se-night-incident-progress-v1';
function saveProgress(){if(!g.started)return;try{localStorage.setItem(SAVE_KEY,serializeGame(g));localStorage.setItem(SAVE_KEY+'-sound',JSON.stringify(sound));$('save-status').textContent='自動保存済み';}catch{$('save-status').textContent='このブラウザでは進行状況を保存できません';}}
function restoreProgress(){try{const saved=restoreGame(localStorage.getItem(SAVE_KEY));if(saved){g=saved;visible=(g.managerEnding||g.dispatch?.phase==='arrived')&&Number.isInteger(g.endingStart)&&Number.isInteger(g.endingVisible)?Math.max(0,Math.min(g.timeline.length,Math.max(g.endingStart,g.endingVisible))):g.timeline.length;const preference=JSON.parse(localStorage.getItem(SAVE_KEY+'-sound')??'true');sound=preference!==false;for(const id of ['sound','mute'])$(id).textContent='通知・着信音：'+(sound?'オン':'オフ');$('save-status').textContent='前回の続きから再開しました';return true;}}catch{}return false;}
function enableAudio(){if(!sound)return;try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
document.addEventListener('pointerdown',enableAudio,{passive:true});
const labels={internal:'社内',customer:'顧客メール',operations:'操作報告'};
function scrollLatest(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});$('new-messages').hidden=true;}
function renderClock(){$('time').textContent=time(g);$('deadline').textContent=deadlineText(g);$('deadline').hidden=!g.infraDeadline;}
function render(){
 const joined=!!g.managerEnding&&visible>g.endingStart;const members=['あなた','鬼塚','田山（シニアテクニカルスペシャリスト）','森',...(g.infraDeadline?['佐伯（インフラ）']:[]),...(joined?['一条（PM）']:[])];$('member-count').textContent=members.length+'人';$('member-list').textContent=members.join('\n');
 $('manager-blackout').hidden=!(g.managerEnding?.phase==='blackout'&&visible===g.timeline.length&&!resultRequested);$('manager-result').disabled=busy;
 renderClock();$('trust').value=g.trust;$('trust-num').textContent=g.trust;$('mental').value=g.mental;$('mental-num').textContent=g.mental;
 $('state').textContent=g.dispatch?(g.dispatch.phase==='travelling'?'操作停止 · 鬼塚がタクシーで移動中':'GAME OVER · 鬼塚が現場に到着'):g.secondary?'追加障害：ACCOUNT_SYNC 停止':g.recovered?'SALES_IMPORT · 正常終了':g.lockEncountered&&!g.lockReleased?'再実行失敗 · DBロック':g.fileDamaged&&g.mismatchSeen?'受信ファイル · 件数不一致':'SALES_IMPORT · 異常終了';
 $('objective').textContent=objectiveText(g);
 renderChoices();
 const near=document.documentElement.scrollHeight-window.scrollY-window.innerHeight<110;
 if(rendered<visible){for(const m of g.timeline.slice(rendered,visible)){if(['meeting','manager-typing','manager-blackout'].includes(m.presentation))continue;if(messageSurface(m)==='customer'){const card=item('article','','mail-card'+(m.sender==='あなた'?' sent':''));card.append(item('small',m.sender+' · '+time({minutes:m.time})),item('p',m.text));$('mail-log').append(card);$('mail-empty').hidden=true;if(!$('customer-mail').open&&m.sender!=='あなた')customerUnread++;$('mail-badge').textContent=customerUnread?String(customerUnread):'';$('mail-badge').hidden=!customerUnread;continue;}const boss=m.sender.startsWith('鬼塚'),critic=m.sender.startsWith('田山');const box=item('article','','message '+m.channel+(m.sender==='あなた'?' mine':'')+(boss?' boss':'')+(critic?' critic':''));const avatar=item('div',m.sender==='あなた'?'私':boss?'鬼':critic?'田':m.sender.startsWith('佐伯')?'佐':m.sender.startsWith('森')?'森':m.sender.startsWith('高橋')?'高':'⌘','chat-avatar');avatar.setAttribute('aria-hidden','true');const content=item('div','','message-content');const h=item('div','','message-head');h.append(item('span',m.presentation==='onsite'&&boss?'鬼塚（対面）':critic?'田山｜シニアテクニカルスペシャリスト':m.sender),item('span',`${String(Math.floor(m.time/60)).padStart(2,'0')}:${String(m.time%60).padStart(2,'0')}`));content.append(h,item('p',m.text));content.append(item('small',m.presentation==='onsite'?'現地・対面':labels[m.channel],'message-channel'));box.append(avatar,content);$('timeline').append(box);}rendered=visible;if(near)requestAnimationFrame(scrollLatest);else $('new-messages').hidden=false;}
 if(g.ended&&resultRequested&&!g.callReason&&!busy&&rendered===g.timeline.length){for(const id of ['call','approval','customer-mail'])if($(id).open)$(id).close();$('result-title').textContent=g.managerEnding?'GAME OVER：二次障害':g.dispatch?'GAME OVER：担当交代':g.result;$('result-summary').textContent=g.deadlineEnded?'復旧期限を超過しました。顛末書の提出と、1ヶ月のなぜなぜ分析が待っています。':g.managerEnding?'操作：'+g.managerEnding.operation+'。影響：'+g.managerEnding.impact+' 2度と本番環境には触らせてもらえないだろう':g.dispatch?'鬼塚が現場に到着し、担当交代となりました。出動を招いた操作：'+g.dispatch.operation+'。理由：'+g.dispatch.reason:g.result==='対応交代'?'障害対応を引き継がれました。次は根拠を集め、報告と操作を進めましょう。':'復旧対応が終了しました。確認・操作・報告の経緯を振り返りましょう。';$('result-stats').replaceChildren(item('span','信用'),item('b',g.trust+' / 100'),item('span','メンタル'),item('b',g.mental+' / 100'),item('span','操作・連絡'),item('b',g.actions+'回'));$('review').replaceChildren(...g.events.map(e=>item('li',`${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')} ${e.text}`)));if(!$('result').open)$('result').showModal();}
 if(g.dispatch||g.managerEnding){for(const id of ['call','approval','customer-mail'])if($(id).open)$(id).close();}
 if(!meetingActive(g)&&g.call&&(!g.ended||g.callReason)&&!$('approval').open&&!paused&&!busy&&!$('customer-mail').open){$('call-script').textContent=g.callReason||'影響件数は何件ですか？ 復旧見込みはいつですか？ 朝の業務に間に合うんですか？';if(!$('call').open)$('call').showModal();if(!rung){ring();rung=true;}}else if(!g.call)rung=false;
}
function resizeComposer(){document.documentElement.style.setProperty('--composer-height',`${Math.ceil(document.querySelector('.composer').getBoundingClientRect().height)}px`);}
function renderChoices(){if(meetingActive(g)){renderMeeting();return;}if(pressedChoice)return;if(busy){choiceKey='';for(const b of $('choices').children)b.disabled=true;return;}const readyForResult=g.ended&&!busy&&!g.callReason&&visible===g.timeline.length;const choices=nextChoices(g),key=JSON.stringify(choices)+busy+(g.dispatch?.phase||'')+readyForResult;if(key===choiceKey)return;choiceKey=key;document.querySelector('.choice-heading span').textContent=g.ended?'対応終了':'次の対応を選ぶ';document.querySelector('.choice-heading small').textContent=g.ended?(readyForResult?'読み終えたら結果へ':'最後の会話をご覧ください'):'3つの選択肢から回答';const buttons=choices.map((choice,i)=>{const b=item('button','','choice');b.type='button';b.disabled=busy;b.append(item('span',String(i+1),'choice-number'),item('span',(choice.channel==='customer'?'✉ 顧客メール：':'')+choice.label,'choice-label'));b.onpointerdown=()=>{pressedChoice=b;};b.onpointercancel=()=>{pressedChoice=null;renderChoices();};b.onclick=()=>{pressedChoice=null;if(busy){renderChoices();return;}chooseAction(g,choice);saveProgress();playReplies(choice.channel==='customer');};return b;});$('choices').replaceChildren(...buttons);if(readyForResult&&!g.managerEnding){const viewResult=item('button','結果を見る →','primary wide');viewResult.onclick=()=>{resultRequested=true;render();};$('choices').append(viewResult);}if(g.dispatch){const status=item('p',g.dispatch.phase==='travelling'?'🚕 鬼塚が移動中 · 操作できません':'担当交代 · 対応終了','tag');status.setAttribute('role','status');$('choices').append(status);}resizeComposer();}
document.addEventListener('pointerup',()=>{setTimeout(()=>{pressedChoice=null;renderChoices();},0);});
$('start').onclick=()=>{try{audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}$('intro').close();start(g);saveProgress();last=Date.now();playReplies();resizeComposer();};
document.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{if(busy)return;answerCall(g,b.dataset.call);saveProgress();$('call').close();playReplies(true);});
$('guide-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;};
$('pause').onclick=()=>{if(!g.started||g.ended||meetingActive(g))return;paused=true;$('paused').showModal();};$('resume').onclick=()=>{paused=false;last=Date.now();$('paused').close();render();};
for(const id of ['sound','mute'])$(id).onclick=()=>{sound=!sound;if(sound)enableAudio();saveProgress();for(const i of ['sound','mute'])$(i).textContent='通知・着信音：'+(sound?'オン':'オフ');};
function openCustomerMail(){if(g.dispatch||meetingActive(g))return;customerUnread=0;$('mail-badge').hidden=true;if(!$('customer-mail').open)$('customer-mail').showModal();$('mail-log').scrollTop=$('mail-log').scrollHeight;}
$('open-mail').onclick=openCustomerMail;
$('close-mail').onclick=()=>{$('customer-mail').close();last=Date.now();render();};
$('customer-mail').addEventListener('cancel',()=>{last=Date.now();});
function restartGame(){g=createGame();try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();}
$('restart').onclick=()=>{const confirmed=window.confirm('最初からやり直しますか？ 今の進行状況はリセットされます。');last=Date.now();if(confirmed)restartGame();};
$('manager-result').onclick=()=>{if(busy||visible!==g.timeline.length||g.managerEnding?.phase!=='blackout')return;resultRequested=true;render();};
$('retry').onclick=restartGame;$('new-messages').onclick=scrollLatest;
new ResizeObserver(resizeComposer).observe(document.querySelector('.composer'));
for(const id of ['intro','call','result','paused','meeting'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{saveProgress();last=Date.now();});
window.addEventListener('pagehide',saveProgress);
setInterval(()=>{const now=Date.now(),seconds=Math.min(2,(now-last)/1000);last=now;if(!document.hidden&&!paused&&!$('intro').open){renderClock();}if(!document.hidden&&!paused&&!busy&&!meetingActive(g)&&!pressedChoice&&!$('call').open&&!$('intro').open&&!$('approval').open&&!$('customer-mail').open){tick(g,seconds);saveProgress();if(g.started){if(rendered<g.timeline.length)playReplies();else render();}}},1000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function playReplies(showCustomerReply=false){
 if(busy)return;busy=true;renderChoices();
 try{while(rendered<g.timeline.length){
  while(paused||document.hidden)await delay(200);
  const message=g.timeline[rendered];
  if(message.presentation?.startsWith('manager-')){if(message.presentation!=='manager-blackout')$('typing').hidden=true;else{$('typing').hidden=false;$('typing-name').textContent='一条（PM）が入力中…';}await delay(message.presentation==='manager-blackout'?2500:2400);while(paused||document.hidden)await delay(200);if(message.presentation==='manager-blackout')g.managerEnding.phase='blackout';}
  else if(message.presentation==='meeting'){ $('typing').hidden=true;renderMeeting();$('meeting-speaking').textContent=message.sender==='システム'?'':message.sender.split('｜')[0]+'が発言中';await delay(Math.max(message.pauseBefore||0,1200+Math.min(2200,message.text.length*22)));while(paused||document.hidden)await delay(200);}
  else if(message.presentation==='onsite'){$('typing').hidden=true;await delay(message.text==='〜完〜'?3500:Math.max(2500,message.pauseBefore||0));while(document.hidden)await delay(200);}
  else if(!g.callReason&&message.sender!=='あなた'&&messageSurface(message)==='teams'){
   $('typing').hidden=false;$('typing-name').textContent=message.sender==='操作結果'?'操作結果を確認中':message.sender.split('｜')[0]+'が入力中';requestAnimationFrame(scrollLatest);
   await delay(g.dispatch?Math.max(1800,Math.min(3500,message.text.length*55)):message.sender==='操作結果'?900:1200+Math.min(1800,message.text.length*22));
   while(paused||document.hidden)await delay(200);
  }
  if(!['onsite','meeting','manager-typing','manager-blackout'].includes(message.presentation)&&!g.callReason&&message.channel==='internal'&&message.sender!=='あなた')chatSound();
  $('typing').hidden=message.presentation!=='manager-typing';if(message.presentation==='manager-typing')$('typing-name').textContent='一条（PM）が入力中…';visible=rendered+1;render();requestAnimationFrame(scrollLatest);
  if(message.presentation?.startsWith('manager-')){g.endingVisible=visible;saveProgress();}
  if(message.presentation==='onsite'){g.endingVisible=visible;saveProgress();if(message.text==='〜完〜')await delay(1200);}
 }}finally{busy=false;last=Date.now();$('typing').hidden=true;if(showCustomerReply&&!meetingActive(g)&&!g.ended&&!g.callReason&&!g.dispatch)openCustomerMail();render();resizeComposer();}
}
function renderMeeting(){
 if(!meetingActive(g)){if($('meeting').open)$('meeting').close();return;}
 if(rendered<g.timeline.length&&g.timeline[rendered]?.presentation!=='meeting'&&!g.timeline.slice(0,visible).some(m=>m.presentation==='meeting'))return;
 if(!$('meeting').open)$('meeting').showModal();
 $('choices').replaceChildren();
 const lines=g.timeline.slice(0,visible).filter(m=>m.presentation==='meeting');
 if($('meeting-log').children.length!==lines.length){$('meeting-log').replaceChildren(...lines.map(m=>{const line=item('div','','meeting-line');line.append(item('b',m.sender==='鬼塚｜リーダー'?'鬼塚':m.sender),item('p',m.text));return line;}));$('meeting-log').scrollTop=$('meeting-log').scrollHeight;}
 $('meeting-return').hidden=busy||visible<g.timeline.length||g.meeting.phase!=='closing';
 if(busy){for(const b of $('meeting-choices').children)b.disabled=true;return;}
 $('meeting-speaking').textContent='';
 $('meeting-choices').replaceChildren(...nextChoices(g).map((choice,i)=>{const b=item('button','','choice');b.type='button';b.append(item('span',String(i+1),'choice-number'),item('span',choice.label));b.onclick=()=>{if(busy)return;chooseAction(g,choice);saveProgress();playReplies();};return b;}));
}
$('meeting-return').onclick=()=>{if(busy||visible<g.timeline.length)return;finishMeeting(g);$('meeting').close();choiceKey='';saveProgress();playReplies();};

const resumed=restoreProgress();if(!resumed)$('intro').showModal();render();resizeComposer();if(resumed){requestAnimationFrame(scrollLatest);if(rendered<g.timeline.length)playReplies();}

// An original two-note notification inspired by workplace chat apps.
function chatSound(){if(!sound||!audio||document.hidden||paused)return;try{const now=audio.currentTime;for(const [i,freq] of [880,1174.66].entries()){const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.value=freq;v.gain.setValueAtTime(0,now+i*.12);v.gain.linearRampToValueAtTime(.035,now+i*.12+.012);v.gain.exponentialRampToValueAtTime(.001,now+i*.12+.2);o.connect(v);v.connect(audio.destination);o.start(now+i*.12);o.stop(now+i*.12+.22);}}catch{}}
setInterval(()=>{if(g.call&&$('call').open&&!document.hidden&&!paused)ring();},3000);
