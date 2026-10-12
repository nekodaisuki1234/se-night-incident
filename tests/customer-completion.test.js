import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,start,execute,send,chooseAction,nextChoices,serializeGame,restoreGame,objectiveText} from '../dist/engine.js';
function recovered(){const g=createGame({setbacks:false});start(g);g.firstReportInstruction=false;g.minutes=280;g.file=true;g.facts.log=g.facts.files=g.facts.checked=g.facts.history=true;g.approved.add('SALES_IMPORT');execute(g,'job rerun SALES_IMPORT');g.internalRequest=null;return g;}
const report=g=>send(g,'customer','正常終了と件数一致を報告します','complete');
const boss=g=>g.timeline.findLast(m=>m.sender==='鬼塚｜リーダー').text;
test('顧客了承と鬼塚の受領・MISSIONが一致し、連打・保存再開後も引き継ぎへ進む',()=>{
 let g=recovered();execute(g,'job status SALES_SUMMARY');execute(g,"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");send(g,'internal','影響整理','impact-review');send(g,'internal','社内復旧報告','internal-complete');
 const choice=nextChoices(g).find(c=>c.id==='complete');chooseAction(g,choice);
 assert.equal(g.customerReport.status,'accepted');assert.equal(g.customerCompleted,true);assert.match(g.messages.customer.at(-1).text,/対応ありがとうございました/);assert.match(boss(g),/顧客の了承は取れたな.*引き継ぎ/);assert.doesNotMatch(boss(g),/まだ完了|確認が残|顧客.*報告して/);assert.match(objectiveText(g),/社内・顧客報告は完了/);
 g=restoreGame(serializeGame(g));const snapshot=serializeGame(g);chooseAction(g,choice);report(g);assert.equal(serializeGame(g),snapshot);
 const handover=nextChoices(g).find(c=>c.id==='handover');assert.ok(handover);chooseAction(g,handover);assert.equal(g.result,'END：通常出勤');assert.equal(g.deadlineEnded,undefined);
});
test('不足項目は顧客と鬼塚で共有し、解消後の再報告で古い未了承返信を生成しない',()=>{
 let g=recovered();report(g);assert.equal(g.customerReport.status,'needs-confirmation');assert.equal(g.customerCompleted,false);const missing=g.customerReport.missing;
 for(const label of missing){assert.ok(g.messages.customer.at(-1).text.includes(label));assert.ok(boss(g).includes(label));}assert.match(boss(g),/ジョブの正常終了は確認できている/);
 g=restoreGame(serializeGame(g));execute(g,'job status SALES_SUMMARY');execute(g,"SELECT COUNT(*) FROM sales WHERE business_date = '20261012';");send(g,'internal','影響整理','impact-review');send(g,'internal','社内報告','internal-complete');const from=g.timeline.length;report(g);
 assert.equal(g.customerReport.status,'accepted');assert.deepEqual(g.customerReport.missing,[]);assert.ok(!g.timeline.slice(from).some(m=>/まだ完了|が残っているな|了承には/.test(m.text)));assert.match(boss(g),/顧客の了承は取れたな/);
});
test('記録まで実施済みなら新たな未完了作業を捏造しない',()=>{const g=recovered();g.facts.summary=g.facts.count=g.impactReviewed=g.internalReported=g.handoverDone=true;report(g);assert.equal(g.result,'END：通常出勤');assert.ok(g.timeline.some(m=>m.text==='顧客の了承は取れたな。確認・報告・引き継ぎまで受け取った。'));assert.ok(!g.timeline.some(m=>m.text.includes('あとは対応経緯と残件')));});
