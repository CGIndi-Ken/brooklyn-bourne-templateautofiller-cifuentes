const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const {browser,pageURL}=await launchBrowser();
  try{
    const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const initial={templates:{
        'Brooklyn Bourne | Junior Cake | 1g badder (I)':{name:'Junior Cake',strain:'Cake',cost:'7',vendor:'Supplier A'},
        'Brooklyn Bourne | Junior Runtz | 3.5g (H)':{name:'Runtz',strain:'Runtz',vendor:'Supplier A'},
        'Brooklyn Bourne | Junior Runtz | 3.5g (H) (imported 1)':{name:'Runtz imported',strain:'Runtz',vendor:'Supplier A'},
        'Dank | Chemdog | 3.5g (H)':{name:'Chemdog',vendor:'Supplier B'},
        Plain:{name:'Plain product'},
      }};
      for(let i=0;i<60;i++)initial.templates[`Dank | Product ${i}`]={name:`Product ${i}`,brand:'Dank'};
      const read=()=>JSON.parse(localStorage.getItem('pickerStore') || JSON.stringify(initial));
      window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>localStorage.setItem('pickerStore',JSON.stringify({...read(),...data})),remove:async key=>{const data=read();delete data[key];localStorage.setItem('pickerStore',JSON.stringify(data));}},onChanged:{addListener(){}}}};
    });
    await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>document.getElementById('learnedInfo').textContent);
    const toggle=page.locator('#templatePickerToggle'),panel=page.locator('#templatePickerPanel'),search=page.locator('#templatePickerSearch');
    assert.equal(await panel.isVisible(),false);await toggle.click();
    assert.equal(await page.locator('.template-group').count(),3);
    assert.equal(await page.locator('.template-choice').count(),0,'Collapsed groups must not create every product button');
    await page.locator('.template-group summary').filter({hasText:'Brooklyn Bourne'}).click();
    await page.locator('.template-choice').first().waitFor({state:'visible'});
    assert.equal(await page.locator('.template-choice').count(),3);
    assert.match(await page.locator('.template-choice').first().innerText(),/^Junior Cake/);
    await search.fill('supplier a runtz');
    assert.equal(await page.locator('.template-choice:visible').count(),2);
    assert.match(await page.locator('#templatePickerStatus').textContent(),/2 templates/);
    await page.locator('#templatePickerCollapse').click();
    assert.equal(await search.inputValue(),'supplier a runtz','Condensing keeps the current search');
    assert.equal(await page.locator('.template-choice').count(),0);
    await page.locator('#templatePickerExpand').click();
    assert.equal(await page.locator('.template-choice:visible').count(),2);
    await search.fill('junior cake');
    const fullName='Brooklyn Bourne | Junior Cake | 1g badder (I)';
    await page.getByRole('button',{name:fullName,exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('f_name').value==='Junior Cake');
    assert.equal(await panel.isVisible(),false);
    assert.equal(await toggle.textContent(),fullName);
    assert.equal(await page.locator('#f_cost').inputValue(),'7');
    await page.evaluate(()=>saveDraft());await page.reload();
    await page.waitForFunction(()=>document.getElementById('templatePickerToggle').textContent.includes('Junior Cake'));
    await toggle.click();await search.fill('');await page.locator('#templatePickerCollapse').click();
    await page.locator('#templatePickerSort').selectOption('desc');
    assert.match(await page.locator('.template-group summary').first().textContent(),/Other templates/);
    await page.locator('#templatePickerExpand').click();
    assert.equal(await page.locator('.template-choice').count(),65);
    assert.equal(await page.locator('#templatePickerResults').evaluate(el=>el.getBoundingClientRect().height<=265),true);
    await search.fill('not present');assert.match(await page.locator('#templatePickerStatus').textContent(),/No matching/);
    await search.press('Escape');assert.equal(await panel.isVisible(),false);
    assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
    await toggle.click();await page.locator('#newBtn').click();
    assert.equal(await panel.isVisible(),false);assert.match(await toggle.textContent(),/Choose/);
    await toggle.click();await search.fill('chemdog');await search.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
    await page.locator('#themeSelect').focus();assert.equal(await panel.isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('Passed grouped lazy template chooser, brand/strain/vendor search, preserved filtering, sorting, imported copies, exact selection/draft recovery, keyboard close, outside focus and bounded narrow layout.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
