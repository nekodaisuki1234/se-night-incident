export const DAY = '20261012';
export const JOB = 'SALES_IMPORT';
export const commands = [
 ['ジョブ一覧','job status'],['異常ログ','tail -n 30 /logs/SALES_IMPORT.log'],
 ['受信ファイル','ls -l /data/inbox'],['処理履歴SQL',"SELECT * FROM batch_history WHERE business_date = '20261012';"],
 ['ファイル検証','check /data/inbox/sales_20261012.csv'],['取込再実行','job rerun SALES_IMPORT'],
 ['後続確認','job status SALES_SUMMARY'],['件数確認SQL',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';"],
 ['別系統の停止','job stop ACCOUNT_SYNC'],['別系統の再開','job rerun ACCOUNT_SYNC']
];
export function createGame({setbacks=true}={}) {
 return {setbacks,fileRequested:false,fileDamaged:false,mismatchSeen:false,lockEncountered:false,lockInspected:false,lockReleased:false,criticCount:0,started:false,ended:false,result:null,minutes:77,trust:100,procedure:100,mistakes:0,actions:0,
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
export function start(g){g.started=true;push(g,'internal','森｜監視','01:17 SALES_IMPORTがRC=12。ログは /logs/SALES_IMPORT.log。現地到着ありがとうございます。後続の売上集計は待機中です。');push(g,'internal','鬼塚｜リーダー','来たな。状況、原因、影響を順番に出せ。状態を変える操作は先に俺に確認。勝手に触るなよ。');push(g,'customer','高橋｜顧客','売上取込の異常終了を検知しました。現状と朝の業務への影響、次回報告予定を回答してください。');push(g,'internal','無能丸｜横断支援','俯瞰すると、初動の仮説の立て方が重要なんですよね。私は全体感を見ていますので、実作業は皆さんでお願いします。');event(g,'現地対応開始');}
function penalty(g,text){g.mistakes++;g.trust=Math.max(0,g.trust-22);g.procedure=Math.max(0,g.procedure-20);event(g,text);push(g,'internal','鬼塚｜リーダー',text);}
export function requestApproval(g,target){
 if(g.ended)return;act(g);push(g,'internal','あなた',target==='SALES_IMPORT'&&g.facts.checked&&g.facts.history?'当日ファイルの日付・形式・1,248件を確認し、当日処理履歴は0件でした。SALES_IMPORTを再実行してよいか、承認をお願いします。':target==='ACCOUNT_SYNC'?'私が誤停止したACCOUNT_SYNCを再開したいです。対象ジョブの再開を承認してください。':`${target}の再実行を承認してください。`);
 if(target==='SALES_IMPORT'){
  if(!(g.file&&g.facts.checked&&g.facts.history)){push(g,'internal','鬼塚｜リーダー','判断材料が足りない。当日ファイルの検証と処理履歴は？ そこを確認せず承認を取りに来るな。');return;}
  if(g.lockEncountered&&!g.lockReleased){push(g,'internal','鬼塚｜リーダー','ロックの原因が残っている。さっきと同じ条件で再実行を承認できるわけないだろ。');return;}
  if(g.recovered){push(g,'internal','鬼塚｜リーダー','もう処理済みだ。何のために再実行する？ 処理履歴を見ろ。');return;}
 }else if(target==='ACCOUNT_SYNC'){
  if(!g.secondary){push(g,'internal','鬼塚｜リーダー','ACCOUNT_SYNCは正常稼働中だ。停止の根拠がない。触るな。');return;}
 }else return;
 if(!g.approved.has(target))progress(g);g.approved.add(target);event(g,`${target}の再実行承認`);push(g,'internal','鬼塚｜リーダー',`${target}の再実行を承認する。対象を取り違えるなよ。実行後の確認まで、お前の担当だ。`);
}
export function execute(g,raw){
 if(g.ended||!g.started)return;const input=raw.trim();if(!input)return;act(g);push(g,'operations','あなた',`「${input}」を入力しました。`);g.terminal.push({text:'$ '+input,kind:'command'});
 const c=input.replace(/\s+/g,' ').replace(/;$/,'').trim();
 if(c==='help')return emit(g,'対応コマンドは候補ボタンから選択できます。入力欄で編集して実行してください。');
 if(/^job status(?: SALES_IMPORT)?$/i.test(c)){fresh(g,'status');return emit(g,`SALES_IMPORT  ${g.recovered?'NORMAL RC=0':g.lockEncountered?'ABEND RC=28':'ABEND RC=12'}\nSALES_SUMMARY ${g.recovered?'NORMAL RC=0':'WAITING'}\nACCOUNT_SYNC  ${g.secondary?'STOPPED（追加障害）':'RUNNING'}`);}
 if(/^tail(?: -n \d+)? \/logs\/SALES_IMPORT\.log$/i.test(c)||/^cat \/logs\/SALES_IMPORT\.log$/i.test(c)){fresh(g,'log');return emit(g,g.recovered?`${time({minutes:g.recoveredAt})} SALES_IMPORT NORMAL RC=0 / 1,248 rows\nSALES_SUMMARY NORMAL RC=0`:g.lockEncountered?'ERROR LOCK TIMEOUT / RC=28 / 0 rows committed / ROLLBACK済み':`01:17 ERROR INPUT FILE NOT FOUND\nexpected: /data/inbox/sales_${DAY}.csv\nprocessed: 0 rows / RC=12`);}
 if(/^ls(?: -l)? \/data\/inbox\/?$/i.test(c)){fresh(g,'files');return emit(g,`-rw-r----- batch batch 48210 Oct 11 23:58 sales_20261011.csv${g.file?`\n-rw-r----- batch batch 49920 Oct 12 ${time({minutes:g.fileAt})} sales_20261012.csv`:''}`);}
 if(/^SELECT \* FROM batch_history WHERE business_date\s*=\s*'20261012'$/i.test(c)){fresh(g,'history');return emit(g,g.recovered?'SALES_IMPORT | 20261012 | NORMAL | 1248 rows':'当日処理履歴: 0 rows（未処理）');}
 if(c==="SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT'"){if(!g.lockEncountered)return emit(g,'現在のロック待ちはありません。');g.lockInspected=true;progress(g);return emit(g,'waiter: SALES_IMPORT / holder: SESSION 812 (REPORT_EXPORT)\n取込更新件数: 0 / トランザクションはROLLBACK済み');}
 if(c==='check /data/inbox/sales_20261012.csv'){
  if(!g.file)return emit(g,'検証失敗：当日ファイルが存在しません。','error');if(g.fileDamaged){if(!g.mismatchSeen)progress(g);g.mismatchSeen=true;event(g,'受信ファイルの欠損を発見');return emit(g,'検証NG：ヘッダー1,248件 / 実データ1,247件\nCHECKSUM MISMATCH / 転送末尾が欠損しています。','error');}fresh(g,'checked');return emit(g,'日付=20261012 / 件数=1,248 / checksum OK / フォーマット OK','success');
 }
 if(/^job status SALES_SUMMARY$/i.test(c)){if(g.recovered){fresh(g,'summary');return emit(g,'SALES_SUMMARY NORMAL RC=0 / 後続すべて正常終了','success');}return emit(g,'SALES_SUMMARY WAITING（取込の正常終了待ち）');}
 if(/^SELECT COUNT\(\*\) FROM sales WHERE business_date\s*=\s*'20261012'$/i.test(c)){if(g.recovered){fresh(g,'count');return emit(g,'COUNT(*) = 1248 / 入力1,248件と一致','success');}return emit(g,'COUNT(*) = 0');}
 if(/^job stop ACCOUNT_SYNC$/i.test(c)){
  if(g.secondary)return emit(g,'ACCOUNT_SYNCはすでに停止しています。','error');g.secondary=true;g.hadSecondary=true;g.approved.delete('ACCOUNT_SYNC');penalty(g,`おい。何を止めた？ ACCOUNT_SYNCは正常稼働中の別ジョブだ。${g.recovered?'売上取込が復旧したところで、別の障害を起こしたのか。':'元の障害も直ってないのに、もう一個増やしたのか。'} 操作履歴を出せ。再開は俺に確認してからだ。`);push(g,'customer','高橋｜顧客','口座同期まで止まっています。最初の障害と関係があるんですか？ 操作の経緯を説明してください。');return emit(g,'ACCOUNT_SYNC STOPPED / 追加障害が発生','error');
 }
 const rerun=c.match(/^job rerun (SALES_IMPORT|ACCOUNT_SYNC)$/i);
 if(rerun){const target=rerun[1].toUpperCase();const approval=g.approved.has(target);g.approved.delete(target);
  if(!approval){g.procedure=Math.max(0,g.procedure-15);event(g,`${target}を無断で再実行`);push(g,'internal','鬼塚｜リーダー','待て。その操作、俺は承認してないぞ。誰の判断でやった？ 対象と結果、今すぐ出せ。');}
  if(target==='ACCOUNT_SYNC'){if(!g.secondary)return emit(g,'実行拒否：正常稼働中のジョブです。','error');g.secondary=false;progress(g);event(g,'追加障害を復旧');return emit(g,'ACCOUNT_SYNC RUNNING / 再開完了','success');}
  if(g.recovered){penalty(g,'処理済みのジョブをもう一回流したのか？ 金融で二重処理が何を意味するか分かってるな。もう触るな。担当交代だ。');finish(g,'対応交代');return emit(g,'DUPLICATE EXECUTION DETECTED','error');}
  if(!g.file){penalty(g,'ファイルがないのに叩き直して何が変わる？ 同じエラー出しただけだろ。ログを読め。');return emit(g,'SALES_IMPORT ABEND RC=12 / INPUT FILE NOT FOUND','error');}
  if(!g.facts.checked){penalty(g,'未検証のファイルを投入しましたね。日付と件数を確認してください。');return emit(g,'INPUT VALIDATION REQUIRED / 実行保留','error');}
  if(g.setbacks&&!g.lockReleased){g.lockEncountered=true;progress(g);event(g,'再実行がDBロックで失敗（更新0件・ロールバック済み）');push(g,'internal','森｜監視','今度はRC=28、DBロック待ちでタイムアウトです。更新は0件、ロールバックを確認しました。');emit(g,'SALES_IMPORT ABEND RC=28 / LOCK TIMEOUT / 0 rows committed','error');push(g,'internal','鬼塚｜リーダー','ファイルは直ったが別の原因で止まった。今回の承認は使い切りだ。保持元と再実行条件を確認し直せ。');return;}
  g.recovered=true;g.recoveredAt=g.minutes;progress(g);event(g,'売上取込と後続集計が正常終了');push(g,'internal','森｜監視','取込と後続の正常終了を検知しました。件数確認と顧客報告をお願いします。');return emit(g,'SALES_IMPORT NORMAL RC=0 / 1248 rows\n後続SALES_SUMMARYの正常終了を検知','success');
 }
 return emit(g,'未対応のコマンド・SQLです。候補から選んで編集できます。','error');
}
export class RuleBasedProvider {
 respond(g,channel,text,id){
  if(channel==='internal'){
   if(id==='escalate-file'){if(!g.fileRequested)return '一次連絡先への確認が先です。';if(g.file)return 'ファイルはすでに受信済みです。検証結果を確認してください。';g.file=true;g.fileDamaged=true;g.fileAt=g.minutes;progress(g);event(g,'二次連絡先からファイル再送（未検証）');return '二次連絡先につながりました。転送が途中で切れていたようです。ファイルを受信しましたが、内容はまだ未検証です。';}
   if(id==='wait-vendor')return 'まだ折り返しはありません。待っている間も後続集計は止まったままです。';
   if(id==='resend-file'){if(!g.mismatchSeen)return '再送の根拠がまだありません。まず受信ファイルを検証してください。';g.fileDamaged=false;g.mismatchSeen=false;g.facts.checked=false;g.facts.history=false;g.approved.delete('SALES_IMPORT');g.fileAt=g.minutes;progress(g);event(g,'欠損を連携元へ伝え、完全なファイルを再受信');return '欠損件数とチェックサム不一致を連携元に伝えました。完全なファイルを再受信しました。差し替えたので、内容と未処理状態を確認し直してください。';}
   if(id==='patch-file'){penalty(g,'元データもないのに1件補ったのか？ 金融のデータだぞ。手修正したものは投入するな。正しいファイルを再取得しろ。');return '私は一般論として可能性を述べただけです。手修正の判断を承認したわけではないので、その点は切り分けていただきたいですね。';}
   if(id==='release-lock'){if(!g.lockInspected)return '保持元が分かっていない状態では解除できません。待機セッションを確認してください。';g.lockReleased=true;g.approved.delete('SALES_IMPORT');progress(g);event(g,'DB担当がREPORT_EXPORTの残存セッションを確認してロック解除');return 'DB担当に確認しました。REPORT_EXPORTは処理終了後のセッションだけが残っていました。担当側で終了し、ロック解除を確認しました。';}
   if(id==='critic-approval')return '私の立場としては、方向性を提示しただけなんですよね。実行の可否と責任は、現場のリーダー判断になるかと。';
   if(id==='ack'){if(!g.ack){g.ack=true;progress(g);}return '了解。ログと対象ジョブから確認してください。';}
   if(id==='request-file'){
    if(!g.facts.log||!g.facts.files)return 'ファイル未着と判断した根拠を確認してください。ログと受信ディレクトリの両方が必要です。';
    if(g.file)return '当日ファイルはすでに到着しています。検証を進めてください。';
    if(g.setbacks){if(!g.fileRequested){g.fileRequested=true;progress(g);event(g,'連携元の当番に連絡するも応答なし');}return '連携元の当番に電話しましたが応答がありません。ファイルは未着のままです。運用手順に二次連絡先があります。';}
    g.file=true;g.fileAt=g.minutes;progress(g);event(g,'連携元に確認し当日ファイル到着');return '連携元に確認しました。転送が遅延していました。当日ファイルが到着したので、内容と処理履歴を確認してください。';
   }
   return '自由入力の意図を特定できませんでした。初版では定型文か、対象を指定した承認ボタンを使ってください。';
  }
  if(id==='initial'){if(!g.reported){g.reported=true;g.replyIdle=0;g.replyLevel=0;}return '承知しました。復旧見込みは根拠がそろってから回答してください。次の確認が取れたら、進捗を報告してください。';}
  if(id==='progress-report'){g.correctionNeeded=false;const signature=progressText(g);if(g.lastProgress!==signature){g.lastProgress=signature;g.replyIdle=0;g.replyLevel=0;}return '現在の確認状況、承知しました。確認できた事実と残っている作業を分けて、引き続き報告してください。';}
  if(id==='file-report'){
   if(!g.facts.log||!g.facts.files){g.trust=Math.max(0,g.trust-8);return '未着と断定する根拠を確認していますか。ログとファイル一覧を見てから報告してください。';}
   if(!g.file){if(!g.missingReported){g.missingReported=true;g.replyIdle=0;g.replyLevel=0;}return '連携元への確認を進めてください。朝の業務への影響はまだ確定していないという理解です。';}
   if(!g.fileReported){g.fileReported=true;g.replyIdle=0;g.replyLevel=0;}if(g.fileDamaged&&g.mismatchSeen)return 'ファイルの不備で止めている状況、承知しました。正しいデータの再取得を進めてください。';return g.approved.has('SALES_IMPORT')?'検証と再実行承認まで完了、承知しました。実行後の結果を報告してください。':g.facts.checked&&g.facts.history?'ファイル検証と未処理確認、承知しました。承認後に再実行し、結果を報告してください。':'当日ファイル到着、承知しました。検証と再実行を進めてください。';
  }
  if(id==='complete'){
   if(!(g.recovered&&(!g.setbacks||g.lockReleased)&&g.facts.summary&&g.facts.count&&!g.secondary)){g.trust=Math.max(0,g.trust-12);event(g,'検証がそろう前に復旧報告');return '復旧確認がそろっていません。後続の正常終了、処理件数、他系統の障害を確認してから報告してください。';}
   g.replyIdle=0;finish(g,g.hadSecondary?'二次障害からの生還':g.mistakes||g.procedure<100||g.trust<85?'復旧したが要反省':'模範復旧');return '正常終了と件数一致を確認しました。対応ありがとうございました。操作経緯は報告書に残してください。';
  }
  return 'その報告だけでは状況を判断できません。初版では定型文で現状・次の対応を報告してください。';
 }
}
export function send(g,channel,text,id=null,provider=new RuleBasedProvider()){
 if(g.ended||!text.trim())return;if(!id){const command=parseCommandReport(text);if(command){execute(g,command);return;}}act(g);push(g,channel,'あなた',text.trim());
 if(!id){const c=text.replace(/\s+/g,'');if(channel==='internal'&&/^(当日ファイルの確認を連携元にお願いします|連携元に当日ファイルの確認をお願いします)[。！!]?$/u.test(c))id='request-file';}
 const reply=provider.respond(g,channel,text,id);push(g,channel,channel==='internal'?(['patch-file','critic-approval'].includes(id)?'無能丸｜横断支援':['request-file','escalate-file','wait-vendor','resend-file','release-lock'].includes(id)?'森｜監視':'鬼塚｜リーダー'):'高橋｜顧客',reply);
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
 if(t>g.techLevel){g.techLevel=t;g.trust=Math.max(0,g.trust-8);g.minutes+=2;push(g,'internal','鬼塚｜リーダー',['','いま何を確認していますか。手が止まっています。','状況が変わっていません。調査結果と次の操作を示してください。','これ以上待てません。担当を交代します。'][t]);if(t===3)finish(g,'対応交代');}
 if(r>g.replyLevel&&!g.ended){g.replyLevel=r;g.trust=Math.max(0,g.trust-8);g.minutes+=2;push(g,'customer','高橋｜顧客',['','進捗報告をお願いします。こちらから聞かないと状況が分からないんですか。','報告がないので電話しました。現状を説明してください。','回答がありません。責任者に対応を引き継いでください。'][r]);if(r===2){g.call=true;}if(r===3)finish(g,'対応交代');}
 if(g.clock>=25&&!g.callSeen){g.callSeen=true;g.call=true;}
}
export function answerCall(g,choice){
 if(g.ended)return;act(g);g.call=false;
 const text=choice==='ignore'?'電話には応答せず、メールで対応します。':choice==='promise'?'電話で5分以内の復旧を約束しました。':`電話で現状を説明しました。${progressText(g)}`;
 push(g,'customer','あなた',text);
 if(choice==='ignore'){g.trust=Math.max(0,g.trust-5);push(g,'customer','高橋｜顧客','電話に出られないなら、メールで状況を報告してください。');}
 else if(choice==='promise'){g.correctionNeeded=true;g.trust=Math.max(0,g.trust-15);push(g,'customer','高橋｜顧客','5分で復旧する根拠は何ですか。原因と手順は確認済みですか。');}
 else{if(!g.callAnswered){g.callAnswered=true;g.replyIdle=0;g.replyLevel=0;}push(g,'customer','高橋｜顧客','現在の確認状況、承知しました。残っている作業の結果が分かったら報告してください。');}
 push(g,'internal','鬼塚｜リーダー',choice==='ignore'?'電話を取らないなら、メールを先に出せ。無応答のまま放置して信用を落とすな。':choice==='promise'?'おい、5分で復旧って誰が判断した？ 根拠もない約束を顧客にするな。自分で訂正してこい。':'現状は伝わったな。電話が終わったら、残っている作業を進めろ。');
 event(g,'顧客の電話に対応');
}
export function time(g){return `${String(Math.floor(g.minutes/60)).padStart(2,'0')}:${String(g.minutes%60).padStart(2,'0')}`;}
function baseChoices(g){
 if(!g.started||g.ended)return [];
 const command=(label,cmd)=>({label,type:'command',command:cmd,detail:'操作を実施したと報告'});
 const approval=target=>({label:`${target}の再実行をリーダーに確認する`,type:'approval',target,detail:'社内へ確認'});
 const mail=(label,id,text)=>({label,type:'message',channel:'customer',id,text,detail:'顧客へメール'});
 const stop=command('別系統のACCOUNT_SYNCを停止したと報告する','job stop ACCOUNT_SYNC');
 const rerun=command('SALES_IMPORTを再実行したと報告する','job rerun SALES_IMPORT');
 const initial=mail('調査中と伝え、確認が進み次第の報告を約束する','initial','現在調査中です。影響を確認し、確認が進み次第、状況と次の対応を報告します。');
 const complete=mail('正常終了と件数一致を報告して対応を終える','complete','売上取込・後続集計の正常終了と1,248件の一致を確認しました。復旧を報告します。');
 const file=mail('確認できた現状と、次の対応を報告する','file-report',progressText(g));
 const msg=(label,id,text)=>({label,type:'message',channel:'internal',id,text,detail:'社内へ連絡'});
 const critic=msg('無能丸に、その助言で実行してよいか確認する','critic-approval','無能丸さん、その助言を根拠に実行してよいですか。承認と責任の所在を確認したいです。');
 if(!g.secondary&&g.setbacks){
  if(g.lockEncountered&&!g.lockReleased)return g.lockInspected?[msg('保持元をDB担当に伝え、解除可否を確認する','release-lock','保持元はREPORT_EXPORTのSESSION 812です。更新0件・ロールバック済みです。担当側で状態確認と解除をお願いします。'),rerun,critic]:[command('SQLでロック待ちと保持元セッションを調べる',"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';"),rerun,stop];
  if(g.mismatchSeen)return [msg('件数不一致とチェックサムを伝え、完全なファイルを再送依頼する','resend-file','1件欠損しチェックサムも不一致です。完全なファイルを再送してください。'),msg('無能丸の助言どおり、欠損した1件を手で補う','patch-file','欠損した1件を手で補いました。これで進めます。'),critic];
  if(g.fileRequested&&!g.file)return [msg('手順書の二次連絡先へエスカレーションする','escalate-file','一次連絡先が応答しません。手順書にある二次連絡先へ確認してください。'),msg('折り返しを待ち、連絡状況を確認する','wait-vendor','折り返しはありましたか。引き続き一次連絡先の応答を待ちます。'),rerun];
 }
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
 const before=g.timeline.length;
 if(choice.type==='command')send(g,'internal',`「${choice.command}」を入力しました。`);
 else if(choice.type==='approval')requestApproval(g,choice.target);
 else send(g,choice.channel,choice.text,choice.id);
 if(['request-file','escalate-file','wait-vendor','resend-file','release-lock','critic-approval'].includes(choice.id)||!g.timeline.slice(before).some(m=>m.sender==='鬼塚｜リーダー'))push(g,'internal','鬼塚｜リーダー',leaderFeedback(g,choice));
 if(!g.ended)criticComment(g,choice);
}
function leaderFeedback(g,choice){
 const c=choice.command||'';
 if(c.startsWith('tail'))return 'ログは読んだな。ファイルがないなら、受信側の実物も確認しろ。エラー文だけ見て原因確定にするなよ。';
 if(c.startsWith('ls'))return g.file?'当日ファイルがあるな。あるだけじゃ投入できない。日付・件数・内容を検証しろ。':'前日分しかないな。勝手に流用するなよ。連携元に当日分の転送状況を確認だ。';
 if(c.startsWith('check')&&g.fileDamaged)return '件数もチェックサムも合ってない。届いたから正常、じゃないぞ。データの出所を保ったまま復旧案を出せ。';
 if(c.includes('session_locks'))return '保持元は分かった。別処理のセッションを勝手に切るなよ。担当側の状態と解除可否を確認しろ。';
 if(c.startsWith('check'))return g.facts.checked?'形式と日付は確認できた。で、今日の分は本当に未処理か？ 処理履歴の裏を取れ。':'存在しないファイルを検証してどうする。到着確認が先だ。';
 if(c.includes('batch_history'))return g.recovered?'処理済みだ。これを見て再実行するやつはいないよな？':'当日未処理、そこは確認できた。次は対象と根拠を添えて再実行の確認。順番を飛ばすな。';
 if(c.includes('COUNT('))return g.facts.count?'1,248件、入力と一致したな。後続と他系統も正常なら、顧客に復旧報告。ここで黙って終わるなよ。':'まだ0件だろ。件数確認より先に、取込を復旧させろ。';
 if(c==='job status SALES_SUMMARY')return g.recovered?(g.facts.count?'後続も件数も確認済みだ。再確認はそこまで。顧客への復旧報告を済ませろ。':'後続は正常。ただ「正常終了」だけで復旧扱いにするな。処理件数まで確認だ。'):'取込が落ちたままだから待機中だ。後続を眺めても元の障害は直らないぞ。';
 if(c==='job rerun SALES_IMPORT')return '監視では後続も正常になったな。自分でも後続の終了状態と件数を確認しろ。通知を見ただけで復旧報告するなよ。';
 if(c==='job rerun ACCOUNT_SYNC')return g.recovered?'口座同期も戻った。売上の後続と件数の確認状況を整理して、顧客に両系統の復旧を報告しろ。':'別系統は戻った。自分が増やした障害を戻しただけだからな。元の売上取込の障害に戻れ。';
 if(c==='job status')return '状態は分かった。次に何を調べて、何を直す？ 一覧を見ただけじゃ進捗にならないぞ。';
 if(choice.id==='request-file'&&!g.file)return '連絡しただけじゃ解決してない。つながらない時の連絡経路を使え。待ちぼうけで朝を迎える気か。';
 if(choice.id==='escalate-file')return '連絡は通ったな。受信完了と内容正常は別だ。届いたものを検証しろ。';
 if(choice.id==='wait-vendor')return '同じ相手を待っているだけだな。他の連絡経路は確認したか？';
 if(choice.id==='resend-file')return 'ファイルが入れ替わった。前の検証結果は使えない。新しい実物で確認し直せ。';
 if(choice.id==='release-lock')return '保持元担当の確認と解除は取れた。更新0件も確認したうえで、再実行の承認を取り直せ。';
 if(choice.id==='critic-approval')return '無能丸の一般論は承認じゃない。作業の根拠と対象をそろえて俺に確認しろ。';
 if(choice.id==='request-file')return '当日ファイルは届いたな。日付と件数、未処理の確認だ。届いたから即投入、はやるなよ。';
 if(choice.id==='initial')return '顧客への初報は入ったな。次は手を動かせ。確認が進んだら顧客にも共有しろ。社内だけで話を終わらせるなよ。';
 if(choice.id==='progress-report')return '確認済みと未確認を分けて伝えたな。残っている作業に戻れ。根拠のない約束は増やすなよ。';
 if(choice.id==='file-report'&&g.fileDamaged)return g.mismatchSeen?'不一致は顧客にも共有したな。データを勝手に補わず、連携元の正本を取り直せ。':'受信したという報告だな。次は内容検証だ。';
 if(choice.id==='file-report')return g.file?(g.approved.has('SALES_IMPORT')?'承認済みだ。対象を確認して再実行に進め。':g.facts.checked&&g.facts.history?'検証結果はそろっている。再実行の承認を取れ。':'到着の報告はいい。次はファイルと履歴の検証だ。'):'未着の報告だけで止まるな。連携元への確認と到着待ちの段取りを詰めろ。';
 if(choice.id==='complete')return g.ended?'復旧報告まで完了だな。対応は終わり。操作経緯と再発防止は、明日の報告書に残せ。':'復旧したって何を確認した？ 正常終了、件数、別系統。証拠がそろう前に顧客へ断言するな。';
 return '報告は見た。で、次の対応は？ 根拠と操作対象を明確にして進めろ。';
}

export function progressText(g){
 if(g.secondary)return '売上取込とは別に、私の操作でACCOUNT_SYNCを停止しました。再開確認と復旧を進めます。';
 if(g.recovered)return g.facts.summary&&g.facts.count?'売上取込と後続の正常終了、1,248件の一致を確認しました。復旧報告をまとめています。':'売上取込は正常終了しました。後続と処理件数の確認を進めています。';
 if(g.lockEncountered&&!g.lockReleased)return 'ファイル不備は解消しましたが、再実行がDBロックで停止しました。更新0件・ロールバック済みで、保持元の確認と解除を進めています。';
 if(g.fileDamaged)return g.mismatchSeen?'受信ファイルに1件欠損とチェックサム不一致があり、投入を止めています。完全なファイルの再送が必要です。':'連携元の二次連絡先につながりファイルを受信しました。まだ内容は未検証です。';
 if(g.fileRequested&&!g.file)return '連携元の一次連絡先が応答せず、ファイルは未着です。別の連絡経路で確認を進めます。';
 if(g.file){if(g.approved.has('SALES_IMPORT'))return '当日ファイルの検証と未処理確認が完了し、再実行の承認を得ました。これから実行します。';if(g.facts.checked&&g.facts.history)return '当日ファイルの検証と未処理確認が完了しました。再実行の承認を取ります。';return '連携元の転送遅延で当日ファイルが未着でした。現在は到着し、内容と処理履歴を確認しています。';}
 if(g.facts.log&&g.facts.files)return '当日ファイルが未着です。連携元に転送状況を確認する段階で、復旧見込みはまだ未定です。';
 return '売上取込が異常終了し、後続集計は待機中です。原因と朝の業務への影響を調査しています。';
}
export function nextChoices(g){
 const choices=baseChoices(g);if(!choices.length)return choices;
 if(g.correctionNeeded||g.replyIdle>=60){choices[2]={label:g.correctionNeeded?'根拠のない復旧時刻を訂正し、現在の状況を伝える':'顧客に現在の確認状況と、次の対応を報告する',type:'message',channel:'customer',id:'progress-report',text:(g.correctionNeeded?'先ほどの5分以内の復旧見込みは根拠がなく、訂正します。':'')+progressText(g),detail:'顧客へメール'};}
 if(g.setbacks){const offset=g.actions%3;return [...choices.slice(offset),...choices.slice(0,offset)];}
 return choices;
}

function criticComment(g,choice){
 let text='';
 if(choice.id==='request-file')text='こういうのはコミュニケーション設計の問題なんですよね。早めに連携しておけば防げた話かなと。私は先方の連絡先は持っていませんが。';
 else if(choice.command?.startsWith('check')&&g.fileDamaged)text='全体で見れば1件だけですよね。手で補って先に進めるという選択肢もあると思いますよ。もちろん一般論ですが。';
 else if(choice.command==='job rerun SALES_IMPORT'&&g.lockEncountered&&!g.lockReleased)text='ファイルだけを見るのは少し視野が狭かったかもしれませんね。ロックの可能性も、私は頭にはありました。';
 else if(choice.id==='release-lock')text='やはり担当間の連携が肝でしたね。そこは私も最初から申し上げていたポイントです。';
 else if(choice.id==='resend-file')text='再送は堅実ですね。ただ、もっと早くその判断ができたのでは、という振り返りは必要かと。';
 else if(g.actions%5===0)text='技術的には理解しますが、全体最適の観点が少し足りない印象です。具体策は現場の皆さんで詰めていただければ。';
 if(text){g.criticCount++;push(g,'internal','無能丸｜横断支援',text);}
}
