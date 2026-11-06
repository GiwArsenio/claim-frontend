const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 const err=[]; p.on('pageerror',e=>err.push(e.message.slice(0,70)));
 await p.goto('https://claimyourjob.com/fr/',{waitUntil:'networkidle',timeout:60000});
 await p.waitForSelector('a.oc[data-slug]',{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1500);
 const cards=await p.$$('a.oc[data-slug]');
 console.log('  cartes rendues:',cards.length,'| erreurs:',err.slice(0,2).join(' | ')||'aucune');
 if(cards.length){
   const slug=await p.evaluate(el=>el.dataset.slug, cards[1]);
   await cards[1].click();
   await p.waitForTimeout(5000);
   const retour=await p.evaluate(()=>document.getElementById('retour-offre')?.getAttribute('href'));
   console.log('  clic carte 2 (slug='+slug.slice(0,24)+')');
   console.log('  retour pointe vers:', retour);
   await p.click('#retour-offre');
   await p.waitForTimeout(5000);
   const etat=await p.evaluate(()=>{const h=location.hash.replace('#','');
     const c=h.startsWith('card-')?document.getElementById(h):null;
     return {hash:location.hash,scrollY:Math.round(window.scrollY),
             cardY:c?Math.round(c.getBoundingClientRect().top):null};});
   console.log('  apres retour: hash='+etat.hash+' scrollY='+etat.scrollY
     +(etat.cardY!==null?' cardY='+etat.cardY+' (0 = carte en haut de l ecran)':''));
 }
 await b.close();
})();
