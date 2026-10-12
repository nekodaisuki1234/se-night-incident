import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,start,execute,send,requestApproval,tick,answerCall,parseCommandReport,nextChoices,chooseAction,progressText,messageSurface,objectiveText,customerStatusText,serializeGame,restoreGame} from '../dist/engine.js';
function game(){const g=createGame({setbacks:false});start(g);return g;}
function prepare(g){execute(g,'tail -n 30 /logs/SALES_IMPORT.log');execute(g,'ls -l /data/inbox');send(g,'internal','確認依頼','request-file');execute(g,'check /data/inbox/sales_20261012.csv');execute(g,"SELECT * FROM batch_history WHERE business_date = '20261012';");}
function verify(g){execute(g,'job status SALES_SUMMARY');execute(g,"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");send(g,'internal','復旧・件数一致を社内報告','internal-complete');}
test('承認と検証を経た正常復旧',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','復旧報告','complete');assert.equal(g.result,'模範復旧');assert.equal(g.mental,100);});
test('未着時の再実行は復旧しない',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,false);assert.equal(g.mistakes,1);assert.ok(g.mental<100);});
test('対象別承認を持っていても別系統の誤停止では出動する',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.secondary,true);assert.equal(g.approved.has('ACCOUNT_SYNC'),false);assert.equal(g.dispatch.kind,'wrong-job');assert.equal(g.ended,false);const actions=g.actions;requestApproval(g,'ACCOUNT_SYNC');execute(g,'job rerun ACCOUNT_SYNC');assert.equal(g.actions,actions);assert.equal(g.secondary,true);tick(g,3);assert.equal(g.result,'対応交代');});
test('無断でも復旧できるが手順評価が下がる',()=>{const g=game();prepare(g);execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','報告','complete');assert.equal(g.result,'復旧したが要反省');});
test('根拠不足の承認・復旧報告は成功しない',()=>{const g=game();requestApproval(g,'SALES_IMPORT');assert.equal(g.approved.size,0);send(g,'customer','復旧','complete');assert.equal(g.ended,false);prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');send(g,'customer','復旧','complete');assert.equal(g.ended,false);});
test('定型文とコマンドの連打で猶予を無限延長できない',()=>{const g=game();send(g,'customer','調査中','initial');tick(g,30);execute(g,'job status');tick(g,40);send(g,'customer','調査中','initial');execute(g,'job status');assert.equal(g.replyIdle,0);assert.equal(g.techIdle,40);tick(g,80);assert.equal(g.call,true);tick(g,150);assert.equal(g.ended,true);});
test('電話で根拠のない復旧時刻を約束すると信用が下がる',()=>{const g=game();tick(g,26);assert.equal(g.call,true);answerCall(g,'promise');assert.equal(g.trust,85);assert.equal(g.call,false);});
test('自由入力の否定文ではファイル到着やクリアを捏造しない',()=>{const g=game();send(g,'internal','当日ファイルの確認を連携元にお願いしますとは言っていない');assert.equal(g.file,false);send(g,'customer','復旧していない、件数一致していない');assert.equal(g.ended,false);});
test('処理済みの二重実行は出動し到着後も作業を再開できない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');assert.equal(g.dispatch.kind,'duplicate');assert.equal(g.ended,false);tick(g,3);assert.equal(g.result,'対応交代');const actions=g.actions;execute(g,'job stop ACCOUNT_SYNC');tick(g,500);assert.equal(g.actions,actions);assert.equal(g.secondary,false);});
test('チャットの操作報告が実際の調査として一度だけ反映される',()=>{const g=game();send(g,'internal','「tail -n 30 /logs/SALES_IMPORT.log」を入力しました。');assert.equal(g.facts.log,true);assert.equal(g.actions,1);assert.equal(g.timeline.filter(m=>m.channel==='operations'&&m.sender==='あなた').length,1);assert.ok(g.timeline.some(m=>m.sender==='操作結果'&&m.text.includes('INPUT FILE NOT FOUND')));});
test('チャットからSQLと復旧操作を実行できる',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');send(g,'internal','job rerun SALES_IMPORTを入力しました');send(g,'internal','job status SALES_SUMMARYを入力しました');send(g,'internal',"「SELECT COUNT(*) FROM sales WHERE business_date = '20261012';」を入力しました。");send(g,'internal','社内復旧報告','internal-complete');send(g,'customer','復旧報告','complete');assert.equal(g.result,'模範復旧');});
test('未実施・曖昧な報告はコマンド実行として扱わない',()=>{for(const s of ['job stop ACCOUNT_SYNCを入力していません','コマンドを入力しました','job rerun SALES_IMPORTを実行したい'])assert.equal(parseCommandReport(s),null);});
test('各段階で3択を提示し、選択のみで正常復旧できる',()=>{const g=game();for(let i=0;i<15&&!g.ended;i++){const choices=nextChoices(g);assert.equal(choices.length,3);chooseAction(g,choices[0]);}assert.equal(g.result,'模範復旧');assert.deepEqual(nextChoices(g),[]);});
test('3択の誤停止を選ぶと通常選択肢を閉じて到着へ進む',()=>{const g=game();chooseAction(g,nextChoices(g)[1]);chooseAction(g,nextChoices(g)[0]);const stop=nextChoices(g).find(c=>c.command==='job stop ACCOUNT_SYNC');assert.ok(stop);chooseAction(g,stop);assert.equal(g.secondary,true);assert.deepEqual(nextChoices(g),[]);assert.equal(g.dispatch.phase,'travelling');tick(g,3);assert.equal(g.result,'対応交代');});
test('鬼塚は正常ルートの進展を受け取り、同じ確認には叱責を足さない',()=>{const g=game();for(let i=0;i<15&&!g.ended;i++)chooseAction(g,nextChoices(g)[0]);assert.equal(g.result,'模範復旧');assert.ok(g.timeline.some(m=>m.sender==='鬼塚｜リーダー'&&m.text.includes('受け取った')));});
test('電話の3つの返答にもユーザー報告と鬼塚の指摘が入る',()=>{for(const choice of ['ignore','promise','explain']){const g=game();const count=g.timeline.length;answerCall(g,choice);assert.ok(g.timeline.slice(count).some(m=>m.sender==='あなた'));assert.ok(g.timeline.slice(count).some(m=>m.sender==='鬼塚｜リーダー'));}});
test('復旧後の電話は原因調査中へ逆戻りしない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');answerCall(g,'explain');const report=g.timeline.filter(m=>m.sender==='あなた').at(-1).text;assert.match(report,/正常終了/);assert.doesNotMatch(report,/原因.*調査/);});
test('承認済みの状況報告は承認待ちにならない',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');assert.match(progressText(g),/承認を得ました/);const choice=nextChoices(g).find(c=>c.id==='file-report');chooseAction(g,choice);assert.match(g.messages.customer.at(-1).text,/承認まで完了/);});
test('誤った復旧時刻の約束を3択で訂正できる',()=>{const g=game();answerCall(g,'promise');const choices=nextChoices(g);assert.equal(choices.length,3);const correction=choices.find(c=>c.id==='progress-report');assert.match(correction.text,/訂正/);chooseAction(g,correction);assert.equal(g.correctionNeeded,false);});
test('初動ミスだけで二次障害からの生還にならない',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);send(g,'customer','完了','complete');assert.equal(g.result,'復旧したが要反省');});
test('件数確認済みなら確認を巻き戻さず終了判断を迫る',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');verify(g);const choice=nextChoices(g).find(c=>c.command==='job status SALES_SUMMARY');chooseAction(g,choice);assert.equal(g.ended,false);assert.equal(g.assistCount,undefined);assert.equal(g.mental,100);assert.ok(nextChoices(g).some(c=>c.id==='complete'));pick(g,'complete');assert.equal(g.result,'模範復旧');});
function pick(g,match){const choices=nextChoices(g);assert.equal(choices.length,3);const choice=choices.find(c=>c.id===match||c.command===match||(c.type==='approval'&&match==='approve'));assert.ok(choice,'Missing choice: '+match);chooseAction(g,choice);}
function damagedGame(){const g=createGame();start(g);for(const step of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file'])pick(g,step);assert.equal(g.file,false);pick(g,'escalate-file');assert.equal(g.fileDamaged,true);pick(g,'check /data/inbox/sales_20261012.csv');assert.equal(g.facts.checked,false);return g;}
function readyHard(){const g=damagedGame();for(const step of ['resend-file','check /data/inbox/sales_20261012.csv',"SELECT * FROM batch_history WHERE business_date = '20261012';",'approve'])pick(g,step);return g;}
test('連絡不通・欠損・DBロックを選択のみで乗り越えられる',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,false);assert.equal(g.lockEncountered,true);assert.equal(g.mistakes,0);assert.equal(g.approved.size,0);for(const step of ["SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';",'release-lock','approve','job rerun SALES_IMPORT','job status SALES_SUMMARY',"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';",'internal-complete','complete'])pick(g,step);assert.equal(g.result,'模範復旧');assert.ok(g.criticCount>=3);});
test('田山に承認を求めても有効な承認は得られない',()=>{const g=damagedGame();pick(g,'critic-approval');assert.equal(g.approved.size,0);assert.match(g.timeline.findLast(m=>m.sender==='田山｜ベテラン').text,/現場のリーダー判断/);assert.equal(g.fileDamaged,false);assert.equal(g.assistCount,1);});
test('金融データの独断修正は田山が承認を否定し鬼塚が出動する',()=>{const g=damagedGame();pick(g,'patch-file');assert.equal(g.mistakes,1);assert.equal(g.assistCount,undefined);assert.ok(tayama(g).some(t=>t.includes('承認したわけではない')));assert.equal(g.dispatch.kind,'data-edit');assert.equal(g.fileDamaged,true);tick(g,3);assert.equal(g.result,'対応交代');});
test('ファイル差し替えと再実行失敗で古い承認を使えない',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');requestApproval(g,'SALES_IMPORT');assert.equal(g.approved.size,0);assert.equal(g.lockReleased,false);execute(g,'job status');assert.match(g.terminal.at(-1).text,/RC=28/);});

test('顧客の送受信と電話履歴はTeamsに入らない',()=>{const g=game();send(g,'customer','初報','initial');answerCall(g,'explain');const teams=g.timeline.filter(m=>messageSurface(m)==='teams');assert.ok(teams.length);assert.ok(teams.every(m=>m.channel!=='customer'&&!m.sender.startsWith('高橋')));assert.ok(g.timeline.filter(m=>messageSurface(m)==='customer').some(m=>m.sender==='あなた'));});
test('田山は手修正を勧めず、鬼塚は技術手順を教えない',()=>{const g=damagedGame();const comments=g.timeline.filter(m=>m.sender==='田山｜ベテラン').map(m=>m.text).join('');assert.match(comments,/整合性/);assert.doesNotMatch(comments,/手で補|SELECT|job rerun/);const boss=g.timeline.filter(m=>m.sender==='鬼塚｜リーダー').map(m=>m.text).join('');assert.match(boss,/どうすんだ/);assert.doesNotMatch(boss,/検証しろ|ログを読め|処理履歴|チェックサム/);assert.ok(nextChoices(g).every(c=>!c.label.includes('助言どおり')));});

test('後半で続報メールを繰り返しても未返信扱いにせず、技術停滞は別に数える',()=>{const g=readyHard();tick(g,61);pick(g,'progress-report');assert.equal(g.replyIdle,0);assert.equal(g.techIdle,61);tick(g,61);pick(g,'progress-report');assert.equal(g.replyIdle,0);assert.equal(g.techIdle,0);assert.equal(g.assistCount,1);assert.equal(g.lockEncountered,true);assert.ok(nextChoices(g).some(c=>c.command?.includes('session_locks')));});
test('ロック解除後の報告は前のファイル到着の話に戻らない',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');pick(g,"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");pick(g,'release-lock');assert.match(progressText(g),/ロック解除/);assert.match(objectiveText(g),/改めてリーダー/);pick(g,'file-report');assert.match(g.messages.customer.at(-1).text,/ロック解除/);pick(g,'approve');pick(g,'file-report');assert.match(g.messages.customer.at(-1).text,/再実行承認/);pick(g,'job rerun SALES_IMPORT');assert.equal(g.recovered,true);});
test('早すぎる完了報告は未確認の作業だけを伝え、確認後は終了できる',()=>{const g=game();prepare(g);requestApproval(g,'SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');pick(g,'complete');assert.equal(g.ended,false);assert.match(g.messages.customer.at(-1).text,/後続/);assert.equal(g.facts.summary,true);pick(g,'complete');assert.match(g.messages.customer.at(-1).text,/SQLで処理件数/);assert.doesNotMatch(g.messages.customer.at(-1).text,/後続の売上集計の確認が残/);assert.equal(g.facts.count,true);assert.match(objectiveText(g),/復旧確認は完了/);pick(g,'internal-complete');pick(g,'complete');assert.equal(g.ended,true);});
test('再着信への現状説明も返信として扱う',()=>{const g=game();answerCall(g,'explain');tick(g,80);answerCall(g,'explain');assert.equal(g.replyIdle,0);assert.equal(g.replyLevel,0);assert.equal(g.techIdle,80);});

test('応答待ちを選ぶと森が二次連絡先へ連絡しファイルが届く',()=>{const g=createGame();start(g);for(const c of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file','wait-vendor'])pick(g,c);assert.equal(g.file,true);assert.equal(g.fileDamaged,true);assert.equal(g.assistCount,1);assert.equal(g.trust,94);assert.ok(nextChoices(g).some(c=>c.command==='check /data/inbox/sales_20261012.csv'));assert.ok(g.timeline.some(m=>m.sender==='森｜監視'&&m.text.includes('二次連絡先へ確認')));});
test('最初の顧客報告は正当な連絡、同じ報告を重ねたら森が調査を進める',()=>{const g=game();pick(g,'tail -n 30 /logs/SALES_IMPORT.log');pick(g,'ls -l /data/inbox');pick(g,'file-report');assert.equal(g.assistCount,undefined);pick(g,'file-report');assert.equal(g.file,true);assert.equal(g.assistCount,1);assert.equal(g.recovered,false);assert.ok(g.timeline.some(m=>m.sender==='鬼塚｜リーダー'&&m.text.includes('同じ報告')));});
test('森の代行もロック解除や再承認を飛ばさない',()=>{const g=readyHard();pick(g,'job rerun SALES_IMPORT');pick(g,"SELECT * FROM session_locks WHERE job_name = 'SALES_IMPORT';");pick(g,'critic-approval');assert.equal(g.lockReleased,true);assert.equal(g.recovered,false);assert.equal(g.approved.size,0);assert.ok(nextChoices(g).some(c=>c.type==='approval'));});

test('詰められるとメンタルが減り、下限は0',()=>{const g=game();assert.equal(g.mental,100);answerCall(g,'promise');assert.equal(g.mental,90);tick(g,90);assert.equal(g.mental,74);g.mental=5;execute(g,'job rerun SALES_IMPORT');assert.equal(g.mental,0);});
test('森の代行で信用とメンタルが別々に減る',()=>{const g=createGame();start(g);for(const c of ['tail -n 30 /logs/SALES_IMPORT.log','ls -l /data/inbox','request-file','wait-vendor'])pick(g,c);assert.equal(g.trust,94);assert.equal(g.mental,90);});

test('初回無断実行は電話、危険操作が続いて出動したら電話分岐を閉じる',()=>{const g=game();execute(g,'job rerun SALES_IMPORT');assert.equal(g.call,true);assert.ok(g.callReason);assert.equal(g.dispatch,null);answerCall(g,'explain');execute(g,'job stop ACCOUNT_SYNC');assert.equal(g.call,false);assert.equal(g.callReason,null);assert.equal(g.dispatch.kind,'wrong-job');});
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
 const g=game();execute(g,'job stop ACCOUNT_SYNC');assert.match(tayama(g).at(-1),/チャットでは確認/);assert.ok(g.messages.internal.some(m=>m.sender==='鬼塚｜リーダー'&&m.text.includes('正常稼働中の別系統')));assert.equal(g.dispatch.kind,'wrong-job');
 const h=game();prepare(h);execute(h,'job rerun SALES_IMPORT');assert.equal(h.recovered,true);assert.equal(h.dispatch,null);assert.match(tayama(h).at(-1),/実施判断の経緯/);assert.doesNotMatch(h.messages.internal.findLast(m=>m.sender==='鬼塚｜リーダー').text,/別系統|対象が違/);
});
test('田山への実際の相談だけで責任を返し、連続する言い換えは省く',()=>{
 const g=game();requestApproval(g,'SALES_IMPORT');assert.equal(tayama(g).length,0);
 send(g,'internal','実行してよいですか','critic-approval');assert.match(tayama(g).at(-1),/現場のリーダー判断/);const n=tayama(g).length;
 send(g,'internal','実行してよいですか','critic-approval');assert.equal(tayama(g).length,n);assert.equal(g.approved.size,0);
 execute(g,'tail -n 30 /logs/SALES_IMPORT.log');send(g,'internal','実行してよいですか','critic-approval');assert.match(tayama(g).at(-1),/現物を見ていない/);
 execute(g,'job rerun SALES_IMPORT');const before=tayama(g).length;send(g,'internal','もう一度相談','critic-approval');assert.equal(tayama(g).length,before);
});
test('使用済み台詞は再開後も保持し旧セーブの台詞からも復元する',()=>{
 let g=game();send(g,'internal','相談','critic-approval');execute(g,'tail -n 30 /logs/SALES_IMPORT.log');g=restoreGame(serializeGame(g));send(g,'internal','相談','critic-approval');assert.equal(new Set(tayama(g)).size,tayama(g).length);
 const raw=JSON.parse(serializeGame(g));delete raw.game.tayamaUsed;delete raw.game.tayamaLastKind;delete raw.game.tayamaLastAction;
 g=restoreGame(JSON.stringify(raw));assert.ok(g);const n=tayama(g).length;send(g,'internal','相談','critic-approval');assert.equal(tayama(g).length,n);
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
 const g=game();const stale=nextChoices(g)[0];execute(g,'job stop ACCOUNT_SYNC');const snapshot=serializeGame(g);
 for(let i=0;i<5;i++){chooseAction(g,stale);execute(g,'job status');execute(g,'job rerun ACCOUNT_SYNC');send(g,'customer','復旧しました','complete');send(g,'internal','依頼','request-file');requestApproval(g,'ACCOUNT_SYNC');answerCall(g,'promise');start(g);}
 assert.equal(serializeGame(g),snapshot);assert.deepEqual(nextChoices(g),[]);
});
test('出動中の保存再開でも到着までの残り時間と理由を保ち一度だけ終了',()=>{
 let g=game();execute(g,'job stop ACCOUNT_SYNC');tick(g,1);const history=JSON.stringify(g.timeline),reason=g.dispatch.reason;g=restoreGame(serializeGame(g));assert.equal(JSON.stringify(g.timeline),history);assert.equal(g.dispatch.remaining,2);assert.equal(g.dispatch.reason,reason);assert.equal(g.ended,false);tick(g,1);assert.equal(g.ended,false);tick(g,1);assert.equal(g.result,'対応交代');
 const arrival=g.timeline.findIndex(m=>m.text==='タクシーが現場に到着しました');assert.ok(arrival>=0);assert.equal(g.timeline[arrival+1].text,'……席、代わって。');
 g=restoreGame(serializeGame(g));tick(g,100);answerCall(g,'explain');assert.equal(g.timeline.filter(m=>m.text==='タクシーが現場に到着しました').length,1);assert.equal(g.events.filter(e=>e.text==='対応交代').length,1);assert.equal(g.dispatch.phase,'arrived');
});
test('旧セーブはそのまま再開でき過去の無断実行は次の危険判断に使う',()=>{
 const g=game();execute(g,'job rerun SALES_IMPORT');const saved=JSON.parse(serializeGame(g));delete saved.game.dispatch;delete saved.game.dangerActions;
 const restored=restoreGame(JSON.stringify(saved));assert.ok(restored);assert.equal(restored.dispatch,null);assert.equal(restored.dangerActions.length,1);execute(restored,'job rerun SALES_IMPORT');assert.equal(restored.dispatch.kind,'repeated-unauthorized');
});
test('田山は最後まで遠隔に留まり出動時も台詞が重複しない',()=>{
 const g=game();execute(g,'job stop ACCOUNT_SYNC');tick(g,3);assert.equal(new Set(tayama(g)).size,tayama(g).length);assert.match(tayama(g).at(-1),/チャットでは確認/);assert.ok(!tayama(g).some(t=>/私も向か|私が現場/.test(t)));
 const cold=g.timeline.findIndex(m=>m.text==='……もういい。そこから何も触るな。');assert.ok(cold>0);assert.ok(!g.timeline.slice(cold).some(m=>m.sender==='鬼塚｜リーダー'&&/どうすんだ|根拠は/.test(m.text)));
});
test('顧客の指摘を社内へ共有してから遠隔の田山が評論する',()=>{
 const g=game();answerCall(g,'promise');const share=g.timeline.findIndex(m=>m.channel==='internal'&&m.sender==='あなた'&&m.text.includes('根拠を問われ'));const critic=g.timeline.findIndex(m=>m.sender==='田山｜ベテラン');assert.ok(share>=0&&critic>share);assert.ok(g.timeline.filter(m=>m.channel==='internal').every(m=>!m.sender.startsWith('高橋')));
});
