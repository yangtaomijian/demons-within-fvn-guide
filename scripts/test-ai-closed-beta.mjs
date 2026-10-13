// Offline regressions only: no Google, Provider, production sessions or network.
import assert from 'node:assert/strict';
globalThis.document={documentElement:{lang:'en'}};
const {CONFIG}=await import('../assets/ai/config.mjs');
const {createPanelTransport,descriptions}=await import('../assets/ai/adapter.mjs');
const {t}=await import('../assets/ai/strings.mjs');
assert.equal(CONFIG.enabled,true);assert.equal(CONFIG.provider,'DISABLED');assert.equal(CONFIG.ownerBootstrapOnly,true);assert.equal(CONFIG.history,false);
assert.match(t('Closed Beta 尚未开放测试资格；登录不会自动获得额度。'),/does not grant/);
assert.match(t(descriptions.BETA_NOT_APPROVED),/awaiting Closed Beta approval/);
const source={id:'fixture-faq',title:'FAQ · Where should I save?',locale:'en',mappingType:'excerpt',url:'https://demons-within.carambi.com/en/guide/faq.html#save-for-replay',text:'Keep a manual save at the start of a recognizable scene, then use separate slots before important choices.'};
function setup({member=false,badSource=false}={}){
 const calls=[],store=new Map();
 const transport=createPanelTransport({origin:'https://demons-within.carambi.com',storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},fetchImpl:async(url,options)=>{
  const p=new URL(url).pathname;calls.push({p,method:options.method});
  const data=p==='/api/session'?{authenticated:true,ready:member,user:{id:'fixture-user'},csrf:'fixture-only',beta:{approved:member},code:member?null:'BETA_NOT_APPROVED'}:p==='/api/request-ticket'?member?{requestId:'fixture-request-0001',ticket:'fixture-ticket-only'}:{status:'rejected',code:'BETA_NOT_APPROVED'}:{status:'completed',segments:[{text:'Use separate save slots before important choices.',evidenceIds:['fixture-faq']}],sources:[badSource?{...source,url:'https://example.invalid/other.html'}:source],refundState:'NOT_REFUNDED'};
  return {status:p==='/api/request-ticket'&&!member?403:200,type:'basic',json:async()=>data};
 }});return {calls,transport};
}
const denied=setup();await denied.transport.snapshot();assert.equal(denied.transport.state().session.ready,false);const rejected=await denied.transport.send('offline fixture');assert.equal(rejected.raw.code,'BETA_NOT_APPROVED');assert.equal(denied.calls.filter(x=>x.p==='/api/ask').length,0);
const accepted=setup({member:true});await accepted.transport.snapshot();const answer=await accepted.transport.send('offline fixture');assert.equal(answer.status,'answer');assert.equal(answer.segments[0].references[0].url,source.url);assert.equal(accepted.transport.sources().get(source.url).variants.excerpt.text,source.text);assert.equal(accepted.calls.filter(x=>x.p==='/api/ask').length,1);
const invalid=setup({member:true,badSource:true});await invalid.transport.snapshot();const failed=await invalid.transport.send('offline fixture');assert.equal(failed.raw.code,'SOURCE_CONTRACT_FAILURE');assert.equal(failed.segments.length,0);assert.equal(invalid.transport.sources().size,0);
console.log(JSON.stringify({status:'PASS_CLOSED_BETA_FRONTEND_OFFLINE',groups:4,productionCalls:0,modelCalls:0,closedEligibility:true,validCitationDisplayed:true,invalidCitationFailsClosed:true}));
