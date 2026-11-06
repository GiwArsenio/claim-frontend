const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 const err=[];
 p.on('pageerror',e=>err.push('pageerror: '+e.message.slice(0,90)));
 p.on('console',m=>{if(m.type()==='error')err.push('console: '+m.text().slice(0,90))});
 const reqs=[];
 p.on('response',r=>{const u=r.url();if(u.includes('/api/v1/'))reqs.push(r.status()+' '+u.slice(30,85))});
 await p.goto('https://claimyourjob.com/fr/',{waitUntil:'networkidle',timeout:60000});
 await p.waitForTimeout(5000);
 const etat=await p.evaluate(()=>({
   cards:document.querySelectorAll('a.oc').length,
   slug:document.querySelectorAll('a.oc[data-slug]').length,
   id:document.querySelectorAll('a.oc[id]').length,
   zone:document.getElementById('liste')?.innerHTML?.length||0}));
 console.log('  cards:',etat.cards,'avec data-slug:',etat.slug,'avec id:',etat.id,'zone:',etat.zone);
 console.log('  reponses API:',reqs.slice(0,3).join(' | ')||'aucune');
 console.log('  erreurs:',err.slice(0,3).join(' | ')||'aucune');
 await b.close();
})();
