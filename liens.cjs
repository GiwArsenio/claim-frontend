const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.goto('https://claimyourjob.com/fr/',{waitUntil:'load',timeout:60000});
 await p.waitForTimeout(6000);
 const liens=await p.evaluate(()=>[...document.querySelectorAll('a.oc')].map(a=>({
   href:a.getAttribute('href'),
   titre:a.querySelector('.ctitle')?.textContent?.slice(0,45),
   societe:a.querySelector('.csub')?.textContent?.slice(0,22)})));
 liens.forEach((l,i)=>console.log('  '+i+' href='+(l.href||'').slice(0,55)+' | '+(l.societe||'')+' | '+(l.titre||'')));
 console.log('  total:',liens.length,'cards');
 await b.close();
})();
