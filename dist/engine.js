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
 return {dispatch:null,dangerActions:[],tayamaConsulted:[],setbacks,fileRequested:false,fileDamaged:false,mismatchSeen:false,lockEncountered:false,lockInspected:false,lockReleased:false,criticCount:0,started:false,ended:false,result:null,minutes:77,trust:100,mental:100,mistakes:0,actions:0,
 facts:{log:false,files:false,history:false,checked:false,summary:false,count:false},file:false,recovered:false,
 secondary:false,approved:new Set(),reported:false,internalReported:false,ack:false,clock:0,techIdle:0,replyIdle:0,techLevel:0,replyLevel:0,
 call:false,callSeen:false,terminal:[{text:'Connected to fin-batch-02 / operator: ses_nakada\n夜間売上取込が異常終了。後続の売上集計は待機中。',kind:'info'}],
 messages:{internal:[],customer:[]},timeline:[],events:[],unread:{internal:0,customer:0}};
}
function push(g,channel,sender,text){if(!text)return;if(sender==='鬼塚｜リーダー'&&!text.includes('承認する')&&g.timeline.some(m=>m.sender===sender&&m.text===text))return;const message={sender,text,time:g.minutes,channel};g.timeline.push(message);if(g.messages[channel]){g.messages[channel].push(message);if(sender!=='あなた')g.unread[channel]++;}}
function event(g,text){g.events.push({time:g.minutes,text});}
function progress(g){g.techIdle=0;g.techLevel=0;}
function fresh(g,key){if(!g.facts[key]){g.facts[key]=true;progress(g);}}
function emit(g,text,kind='info'){g.terminal.push({text,kind});push(g,'operations','操作結果',text);return text;}
function act(g){g.actions++;g.minutes++;}
export function start(g){if(g.started||g.dispatch)return;g.started=true;push(g,'internal','森｜監視','現場対応はあなた一人です。鬼塚さんと田山さんは遠隔参加、私は監視側から状況を共有します。');push(g,'internal','森｜監視','01:17 SALES_IMPORTがRC=12。ログは /logs/SALES_IMPORT.log。現地到着ありがとうございます。後続の売上集計は待機中です。');push(g,'internal','鬼塚｜リーダー','到着したな。電話に出るのがおせーんだよ。車内で状況は確認したよな？ まず、分かっている影響と次の対応を聞かせろ。実行判断は先に俺に確認してくれ。進展がない場合も90秒以内に報告しろ。');push(g,'customer','高橋｜顧客','売上取込の異常終了を検知しました。影響件数は何件ですか？ 復旧見込みはいつですか？ 朝の業務への影響も回答してください。未確定の点は未確定と分けて、75秒以内に一度ご連絡ください。');event(g,'現地対応開始');}
function urgentCall(g,reason){g.call=true;g.callSeen=true;g.callReason=reason;event(g,'操作直後に顧客から緊急着信');}
function penalty(g,text){urgentCall(g,'操作後にまた異常を検知しています。いま何をしたんですか。経緯と影響を説明してください。');g.mistakes++;g.trust=Math.max(0,g.trust-22);g.mental=Math.max(0,g.mental-20);event(g,text);push(g,'internal','鬼塚｜リーダー',text);}
export function requestApproval(g,target){
 if(g.ended||g.dispatch)return;act(g);push(g,'internal','あなた',target==='SALES_IMPORT'&&g.facts.checked&&g.facts.history?'当日ファイルの日付・形式・1,248件を確認し、当日処理履歴は0件でした。SALES_IMPORTを再実行してよいか、承認をお願いします。':target==='ACCOUNT_SYNC'?'私が誤停止したACCOUNT_SYNCを再開したいです。対象ジョブの再開を承認してください。':`${target}の再実行を承認してください。`);
 if(target==='SALES_IMPORT'){
  if(!(g.file&&g.facts.checked&&g.facts.history)){push(g,'internal','鬼塚｜リーダー','やって大丈夫と言える根拠は？ 失敗した場合の影響と、戻せるかどうかも整理してくれ。その説明ではまだ承認できない。');return;}
  if(g.lockEncountered&&!g.lockReleased){push(g,'internal','鬼塚｜リーダー','止まった要因がまだ残っているよな。状況が変わった根拠がないと承認できない。間違えたら説明するのは俺なんだよ。');return;}
  if(g.recovered){push(g,'internal','鬼塚｜リーダー','終わったって言わなかったか？ もう一回やる理由を説明してみろ。');return;}
 }else if(target==='ACCOUNT_SYNC'){
  if(!g.secondary){push(g,'internal','鬼塚｜リーダー','それ、問題が出てるやつなのか？ 関係ないものまで触る話は聞いてないぞ。');return;}
 }else return;
 if(!g.approved.has(target))progress(g);g.approved.add(target);event(g,`${target}の再実行承認`);push(g,'internal','鬼塚｜リーダー',`${target}の再実行を承認する。対象を取り違えるなよ。実行後の確認まで、お前の担当だ。`);
}
export function execute(g,raw){return withDialogue(g,{kind:'command'},()=>executeCore(g,raw));}
function executeCore(g,raw){
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
  if(g.secondary)return emit(g,'ACCOUNT_SYNCはすでに停止しています。','error');g.secondary=true;g.hadSecondary=true;g.internalReported=false;g.approved.delete('ACCOUNT_SYNC');penalty(g,'普段トロいのに、こういう時には慎重さに欠くのはなんでなんだ？');push(g,'customer','高橋｜顧客','口座同期まで止まっています。最初の障害と関係があるんですか？ 操作の経緯を説明してください。');return emit(g,'ACCOUNT_SYNC STOPPED / 追加障害が発生','error');
 }
 const rerun=c.match(/^job rerun (SALES_IMPORT|ACCOUNT_SYNC)$/i);
 if(rerun){const target=rerun[1].toUpperCase();const approval=g.approved.has(target);g.approved.delete(target);
  if(!approval){urgentCall(g,'本番バッチの再実行通知が来ました。いま実行したんですか？ 承認と影響確認は済んでいるんですよね？');g.mental=Math.max(0,g.mental-15);event(g,`${target}を無断で再実行`);push(g,'internal','鬼塚｜リーダー','その再実行、対象の話は分かったが俺はまだ承認していない。誰の判断で進めた？ 実行結果と影響を今すぐ報告して。');}
  if(target==='ACCOUNT_SYNC'){if(!g.secondary)return emit(g,'実行拒否：正常稼働中のジョブです。','error');g.secondary=false;progress(g);event(g,'追加障害を復旧');return emit(g,'ACCOUNT_SYNC RUNNING / 再開完了','success');}
  if(g.recovered){penalty(g,'処理済みのジョブをもう一回流したのか？ 金融で二重処理が何を意味するか分かってるな。二重処理につながる操作だ。');return emit(g,'DUPLICATE EXECUTION DETECTED','error');}
  if(!g.file){penalty(g,'また失敗か。いけると思ってやったんだよな？ で、今度はどうすんだ？');return emit(g,'SALES_IMPORT ABEND RC=12 / INPUT FILE NOT FOUND','error');}
  if(!g.facts.checked){penalty(g,'大丈夫かも分からないままやったのか？ その判断、どう説明するつもりだ？');return emit(g,'INPUT VALIDATION REQUIRED / 実行保留','error');}
  if(g.setbacks&&!g.lockReleased){g.lockEncountered=true;progress(g);event(g,'再実行がDBロックで失敗（更新0件・ロールバック済み）');push(g,'internal','森｜監視','今度はRC=28、DBロック待ちでタイムアウトです。更新は0件、ロールバックを確認しました。');emit(g,'SALES_IMPORT ABEND RC=28 / LOCK TIMEOUT / 0 rows committed','error');push(g,'internal','鬼塚｜リーダー','DBロックで止まったんだな。更新0件という報告は受け取った。復旧見込みに何が変わる？ 再実行は改めて確認してくれ。');return;}
  g.recovered=true;g.recoveredAt=g.minutes;progress(g);event(g,'売上取込と後続集計が正常終了');push(g,'internal','森｜監視','取込と後続の正常終了を検知しました。件数確認と顧客報告をお願いします。');return emit(g,'SALES_IMPORT NORMAL RC=0 / 1248 rows\n後続SALES_SUMMARYの正常終了を検知','success');
 }
 return emit(g,'未対応のコマンド・SQLです。候補から選んで編集できます。','error');
}
export class RuleBasedProvider {
 respond(g,channel,text,id){
  if(channel==='internal'){
   if(id==='internal-complete'){
    if(!g.recovered||!g.facts.summary||!g.facts.count||g.secondary)return '終わったって、何を根拠に言ってる？ 件数と影響まで説明できる状態なのか？';
    if(!g.internalReported){g.internalReported=true;progress(g);event(g,'社内へ復旧・入力とDBの1,248件一致・後続正常を報告');}
    return '取込と後続は正常、入力もDBも1,248件で一致、だな。その内容で顧客にも説明できるんだな？';
   }

   if(id==='escalate-file'){if(!g.fileRequested)return '一次連絡先への確認が先です。';if(g.file)return 'ファイルはすでに受信済みです。検証結果を確認してください。';g.file=true;g.fileDamaged=true;g.fileAt=g.minutes;progress(g);event(g,'二次連絡先からファイル再送（未検証）');return '二次連絡先につながりました。転送が途中で切れていたようです。ファイルを受信しましたが、内容はまだ未検証です。';}
   if(id==='wait-vendor')return 'まだ折り返しはありません。待っている間も後続集計は止まったままです。';
   if(id==='resend-file'){if(!g.mismatchSeen)return '再送の根拠がまだありません。まず受信ファイルを検証してください。';g.fileDamaged=false;g.mismatchSeen=false;g.facts.checked=false;g.facts.history=false;g.approved.delete('SALES_IMPORT');g.fileAt=g.minutes;progress(g);event(g,'欠損を連携元へ伝え、完全なファイルを再受信');return '欠損件数とチェックサム不一致を連携元に伝えました。完全なファイルを再受信しました。差し替えたので、内容と未処理状態を確認し直してください。';}
   if(id==='patch-file'){penalty(g,'勝手にデータを書き換えたのか？ お前、それで何かあったらどう説明するんだ？');return takeTayama(g,'patch',true);}
   if(id==='release-lock'){if(!g.lockInspected)return '保持元が分かっていない状態では解除できません。待機セッションを確認してください。';g.lockReleased=true;g.approved.delete('SALES_IMPORT');progress(g);event(g,'DB担当がREPORT_EXPORTの残存セッションを確認してロック解除');return 'DB担当に確認しました。REPORT_EXPORTは処理終了後のセッションだけが残っていました。担当側で終了し、ロック解除を確認しました。';}
   if(id==='critic-approval'){const issue=consultationIssue(g);if(!issue||consulted(g,issue))return '';g.tayamaConsulted=[...(g.tayamaConsulted||[]),issue];const reply=takeTayama(g,issue==='missing-row'?'consultMissing':'consultLock',true);if(reply){const damage=Math.min(5,g.mental);g.mental-=damage;g.tayamaMentalDamage=(g.tayamaMentalDamage||0)+damage;event(g,'田山に具体策を聞いたが一般論で返された（メンタル −'+damage+'）');}return reply;}
   if(id==='internal-status'){const stage=g.facts.files?'missing-file':'log';g.earlyInternalReports=[...(g.earlyInternalReports||[]),stage];return stage==='log'?'ログで未着エラーが出ていることと、受信状況は確認中という点は受け取った。調査は続けてくれ。顧客への説明も同時に頼む。':'当日ファイル未着、後続は待機中、連携元への確認が次の対応だな。その内容は受け取った。見通しが変わったら共有してくれ。';}
   if(id==='ack'){if(!g.ack){g.ack=true;progress(g);}return '分かった。で、どうすんだ？ お前の考えを聞いてるんだが。';}
   if(id==='request-file'){
    if(!g.facts.log||!g.facts.files)return 'ファイル未着と判断した根拠を確認してください。ログと受信ディレクトリの両方が必要です。';
    if(g.file)return '当日ファイルはすでに到着しています。検証を進めてください。';
    if(g.setbacks){if(!g.fileRequested){g.fileRequested=true;progress(g);event(g,'連携元の当番に連絡するも応答なし');}return '連携元の当番に電話しましたが応答がありません。ファイルは未着のままです。運用手順に二次連絡先があります。';}
    g.file=true;g.fileAt=g.minutes;progress(g);event(g,'連携元に確認し当日ファイル到着');return '連携元に確認しました。転送が遅延していました。当日ファイルが到着したので、内容と処理履歴を確認してください。';
   }
   return '自由入力の意図を特定できませんでした。初版では定型文か、対象を指定した承認ボタンを使ってください。';
  }
  if(['initial','progress-report','file-report'].includes(id)){
   // A delivered status update is a reply, even when the incident is unchanged.
   // Technical inactivity is tracked separately and is never reset here.
   const prompted=g.replyLevel>0;g.reported=true;g.replyIdle=0;g.replyLevel=0;
   if(id==='progress-report')g.correctionNeeded=false;
   if(prompted&&!g.customerReminderReplied){g.customerReminderReplied=true;return customerReply(g)+' 作業中なのは承知しておりますが、こちらから伺う前に共有いただけると助かります。こちらも社内に説明が必要ですので。';}
   return customerReply(g)+' 影響件数と復旧見込みは、根拠と未確定の点を分けて、更新があれば連絡してください。';
  }
  if(id==='complete'){
   if(!(g.recovered&&(!g.setbacks||g.lockReleased)&&g.facts.summary&&g.facts.count&&g.internalReported&&!g.secondary)){g.trust=Math.max(0,g.trust-12);event(g,'検証がそろう前に復旧報告');return 'まだ復旧完了として受け取れません。'+objectiveText(g);}
   g.replyIdle=0;finish(g,g.hadSecondary?'二次障害からの生還':g.mistakes||g.mental+(g.tayamaMentalDamage||0)<100||g.trust<85?'復旧したが要反省':'模範復旧');return '正常終了と件数一致を確認しました。対応ありがとうございました。操作経緯は報告書に残してください。';
  }
  return 'その報告だけでは状況を判断できません。初版では定型文で現状・次の対応を報告してください。';
 }
}
export function send(g,channel,text,id=null,provider=new RuleBasedProvider()){return withDialogue(g,{kind:'message',id,channel},()=>sendCore(g,channel,text,id,provider));}
function sendCore(g,channel,text,id=null,provider=new RuleBasedProvider()){
 if(g.ended||!text.trim())return;if(id==='critic-approval'&&(!consultationIssue(g)||consulted(g,consultationIssue(g))))return;if(!id){const command=parseCommandReport(text);if(command){execute(g,command);return;}}act(g);push(g,channel,'あなた',text.trim());
 if(!id){const c=text.replace(/\s+/g,'');if(channel==='internal'&&/^(当日ファイルの確認を連携元にお願いします|連携元に当日ファイルの確認をお願いします)[。！!]?$/u.test(c))id='request-file';}
 if(channel==='customer')push(g,'internal','あなた','顧客への報告内容を共有します。'+text.trim());
 const reply=provider.respond(g,channel,text,id);push(g,channel,channel==='internal'?(['patch-file','critic-approval'].includes(id)?'田山｜ベテラン':['request-file','escalate-file','wait-vendor','resend-file','release-lock'].includes(id)?'森｜監視':'鬼塚｜リーダー'):'高橋｜顧客',reply);
}
export function parseCommandReport(raw){
 const text=raw.trim();
 if(/(?:入力|実行)(?:していない|してません|していません|しません|しない|予定|したい)/u.test(text))return null;
 const quoted=text.match(/^[「『"]([\s\S]+)[」』"](?:のコマンド|のSQL)?を(?:入力|実行)しました[。.!！]?$/u);
 const plain=text.match(/^([\s\S]+?)(?:のコマンド|のSQL)?を(?:入力|実行)しました[。.!！]?$/u);
 const command=(quoted?.[1]||plain?.[1]||text).trim();
 return /^(?:job\s|tail\s|cat\s|ls\s|check\s|SELECT\s|help$)/i.test(command)?command:null;
}
function finish(g,title){if(g.ended||g.dispatch?.phase==='travelling')return;g.ended=true;g.result=title;event(g,title);}
export function tick(g,seconds){return withDialogue(g,{kind:'tick',seconds},()=>tickCore(g,seconds));}
function tickCore(g,seconds){
 if(!g.started||g.ended)return;g.clock+=seconds;g.techIdle+=seconds;g.replyIdle+=seconds;
 const t=Math.min(3,Math.floor(g.techIdle/90)),r=Math.min(3,Math.floor(g.replyIdle/75));
 if(t>g.techLevel){g.techLevel=t;g.mental=Math.max(0,g.mental-8);g.trust=Math.max(0,g.trust-8);g.minutes+=2;push(g,'internal','鬼塚｜リーダー',['','状況の共有を頼む。確認できたことと、まだ分からないことは分けてくれ。','進展がないまま時間が過ぎている。次の対応はどうすんだ？ こっちも説明しないといけないんだよ。','このまま任せ続ける判断はできない。担当を交代する。これ以上の操作は止めてくれ。'][t]);if(t===3)finish(g,'対応交代');}
 if(r>g.replyLevel&&!g.ended){g.replyLevel=r;g.mental=Math.max(0,g.mental-8);g.trust=Math.max(0,g.trust-8);g.minutes+=2;push(g,'customer','高橋｜顧客',['','作業を進めていただいているとは思いますが、こちらから確認する前に、一度ご連絡いただけるものと思っておりました。現状を共有いただけますか。','その後のご連絡がないため、お電話しました。作業と並行で大変かとは思いますが、ご連絡まで含めて対応いただけると助かります。','回答がありません。責任者に対応を引き継いでください。'][r]);push(g,'internal','森｜監視','顧客から進捗連絡の催促が来ています。メールの内容を共有します：'+['','「こちらから確認する前にご連絡いただけるものと思っていた」とのことです。','作業と並行して、連絡まで含めて対応してほしいとのことです。','責任者への引き継ぎを求められています。'][r]);if(r===2){g.call=true;}if(r===3)finish(g,'対応交代');}
 if(g.clock>=25&&!g.callSeen){g.callSeen=true;g.call=true;}
}
export function answerCall(g,choice){return withDialogue(g,{kind:'call',choice,urgent:g.callReason},()=>answerCallCore(g,choice));}
function answerCallCore(g,choice){
 if(g.ended&&!g.callReason)return;const urgent=g.callReason;act(g);g.call=false;g.callReason=null;
 if(urgent)push(g,'customer','高橋｜顧客','【緊急電話】'+urgent);
 const text=choice==='ignore'?'電話には応答せず、メールで対応します。':choice==='promise'?'電話で5分以内の復旧を約束しました。':`電話で現状を説明しました。${customerStatusText(g)}`;
 push(g,'customer','あなた',text);
 if(choice==='ignore'){g.trust=Math.max(0,g.trust-5);push(g,'customer','高橋｜顧客','電話に出られないなら、メールで状況を報告してください。');}
 else if(choice==='promise'){g.correctionNeeded=true;g.mental=Math.max(0,g.mental-10);g.trust=Math.max(0,g.trust-15);push(g,'customer','高橋｜顧客','5分で復旧する根拠は何ですか。原因と手順は確認済みですか。');}
 else{g.callAnswered=true;g.replyIdle=0;g.replyLevel=0;push(g,'customer','高橋｜顧客',urgent?'経緯は聞きました。勝手な判断で影響を広げられては困ります。確認できた結果を必ず報告してください。':'現在の確認状況、承知しました。残っている作業の結果が分かったら報告してください。');}
 push(g,'internal','あなた',choice==='promise'?'顧客に5分以内の復旧を約束しましたが、根拠を問われています。':choice==='ignore'?'顧客の電話には応答しませんでした。メールで状況を伝える必要があります。':'電話対応の共有です。'+customerStatusText(g));event(g,'顧客の電話に対応');
 push(g,'internal','鬼塚｜リーダー',choice==='ignore'?'電話を取らないなら、メールを先に出せ。無応答のまま放置して信用を落とすな。':choice==='promise'?'その5分、何を根拠に言ってる？ 顧客に伝えていい数字なのか。後から違いましたじゃ済まない。根拠がないなら訂正してくれ。':'確認できた事実と残っている点は伝わったな。その説明は受け取った。次の進展があったら共有してくれ。');

}
export function time(g){return `${String(Math.floor(g.minutes/60)).padStart(2,'0')}:${String(g.minutes%60).padStart(2,'0')}`;}
function consultationIssue(g){return g.mismatchSeen?'missing-row':g.lockEncountered&&!g.lockReleased&&g.lockInspected?'db-lock':null;}
function consulted(g,issue){return Array.isArray(g.tayamaConsulted)&&g.tayamaConsulted.includes(issue);}

function baseChoices(g){
 if(!g.started||g.ended||g.dispatch)return [];
 const command=(label,cmd)=>({label,type:'command',command:cmd,detail:'操作を実施したと報告'});
 const approval=target=>({label:`${target}の再実行をリーダーに確認する`,type:'approval',target,detail:'社内へ確認'});
 const mail=(label,id,text)=>({label,type:'message',channel:'customer',id,text,detail:'顧客へメール'});
 const stop=command('別系統のACCOUNT_SYNCを停止したと報告する','job stop ACCOUNT_SYNC');
 const rerun=command('SALES_IMPORTを再実行したと報告する','job rerun SALES_IMPORT');
 const initial=mail('調査中と伝え、確認が進み次第の報告を約束する','initial','現在調査中です。影響を確認し、確認が進み次第、状況と次の対応を報告します。');
 const complete=mail('正常終了と件数一致を報告して対応を終える','complete','売上取込・後続集計の正常終了と1,248件の一致を確認しました。復旧を報告します。');
 const file=mail('影響件数と復旧見込みを、確認できた根拠で報告する','file-report',customerStatusText(g));
 const msg=(label,id,text)=>({label,type:'message',channel:'internal',id,text,detail:'社内へ連絡'});
 const internalStage=g.facts.files?'missing-file':'log';
 const internalUpdate=msg(g.facts.files?'当日ファイル未着と連携元への確認方針を鬼塚に報告する':'ログの未着エラーと、これから受信一覧を調べる方針を報告する','internal-status',g.facts.files?'ログと受信一覧で当日ファイル未着を確認しました。後続集計は待機中です。転送遅延の理由と到着見込みは未確認のため、次に連携元へ確認します。':'ログに当日ファイル未着のエラーが出ています。受信一覧はまだ未確認です。次に実際の到着状況を確認します。');
 const sideCheck=!g.facts.status?command('ジョブ一覧で後続と別系統の稼働状況を確認する','job status'):command('SQLで当日の処理履歴を先に確認する',"SELECT * FROM batch_history WHERE business_date = '20261012';");
 const earlyReport=(g.earlyInternalReports||[]).includes(internalStage)?sideCheck:internalUpdate;
 const issue=consultationIssue(g);
 const critic=consulted(g,issue)?(issue==='missing-row'?file:command('SQLでロック待ちと保持元を再確認する',"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';")):msg('田山に具体的な対応案を聞く','critic-approval',issue==='missing-row'?'件数が1件不足し、チェックサムも不一致です。田山さん、具体的にはどう対応するのがよいでしょうか？':'DBロックで再実行が止まりました。保持元はREPORT_EXPORTで、更新0件・ロールバック済みです。田山さん、具体的にはどう進めるのがよいでしょうか？');
 if(!g.secondary&&g.setbacks){
  if(g.lockEncountered&&!g.lockReleased)return g.lockInspected?[msg('保持元をDB担当に伝え、解除可否を確認する','release-lock','保持元はREPORT_EXPORTのSESSION 812です。更新0件・ロールバック済みです。担当側で状態確認と解除をお願いします。'),rerun,critic]:[command('SQLでロック待ちと保持元セッションを調べる',"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';"),rerun,stop];
  if(g.mismatchSeen)return [msg('件数不一致とチェックサムを伝え、完全なファイルを再送依頼する','resend-file','1件欠損しチェックサムも不一致です。完全なファイルを再送してください。'),msg('自分の判断で、欠損した1件を手で補う','patch-file','欠損した1件を手で補いました。これで進めます。'),critic];
  if(g.fileRequested&&!g.file)return [msg('手順書の二次連絡先へエスカレーションする','escalate-file','一次連絡先が応答しません。手順書にある二次連絡先へ確認してください。'),msg('折り返しを待ち、連絡状況を確認する','wait-vendor','折り返しはありましたか。引き続き一次連絡先の応答を待ちます。'),rerun];
 }
 if(g.secondary)return g.approved.has('ACCOUNT_SYNC')?[command('ACCOUNT_SYNCを再開したと報告する','job rerun ACCOUNT_SYNC'),complete,command('ジョブ一覧を確認したと報告する','job status')]:[approval('ACCOUNT_SYNC'),command('ACCOUNT_SYNCを無断で再開したと報告する','job rerun ACCOUNT_SYNC'),complete];
 if(!g.facts.log)return [command('異常終了したジョブのログを確認したと報告する','tail -n 30 /logs/SALES_IMPORT.log'),g.reported?stop:initial,rerun];
 if(!g.facts.files)return [command('受信ファイルの一覧を確認したと報告する','ls -l /data/inbox'),earlyReport,g.reported?stop:mail('未着エラーを確認中と顧客へ初報を送る','initial','ログでは当日ファイル未着のエラーを確認しました。実際の受信状況と影響件数は調査中です。次に受信一覧を確認します。')];
 if(!g.file)return [{label:'連携元に当日ファイルの確認を依頼する',type:'message',channel:'internal',id:'request-file',text:'当日ファイルの確認を連携元にお願いします。',detail:'社内へ連絡'},earlyReport,mail('当日ファイル未着と、連携元への確認予定を顧客に伝える','file-report',customerStatusText(g))];
 if(!g.facts.checked)return [command('到着した当日ファイルを検証したと報告する','check /data/inbox/sales_20261012.csv'),command('投入前にSQLで当日の処理履歴を確認する',"SELECT * FROM batch_history WHERE business_date = '20261012';"),mail('ファイル受信済み・内容は未検証と顧客に伝える','file-report',customerStatusText(g))];
 if(!g.facts.history)return [command('SQLで当日の処理履歴を確認したと報告する',"SELECT * FROM batch_history WHERE business_date = '20261012';"),rerun,stop];
 if(!g.recovered)return g.approved.has('SALES_IMPORT')?[rerun,file,stop]:[approval('SALES_IMPORT'),{...rerun,label:'承認を取らずSALES_IMPORTを再実行したと報告する'},file];
 if(!g.facts.summary)return [command('後続の売上集計を確認したと報告する','job status SALES_SUMMARY'),complete,rerun];
 if(!g.facts.count)return [command('SQLで当日の処理件数を確認したと報告する',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';"),complete,stop];
 if(!g.internalReported)return [msg('社内に復旧・1,248件一致・後続正常を報告する','internal-complete','SALES_IMPORTと後続SALES_SUMMARYの正常終了を確認しました。入力1,248件とDB登録1,248件が一致しています。社内へ復旧を報告します。'),complete,command('処理件数をもう一度確認する',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';")];
 return [complete,command('後続ジョブの状態をもう一度確認する','job status SALES_SUMMARY'),rerun];
}
export function chooseAction(g,choice){
 if(g.dispatch||!choice||!nextChoices(g).some(c=>JSON.stringify(c)===JSON.stringify(choice)))return;
 if(g.facts.files&&!g.recovered&&!g.upperReportRequested){g.upperReportRequested=true;event(g,'上席から状況報告の要求');push(g,'internal','森｜監視','上席から状況報告を求められました。判明している影響、未確認事項、次の対応を共有してください。');push(g,'internal','鬼塚｜リーダー','今、上から状況を聞かれてる。分かってることだけでいいから整理して。未確認の点は分けてくれ。');}
 const before=g.timeline.length;
 const reportState=progressText(g);
 const repeatedReport=choice.channel==='customer'&&['file-report','progress-report','initial'].includes(choice.id)&&g.lastPlayerReport===reportState;

 if(choice.type==='command')send(g,'internal',`「${choice.command}」を入力しました。`);
 else if(choice.type==='approval')requestApproval(g,choice.target);
 else send(g,choice.channel,choice.text,choice.id);
 if(g.dispatch)return;
 if(['request-file','escalate-file','wait-vendor','resend-file','release-lock','critic-approval'].includes(choice.id)||!g.timeline.slice(before).some(m=>m.sender==='鬼塚｜リーダー'))push(g,'internal','鬼塚｜リーダー',variedFeedback(g,choice));
 if(choice.channel==='customer'&&['file-report','progress-report','initial'].includes(choice.id))g.lastPlayerReport=reportState;
 
 if(!g.ended&&(repeatedReport||['wait-vendor','patch-file','complete'].includes(choice.id)))colleagueAdvance(g,choice,repeatedReport);
}
function leaderFeedback(g,choice){
 const c=choice.command||'';
 if(choice.id==='complete')return g.ended?'顧客への復旧報告まで受け取った。上席にもこの結果を返す。操作経緯は報告書に残してくれ。':'まだ完了として受け取れないと返っているな。確認済みの事実と、残っている点を分けて報告して。';
 if(choice.channel==='customer')return '確認できた事実と、まだ確定していない点は受け取った。その内容で説明しよう。次の進展があったら共有してくれ。';
 if(g.secondary)return '口座同期の追加影響もある。売上取込とは分けて説明が必要だ。再開の結果を報告して。';
 if(g.recovered){
  if(!g.facts.summary)return '取込の正常終了は受け取った。後続についても確認した結果が欲しい。顧客に完了と言える状態か、整理して。';
  if(!g.facts.count)return '後続の正常終了も確認できたな。入力と処理の件数は合っている？ そこまで含めて報告してくれ。';
  if(!g.internalReported)return '1,248件の一致まで確認できたな。社内向けにも復旧結果をまとめて。俺から上に返す説明が必要なんだ。';
  return '社内の復旧報告は受け取っている。残る顧客への連絡を頼む。';
 }
 if(choice.id==='critic-approval')return g.mismatchSeen?'田山さんの話は分かった。で、この欠損に対してお前はどうするつもりなんだ？':'一般的な話は分かった。今のロックに対して、担当としてどう進めたいんだ？';
 if(choice.id==='wait-vendor')return '連絡がつかないのは分かった。このまま待つ判断で、朝の業務への影響はどう説明する？';
 if(choice.id==='request-file')return g.file?'受信したんだな。まだ正常に処理できると決まったわけではないな。見通しが変わったら知らせて。':'連絡先が応答しないんだな。復旧時刻はまだ出せないとして、次の対応はどうすんだ？';
 if(choice.id==='resend-file'||choice.id==='escalate-file')return '受信したという事実は受け取った。未確認のまま復旧見込みを確約しないでくれ。';
 if(choice.id==='release-lock')return '解除の報告は受け取った。実行判断は改めて俺に確認してくれ。影響まで説明できる状態で頼む。';
 if(c.startsWith('check')&&g.fileDamaged)return '受信データに問題があるんだな。いま分かった範囲でいい。朝の業務への影響と次の対応を聞かせて。';
 if(c.includes('session_locks'))return '保持元と更新0件は分かった。次に誰へ確認する判断なのか、そこまで共有してくれ。';
 if(c.startsWith('tail'))return g.lockEncountered?'ロックで停止している状況は受け取っている。見通しが変わる情報が出たら共有して。':'ログの確認は分かった。後続集計が待機している間、顧客には今、何て説明する？ 調査と並行して考えてくれ。';
 if(c.startsWith('ls'))return g.file?'ファイルの受信状況は分かった。確認できたことと、これから確認することを分けておいて。':'当日分が見当たらないんだな。後続への影響も含めて、今ある事実で説明していこう。';
 if(c.startsWith('check')||c.includes('batch_history'))return 'その確認結果は受け取った。実行するなら、対象と根拠をそろえて俺に確認してくれ。';
 return '報告は受け取った。次の対応と影響の見通しが変わったら共有してくれ。';
}

export function progressText(g){
 if(g.secondary)return '売上取込とは別に、私の操作でACCOUNT_SYNCを停止しました。再開確認と復旧を進めます。';
 if(g.recovered){if(!g.facts.summary)return '売上取込は正常終了しました。後続の状態と処理件数の確認を進めています。';if(!g.facts.count)return '売上取込と後続の正常終了を確認しました。処理件数は確認中です。';return g.internalReported?'売上取込と後続の正常終了、1,248件の一致を社内へ報告済みです。顧客への復旧報告を進めています。':'売上取込と後続の正常終了、1,248件の一致を確認しました。復旧報告をまとめています。';}
 if(g.lockEncountered&&!g.lockReleased)return 'ファイル不備は解消しましたが、再実行がDBロックで停止しました。更新0件・ロールバック済みで、保持元の確認と解除を進めています。';
 if(g.fileDamaged)return g.mismatchSeen?'受信ファイルに1件欠損とチェックサム不一致があり、投入を止めています。完全なファイルの再送が必要です。':'連携元の二次連絡先につながりファイルを受信しました。まだ内容は未検証です。';
 if(g.fileRequested&&!g.file)return '連携元の一次連絡先が応答せず、ファイルは未着です。別の連絡経路で確認を進めます。';
 if(g.lockReleased&&!g.recovered)return g.approved.has('SALES_IMPORT')?'DB担当によるロック解除を確認し、再実行の再承認を得ました。再実行はこれからです。':'DB担当によるロック解除を確認しました。再実行はまだ行っておらず、再承認を取ります。';
 if(g.file){if(g.approved.has('SALES_IMPORT'))return '当日ファイルの検証と未処理確認が完了し、再実行の承認を得ました。これから実行します。';if(g.facts.checked&&g.facts.history)return '当日ファイルの検証と未処理確認が完了しました。再実行の承認を取ります。';return '連携元の転送遅延で当日ファイルが未着でした。現在は到着し、内容と処理履歴を確認しています。';}
 if(g.facts.log&&g.facts.files)return '当日ファイルが未着です。連携元に転送状況を確認する段階で、復旧見込みはまだ未定です。';
 return '売上取込が異常終了し、後続集計は待機中です。原因と朝の業務への影響を調査しています。';
}
export function nextChoices(g){
 const choices=baseChoices(g);if(!choices.length)return choices;
 if(g.correctionNeeded||g.replyIdle>=60){choices[2]={label:g.correctionNeeded?'根拠のない復旧時刻を訂正し、現在の状況を伝える':'顧客に現在の確認状況と、次の対応を報告する',type:'message',channel:'customer',id:'progress-report',text:(g.correctionNeeded?'先ほどの5分以内の復旧見込みは根拠がなく、訂正します。':'')+customerStatusText(g),detail:'顧客へメール'};}
 if(g.setbacks){const offset=g.actions%3;return [...choices.slice(offset),...choices.slice(0,offset)];}
 return choices;
}

// Topics represent distinct points, not interchangeable paraphrases. Exhaustion is silence.
const tayamaLines={
 dispatch:[['remoteOnly','現場で直接確認いただくのが確実ですね。私もチャットでは確認できますので。']],
 investigation:[['flow','個別のエラーだけでなく、全体の流れも見ておいた方がいいですね。原因の切り分けと影響の確認は、別の話ですので。']],
 vendor:[['coordination','連携障害は技術だけでは片付かないんですよね。今の連絡体制でどこまで動けるかは、担当の皆さんで整理いただければ。']],
 mismatch:[['integrity','件数差が小さくても、整合性の問題は残りますね。転送でこういうことは起こり得ます。受信できたことと、中身が正しいことは別ですので。']],
 lock:[['dependencies','ロック競合はこの構成だと起こり得ますね。ファイルが正常でも、別の要因で止まることはありますので。']],
 wrongJob:[['scope','対象が違えば、影響範囲も変わりますからね。結果論にはなりますが、操作対象の認識がそろっていなかった印象です。']],
 failed:[['readiness','その状態では実行が通らない可能性はありましたね。結果が出た後に言うのも何ですが、少し判断を急いだ印象です。']],
 unauthorized:[['authority','結果とは別に、実施判断の経緯は残りますからね。進めてよいかどうかまで、私から申し上げられる話ではないですが。']],
 patch:[['dataOwnership','手修正を承認したわけではないので、その点は切り分けていただきたいですね。データの正当性は、修正された方から説明いただく必要があるかと。']],
 consultMissing:[['missingPlan','まず、受信データの正当性を確保することが重要ですね。件数だけ合えばよいという話でもありませんので。\n\nただ、現物を確認されているのはそちらです。具体的な進め方は、担当として整理いただくのがよいかと。']],
 consultLock:[['lockPlan','処理同士の依存関係と、他の処理への影響を分けて考える必要がありますね。止まっている処理だけを見て判断できる話ではありませんので。\n\nどこまで影響を許容するかも含め、担当としての案を鬼塚さんに確認いただくのがよいかと思います。']],
 validated:[['validationCredit','検証結果がそろってきましたね。私も、こうして確認を積み重ねる方向がよいと思っていました。実行結果はまた別ですが。']],
 recovered:[['recoveryCredit','正常終了まで進みましたね。こういう場面で慎重に進められるのは、チームで状況を見てきたからだと思います。']],
 customer:[['communication','先方が不安になるのも分かります。確定していることと確認中のことを、どう伝えるかも重要ですね。'],['expectations','技術的な状況だけでなく、先方の受け止め方もありますからね。約束として受け取られる表現には気を配る必要があるかと。']],
 retrospective:[['review','最終的には復旧できましたね。今回の進め方を次に生かすことが大事だと思います。経緯の整理をお願いします。']]
};
function tayamaMemory(g){
 const history=g.timeline.filter(m=>m.sender==='田山｜ベテラン');
 const used=new Set(Array.isArray(g.tayamaUsed)?g.tayamaUsed.filter(x=>typeof x==='string'):[]);
 if(typeof g.tayamaLastKind!=='string'){const last=history.at(-1)?.text;g.tayamaLastKind=Object.entries(tayamaLines).find(([,lines])=>lines.some(([,text])=>text===last))?.[0]||null;}
 for(const [kind,lines] of Object.entries(tayamaLines))for(const [topic,text] of lines)if(history.some(m=>m.text===text))used.add(kind+':'+topic);
 // Old saves have no IDs. Retire equivalent old observations instead of repeating them.
 const legacy={investigation:/全体最適/,vendor:/連携障害/,mismatch:/データの整合性/,lock:/ロック競合/,patch:/手修正の判断を承認/};
 for(const [kind,re] of Object.entries(legacy))if(history.some(m=>re.test(m.text)))for(const [topic] of tayamaLines[kind])used.add(kind+':'+topic);
 g.tayamaUsed=[...used];return used;
}
function takeTayama(g,kind,direct=false){
 const used=tayamaMemory(g),lines=tayamaLines[kind]||[];
 if(!direct&&g.tayamaLastAction!==undefined&&g.actions-g.tayamaLastAction<2)return '';
 const row=lines.find(([topic,text])=>!used.has(kind+':'+topic)&&g.tayamaLastKind!==kind&&!g.timeline.some(m=>m.sender==='田山｜ベテラン'&&m.text===text));
 if(!row)return '';
 g.tayamaUsed.push(kind+':'+row[0]);g.tayamaLastKind=kind;g.tayamaLastAction=g.actions;g.criticCount++;
 return row[1];
}
function criticComment(g,context,before){
 if(g.dispatch)return;
 if(g.timeline.length===before.messages)return;
 if((!before.secondary&&g.secondary)||g.terminal.slice(before.terminal).some(t=>t.text==='DUPLICATE EXECUTION DETECTED'))return;
 const freshEvents=g.events.slice(before.events).map(e=>e.text);
 let kind;
 if(context.id==='patch-file'||context.id==='critic-approval')return; // Direct replies are handled by the provider.
 if(g.ended){if(g.recovered&&g.internalReported&&!g.secondary&&g.result!=='対応交代')kind='retrospective';}
 else if(!before.secondary&&g.secondary)kind='wrongJob';
 else if(g.mistakes>before.mistakes)kind='failed';
 else if(freshEvents.some(e=>e.includes('無断で再実行')))kind='unauthorized';
 else if(!before.mismatchSeen&&g.mismatchSeen)kind='mismatch';
 else if(!before.lockEncountered&&g.lockEncountered)kind='lock';
 else if(!before.recovered&&g.recovered)kind='recovered';
 else if(!before.checked&&g.facts.checked)kind='validated';
 else if(context.kind==='call'&&(context.choice==='promise'||context.urgent))kind='customer';
 else if(context.kind==='tick'&&g.replyLevel>before.replyLevel)kind='customer';
 else if(!before.fileRequested&&g.fileRequested)kind='vendor';
 else if(!before.log&&g.facts.log)kind='investigation';
 if(kind)push(g,'internal','田山｜ベテラン',takeTayama(g,kind,['wrongJob','failed','unauthorized','mismatch','lock','retrospective'].includes(kind)));
}
// Only the outer action comments: a chat command invokes execute internally.
let dialogueDepth=0;
function withDialogue(g,context,run){
 if(g.dispatch){if(context.kind==='tick')advanceDispatch(g,context.seconds);return;}
 const outer=dialogueDepth===0;
 const before={terminal:g.terminal.length,messages:g.timeline.length,events:g.events.length,secondary:g.secondary,mistakes:g.mistakes,mismatchSeen:g.mismatchSeen,lockEncountered:g.lockEncountered,recovered:g.recovered,checked:g.facts.checked,replyLevel:g.replyLevel,fileRequested:g.fileRequested,log:g.facts.log};
 dialogueDepth++;
 try{return run();}finally{dialogueDepth--;if(outer){criticComment(g,context,before);assessDanger(g,context,before);}}
}

function assessDanger(g,context,before){
 if(g.dispatch||g.ended)return;
 const recent=g.events.slice(before.events);
 const duplicate=g.terminal.slice(before.terminal).some(t=>t.text==='DUPLICATE EXECUTION DETECTED');
 const unauthorized=recent.some(e=>e.text==='SALES_IMPORTを無断で再実行');
 if(unauthorized)g.dangerActions.push({kind:'unauthorized',operation:'job rerun SALES_IMPORT',time:g.minutes});
 if(!before.secondary&&g.secondary){
  beginDispatch(g,'job stop ACCOUNT_SYNC','正常稼働中の別系統ACCOUNT_SYNCを停止し、売上取込とは別の障害を発生させた。','wrong-job');
 }else if(duplicate){
  beginDispatch(g,'job rerun SALES_IMPORT','正常終了済みの売上取込を再実行し、金融データの二重処理につながる危険な操作を行った。','duplicate');
 }else if(context.id==='patch-file'&&g.mistakes>before.mistakes){
  beginDispatch(g,'欠損した1件を独断で手修正','正本との整合性を確認せず金融データを変更し、データの正当性を損なう操作を行った。','data-edit');
 }else if(unauthorized&&g.dangerActions.filter(a=>a.kind==='unauthorized').length>=2){
  beginDispatch(g,'job rerun SALES_IMPORT（無承認で繰り返し実行）','承認を取るよう指摘された後も無承認で本番バッチを再実行し、操作を任せ続けられないと判断された。','repeated-unauthorized');
 }
}
function beginDispatch(g,operation,reason,kind){
 if(g.dispatch||g.ended)return;
 g.dispatch={phase:'travelling',remaining:3,operation,reason,kind};
 g.dangerActions.push({kind,operation,time:g.minutes});
 // Departure owns the ending: dismiss the urgent-call branch and freeze all work.
 g.call=false;g.callReason=null;
 event(g,'鬼塚が出動：'+operation+'／'+reason);
 if(kind==='repeated-unauthorized')push(g,'internal','鬼塚｜リーダー','承認前に実行するなと伝えた後も、SALES_IMPORTを無断で再実行したな。これ以上、操作を任せ続ける判断はできない。');
 push(g,'internal','鬼塚｜リーダー','……もういい。そこから何も触るな。');
 push(g,'internal','鬼塚｜リーダー','今からタクシーで向かう。');
 push(g,'internal','田山｜ベテラン',takeTayama(g,'dispatch',true));
 push(g,'internal','システム','鬼塚がタクシーで移動中です。通常操作を停止しました。');
}
export function advanceDispatch(g,seconds){
 if(g.dispatch?.phase!=='travelling'||g.ended||!Number.isFinite(seconds)||seconds<=0)return;
 g.dispatch.remaining=Math.max(0,g.dispatch.remaining-seconds);
 if(g.dispatch.remaining>0)return;
 g.dispatch.phase='arrived';
 g.endingStart=g.timeline.length;g.endingVisible=g.endingStart;
 finish(g,'対応交代'); // Arrival is final; the remaining messages are presentation only.
 onsiteMessage(g,'システム','タクシーが現場に到着しました',400);
 onsiteMessage(g,'鬼塚｜リーダー','お前は一体何ならできるんだ？',650);
 onsiteMessage(g,'鬼塚｜リーダー','……ライブラリアンさえやってくれたらいいから',1500);
 onsiteMessage(g,'システム','〜完〜',1000);

}

function onsiteMessage(g,sender,text,pauseBefore){push(g,'internal',sender,text);Object.assign(g.timeline.at(-1),{presentation:'onsite',pauseBefore});}

export function messageSurface(message){return message.channel==='customer'?'customer':'teams';}

export function objectiveText(g){
 if(g.dispatch)return g.dispatch.phase==='travelling'?'鬼塚がタクシーで移動中です。操作を停止し、そのまま待機してください。':'鬼塚が現場に到着。担当交代となりました。';
 if(g.secondary)return 'ACCOUNT_SYNCの再開と正常稼働の確認が残っています。';
 if(g.recovered){
  if(!g.facts.summary)return '売上取込は正常終了。後続の売上集計の確認が残っています。';
  if(!g.facts.count)return '売上取込・後続とも正常終了。SQLで処理件数の確認が残っています。';
  if(!g.internalReported)return '復旧確認は完了。社内に正常終了・入力とDBの1,248件一致を報告します。';
  return '復旧確認は完了。顧客へ「正常終了と件数一致」を報告して対応を終了します。';
 }
 if(g.lockEncountered&&!g.lockReleased)return g.lockInspected?'ロック保持元は特定済み。DB担当への解除依頼が残っています。':'再実行はDBロックで失敗。SQLでロック保持元を調べる段階です。';
 if(g.lockReleased)return g.approved.has('SALES_IMPORT')?'ロック解除・再承認は完了。SALES_IMPORTの再実行が残っています。':'ロック解除は完了。再実行には改めてリーダー確認が必要です。';
 if(g.mismatchSeen)return '受信データが1件欠損。完全なファイルの再送が必要です。';
 if(g.fileRequested&&!g.file)return '一次連絡先は応答なし。手順書の二次連絡先に確認できる状態です。';
 if(!g.facts.log)return '異常終了したジョブのログを確認します。';
 if(!g.facts.files)return '受信ファイルの一覧を確認します。';
 if(!g.file)return '当日ファイルが未着。連携元への確認が必要です。';
 if(!g.facts.checked)return '受信したファイルの内容検証が残っています。';
 if(!g.facts.history)return 'ファイル検証は完了。SQLで当日の処理履歴を確認します。';
 return g.approved.has('SALES_IMPORT')?'検証・承認は完了。SALES_IMPORTの再実行が残っています。':'検証は完了。再実行する対象と根拠をリーダーに確認します。';
}
function customerReply(g){
 if(g.recovered)return '正常終了の報告、承知しました。'+objectiveText(g);
 if(g.secondary)return '追加障害について承知しました。口座同期も含めた復旧状況を報告してください。';
 if(g.lockEncountered&&!g.lockReleased)return '再実行がDBロックで停止した状況、承知しました。まだ復旧していないものとして扱います。';
 if(g.lockReleased)return g.approved.has('SALES_IMPORT')?'ロック解除と再実行承認まで完了、承知しました。実行後の結果を報告してください。':'ロック解除、承知しました。再実行はまだ行っていないという理解です。';
 if(g.fileDamaged)return g.mismatchSeen?'ファイル欠損で投入を止めている状況、承知しました。':'受信済み・内容未検証、承知しました。';
 if(g.approved.has('SALES_IMPORT'))return '検証と再実行承認まで完了、承知しました。実行後の結果を報告してください。';
 if(g.file)return 'ファイル到着、承知しました。復旧作業の結果を報告してください。';
 return '現在の確認状況、承知しました。状況が変わり次第、続報をお願いします。';
}

function variedFeedback(g,choice){
 const text=leaderFeedback(g,choice);
 // Rechecking a safe fact warrants silence, not a random reprimand.
 const last=g.timeline.findLast(m=>m.sender==='鬼塚｜リーダー')?.text;
 return last===text?'':text;
}

function colleagueAdvance(g,choice,repeatedReport){
 if(g.dispatch||g.ended)return;
 const next=baseChoices(g)[0];if(!next)return;
 const reason=repeatedReport?'同じ報告を繰り返してどうする。状況が変わってないだろ。':choice.id==='wait-vendor'?'待ってるだけじゃ朝になるぞ。森、そっちで進めてくれ。':choice.id==='complete'?'確認も終わってないのに完了って言ったのか。森、残りを引き取ってくれ。':choice.id==='patch-file'?'その場しのぎで増やした手間、誰が片付けるんだ。森、頼む。':'もう確認したことを繰り返してるぞ。森、先へ進めてくれ。';
 push(g,'internal','鬼塚｜リーダー',reason);
 g.assistCount=(g.assistCount||0)+1;g.mistakes++;g.mental=Math.max(0,g.mental-10);g.trust=Math.max(0,g.trust-6);
 event(g,'停滞した対応を森が引き取り、次の作業を代行（信用 −6・メンタル −10）');
 push(g,'internal','森｜監視','こちらで次の対応を引き取ります。'+(next.type==='approval'?'対象と確認結果を整理して、鬼塚さんに承認を取ります。':next.type==='command'?'「'+next.command+'」を実施します。':next.channel==='customer'?'確認結果をまとめて顧客へメールします。':next.text));
 const from=g.timeline.length;
 if(next.type==='command')execute(g,next.command);
 else if(next.type==='approval')requestApproval(g,next.target);
 else send(g,next.channel,next.text,next.id);
 // Preserve the actual actor, including the separate customer contact history.
 for(const message of g.timeline.slice(from))if(message.sender==='あなた')message.sender='森｜監視';
 if(!g.ended&&!g.dispatch)push(g,'internal','森｜監視','ここまで私のほうで対応しました。続きの判断をお願いします。');
}

export function customerStatusText(g){
 const impact=g.facts.checked||g.facts.count?'今回の売上取込の遅延対象は1,248件です。これは取引データ件数で、利用者数は未確定です。':g.mismatchSeen?'連携元の申告は1,248件ですが、受信データが1件欠損しています。影響件数は正本と突合して確定します。':'影響件数は調査中で、現時点では確定していません。';
 const estimate=g.recovered?(g.facts.summary&&g.facts.count?'取込と後続の復旧、処理件数の一致まで確認済みです。':'取込は正常終了しましたが、復旧完了時刻は後続と件数の確認後に確定します。'):g.lockEncountered&&!g.lockReleased?'DBロックが解消しておらず、復旧時刻は未定です。':g.fileRequested&&!g.file?'ファイルの到着時刻が未定のため、復旧時刻も未定です。':'残作業の完了を確認していないため、復旧時刻はまだ確約できません。';
 return progressText(g)+' '+impact+' '+estimate+(g.secondary?' 口座同期の追加影響件数は別途調査中です。':'');
}

export function serializeGame(g){
 return JSON.stringify({version:1,game:{...g,approved:[...g.approved]}});
}
export function restoreGame(raw){
 try{
  const saved=JSON.parse(raw);if(saved?.version!==1)return null;
  const data=saved.game;
  if(!data||data.started!==true||typeof data.ended!=='boolean'||!Array.isArray(data.approved)||data.approved.some(x=>!['SALES_IMPORT','ACCOUNT_SYNC'].includes(x)))return null;
  if(!data.facts||!Array.isArray(data.timeline)||!Array.isArray(data.events)||!Array.isArray(data.terminal))return null;
  for(const key of ['minutes','trust','mental','actions','clock','techIdle','replyIdle'])if(!Number.isFinite(data[key])||data[key]<0)return null;
  if(data.trust>100||data.mental>100)return null;
  if(data.timeline.some(m=>!m||typeof m.sender!=='string'||typeof m.text!=='string'||!Number.isFinite(m.time)||!['internal','customer','operations'].includes(m.channel)))return null;
  const defaults=createGame();
  const g={...defaults,...data,facts:{...defaults.facts,...data.facts},approved:new Set(data.approved)};
  if(!Array.isArray(g.dangerActions))g.dangerActions=[];
  if(data.dangerActions===undefined)g.dangerActions=g.events.filter(e=>e.text==='SALES_IMPORTを無断で再実行').map(e=>({kind:'unauthorized',operation:'job rerun SALES_IMPORT',time:e.time}));
  if(g.dispatch){
   const d=g.dispatch;
   if(!['travelling','arrived'].includes(d.phase)||typeof d.operation!=='string'||typeof d.reason!=='string'||!Number.isFinite(d.remaining)||d.remaining<0)return null;
   g.call=false;g.callReason=null;g.ended=d.phase==='arrived';g.result=g.ended?'対応交代':null;
  }
  // Both histories must point at the same messages when a colleague takes over.
  g.messages={internal:g.timeline.filter(m=>m.channel==='internal'),customer:g.timeline.filter(m=>m.channel==='customer')};
  return g;
 }catch{return null;}
}
