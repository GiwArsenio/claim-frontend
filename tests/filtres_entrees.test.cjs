const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn('python3',['-m','http.server','8899'],{stdio:'ignore'});
 await new Promise(r=>setTimeout(r,800));
 const b=await chromium.launch({args:['--no-sandbox']});
 try {
 for(const width of [390,1440]) {
 const p=await b.newPage({viewport:{width,height:844}});
 const errors=[]; p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8899/job-board.html');
 await p.waitForTimeout(700);
 assert.equal(await p.locator('#filtres-panneau').isVisible(),false);
 assert.equal(await p.locator('.filtres-entrees .filtre-entree:visible').count(),width===390?3:8);
 for(const category of ['contract-filter','specialty-filter','branch-filter','company-type-filter','experience-filter','date-filter','ats-filter']){
 if(width===390 && !['contract-filter','specialty-filter'].includes(category)) continue;
 await p.locator(`[data-categorie="${category}"]`).click();
 assert.equal(await p.locator('.fp-groupe:visible').count(),1,'une catégorie n’ouvre que ses valeurs');
 assert(await p.locator('#filtres-panneau').isVisible());
 await p.waitForTimeout(150);
 const y=await p.locator(`.fp-groupe[data-filtre="${category}"]`).evaluate(e=>e.getBoundingClientRect().top);
 assert(y>=0 && y<844, `${category} doit être visible (${y})`);
 await p.locator('.fp-fermer').click();
 assert.equal(await p.locator('#filtres-panneau').isVisible(),false);
 }
 await p.locator('[data-categorie="contract-filter"]').click();
 await p.locator('.fp-groupe[data-filtre="contract-filter"] [data-valeur="cdi"]').click();
 await p.locator('.fp-groupe[data-filtre="contract-filter"] [data-valeur="cdd"]').click();
 assert.equal(await p.locator('#contract-filter').inputValue(),'cdi,cdd');
 await p.screenshot({path:`/tmp/filtres-${width}.png`});
 await p.locator('.fp-fermer').click();
 assert.equal(await p.locator('#contract-filter').inputValue(),'');
 await p.goto('http://localhost:8899/index.html');
 assert.equal(await p.locator('.filtres-entrees .filtre-entree:visible').count(),width===390?3:8);
 await p.locator('.filtres-entrees a').filter({hasText:'Spécialité'}).click();
 await p.waitForTimeout(300);
 assert(await p.locator('#filtres-panneau').isVisible());
 assert.equal(new URL(p.url()).hash,'#filtres-specialty-filter');
 assert.deepEqual(errors,[]);
 console.log(`OK ${width}px : huit boutons, sept catégories, multichoix, annulation et lien accueil`);
 await p.close();
 }
 }finally{await b.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
