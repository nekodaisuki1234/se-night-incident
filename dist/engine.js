export const DAY = '20261012';
export const JOB = 'SALES_IMPORT';
export const commands = [
 ['ジョブ一覧','job status'],['異常ログ','tail -n 30 /logs/SALES_IMPORT.log'],
 ['受信ファイル','ls -l /data/inbox'],['処理履歴SQL',"SELECT * FROM batch_history WHERE business_date = '20261012';"],
 ['ファイル検証','check /data/inbox/sales_20261012.csv'],['取込再実行','job rerun SALES_IMPORT'],
 ['後続確認','job status SALES_SUMMARY'],['件数確認SQL',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';"],
 ['別系統の停止','job stop ACCOUNT_SYNC'],['別系統の再開','job rerun ACCOUNT_SYNC']
];
export function createGame() {
 return {started:false,ended:false,result:null,minutes:77,trust:100,procedure:100,mistakes:0,actions:0,
 facts:{log:false,files:false,history:false,checked:false,summary:false,count:false},file:false,recovered:false,
 secondary:false,approved:new Set(),reported:false,ack:false,clock:0,techIdle:0,replyIdle:0,techLevel:0,replyLevel:0,
 call:false,callSeen:false,terminal:[{text:'Connected to fin-batch-02 / operator: ses_nakada\n夜間売上取込が異常終了。後続の売上集計は待機中。',kind:'info'}],
 messages:{internal:[],customer:[]},timeline:[],events:[],unread:{internal:0,customer:0}};
}
function push(g,channel,sender,text){const message={sender,text,time:g.minutes,channel};g.timeline.push(message);if(g.messages[channel]){g.messages[channel].push(message);if(sender!=='あなた')g.unread[channel]++;}}
function event(g,text){g.events.push({time:g.minutes,text});}
function progress(g){g.techIdle=0;g.techLevel=0;}
function fresh(g,key){if(!g.facts[key]){g.facts[key]=true;progress(g);}}
function emit(g,text,kind='info'){g.terminal.push({text,kind});push(g,'operations','操作結果',text);return text;}
function act(g){g.actions++;g.minutes++;}
export function start(g){g.started=true;push(g,'internal','森｜監視','01:17 SALES_IMPORTがRC=12。ログは /logs/SALES_IMPORT.log。現地対応お願いします。');push(g,'internal','佐伯｜リーダー','まず原因と影響を確認してください。状態を変える操作は対象を添えて私に確認を。');push(g,'customer','高橋｜顧客','売上取込の異常終了を検知しました。現状と朝の業務への影響、次回報告予定を回答してください。');event(g,'現地対応開始');}
function penalty(g,text){g.mistakes++;g.trust=Math.max(0,g.trust-22);g.procedure=Math.max(0,g.procedure-20);event(g,text);push(g,'internal','佐伯｜リーダー',text);}
export function requestApproval(g,target){
 if(g.ended)return;act(g);push(g,'internal','あなた',`${target}の再実行・再開を確認します。`);
 if(target==='SALES_IMPORT'){
  if(!(g.file&&g.facts.checked&&g.facts.history)){push(g,'internal','佐伯｜リーダー','再実行の判断材料が足りません。当日ファイルの検証と当日処理履歴を確認してください。');return;}
  if(g.recovered){push(g,'internal','佐伯｜リーダー','そのジョブは処理済みです。再実行する必要はありません。');return;}
 }else if(target==='ACCOUNT_SYNC'){
  if(!g.secondary){push(g,'internal','佐伯｜リーダー','ACCOUNT_SYNCは正常稼働中。止める理由はありません。');return;}
 }else return;
 if(!g.approved.has(target))progress(g);g.approved.add(target);event(g,`${target}の再実行承認`);push(g,'internal','佐伯｜リーダー',`${target}の再実行を承認します。対象を取り違えず、実行後の状態を確認してください。`);
}
export function execute(g,raw){
 if(g.ended||!g.started)return;const input=raw.trim();if(!input)return;act(g);push(g,'operations','あなた',`「${input}」を入力しました。`);g.terminal.push({text:'$ '+input,kind:'command'});
 const c=input.replace(/\s+/g,' ').replace(/;$/,'').trim();
 if(c==='help')return emit(g,'対応コマンドは候補ボタンから選択できます。入力欄で編集して実行してください。');
 if(/^job status(?: SALES_IMPORT)?$/i.test(c)){fresh(g,'status');return emit(g,`SALES_IMPORT  ${g.recovered?'NORMAL RC=0':'ABEND RC=12'}\nSALES_SUMMARY ${g.recovered?'NORMAL RC=0':'WAITING'}\nACCOUNT_SYNC  ${g.secondary?'STOPPED（追加障害）':'RUNNING'}`);}
 if(/^tail(?: -n \d+)? \/logs\/SALES_IMPORT\.log$/i.test(c)||/^cat \/logs\/SALES_IMPORT\.log$/i.test(c)){fresh(g,'log');return emit(g,g.recovered?'01:xx SALES_IMPORT NORMAL RC=0 / 1,248 rows\nSALES_SUMMARY NORMAL RC=0':`01:17 ERROR INPUT FILE NOT FOUND\nexpected: /data/inbox/sales_${DAY}.csv\nprocessed: 0 rows / RC=12`);}
 if(/^ls(?: -l)? \/data\/inbox\/?$/i.test(c)){fresh(g,'files');return emit(g,`-rw-r----- batch batch 48210 Oct 11 23:58 sales_20261011.csv${g.file?'\n-rw-r----- batch batch 49920 Oct 12 01:xx sales_20261012.csv':''}`);}
 if(/^SELECT \* FROM batch_history WHERE business_date\s*=\s*'20261012'$/i.test(c)){fresh(g,'history');return emit(g,g.recovered?'SALES_IMPORT | 20261012 | NORMAL | 1248 rows':'当日処理履歴: 0 rows（未処理）');}
 if(c==='check /data/inbox/sales_20261012.csv'){
  if(!g.file)return emit(g,'検証失敗：当日ファイルが存在しません。','error');fresh(g,'checked');return emit(g,'日付=20261012 / 件数=1,248 / checksum OK / フォーマット OK','success');
 }
 if(/^job status SALES_SUMMARY$/i.test(c)){if(g.recovered){fresh(g,'summary');return emit(g,'SALES_SUMMARY NORMAL RC=0 / 後続すべて正常終了','success');}return emit(g,'SALES_SUMMARY WAITING（取込の正常終了待ち）');}
 if(/^SELECT COUNT\(\*\) FROM sales WHERE business_date\s*=\s*'20261012'$/i.test(c)){if(g.recovered){fresh(g,'count');return emit(g,'COUNT(*) = 1248 / 入力1,248件と一致','success');}return emit(g,'COUNT(*) = 0');}
 if(/^job stop ACCOUNT_SYNC$/i.test(c)){
  if(g.secondary)return emit(g,'ACCOUNT_SYNCはすでに停止しています。','error');g.secondary=true;g.approved.delete('ACCOUNT_SYNC');penalty(g,'何を止めたんですか。ACCOUNT_SYNCは正常稼働中の別ジョブです。障害を増やしてどうするんですか。状態を確認して、再開の承認を取ってください。');push(g,'customer','高橋｜顧客','口座同期まで止まっています。最初の障害と関係があるんですか？ 操作の経緯を説明してください。');return emit(g,'ACCOUNT_SYNC STOPPED / 追加障害が発生','error');
 }
 const rerun=c.match(/^job rerun (SALES_IMPORT|ACCOUNT_SYNC)$/i);
 if(rerun){const target=rerun[1].toUpperCase();const approval=g.approved.has(target);g.approved.delete(target);
  if(!approval){g.procedure=Math.max(0,g.procedure-15);event(g,`${target}を無断で再実行`);push(g,'internal','佐伯｜リーダー','その操作、承認を出していません。結果と操作対象をすぐ報告してください。');}
  if(target==='ACCOUNT_SYNC'){if(!g.secondary)return emit(g,'実行拒否：正常稼働中のジョブです。','error');g.secondary=false;progress(g);event(g,'追加障害を復旧');return emit(g,'ACCOUNT_SYNC RUNNING / 再開完了','success');}
  if(g.recovered){penalty(g,'処理済みジョブを再実行しましたね。二重処理のリスクを作っています。担当を交代します。');finish(g,'対応交代');return emit(g,'DUPLICATE EXECUTION DETECTED','error');}
  if(!g.file){penalty(g,'ファイルがないのに再実行して何が変わるんですか。ログを確認してから判断してください。');return emit(g,'SALES_IMPORT ABEND RC=12 / INPUT FILE NOT FOUND','error');}
  if(!g.facts.checked){penalty(g,'未検証のファイルを投入しましたね。日付と件数を確認してください。');return emit(g,'INPUT VALIDATION REQUIRED / 実行保留','error');}
  g.recovered=true;progress(g);event(g,'売上取込と後続集計が正常終了');push(g,'internal','森｜監視','取込と後続の正常終了を検知しました。件数確認と顧客報告をお願いします。');return emit(g,'SALES_IMPORT NORMAL RC=0 / 1248 rows\n後続SALES_SUMMARYの正常終了を検知','success');
 }
 return emit(g,'未対応のコマンド・SQLです。候補から選んで編集できます。','error');
}
export class RuleBasedProvider {
 respond(g,channel,text,id){
  if(channel==='internal'){
   if(id==='ack'){if(!g.ack){g.ack=true;progress(g);}return '了解。ログと対象ジョブから確認してください。';}
   if(id==='request-file'){
    if(!g.facts.log||!g.facts.files)return 'ファイル未着と判断した根拠を確認してください。ログと受信ディレクトリの両方が必要です。';
    if(g.file)return '当日ファイルはすでに到着しています。検証を進めてください。';
    g.file=true;progress(g);event(g,'連携元に確認し当日ファイル到着');return '連携元に確認しました。転送が遅延していました。当日ファイルが到着したので、内容と処理履歴を確認してください。';
   }
   return '自由入力の意図を特定できませんでした。初版では定型文か、対象を指定した承認ボタンを使ってください。';
  }
  if(id==='initial'){if(!g.reported){g.reported=true;g.replyIdle=0;g.replyLevel=0;}return '承知しました。復旧見込みは根拠がそろってから回答してください。次は5分後に進捗を報告してください。';}
  if(id==='file-report'){
   if(!g.facts.log||!g.facts.files){g.trust=Math.max(0,g.trust-8);return '未着と断定する根拠を確認していますか。ログとファイル一覧を見てから報告してください。';}
   if(!g.file){if(!g.missingReported){g.missingReported=true;g.replyIdle=0;g.replyLevel=0;}return '連携元への確認を進めてください。朝の業務への影響はまだ確定していないという理解です。';}
   if(!g.fileReported){g.fileReported=true;g.replyIdle=0;g.replyLevel=0;}return '当日ファイル到着、承知しました。検証と再実行を進めてください。';
  }
  if(id==='complete'){
   if(!(g.recovered&&g.facts.summary&&g.facts.count&&!g.secondary)){g.trust=Math.max(0,g.trust-12);event(g,'検証がそろう前に復旧報告');return '復旧確認がそろっていません。後続の正常終了、処理件数、他系統の障害を確認してから報告してください。';}
   g.replyIdle=0;finish(g,g.mistakes?'二次障害からの生還':g.procedure<100||g.trust<85?'復旧したが要反省':'模範復旧');return '正常終了と件数一致を確認しました。対応ありがとうございました。操作経緯は報告書に残してください。';
  }
  return 'その報告だけでは状況を判断できません。初版では定型文で現状・次の対応を報告してください。';
 }
}
export function send(g,channel,text,id=null,provider=new RuleBasedProvider()){
 if(g.ended||!text.trim())return;if(!id){const command=parseCommandReport(text);if(command){execute(g,command);return;}}act(g);push(g,channel,'あなた',text.trim());
 if(!id){const c=text.replace(/\s+/g,'');if(channel==='internal'&&/^(当日ファイルの確認を連携元にお願いします|連携元に当日ファイルの確認をお願いします)[。！!]?$/u.test(c))id='request-file';}
 const reply=provider.respond(g,channel,text,id);push(g,channel,channel==='internal'?'佐伯｜リーダー':'高橋｜顧客',reply);
}
export function parseCommandReport(raw){
 const text=raw.trim();
 if(/(?:入力|実行)(?:していない|してません|していません|しません|しない|予定|したい)/u.test(text))return null;
 const quoted=text.match(/^[「『"]([\s\S]+)[」』"](?:のコマンド|のSQL)?を(?:入力|実行)しました[。.!！]?$/u);
 const plain=text.match(/^([\s\S]+?)(?:のコマンド|のSQL)?を(?:入力|実行)しました[。.!！]?$/u);
 const command=(quoted?.[1]||plain?.[1]||text).trim();
 return /^(?:job\s|tail\s|cat\s|ls\s|check\s|SELECT\s|help$)/i.test(command)?command:null;
}
function finish(g,title){g.ended=true;g.result=title;event(g,title);}
export function tick(g,seconds){
 if(!g.started||g.ended)return;g.clock+=seconds;g.techIdle+=seconds;g.replyIdle+=seconds;
 const t=Math.min(3,Math.floor(g.techIdle/90)),r=Math.min(3,Math.floor(g.replyIdle/75));
 if(t>g.techLevel){g.techLevel=t;g.trust=Math.max(0,g.trust-8);g.minutes+=2;push(g,'internal','佐伯｜リーダー',['','いま何を確認していますか。手が止まっています。','状況が変わっていません。調査結果と次の操作を示してください。','これ以上待てません。担当を交代します。'][t]);if(t===3)finish(g,'対応交代');}
 if(r>g.replyLevel&&!g.ended){g.replyLevel=r;g.trust=Math.max(0,g.trust-8);g.minutes+=2;push(g,'customer','高橋｜顧客',['','進捗報告をお願いします。こちらから聞かないと状況が分からないんですか。','報告がないので電話しました。現状を説明してください。','回答がありません。責任者に対応を引き継いでください。'][r]);if(r===2){g.call=true;}if(r===3)finish(g,'対応交代');}
 if(g.clock>=25&&!g.callSeen){g.callSeen=true;g.call=true;}
}
export function answerCall(g,choice){if(g.ended)return;g.call=false;if(choice==='ignore'){g.trust=Math.max(0,g.trust-5);push(g,'customer','高橋｜顧客','電話に出られないなら、メールで状況を報告してください。');}else if(choice==='promise'){g.trust=Math.max(0,g.trust-15);push(g,'customer','高橋｜顧客','5分で復旧する根拠は何ですか。原因と手順は確認済みですか。');}else{if(!g.callAnswered){g.callAnswered=true;g.replyIdle=0;g.replyLevel=0;}push(g,'customer','高橋｜顧客','調査中、承知しました。次回報告は5分後に。根拠のない復旧時刻は約束しないでください。');}event(g,'顧客の電話に対応');}
export function time(g){return `${String(Math.floor(g.minutes/60)).padStart(2,'0')}:${String(g.minutes%60).padStart(2,'0')}`;}
export function nextChoices(g){
 if(!g.started||g.ended)return [];
 const command=(label,cmd)=>({label,type:'command',command:cmd,detail:'操作を実施したと報告'});
 const approval=target=>({label:`${target}の再実行をリーダーに確認する`,type:'approval',target,detail:'社内へ確認'});
 const mail=(label,id,text)=>({label,type:'message',channel:'customer',id,text,detail:'顧客へメール'});
 const stop=command('別系統のACCOUNT_SYNCを停止したと報告する','job stop ACCOUNT_SYNC');
 const rerun=command('SALES_IMPORTを再実行したと報告する','job rerun SALES_IMPORT');
 const initial=mail('調査中と伝え、5分後の報告を約束する','initial','現在調査中です。影響を確認し、5分後に進捗を報告します。');
 const complete=mail('正常終了と件数一致を報告して対応を終える','complete','売上取込・後続集計の正常終了と1,248件の一致を確認しました。復旧を報告します。');
 const file=mail('ファイルの状況と、これからの対応を報告する','file-report',g.file?'当日ファイルが到着しました。内容を検証し、承認後に再実行します。':'当日ファイルの未着を確認しました。連携元への確認を進めています。業務影響は引き続き確認中です。');
 if(g.secondary)return g.approved.has('ACCOUNT_SYNC')?[command('ACCOUNT_SYNCを再開したと報告する','job rerun ACCOUNT_SYNC'),complete,command('ジョブ一覧を確認したと報告する','job status')]:[approval('ACCOUNT_SYNC'),command('ACCOUNT_SYNCを無断で再開したと報告する','job rerun ACCOUNT_SYNC'),complete];
 if(!g.facts.log)return [command('異常終了したジョブのログを確認したと報告する','tail -n 30 /logs/SALES_IMPORT.log'),g.reported?stop:initial,rerun];
 if(!g.facts.files)return [command('受信ファイルの一覧を確認したと報告する','ls -l /data/inbox'),rerun,g.reported?stop:initial];
 if(!g.file)return [{label:'連携元に当日ファイルの確認を依頼する',type:'message',channel:'internal',id:'request-file',text:'当日ファイルの確認を連携元にお願いします。',detail:'社内へ連絡'},rerun,file];
 if(!g.facts.checked)return [command('到着した当日ファイルを検証したと報告する','check /data/inbox/sales_20261012.csv'),rerun,file];
 if(!g.facts.history)return [command('SQLで当日の処理履歴を確認したと報告する',"SELECT * FROM batch_history WHERE business_date = '20261012';"),rerun,stop];
 if(!g.recovered)return g.approved.has('SALES_IMPORT')?[rerun,file,stop]:[approval('SALES_IMPORT'),{...rerun,label:'承認を取らずSALES_IMPORTを再実行したと報告する'},file];
 if(!g.facts.summary)return [command('後続の売上集計を確認したと報告する','job status SALES_SUMMARY'),complete,rerun];
 if(!g.facts.count)return [command('SQLで当日の処理件数を確認したと報告する',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';"),complete,stop];
 return [complete,command('後続ジョブの状態をもう一度確認する','job status SALES_SUMMARY'),rerun];
}
export function chooseAction(g,choice){
 if(!choice||!nextChoices(g).some(c=>JSON.stringify(c)===JSON.stringify(choice)))return;
 if(choice.type==='command')send(g,'internal',`「${choice.command}」を入力しました。`);
 else if(choice.type==='approval')requestApproval(g,choice.target);
 else send(g,choice.channel,choice.text,choice.id);
}
