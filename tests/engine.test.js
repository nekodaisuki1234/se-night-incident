import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,start,execute,send,requestApproval,tick,answerCall,parseCommandReport,nextChoices,chooseAction,progressText,messageSurface,objectiveText,customerStatusText,serializeGame,restoreGame,internalStatusText,meetingActive,finishMeeting} from '../dist/engine.js';
function completeMeeting(g){while(meetingActive(g)){if(g.meeting.phase==='closing')finishMeeting(g);else chooseAction(g,nextChoices(g).find(c=>c.id==='meeting-good'));}}
function answerInternal(g){if(g.internalRequest)send(g,'internal',internalStatusText(g),'internal-report');}
// Isolate existing engine regression tests from the new, separately tested opening instruction.
function game(){const g=createGame({setbacks:false});start(g);g.firstReportInstruction=false;answerInternal(g);return g;}
function prepare(g){execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'ls -l /data/inbox');send(g,'internal','確認依頼','request-file');execute(g,'check /data/inbox/sales_20261012.csv');execute(g,"SELECT * FROM batch_history WHERE business_date = '20261012';");answerInternal(g);}
function verify(g){execute(g,'job status SALES_SUMMARY');execute(g,"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");send(g,'internal','復旧・件数一致を社内報告','internal-complete');}
test('承認と検証を経た正常復旧',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','復旧報告','complete');assert.equal(g.result,'模範復旧');assert.equal(g.mental,100);});
test('未着時の再実行は復旧しない',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,false);assert.equal(g.mistakes,1);assert.ok(g.mental<100);});
test('対象別承認があっても別系統の誤停止では二次障害エンドになる',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.secondary,true);assert.equal(g.approved.has('ACCOUNT_SYNC'),false);assert.equal(g.dispatch,null);assert.ok(g.managerEnding);assert.equal(g.ended,true);const actions=g.actions;requestApproval(g,'ACCOUNT_SYNC');execute(g,'job rerun ACCOUNT_SYNC');assert.equal(g.actions,actions);assert.equal(g.secondary,true);tick(g,3);assert.equal(g.result,'二次障害');});
test('無断でも復旧できるが手順評価が下がる',()=>{const g=game();prepare(g);execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','報告','complete');assert.equal(g.result,'復旧したが要反省');});
test('根拠不足の承認・復旧報告は成功しない',()=>{const g=game();requestApproval(g,'SALES_IMPORT');assert.equal(g.approved.size,0);send(g,'customer','復旧','complete');assert.equal(g.ended,false);prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');send(g,'customer','復旧','complete');assert.equal(g.ended,false);});
test('定型文とコマンドの連打で猶予を無限延長できない',()=>{const g=game();send(g,'customer','調査中','initial');tick(g,30);execute(g,'job status');tick(g,40);send(g,'customer','調査中','initial');execute(g,'job status');assert.equal(g.replyIdle,0);assert.equal(g.techIdle,40);tick(g,80);assert.equal(g.call,true);tick(g,150);assert.equal(g.ended,true);});
test('電話で根拠のない復旧時刻を約束すると信用が下がる',()=>{const g=game();tick(g,26);assert.equal(g.call,true);answerCall(g,'promise');assert.equal(g.trust,85);assert.equal(g.call,false);});
test('自由入力の否定文ではファイル到着やクリアを捏造しない',()=>{const g=game();send(g,'internal','当日ファイルの確認を連携元にお願いしますとは言っていない');assert.equal(g.file,false);send(g,'customer','復旧していない、件数一致していない');assert.equal(g.ended,false);});
test('処理済みの二重実行は出動し到着後も作業を再開できない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');assert.equal(g.dispatch.kind,'duplicate');assert.equal(g.ended,false);tick(g,3);assert.equal(g.result,'対応交代');const actions=g.actions;execute(g,'job stop ACCOUNT_SYNC');tick(g,500);assert.equal(g.actions,actions);assert.equal(g.secondary,false);});
test('チャットの操作報告が実際の調査として一度だけ反映される',()=>{const g=game();const actions=g.actions;send(g,'internal','「tail -n 30 /logs/SALES_IMPORT.log」を入力しました。');assert.equal(g.facts.log,true);assert.equal(g.actions,actions+1);assert.equal(g.timeline.filter(m=>m.channel==='operations'&&m.sender==='あなた').length,1);assert.ok(g.timeline.some(m=>m.sender==='操作結果'&&m.text.includes('INPUT FILE NOT FOUND')));});
test('チャットからSQLと復旧操作を実行できる',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');send(g,'internal','job rerun SALES_IMPORTを入力しました');send(g,'internal','job status SALES_SUMMARYを入力しました');send(g,'internal',"「SELECT COUNT(*) FROM sales WHERE business_date = '20261012';」を入力しました。");send(g,'internal','社内復旧報告','internal-complete');send(g,'customer','復旧報告','complete');assert.equal(g.result,'模範復旧');});
test('未実施・曖昧な報告はコマンド実行として扱わない',()=>{for(const s of ['job stop ACCOUNT_SYNCを入力していません','コマンドを入力しました','job rerun SALES_IMPORTを実行したい'])assert.equal(parseCommandReport(s),null);});
test('各段階で3択を提示し、選択のみで正常復旧できる',()=>{const g=game();for(let i=0;i<15&&!g.ended;i++){const choices=nextChoices(g);assert.equal(choices.length,3);chooseAction(g,choices[0]);}assert.equal(g.result,'模範復旧');assert.deepEqual(nextChoices(g),[]);});
test('3択の誤停止で通常選択肢を閉じ二次障害エンドへ進む',()=>{const g=game();chooseAction(g,nextChoices(g)[1]);chooseAction(g,nextChoices(g)[0]);const stop=nextChoices(g).find(c=>c.command==='job stop ACCOUNT_SYNC');assert.ok(stop);chooseAction(g,stop);assert.equal(g.secondary,true);assert.deepEqual(nextChoices(g),[]);assert.equal(g.managerEnding.phase,'sequence');tick(g,3);assert.equal(g.result,'二次障害');});
test('鬼塚は正常ルートの進展を受け取り、同じ確認には叱責を足さない',()=>{const g=game();for(let i=0;i<15&&!g.ended;i++)chooseAction(g,nextChoices(g)[0]);assert.equal(g.result,'模範復旧');assert.ok(g.timeline.some(m=>m.sender==='鬼塚｜リーダー'&&m.text.includes('受け取った')));});
test('電話の3つの返答にもユーザー報告と鬼塚の指摘が入る',()=>{for(const choice of ['ignore','promise','explain']){const g=game();const count=g.timeline.length;answerCall(g,choice);assert.ok(g.timeline.slice(count).some(m=>m.sender==='あなた'));assert.ok(g.timeline.slice(count).some(m=>m.sender==='鬼塚｜リーダー'));}});
test('復旧後の電話は原因調査中へ逆戻りしない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');const report=g.timeline.filter(m=>m.sender==='あなた').at(-1).text;assert.match(report,/正常終了/);assert.doesNotMatch(report,/原因.*調査/);});
test('承認済みの状況報告は承認待ちにならない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');assert.match(progressText(g),/承認を得ました/);const choice=nextChoices(g).find(c=>c.id==='file-report');chooseAction(g,choice);assert.match(g.messages.customer.at(-1).text,/承認まで完了/);});
test('誤った復旧時刻の約束を3択で訂正できる',()=>{const g=game();answerCall(g,'promise');const choices=nextChoices(g);assert.equal(choices.length,3);const correction=choices.find(c=>c.id==='progress-report');assert.match(correction.text,/訂正/);chooseAction(g,correction);assert.equal(g.correctionNeeded,false);});
test('初動ミスだけで二次障害からの生還にならない',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','完了','complete');assert.equal(g.result,'復旧したが要反省');});
test('件数確認済みなら確認を巻き戻さず終了判断を迫る',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);const choice=nextChoices(g).find(c=>c.command==='job status SALES_SUMMARY');chooseAction(g,choice);assert.equal(g.ended,false);assert.equal(g.assistCount,undefined);assert.equal(g.mental,100);assert.ok(nextChoices(g).some(c=>c.id==='complete'));pick(g,'complete');assert.equal(g.result,'模範復旧');});
// Existing route tests answer a pending report first if it temporarily occupies an optional slot.
function pick(g,match){completeMeeting(g);let choices=nextChoices(g);assert.equal(choices.length,3);const matches=c=>c.id===match||c.command===match||(c.type==='approval'&&match==='approve');if(!choices.some(matches)&&g.internalRequest){const report=choices.find(c=>c.id==='internal-report');assert.ok(report);chooseAction(g,report);if(['infra-status','infra-judgment'].includes(match)&&nextChoices(g).some(c=>c.id==='infra-open'))chooseAction(g,nextChoices(g).find(c=>c.id==='infra-open'));choices=nextChoices(g);}const choice=choices.find(matches);assert.ok(choice,'Missing choice: '+match);chooseAction(g,choice);completeMeeting(g);}
function damagedGame(){const g=createGame();start(g);send(g,'customer','原因は確認中です','initial');for(const step of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file'])pick(g,step);assert.equal(g.file,false);pick(g,'escalate-file');assert.equal(g.fileDamaged,true);pick(g,'check /data/inbox/sales_20261012.csv');assert.equal(g.facts.checked,false);answerInternal(g);return g;}
function readyHard(){const g=damagedGame();for(const step of ['resend-file','check /data/inbox/sales_20261012.csv',"SELECT * FROM batch_history WHERE business_date = '20261012';",'approve'])pick(g,step);return g;}
test('連絡不通・欠損・DBロックを選択のみで乗り越えられる',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,false);assert.equal(g.lockEncountered,true);assert.equal(g.mistakes,0);assert.equal(g.approved.size,0);for(const step of ["SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';",'release-lock','approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,step);assert.equal(g.result,'模範復旧');assert.ok(g.criticCount>=3);});
test('具体策が返ってこない相談でメンタルだけ5下がり信用・作業・代行は変わらない',()=>{
 const g=damagedGame();const before={trust:g.trust,mental:g.mental,mistakes:g.mistakes,actions:g.actions,tech:g.techIdle,reply:g.replyIdle};pick(g,'critic-approval');assert.equal(g.approved.size,0);assert.equal(g.fileDamaged,true);assert.equal(g.assistCount,undefined);assert.equal(g.mismatchSeen,true);assert.equal(g.trust,before.trust);assert.equal(g.mental,before.mental-5);assert.equal(g.mistakes,before.mistakes);assert.equal(g.actions,before.actions+1);assert.equal(g.techIdle,before.tech);assert.equal(g.replyIdle,before.reply);assert.match(tayama(g).at(-1),/現物を確認/);assert.equal(nextChoices(g).length,3);assert.ok(!nextChoices(g).some(c=>c.id==='critic-approval'));pick(g,'resend-file');assert.equal(g.fileDamaged,false);
});
test('金融データの独断修正は田山が承認を否定し鬼塚が出動する',()=>{const g=damagedGame();pick(g,'patch-file');assert.equal(g.mistakes,1);assert.equal(g.assistCount,undefined);assert.ok(tayama(g).some(t=>t.includes('承認したわけではない')));assert.equal(g.dispatch.kind,'data-edit');assert.equal(g.fileDamaged,true);tick(g,3);assert.equal(g.result,'対応交代');});
test('ファイル差し替えと再実行失敗で古い承認を使えない',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');requestApproval(g,'SALES_IMPORT');assert.equal(g.approved.size,0);assert.equal(g.lockReleased,false);execute(g,'job status');assert.match(g.terminal.at(-1).text,/RC=28/);});

test('顧客の送受信と電話履歴はTeamsに入らない',()=>{const g=game();send(g,'customer','初報','initial');answerCall(g,'explain');const teams=g.timeline.filter(m=>messageSurface(m)==='teams');assert.ok(teams.length);assert.ok(teams.every(m=>m.channel!=='customer'&&!m.sender.startsWith('高橋')));assert.ok(g.timeline.filter(m=>messageSurface(m)==='customer').some(m=>m.sender==='あなた'));});
test('田山は手修正を勧めず、鬼塚は技術手順を教えない',()=>{const g=damagedGame();const comments=g.timeline.filter(m=>m.sender==='田山｜ベテラン').map(m=>m.text).join('');assert.match(comments,/整合性/);assert.doesNotMatch(comments,/手で補|SELECT|job rerun/);const boss=g.timeline.filter(m=>m.sender==='鬼塚｜リーダー').map(m=>m.text).join('');assert.match(boss,/どうすんだ/);assert.doesNotMatch(boss,/検証しろ|ログを読め|処理履歴|チェックサム/);assert.ok(nextChoices(g).every(c=>!c.label.includes('助言どおり')));});

test('後半で続報メールを繰り返しても未返信扱いにせず、技術停滞は別に数える',()=>{const g=readyHard();tick(g,61);pick(g,'progress-report');assert.equal(g.replyIdle,0);assert.equal(g.techIdle,61);tick(g,61);pick(g,'progress-report');assert.equal(g.replyIdle,0);assert.equal(g.techIdle,0);assert.equal(g.assistCount,1);assert.equal(g.lockEncountered,true);assert.ok(nextChoices(g).some(c=>c.command?.includes('session_locks')));});
test('ロック解除後の報告は前のファイル到着の話に戻らない',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');pick(g,"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");pick(g,'release-lock');assert.match(progressText(g),/ロック解除/);assert.match(objectiveText(g),/改めてリーダー/);pick(g,'file-report');assert.match(g.messages.customer.at(-1).text,/ロック解除/);pick(g,'approve');pick(g,'file-report');assert.match(g.messages.customer.at(-1).text,/再実行承認/);pick(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,true);});
test('早すぎる完了報告は未確認の作業だけを伝え、確認後は終了できる',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');pick(g,'complete');assert.equal(g.ended,false);assert.match(g.messages.customer.at(-1).text,/後続/);assert.equal(g.facts.summary,true);pick(g,'complete');assert.match(g.messages.customer.at(-1).text,/SQLで処理件数/);assert.doesNotMatch(g.messages.customer.at(-1).text,/後続の売上集計の確認が残/);assert.equal(g.facts.count,true);assert.match(objectiveText(g),/復旧確認は完了/);pick(g,'internal-complete');pick(g,'complete');assert.equal(g.ended,true);});
test('再着信への現状説明も返信として扱う',()=>{const g=game();answerCall(g,'explain');tick(g,80);answerCall(g,'explain');assert.equal(g.replyIdle,0);assert.equal(g.replyLevel,0);assert.equal(g.techIdle,80);});

test('応答待ちを選ぶと森が二次連絡先へ連絡しファイルが届く',()=>{const g=createGame();start(g);send(g,'customer','原因は確認中です','initial');for(const c of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file','wait-vendor'])pick(g,c);assert.equal(g.file,true);assert.equal(g.fileDamaged,true);assert.equal(g.assistCount,1);assert.equal(g.trust,94);assert.ok(nextChoices(g).some(c=>c.command==='check /data/inbox/sales_20261012.csv'));assert.ok(g.timeline.some(m=>m.sender==='森｜監視'&&m.text.includes('二次連絡先へ確認')));});
test('最初の顧客報告は正当な連絡、同じ報告を重ねたら森が調査を進める',()=>{const g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');pick(g,'ls -l /data/inbox');pick(g,'file-report');assert.equal(g.assistCount,undefined);pick(g,'file-report');assert.equal(g.file,true);assert.equal(g.assistCount,1);assert.equal(g.recovered,false);assert.ok(g.timeline.some(m=>m.sender==='鬼塚｜リーダー'&&m.text.includes('同じ報告')));});
test('ロック相談だけでは解除や再承認を飛ばさず自分で次を選べる',()=>{
 const g=readyHard();pick(g,'job rerun SALES_IMPORT');pick(g,"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");pick(g,'critic-approval');assert.equal(g.lockReleased,false);assert.equal(g.recovered,false);assert.equal(g.approved.size,0);assert.equal(g.assistCount,undefined);assert.match(tayama(g).at(-1),/処理同士の依存関係/);assert.equal(nextChoices(g).length,3);assert.ok(!nextChoices(g).some(c=>c.id==='critic-approval'));pick(g,'release-lock');assert.ok(nextChoices(g).some(c=>c.type==='approval'));
});
test('詰められるとメンタルが減り、下限は0',()=>{const g=game();assert.equal(g.mental,100);answerCall(g,'promise');assert.equal(g.mental,90);tick(g,90);assert.equal(g.mental,74);g.mental=5;execute(g,'job rerun SALES_IMPORT');assert.equal(g.mental,0);});
test('森の代行で信用とメンタルが別々に減る',()=>{const g=createGame();start(g);send(g,'customer','原因は確認中です','initial');for(const c of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file','wait-vendor'])pick(g,c);assert.equal(g.trust,94);assert.equal(g.mental,90);});

test('初回無断実行は電話、危険操作が続いて出動したら電話分岐を閉じる',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');assert.equal(g.call,true);assert.ok(g.callReason);assert.equal(g.dispatch,null);answerCall(g,'explain');execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.call,false);assert.equal(g.callReason,null);assert.equal(g.dispatch,null);assert.ok(g.managerEnding);});
test('ログと一覧を見るだけなら電話も代行も発生しない',()=>{const g=game();for(let i=0;i<3;i++){execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'job status');}assert.equal(g.call,false);assert.equal(g.assistCount,undefined);assert.equal(g.mental,100);});
test('承認した正常なバッチ再実行では緊急電話しない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');assert.equal(g.call,false);assert.equal(g.recovered,true);});
test('二重実行の出動と緊急電話が競合せず結果は一度だけ',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');assert.equal(g.call,false);const actions=g.actions;answerCall(g,'explain');assert.equal(g.actions,actions);tick(g,3);tick(g,3);assert.equal(g.result,'対応交代');assert.equal(g.events.filter(e=>e.text==='対応交代').length,1);});
test('影響件数は根拠確認前に捏造せず、復旧時刻も確約しない',()=>{const g=game();assert.match(customerStatusText(g),/影響件数は調査中/);assert.doesNotMatch(customerStatusText(g),/1,248/);prepare(g);assert.match(customerStatusText(g),/遅延対象は1,248件/);assert.match(customerStatusText(g),/利用者数は未確定/);assert.match(customerStatusText(g),/復旧時刻はまだ確約できません/);});
test('件数チェックだけで終了せず社内復旧報告を必須とする',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');execute(g,'job status SALES_SUMMARY');execute(g,"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");send(g,'customer','完了','complete');assert.equal(g.ended,false);assert.equal(g.internalReported,false);pick(g,'internal-complete');assert.equal(g.internalReported,true);pick(g,'complete');assert.equal(g.ended,true);});
test('社内報告を先走ってもチェック済み扱いにしない',()=>{const g=game();send(g,'internal','復旧しました','internal-complete');assert.equal(g.internalReported,false);assert.equal(g.facts.count,false);});

test('ロック失敗後に再読み込みしても会話と選択肢を保持し最後まで進む',()=>{let g=readyHard();pick(g,'job rerun SALES_IMPORT');const history=JSON.stringify(g.timeline),choices=nextChoices(g);g=restoreGame(serializeGame(g));assert.ok(g);assert.equal(JSON.stringify(g.timeline),history);assert.deepEqual(nextChoices(g),choices);for(const c of ["SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';",'release-lock','approve'])pick(g,c);g=restoreGame(serializeGame(g));assert.ok(g.approved instanceof Set);assert.ok(g.approved.has('SALES_IMPORT'));for(const c of ['job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,c);assert.equal(g.result,'模範復旧');});
test('緊急電話と低下したメンタルを保存し、再開時に時間を加算しない',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');tick(g,7);const restored=restoreGame(serializeGame(g));assert.equal(restored.call,true);assert.equal(restored.callReason,g.callReason);assert.equal(restored.mental,g.mental);assert.equal(restored.clock,g.clock);assert.equal(restored.replyIdle,g.replyIdle);answerCall(restored,'explain');assert.equal(restored.call,false);});
test('復元後の代行履歴も実行者が森として両方の履歴に残る',()=>{let g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');pick(g,'ls -l /data/inbox');pick(g,'file-report');g=restoreGame(serializeGame(g));pick(g,'file-report');assert.equal(g.assistCount,1);assert.ok(g.messages.internal.some(m=>m.sender==='森｜監視'&&m.text==='当日ファイルの確認を連携元にお願いします。'));});
test('壊れた保存データは例外にせず新規開始へ戻せる',()=>{for(const raw of [null,'{broken','{}',JSON.stringify({version:999}),JSON.stringify({version:1,game:{started:true}})])assert.equal(restoreGame(raw),null);});

const tayama=g=>g.timeline.filter(m=>m.sender==='田山｜ベテラン').map(m=>m.text);
test('田山は正常ルートで重複せず、検証と復旧を区別して最後に総括する',()=>{
 const g=readyHard();assert.ok(tayama(g).some(t=>t.includes('検証結果')));assert.ok(tayama(g).every(t=>!t.includes('正常終了まで')&&!t.includes('最終的には復旧')));
 pick(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,false);assert.match(tayama(g).at(-1),/ロック競合/);assert.doesNotMatch(tayama(g).at(-1),/判断を急|実行前に確認/);
 for(const c of ["SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';",'release-lock','approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,c);
 assert.equal(g.result,'模範復旧');assert.equal(new Set(tayama(g)).size,tayama(g).length);assert.match(tayama(g).at(-1),/最終的には復旧/);
});
test('安全な再確認では田山の一般論も鬼塚の誤操作叱責も増やさない',()=>{
 const g=game();execute(g,'tail -n 30 /logs/SALES_IMPORT.log');const n=tayama(g).length;
 for(let i=0;i<20;i++)execute(g,'tail -n 30 /logs/SALES_IMPORT.log');
 assert.equal(tayama(g).length,n);assert.equal(g.mistakes,0);assert.equal(g.trust,100);assert.equal(g.mental,100);assert.equal(g.assistCount,undefined);
});
test('別ジョブ誤停止と正しい対象の無承認実行を言い分ける',()=>{
 const g=game();execute(g,'job stop ACCOUNT_SYNC');assert.equal(tayama(g).length,0);assert.ok(g.messages.internal.some(m=>m.sender==='鬼塚｜リーダー'&&m.text.includes('普段トロいのに')));assert.equal(g.dispatch,null);assert.ok(g.managerEnding);
 const h=game();prepare(h);execute(h,'job rerun SALES_IMPORT');assert.equal(h.recovered,true);assert.equal(h.dispatch,null);assert.match(tayama(h).at(-1),/実施判断の経緯/);assert.doesNotMatch(h.messages.internal.findLast(m=>m.sender==='鬼塚｜リーダー').text,/別系統|対象が違/);
});
test('相談した問題に沿って返答し同じ問題には再回答しない',()=>{
 const g=damagedGame();const choice=nextChoices(g).find(c=>c.id==='critic-approval');assert.equal(choice.label,'田山に具体的な対応案を聞く');assert.match(choice.text,/件数が1件不足/);chooseAction(g,choice);const n=tayama(g).length,actions=g.actions;chooseAction(g,choice);send(g,'internal','具体策を聞き直す','critic-approval');assert.equal(tayama(g).length,n);assert.equal(g.actions,actions);assert.ok(!g.timeline.some(m=>m.text.includes('その助言を根拠')));
});
test('相談済みの問題はセーブ再開でも選択肢に復活せず別の問題なら相談できる',()=>{
 let g=damagedGame();pick(g,'critic-approval');g=restoreGame(serializeGame(g));assert.ok(g);assert.ok(!nextChoices(g).some(c=>c.id==='critic-approval'));assert.equal(nextChoices(g).length,3);
 for(const c of ['resend-file','check /data/inbox/sales_20261012.csv',"SELECT * FROM batch_history WHERE business_date = '20261012';",'approve','job rerun SALES_IMPORT',"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';"])pick(g,c);
 const choice=nextChoices(g).find(c=>c.id==='critic-approval');assert.match(choice.text,/DBロック/);assert.doesNotMatch(choice.text,/件数が1件不足/);chooseAction(g,choice);assert.equal(new Set(tayama(g)).size,tayama(g).length);g=restoreGame(serializeGame(g));assert.ok(!nextChoices(g).some(c=>c.id==='critic-approval'));
 for(const c of ['release-lock','approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,c);assert.equal(g.result,'模範復旧');assert.equal(g.dispatch,null);
});
test('上席からの要求は先に出来事として提示し、報告は受け止める',()=>{
 const g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');pick(g,'ls -l /data/inbox');pick(g,'file-report');
 const eventIndex=g.timeline.findIndex(m=>m.text.includes('上席から状況報告を求められました'));
 const pressureIndex=g.timeline.findIndex(m=>m.text.includes('今、上から状況'));
 assert.ok(eventIndex>=0&&pressureIndex>eventIndex);assert.match(g.messages.internal.findLast(m=>m.sender==='鬼塚｜リーダー').text,/受け取った/);assert.equal(g.trust,100);
});
test('復旧後の確認済み事項を鬼塚が未確認として聞き直さない',()=>{
 const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);const from=g.timeline.length;pick(g,'job status SALES_SUMMARY');
 const boss=g.timeline.slice(from).filter(m=>m.sender==='鬼塚｜リーダー').map(m=>m.text).join('');assert.doesNotMatch(boss,/件数は合って|後続についても確認|社内向けにも復旧結果/);assert.match(boss,/社内の復旧報告は受け取って/);
});
test('電話で根拠のない約束をした時に顧客の指摘を受けてから田山が評論する',()=>{
 const g=game();answerCall(g,'promise');assert.match(tayama(g).at(-1),/先方が不安/);const first=tayama(g).length;answerCall(g,'promise');assert.equal(tayama(g).length,first);
 assert.ok(g.timeline.findIndex(m=>m.sender==='高橋｜顧客'&&m.text.includes('根拠'))<g.timeline.findIndex(m=>m.sender==='田山｜ベテラン'));
});

test('調査の難航やメンタル低下だけではタクシーは出動しない',()=>{
 const g=game();g.mental=0;for(let i=0;i<10;i++){execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'job status');}assert.equal(g.dispatch,null);assert.equal(g.mistakes,0);
 tick(g,270);assert.equal(g.dispatch,null);assert.equal(g.ended,true);assert.ok(!g.timeline.some(m=>m.text.includes('タクシー')));
 const h=readyHard();pick(h,'job rerun SALES_IMPORT');assert.equal(h.lockEncountered,true);assert.equal(h.dispatch,null);assert.equal(h.mistakes,0);
});
test('重大な無断操作の繰り返しは初回と区別し理由を保持する',()=>{
 const g=game();execute(g,'job rerun SALES_IMPORT');assert.equal(g.dispatch,null);answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');assert.equal(g.dispatch.kind,'repeated-unauthorized');assert.match(g.dispatch.reason,/指摘された後も/);assert.equal(g.ended,false);tick(g,3);assert.equal(g.ended,true);
});
test('出動確定後の全操作と連打を拒否し復旧や承認に進めない',()=>{
 const g=game();const stale=nextChoices(g)[0];execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');const snapshot=serializeGame(g);
 for(let i=0;i<5;i++){chooseAction(g,stale);execute(g,'job status');execute(g,'job rerun ACCOUNT_SYNC');send(g,'customer','復旧しました','complete');send(g,'internal','依頼','request-file');requestApproval(g,'ACCOUNT_SYNC');answerCall(g,'promise');start(g);}
 assert.equal(serializeGame(g),snapshot);assert.deepEqual(nextChoices(g),[]);
});
test('出動中の保存再開でも到着までの残り時間と理由を保ち一度だけ終了',()=>{
 let g=game();execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');tick(g,1);const history=JSON.stringify(g.timeline),reason=g.dispatch.reason;g=restoreGame(serializeGame(g));assert.equal(JSON.stringify(g.timeline),history);assert.equal(g.dispatch.remaining,2);assert.equal(g.dispatch.reason,reason);assert.equal(g.ended,false);tick(g,1);assert.equal(g.ended,false);tick(g,1);assert.equal(g.result,'対応交代');
 const arrival=g.timeline.findIndex(m=>m.text==='タクシーが現場に到着しました');assert.ok(arrival>=0);assert.equal(g.timeline[arrival+1].text,'お前は一体何ならできるんだ？');
 g=restoreGame(serializeGame(g));tick(g,100);answerCall(g,'explain');assert.equal(g.timeline.filter(m=>m.text==='タクシーが現場に到着しました').length,1);assert.equal(g.events.filter(e=>e.text==='対応交代').length,1);assert.equal(g.dispatch.phase,'arrived');
});
test('旧セーブはそのまま再開でき過去の無断実行は次の危険判断に使う',()=>{
 const g=game();execute(g,'job rerun SALES_IMPORT');const saved=JSON.parse(serializeGame(g));delete saved.game.dispatch;delete saved.game.dangerActions;
 const restored=restoreGame(JSON.stringify(saved));assert.ok(restored);assert.equal(restored.dispatch,null);assert.equal(restored.dangerActions.length,1);execute(restored,'job rerun SALES_IMPORT');assert.equal(restored.dispatch.kind,'repeated-unauthorized');
});
test('田山は最後まで遠隔に留まり出動時も台詞が重複しない',()=>{
 const g=game();execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');tick(g,3);assert.equal(new Set(tayama(g)).size,tayama(g).length);assert.match(tayama(g).at(-1),/チャットでは確認/);assert.ok(!tayama(g).some(t=>/私も向か|私が現場/.test(t)));
 const cold=g.timeline.findIndex(m=>m.text==='……もういい。そこから何も触るな。');assert.ok(cold>0);assert.ok(!g.timeline.slice(cold).some(m=>m.sender==='鬼塚｜リーダー'&&/どうすんだ|根拠は/.test(m.text)));
});
test('顧客の指摘を社内へ共有してから遠隔の田山が評論する',()=>{
 const g=game();answerCall(g,'promise');const share=g.timeline.findIndex(m=>m.channel==='internal'&&m.sender==='あなた'&&m.text.includes('根拠を問われ'));const critic=g.timeline.findIndex(m=>m.sender==='田山｜ベテラン');assert.ok(share>=0&&critic>share);assert.ok(g.timeline.filter(m=>m.channel==='internal').every(m=>!m.sender.startsWith('高橋')));
});

test('別ジョブ専用台詞は誤停止だけに一度出し長い叱責を重ねない',()=>{
 const text='普段トロいのに、こういう時には慎重さに欠くのはなんでなんだ？';
 const g=game();execute(g,'job stop ACCOUNT_SYNC');execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.timeline.filter(m=>m.text===text).length,1);assert.equal(g.trust,78);assert.equal(g.mental,80);assert.equal(g.dispatch,null);assert.ok(g.managerEnding);assert.ok(!g.timeline.some(m=>m.text.includes('待て。なんでACCOUNT_SYNC')));
 for(const cmd of ['job rerun SALES_IMPORT','tail -n 30 /logs/SALES_IMPORT.log']){const h=game();execute(h,cmd);assert.ok(!h.timeline.some(m=>m.text===text));}
});
test('到着で終了を確定し対面の台詞と沈黙だけで専用エンドを構成する',()=>{
 const g=game();execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');tick(g,3);assert.equal(g.ended,true);assert.equal(g.result,'対応交代');assert.deepEqual(nextChoices(g),[]);
 const scene=g.timeline.slice(g.endingStart);assert.deepEqual(scene.map(m=>m.text),['タクシーが現場に到着しました','お前は一体何ならできるんだ？','……ライブラリアンさえやってくれたらいいから','〜完〜']);assert.ok(scene.every(m=>m.presentation==='onsite'&&!m.sender.startsWith('田山')));assert.ok(scene[2].pauseBefore>=1000);
 const frozen=serializeGame(g);execute(g,'job rerun ACCOUNT_SYNC');send(g,'customer','復旧','complete');assert.equal(serializeGame(g),frozen);
});
test('エンド途中の表示位置と使用済み台詞を保存し重複せず再開できる',()=>{
 let g=game();execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');tick(g,3);g.endingVisible=g.endingStart+2;g=restoreGame(serializeGame(g));assert.equal(g.endingVisible,g.endingStart+2);const history=JSON.stringify(g.timeline);tick(g,10);assert.equal(JSON.stringify(g.timeline),history);assert.equal(g.events.filter(e=>e.text==='対応交代').length,1);
 const h=game();assert.equal(h.dispatch,null);assert.equal(h.ended,false);assert.equal(h.endingVisible,undefined);assert.equal(h.tayamaUsed,undefined);execute(h,'job stop ACCOUNT_SYNC');assert.equal(h.timeline.filter(m=>m.text.includes('普段トロいのに')).length,1);
});
test('通常復旧と時間超過エンドに専用対面台詞は出ない',()=>{
 const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','復旧報告','complete');assert.equal(g.result,'模範復旧');assert.ok(!g.timeline.some(m=>m.presentation==='onsite'||m.text.includes('ライブラリアン')));
 const h=game();tick(h,270);assert.equal(h.result,'対応交代');assert.ok(!h.timeline.some(m=>m.presentation==='onsite'||m.text.includes('ライブラリアン')));
});

test('相談済み情報のない旧セーブを読めて時間経過の共通ルールも維持する',()=>{
 const saved=JSON.parse(serializeGame(damagedGame()));delete saved.game.tayamaConsulted;const g=restoreGame(JSON.stringify(saved));assert.ok(g);tick(g,10);const idle=g.techIdle,reply=g.replyIdle;pick(g,'critic-approval');assert.equal(g.techIdle,idle);assert.equal(g.replyIdle,reply);tick(g,10);assert.equal(g.techIdle,idle+10);assert.equal(g.replyIdle,reply+10);
});

test('田山の精神ダメージは再選択や再開で重複せず下限は0',()=>{
 let g=damagedGame();g.mental=3;const choice=nextChoices(g).find(c=>c.id==='critic-approval');chooseAction(g,choice);assert.equal(g.mental,0);assert.equal(g.tayamaMentalDamage,3);assert.equal(g.trust,100);assert.equal(g.dispatch,null);g=restoreGame(serializeGame(g));chooseAction(g,choice);send(g,'internal','相談','critic-approval');assert.equal(g.mental,0);assert.equal(g.events.filter(e=>e.text.includes('一般論で返された')).length,1);
});

test('顧客の嫌味は催促後だけ出て再開後も同じ返答を繰り返さない',()=>{
 const punctual=game();send(punctual,'customer','調査中','initial');assert.ok(!punctual.messages.customer.some(m=>m.text.includes('こちらから伺う前')));
 let g=game();tick(g,75);assert.match(g.messages.customer.at(-1).text,/こちらから確認する前/);const trust=g.trust,mental=g.mental;send(g,'customer','調査中','initial');assert.match(g.messages.customer.at(-1).text,/作業中なのは承知/);assert.equal(g.trust,trust);assert.equal(g.mental,mental);assert.equal(g.replyIdle,0);
 g=restoreGame(serializeGame(g));tick(g,75);send(g,'customer','調査中','progress-report');assert.equal(g.messages.customer.filter(m=>m.text.includes('こちらから伺う前')).length,1);assert.ok(g.messages.internal.every(m=>!m.sender.startsWith('高橋')));
});
test('序盤の選択肢は判明情報に合わせて変わり社内報告は作業を進めない',()=>{
 let g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');const logLabels=nextChoices(g).map(c=>c.label);const facts=JSON.stringify(g.facts);pick(g,'internal-status');assert.equal(JSON.stringify(g.facts),facts);assert.equal(g.trust,100);assert.equal(g.mistakes,0);assert.equal(g.assistCount,undefined);assert.ok(!nextChoices(g).some(c=>c.id==='internal-status'));assert.equal(nextChoices(g).length,3);
 g=restoreGame(serializeGame(g));assert.ok(!nextChoices(g).some(c=>c.id==='internal-status'));pick(g,'ls -l /data/inbox');const missingLabels=nextChoices(g).map(c=>c.label);assert.ok(missingLabels.every(label=>!logLabels.includes(label)));pick(g,'internal-status');assert.equal(g.file,false);assert.equal(g.fileRequested,false);assert.equal(g.dispatch,null);pick(g,'request-file');const received=nextChoices(g);assert.equal(received.length,3);assert.ok(received.every(c=>!missingLabels.includes(c.label)));assert.ok(received.some(c=>c.command==='check /data/inbox/sales_20261012.csv'));assert.ok(received.some(c=>/内容は未検証/.test(c.label)));
});

function receivedGame(){const g=game();for(const step of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file'])pick(g,step);answerInternal(g);return g;}
const infraMessages=g=>g.timeline.filter(m=>m.sender==='佐伯｜インフラ担当');
test('インフラの期限通知は見込み未確定の調査中に一度届き、後続の運用枠と整合する',()=>{
 let g=game();assert.equal(infraMessages(g).length,0);pick(g,'tail -n 30 /logs/SALES_IMPORT.log');assert.equal(g.file,false);assert.equal(g.facts.checked,false);assert.deepEqual(g.infraDeadline,{recovery:180,downstream:195});assert.ok(g.minutes<g.infraDeadline.recovery);assert.match(infraMessages(g)[0].text,/取込→売上集計.*別運用枠.*03:15/);assert.match(infraMessages(g)[0].text,/03:00まで/);
 g=restoreGame(serializeGame(g));execute(g,'tail -n 30 /logs/SALES_IMPORT.log');tick(g,1);assert.equal(infraMessages(g).length,1);assert.equal(g.trust,100);assert.equal(g.mental,100);assert.ok(infraMessages(g).every(m=>messageSurface(m)==='teams'));assert.ok(!g.messages.customer.some(m=>m.sender.startsWith('佐伯')));
});
test('基盤確認は具体的な観測だけを返し実作業や承認、評価、停滞時間を変更しない',()=>{
 const g=receivedGame();tick(g,10);const before={facts:JSON.stringify(g.facts),terminal:JSON.stringify(g.terminal),actions:g.actions,tech:g.techIdle,reply:g.replyIdle};pick(g,'infra-open');assert.equal(g.actions,before.actions);pick(g,'infra-status');assert.match(infraMessages(g).at(-1).text,/稼働、空き容量.*接続を確認/);assert.match(infraMessages(g).at(-1).text,/正常終了待ち/);assert.match(infraMessages(g).at(-1).text,/業務データの内容は.*含みません/);assert.equal(JSON.stringify(g.facts),before.facts);assert.equal(JSON.stringify(g.terminal),before.terminal);assert.equal(g.approved.size,0);assert.equal(g.recovered,false);assert.equal(g.actions,before.actions+1);assert.equal(g.techIdle,before.tech);assert.equal(g.replyIdle,before.reply);assert.equal(g.trust,100);assert.equal(g.mental,100);assert.equal(g.mistakes,0);assert.equal(g.assistCount,undefined);assert.equal(g.dispatch,null);assert.equal(nextChoices(g).length,3);
});
test('未検証ファイルのアプリ判断はインフラが引き取らず問い合わせ後も正常復旧できる',()=>{
 const g=receivedGame();pick(g,'infra-open');pick(g,'infra-judgment');assert.match(infraMessages(g).at(-1).text,/ファイルの正当性や二重処理/);assert.match(infraMessages(g).at(-1).text,/実行承認ではありません/);assert.match(infraMessages(g).at(-1).text,/復旧期限は変わりません/);assert.equal(g.approved.size,0);assert.equal(g.facts.checked,false);assert.equal(g.dispatch,null);assert.equal(g.mistakes,0);assert.equal(g.trust,100);assert.equal(g.mental,100);assert.equal(g.assistCount,undefined);
 for(const step of ['check /data/inbox/sales_20261012.csv',"SELECT * FROM batch_history WHERE business_date = '20261012';",'approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,step);assert.equal(g.result,'模範復旧');
});
test('ロック失敗時は接続断と区別し未調査の保持元を知っているように答えない',()=>{
 const g=readyHard();pick(g,'job rerun SALES_IMPORT');pick(g,'infra-open');pick(g,'infra-status');const reply=infraMessages(g).at(-1).text;assert.match(reply,/接続断ではなく、ロック待ち/);assert.match(reply,/まだ確認していません/);assert.doesNotMatch(reply,/REPORT_EXPORT|SESSION 812/);assert.equal(g.lockInspected,false);assert.equal(g.lockReleased,false);assert.equal(g.approved.size,0);
 pick(g,'infra-open');pick(g,'infra-judgment');assert.match(infraMessages(g).at(-1).text,/競合中の処理への影響/);assert.equal(g.lockReleased,false);assert.equal(g.dispatch,null);assert.equal(g.assistCount,undefined);assert.ok(!nextChoices(g).some(c=>c.id==='infra-open'));
 for(const step of ["SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';",'critic-approval','release-lock','approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,step);assert.equal(g.result,'模範復旧');
});
test('相談の連打とセーブ再開で回答を重複せず、別の障害段階では質問できる',()=>{
 let g=receivedGame();pick(g,'infra-open');g=restoreGame(serializeGame(g));assert.ok(nextChoices(g).some(c=>c.id==='infra-status'));const stale=nextChoices(g).find(c=>c.id==='infra-status');chooseAction(g,stale);g=restoreGame(serializeGame(g));const snapshot=serializeGame(g);chooseAction(g,stale);send(g,'internal','再確認','infra-status');assert.equal(serializeGame(g),snapshot);pick(g,'infra-open');assert.ok(!nextChoices(g).some(c=>c.id==='infra-status'));pick(g,'infra-judgment');assert.ok(!nextChoices(g).some(c=>c.id==='infra-open'));
 g.setbacks=true;pick(g,'check /data/inbox/sales_20261012.csv');pick(g,"SELECT * FROM batch_history WHERE business_date = '20261012';");pick(g,'approve');pick(g,'job rerun SALES_IMPORT');pick(g,'infra-open');assert.ok(nextChoices(g).some(c=>c.id==='infra-status'));pick(g,'infra-status');assert.equal(g.infraAsked.length,3);assert.equal(new Set(infraMessages(g).map(m=>m.text)).size,infraMessages(g).length);
});
test('期限を過ぎても新しい減点や終了を発生させず、過去の時刻として説明する',()=>{
 const g=receivedGame();g.minutes=179;pick(g,'infra-open');pick(g,'infra-judgment');assert.equal(g.minutes,180);assert.match(infraMessages(g).at(-1).text,/期限は過ぎています/);assert.doesNotMatch(infraMessages(g).at(-1).text,/期限は変わりません/);tick(g,1);assert.equal(g.trust,100);assert.equal(g.mental,100);assert.equal(g.ended,false);assert.equal(g.dispatch,null);
 const old=JSON.parse(serializeGame(g));delete old.game.infraAsked;delete old.game.infraDeadline;delete old.game.infraMenu;old.game.timeline=old.game.timeline.filter(m=>!m.sender.startsWith('佐伯'));const restored=restoreGame(JSON.stringify(old));assert.ok(restored);assert.deepEqual(restored.infraAsked,[]);execute(restored,'job status');assert.match(infraMessages(restored)[0].text,/期限03:00を過ぎています/);assert.equal(restored.ended,false);
});
test('問い合わせメニューから戻れる・顧客報告へ切り替えても三択の作業に戻れる',()=>{
 const g=receivedGame();pick(g,'infra-open');const actions=g.actions;pick(g,'infra-back');assert.equal(g.actions,actions);assert.equal(g.infraMenu,false);pick(g,'infra-open');tick(g,61);pick(g,'progress-report');assert.equal(g.infraMenu,false);assert.equal(nextChoices(g).length,3);assert.ok(nextChoices(g).some(c=>c.command==='check /data/inbox/sales_20261012.csv'));
});
test('インフラ回答は危険操作を承認せず鬼塚の出動・到着エンドを維持する',()=>{
 const g=receivedGame();pick(g,'infra-open');pick(g,'infra-judgment');execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.dispatch,null);assert.ok(g.managerEnding);const count=infraMessages(g).length;send(g,'internal','確認','infra-status');tick(g,3);assert.equal(g.result,'二次障害');assert.equal(infraMessages(g).length,count);assert.deepEqual(nextChoices(g),[]);assert.equal(createGame().infraAsked.length,0);assert.equal(createGame().infraDeadline,null);
});

test('到着時の報告要求に答えられ、未確認の原因や件数を確定しない',()=>{
 const g=createGame({setbacks:false});start(g);g.firstReportInstruction=false;const report=nextChoices(g).find(c=>c.id==='internal-report');assert.ok(report);assert.match(report.text,/原因は未確認/);assert.match(report.text,/影響件数は未確定/);assert.doesNotMatch(report.text,/1,248|転送遅延/);const before=g.actions;chooseAction(g,report);assert.equal(g.actions,before+1);assert.equal(g.internalRequest,null);assert.equal(g.facts.log,false);assert.equal(g.reported,false);assert.equal(g.approved.size,0);const saved=serializeGame(g);chooseAction(g,report);assert.equal(serializeGame(g),saved);
});
test('上席要求は調査への回答の後に出し森は問い合わせの事実だけ共有する',()=>{
 const g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');const from=g.timeline.length;pick(g,'ls -l /data/inbox');const messages=g.timeline.slice(from);const output=messages.findIndex(m=>m.sender==='操作結果');const request=messages.findIndex(m=>m.text.includes('上席から状況報告'));assert.ok(output>=0&&request>output);assert.equal(messages.filter(m=>/次の対応を報告してくれ/.test(m.text)).length,1);assert.ok(messages.filter(m=>m.sender==='森｜監視').every(m=>!m.text.includes('共有してください')));const report=nextChoices(g).find(c=>c.id==='internal-report');assert.ok(report);assert.match(report.text,/未着の理由と到着見込みは未確認/);assert.match(report.text,/次に連携元へ確認します/);assert.ok(nextChoices(g).some(c=>c.id==='request-file'));
 const facts=JSON.stringify(g.facts),idle=g.replyIdle;chooseAction(g,report);assert.equal(JSON.stringify(g.facts),facts);assert.equal(g.fileRequested,false);assert.equal(g.file,false);assert.equal(g.replyIdle,idle);assert.equal(g.reported,false);assert.equal(g.internalRequest,null);assert.ok(nextChoices(g).some(c=>c.id==='request-file'));pick(g,'request-file');assert.equal(g.file,true);
});
test('報告文は不応答・欠損・ロック・復旧確認の工程と予定を区別する',()=>{
 const g=createGame();start(g);execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'ls -l /data/inbox');send(g,'internal','依頼','request-file');assert.match(internalStatusText(g),/依頼しましたが応答がありません/);assert.match(internalStatusText(g),/次に手順書の二次連絡先/);send(g,'internal','二次確認','escalate-file');assert.match(internalStatusText(g),/内容の検証は未実施/);assert.doesNotMatch(internalStatusText(g),/転送遅延で/);execute(g,'check /data/inbox/sales_20261012.csv');assert.match(internalStatusText(g),/1件欠損/);assert.match(internalStatusText(g),/次に連携元に完全なファイル/);
 const h=readyHard();pick(h,'job rerun SALES_IMPORT');assert.match(internalStatusText(h),/保持元と解除可否は未確認/);assert.doesNotMatch(internalStatusText(h),/SESSION 812/);pick(h,"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");assert.match(internalStatusText(h),/保持元はREPORT_EXPORTのSESSION 812/);pick(h,'release-lock');pick(h,'approve');pick(h,'job rerun SALES_IMPORT');assert.match(internalStatusText(h),/件数照合は未実施/);assert.doesNotMatch(internalStatusText(h),/1,248件一致/);
});
test('90秒の催促に回答すると次の90秒まで再要求せず顧客の時計は別に進む',()=>{
 let g=game();tick(g,89);assert.equal(g.internalRequest,null);send(g,'customer','調査中','initial');tick(g,1);assert.ok(g.internalRequest);assert.equal(nextChoices(g).length,3);const report=nextChoices(g).find(c=>c.id==='internal-report');assert.ok(report);const trust=g.trust,mental=g.mental,customerIdle=g.replyIdle;chooseAction(g,report);assert.equal(g.techIdle,0);assert.equal(g.techLevel,0);assert.equal(g.replyIdle,customerIdle);assert.equal(g.trust,trust);assert.equal(g.mental,mental);g=restoreGame(serializeGame(g));assert.equal(g.internalRequest,null);const oldId=g.internalReportAnswered;tick(g,89);assert.equal(g.internalRequest,null);send(g,'customer','調査中','progress-report');tick(g,1);assert.ok(g.internalRequest.id>oldId);assert.ok(nextChoices(g).some(c=>c.id==='internal-report'));const before=serializeGame(g);chooseAction(g,report);assert.equal(serializeGame(g),before);
});
test('社内と顧客が同時に報告待ちでも三択に調査と双方の報告を残す',()=>{
 const g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');pick(g,'ls -l /data/inbox');tick(g,61);let choices=nextChoices(g);assert.equal(choices.length,3);assert.ok(choices.some(c=>c.id==='request-file'));assert.ok(choices.some(c=>c.id==='internal-report'));assert.ok(choices.some(c=>c.id==='progress-report'));pick(g,'progress-report');assert.ok(g.internalRequest);const customer=g.replyIdle;pick(g,'internal-report');assert.equal(g.replyIdle,customer);assert.equal(g.file,false);assert.equal(g.approved.size,0);
});
test('未回答・回答済みの保存再開と旧セーブで催促を再送しない',()=>{
 let g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');pick(g,'ls -l /data/inbox');let timeline=JSON.stringify(g.timeline);g=restoreGame(serializeGame(g));assert.equal(JSON.stringify(g.timeline),timeline);assert.ok(nextChoices(g).some(c=>c.id==='internal-report'));pick(g,'internal-report');g=restoreGame(serializeGame(g));assert.equal(g.internalRequest,null);timeline=JSON.stringify(g.timeline);tick(g,1);assert.equal(JSON.stringify(g.timeline),timeline);
 const old=JSON.parse(serializeGame(g));delete old.game.internalRequest;delete old.game.internalRequestSeq;delete old.game.internalReportAnswered;old.game.timeline.push({sender:'鬼塚｜リーダー',channel:'internal',time:80,text:'状況の共有を頼む。確認できたことと、まだ分からないことは分けてくれ。'});const restored=restoreGame(JSON.stringify(old));assert.ok(restored.internalRequest);assert.ok(nextChoices(restored).some(c=>c.id==='internal-report'));assert.equal(restored.timeline.length,old.game.timeline.length);
});

function meetingGame(){const g=createGame();start(g);send(g,'customer','原因は確認中です','initial');execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'ls -l /data/inbox');send(g,'internal','依頼','request-file');send(g,'internal','二次確認','escalate-file');execute(g,'check /data/inbox/sales_20261012.csv');assert.equal(g.meeting.phase,'opening');return g;}
function meetingAnswer(g,id){const choices=nextChoices(g);assert.equal(choices.length,3);chooseAction(g,choices.find(c=>c.id===id));}
test('Zoomは欠損発覚後の会話の区切りで一度開き整理した説明なら評価を下げない',()=>{
 const g=meetingGame();const scene=g.timeline.filter(m=>m.presentation==='meeting');assert.ok(scene.every(m=>['システム','部長','鬼塚｜リーダー','あなた'].includes(m.sender)));const result=g.timeline.findIndex(m=>m.sender==='操作結果'&&m.text.includes('CHECKSUM'));const start=g.timeline.findIndex(m=>m.presentation==='meeting');assert.ok(result<start);assert.match(g.meeting.reason,/欠損/);const facts=JSON.stringify(g.facts),customerIdle=g.replyIdle;meetingAnswer(g,'meeting-good');assert.equal(g.meeting.phase,'followup');meetingAnswer(g,'meeting-good');assert.equal(g.meeting.phase,'closing');assert.equal(g.trust,100);assert.equal(g.mental,100);assert.equal(g.upperReporter,'player');assert.equal(JSON.stringify(g.facts),facts);assert.equal(g.replyIdle,customerIdle);finishMeeting(g);assert.equal(g.mismatchSeen,true);assert.ok(nextChoices(g).some(c=>c.id==='resend-file'));assert.equal(g.dispatch,null);
});
test('しどろもどろでも一度立て直せば説明役を維持する',()=>{
 const g=meetingGame();meetingAnswer(g,'meeting-vague');assert.equal(g.meeting.phase,'repair');assert.match(g.timeline.at(-1).text,/確認できたこと/);meetingAnswer(g,'meeting-good');assert.equal(g.meeting.takenOver,false);assert.equal(g.trust,100);assert.equal(g.mental,100);finishMeeting(g);assert.equal(g.upperReporter,'player');
});
test('説明交代は既知の事実だけで収め現地作業と顧客対応を残す',()=>{
 const g=meetingGame();meetingAnswer(g,'meeting-vague');meetingAnswer(g,'meeting-vague');assert.equal(g.upperReporter,'onizuka');assert.equal(g.trust,94);assert.equal(g.mental,92);assert.equal(g.dispatch,null);assert.equal(g.ended,false);assert.equal(g.recovered,false);assert.equal(g.firstReportDelegated,false);const summary=g.timeline.find(m=>m.text.startsWith('……私から整理します'));assert.match(summary.text,/1件欠損/);assert.match(summary.text,/次に連携元に完全なファイルの再送/);assert.doesNotMatch(summary.text,/SESSION|ロック解除|承認済み|復旧しました/);assert.equal(g.events.filter(e=>e.text.startsWith('Zoom報告')).length,1);finishMeeting(g);assert.match(g.timeline.at(-1).text,/個別.*俺に内容を送って/);assert.equal(g.approved.size,0);
 for(const step of ['resend-file','check /data/inbox/sales_20261012.csv',"SELECT * FROM batch_history WHERE business_date = '20261012';",'approve','job rerun SALES_IMPORT',"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';",'release-lock','approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,step);assert.equal(g.result,'復旧したが要反省');assert.equal(g.events.filter(e=>e.text.startsWith('部長から社内Zoom')).length,1);
});
test('根拠のない確約は一度だけ評価し、訂正すれば説明交代を回避できる',()=>{
 const g=meetingGame();meetingAnswer(g,'meeting-claim');assert.equal(g.trust,100);meetingAnswer(g,'meeting-good');assert.equal(g.trust,92);assert.equal(g.mental,96);assert.equal(g.meeting.takenOver,false);assert.equal(g.correctionNeeded,undefined);assert.equal(g.events.filter(e=>e.text.startsWith('Zoom報告')).length,1);
 const h=meetingGame();meetingAnswer(h,'meeting-claim');meetingAnswer(h,'meeting-claim');assert.equal(h.trust,92);assert.equal(h.mental,92);assert.equal(h.meeting.takenOver,true);assert.equal(h.events.filter(e=>e.text.startsWith('Zoom報告')).length,1);
});
test('会議中の連打・通常操作・時間経過を拒否し再開で発言と減点を重複しない',()=>{
 let g=meetingGame();const stale=nextChoices(g)[1];chooseAction(g,stale);const snapshot=serializeGame(g);chooseAction(g,stale);execute(g,'job stop ACCOUNT_SYNC');requestApproval(g,'SALES_IMPORT');send(g,'customer','復旧','complete');answerCall(g,'promise');tick(g,500);assert.equal(serializeGame(g),snapshot);g=restoreGame(serializeGame(g));assert.equal(g.meeting.phase,'repair');assert.equal(serializeGame(g),snapshot);meetingAnswer(g,'meeting-vague');g=restoreGame(serializeGame(g));assert.equal(g.meeting.phase,'closing');assert.deepEqual(nextChoices(g),[]);finishMeeting(g);const closed=serializeGame(g);finishMeeting(g);assert.equal(serializeGame(g),closed);assert.equal(g.events.filter(e=>e.text.startsWith('Zoom報告')).length,1);execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.dispatch,null);assert.ok(g.managerEnding);tick(g,3);assert.equal(g.result,'二次障害');
});
test('緊急着信中の招集は待機し電話への返答を終えてから会議に入る',()=>{
 const g=createGame();start(g);execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'ls -l /data/inbox');send(g,'internal','依頼','request-file');send(g,'internal','二次','escalate-file');g.call=true;g.callReason='状況を説明してください。';execute(g,'check /data/inbox/sales_20261012.csv');assert.equal(g.meeting,null);answerCall(g,'explain');assert.equal(g.meeting.phase,'opening');const call=g.timeline.findIndex(m=>m.text.includes('電話で現状'));const zoom=g.timeline.findIndex(m=>m.presentation==='meeting');assert.ok(call<zoom);
});
test('旧セーブには会議状態を補い、ロック段階でも既知の情報だけで会議を開始する',()=>{
 const g=readyHard();const saved=JSON.parse(serializeGame(g));delete saved.game.meeting;delete saved.game.upperReporter;const h=restoreGame(JSON.stringify(saved));assert.equal(h.meeting,null);assert.equal(h.upperReporter,'player');execute(h,'job rerun SALES_IMPORT');assert.equal(h.meeting.phase,'opening');assert.match(h.meeting.reason,/DBロック/);assert.match(nextChoices(h)[0].text,/保持元と解除可否は未確認/);assert.doesNotMatch(nextChoices(h)[0].text,/SESSION 812/);
});

test('二次障害は敗北を即時確定しマネージャーの発言なしで専用演出だけを追加する',()=>{
 const g=game();execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.ended,true);assert.equal(g.result,'二次障害');assert.equal(g.dispatch,null);assert.equal(g.call,false);assert.equal(g.callReason,null);assert.equal(g.trust,78);assert.equal(g.mental,80);assert.equal(g.mistakes,1);assert.deepEqual(g.timeline.slice(g.endingStart).map(m=>m.text),['鬼塚が一条（PM）を追加しました','過去の履歴を全て共有しました','@一条（PM） こちらです','一条（PM）が入力中…','GAME OVER']);assert.ok(!g.timeline.some(m=>m.sender==='一条（PM）'||m.text.includes('タクシー')));assert.match(g.managerEnding.impact,/口座同期を停止/);assert.doesNotMatch(g.managerEnding.impact,/二重処理|データ破損/);assert.deepEqual(nextChoices(g),[]);
});
test('マネージャー演出と暗転を再開しても敗北を解除せず通知・評価を重複しない',()=>{
 let g=game();execute(g,'job stop ACCOUNT_SYNC');g.endingVisible=g.endingStart+2;g=restoreGame(serializeGame(g));const before=serializeGame(g);tick(g,1000);execute(g,'job rerun ACCOUNT_SYNC');send(g,'customer','報告','initial');requestApproval(g,'ACCOUNT_SYNC');answerCall(g,'promise');assert.equal(serializeGame(g),before);g.managerEnding.phase='blackout';g.endingVisible=g.timeline.length;g=restoreGame(serializeGame(g));assert.equal(g.ended,true);assert.equal(g.managerEnding.phase,'blackout');assert.equal(g.timeline.filter(m=>m.text==='過去の履歴を全て共有しました').length,1);assert.equal(g.events.filter(e=>e.text==='二次障害').length,1);const fresh=createGame();assert.equal(fresh.managerEnding,null);assert.equal(fresh.ended,false);
});
test('重大な無断操作の繰り返しと二重実行は被害を捏造せず既存タクシーエンドを残す',()=>{
 const g=game();execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');execute(g,'job rerun SALES_IMPORT');assert.equal(g.managerEnding,null);assert.equal(g.dispatch.kind,'repeated-unauthorized');tick(g,3);assert.equal(g.result,'対応交代');assert.ok(!g.timeline.some(m=>m.text.includes('一条（PM）')));
});
test('明示された一次報優先を飛ばした場合だけ代送しログは安全に正常実施する',()=>{
 let g=createGame({setbacks:false});start(g);assert.ok(g.timeline.some(m=>m.text==='調査の前に、顧客へ一次報を送れ。原因は確認中でいい'));const before=g.actions;chooseAction(g,nextChoices(g).find(c=>c.command?.startsWith('tail')));assert.equal(g.facts.log,true);assert.equal(g.actions,before+1);assert.equal(g.reported,true);assert.equal(g.firstReportDelegated,true);assert.equal(g.trust,95);assert.equal(g.mental,95);assert.equal(g.mistakes,0);assert.equal(g.dispatch,null);assert.equal(g.managerEnding,null);assert.equal(g.assistCount,undefined);assert.equal(g.messages.customer.filter(m=>m.sender==='鬼塚｜リーダー').length,1);assert.ok(!nextChoices(g).some(c=>c.id==='initial'));g=restoreGame(serializeGame(g));const snapshot=serializeGame(g);send(g,'customer','調査中','initial');assert.equal(serializeGame(g),snapshot);execute(g,'tail -n 30 /logs/SALES_IMPORT.log');assert.equal(g.messages.customer.filter(m=>m.sender==='鬼塚｜リーダー').length,1);assert.equal(g.timeline.filter(m=>m.text.includes('一次報が先だって')).length,1);assert.equal(g.mistakes,0);
});
test('一次報を先に送れば代送・叱責はなく正常復旧まで進める',()=>{
 const g=createGame({setbacks:false});start(g);chooseAction(g,nextChoices(g).find(c=>c.id==='initial'));assert.equal(g.reported,true);for(let i=0;i<20&&!g.ended;i++)chooseAction(g,nextChoices(g)[0]);assert.equal(g.result,'模範復旧');assert.equal(g.firstReportDelegated,false);assert.ok(!g.timeline.some(m=>m.text.includes('一次報が先だって')));
});
test('優先指示がない旧セーブのログ調査には代送も叱責も追加しない',()=>{
 const g=createGame({setbacks:false});start(g);const saved=JSON.parse(serializeGame(g));delete saved.game.firstReportInstruction;delete saved.game.firstReportDelegated;saved.game.timeline=saved.game.timeline.filter(m=>!m.text.startsWith('調査の前に'));const h=restoreGame(JSON.stringify(saved));execute(h,'tail -n 30 /logs/SALES_IMPORT.log');assert.equal(h.firstReportDelegated,false);assert.equal(h.reported,false);assert.equal(h.facts.log,true);
});

test('実時間では時計が進まず、会議の回答でも選択時に1分進む',async()=>{
 const {advanceIncidentTime,deadlineText}=await import('../dist/engine.js');const g=meetingGame();const before={minutes:g.minutes,clock:g.clock,tech:g.techIdle,reply:g.replyIdle,trust:g.trust};advanceIncidentTime(g,6);assert.equal(g.minutes,before.minutes);assert.equal(g.clock,before.clock);assert.equal(g.techIdle,before.tech);assert.equal(g.replyIdle,before.reply);assert.equal(g.trust,before.trust);assert.match(deadlineText(g),/03:00まで あと/);meetingAnswer(g,'meeting-good');assert.equal(g.minutes,before.minutes+1);
});
test('3時までの残り時間と超過を表示し新しい敗北条件は作らない',async()=>{
 const {advanceIncidentTime,deadlineText}=await import('../dist/engine.js');const g=createGame();start(g);assert.equal(deadlineText(g),'03:00まで あと1時間43分');g.minutes=180;advanceIncidentTime(g,6);assert.equal(deadlineText(g),'03:00 · 復旧期限です');g.minutes++;advanceIncidentTime(g,6);assert.equal(deadlineText(g),'03:00から 0時間01分超過');assert.equal(g.ended,false);assert.equal(g.trust,100);assert.equal(g.mental,100);g.incidentSeconds=25;const h=restoreGame(serializeGame(g));assert.equal(h.incidentSeconds,25);h.ended=true;const before=serializeGame(h);advanceIncidentTime(h,60);assert.equal(serializeGame(h),before);
});

test('序盤の一次報以外は社内共有も含め優先指示違反として一度だけ減点する',()=>{
 for(const choiceId of ['internal-report','log']){
  let g=createGame({setbacks:false});start(g);
  const choice=nextChoices(g).find(c=>choiceId==='log'?c.command?.startsWith('tail'):choiceId==='rerun'?c.command==='job rerun SALES_IMPORT':c.id===choiceId);
  assert.ok(choice);chooseAction(g,choice);assert.equal(g.firstReportDelegated,true);assert.equal(g.reported,true);
  assert.equal(g.events.filter(e=>e.text.includes('信用-5・メンタル-5')).length,1);
  if(choiceId!=='rerun'){assert.equal(g.trust,95);assert.equal(g.mental,95);assert.equal(g.mistakes,0);assert.equal(g.dispatch,null);}
  g=restoreGame(serializeGame(g));execute(g,'tail -n 30 /logs/SALES_IMPORT.log');
  assert.equal(g.events.filter(e=>e.text.includes('信用-5・メンタル-5')).length,1);
 }
});
