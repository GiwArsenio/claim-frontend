const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 await p.goto('https://claimyourjob.com/fr/',{waitUntil:'networkidle',timeout:60000});
 await p.waitForTimeout(3000);
 const card=(await p.$$('a.oc'))[0];
 const titre=await p.evaluate(el=>el.querySelector('.ctitle').textContent, card);
 await card.click();
 await p.waitForTimeout(4500);
 const apres=await p.evaluate(()=>{const a=document.getElementById('retour-offre');
   return {href:a?.getAttribute('href'),label:a?.textContent?.trim()};});
 console.log('  depuis l\'accueil, card "'+titre.slice(0,35)+'" -> retour '+(apres.href||'?')+' "'+(apres.label||'')+'"');
 // Depuis le board, le retour doit rester le board.
 await p.goto('https://claimyourjob.com/fr/job-board.html',{waitUntil:'networkidle',timeout:60000});
 await p.waitForTimeout(4000);
 const card2=(await p.$$('a.oc'))[0];
 if(card2){ await card2.click(); await p.waitForTimeout(4000);
   const apres2=await p.evaluate(()=>{const a=document.getElementById('retour-offre');
     return {href:a?.getAttribute('href'),label:a?.textContent?.trim()};});
   console.log('  depuis le board -> retour '+(apres2.href||'?')+' "'+(apres2.label||'')+'"');
 }
 await b.close();
})();
