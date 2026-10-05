import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './src/core/api/modules/isolation.api';export * from './src/core/api/modules/gasTester.api';export {odataClient} from './src/core/api/odataClient';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env':'{}'}});
const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {isolationApi,gasTesterApi,odataClient}=mod.exports;
test('isolation and gas reads propagate SAP failures and never return local fallback evidence',async()=>{
 const original=odataClient.get;
 try{
  odataClient.get=async()=>{throw new Error('SAP unavailable');};
  await assert.rejects(()=>isolationApi.list(),/SAP unavailable/);
  await assert.rejects(()=>isolationApi.read('I1'),/SAP unavailable/);
  await assert.rejects(()=>gasTesterApi.list('P1'),/SAP unavailable/);
  odataClient.get=async()=>({data:{value:[]}});
  assert.deepEqual(await isolationApi.list(),[]);assert.deepEqual(await gasTesterApi.list('P1'),[]);
 }finally{odataClient.get=original;}
});
test('certificate create posts nested items once and only returns SAP numbering',async()=>{
 const original=odataClient.post;let calls=0;
 try{
  odataClient.post=async(url,body)=>{calls++;assert.equal(url,'Isolation');assert.equal(body.IsolationNo,undefined);assert.equal(body._Item[0].ItemNo,undefined);return {data:{...body,IsolationNo:'I1',Status:'CRTD'}};};
  const result=await isolationApi.create({PermitNo:'P1',_Item:[{ReferenceType:'EQUI',ReferenceId:'E1',IsolationPoint:'P1',IsolType:'MECH',IsolMethod:'VALVE',LockTagNo:'L1'}]});
  assert.equal(result.IsolationNo,'I1');assert.equal(calls,1);
  odataClient.post=async()=>{throw new Error('timeout');};
  await assert.rejects(()=>isolationApi.create({PermitNo:'P1',_Item:[{ReferenceType:'EQUI',ReferenceId:'E1',IsolationPoint:'P1',IsolType:'MECH',IsolMethod:'VALVE'}]}),/unconfirmed/);
 }finally{odataClient.post=original;}
});
test('remarks patch requires ETag and rejects immutable linkage or computed status',async()=>{
 const original=odataClient.patch;let calls=0;
 try{
  odataClient.patch=async(url,body,etag)=>{calls++;assert.equal(etag,'W/"1"');assert.deepEqual(body,{Remarks:'Reviewed'});return {data:{IsolationNo:'I1'}};};
  await assert.rejects(()=>isolationApi.update('I1',{Status:'ISOL'},'W/"1"'),/workflow actions/);
  await assert.rejects(()=>isolationApi.update('I1',{PermitNo:'P2'},'W/"1"'),/immutable/);
  await assert.rejects(()=>isolationApi.update('I1',{Remarks:'Reviewed'}),/ETag/);
  await isolationApi.update('I1',{Remarks:'Reviewed'},'W/"1"');assert.equal(calls,1);
 }finally{odataClient.patch=original;}
});
test('GasTest create is blocked before a forbidden POST',async()=>{
 const original=odataClient.post;let calls=0;
 try{odataClient.post=async()=>{calls++;};await assert.rejects(()=>gasTesterApi.create({PermitNo:'P1'}),/read-only/);assert.equal(calls,0);}finally{odataClient.post=original;}
});
