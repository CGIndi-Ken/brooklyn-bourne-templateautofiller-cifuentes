// Deterministic SKU tests: real filler functions, mocked page and virtual time.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname,'fillers.js'),'utf8');
const def = {key:'generateSku',label:'Generate SKU'};
function fixture(config={}) {
  let now=0, clicks=0, generatedAt=Infinity, menu=!!config.menu;
  const button = {
    isConnected:true, offsetParent:{},
    get disabled(){return !!config.disabled || now < (config.readyAt || 0);},
    getAttribute(){return config.ariaDisabled ? 'true' : null;},
    click(){
      if (this.disabled || config.ariaDisabled) return;
      clicks++;
      if (!config.fail && clicks >= (config.succeedOn || 1)) generatedAt=now+(config.delay || 0);
    },
  };
  const context=vm.createContext({
    status:{set(){}},
    document:{getElementById:()=>config.missingInput ? null : {value: config.existing || (now>=generatedAt ? 'SKU-123' : '')}},
    elFor:()=>config.missingButton || now<(config.buttonAt || 0) ? null : button,
    anyOptionsOpen:()=>menu,
    closeMenu:async()=>{menu=false;},
    sleep:async ms=>{now+=ms;},
    waitFor:async(fn, timeout=4000)=>{
      const end=now+timeout;
      while(now<end){const result=fn();if(result)return result;now+=100;}
      return null;
    },
  });
  vm.runInContext(source,context);
  return {context, stats:()=>({now,clicks,menu})};
}
async function run(config) {
  const f=fixture(config);
  const error=await f.context.fillClick(def);
  return {error,...f.stats()};
}
async function main(){
  // Reproduce the old behavior using its original unchecked click and 3s wait.
  for(const config of [{readyAt:700},{delay:4000}]){
    const f=fixture(config);
    const oldResult=await vm.runInContext(`(async()=>{
      elFor({}).click();
      return !!(await waitFor(()=>document.getElementById('input-input_SKU:').value.trim(),3000));
    })()`,f.context);
    assert.equal(oldResult,false);
    assert.equal((await run(config)).error,'');
  }
  for(const config of [{},{readyAt:700},{buttonAt:900},{delay:4000},{succeedOn:2},{menu:true},{existing:'KEEP',missingButton:true}]){
    const result=await run(config);
    assert.equal(result.error,'',JSON.stringify(config));
    if(config.existing)assert.equal(result.clicks,0);
    if(config.succeedOn)assert.equal(result.clicks,2);
    if(config.menu)assert.equal(result.menu,false);
  }
  for(const config of [{disabled:true},{ariaDisabled:true},{missingButton:true}]){
    const result=await run(config);
    assert.match(result.error,/button missing, hidden, or disabled/);
    assert.equal(result.clicks,0);
  }
  assert.match((await run({missingInput:true})).error,/SKU field not found/);
  const failed=await run({fail:true});
  assert.match(failed.error,/still empty after two attempts/);
  assert.equal(failed.clicks,2);
  console.log('Passed: reproduced old disabled-button/slow-response failures; new readiness, delayed render, 4s response, retry, existing SKU, menu, missing field, and failure-reporting checks.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
