/* Verification en PRODUCTION : l'en-tete, le pied et le logo mobile. */
const { chromium } = require('playwright');
(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'fr-FR' });
  const page = await ctx.newPage();
  for (const p of ['/', '/job-board.html', '/claim-entreprises.html', '/claim-observatoire.html', '/contact.html']) {
    await page.goto('https://claimyourjob.fr' + p, { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(2500);
    const etat = await page.evaluate(() => {
      const ft = document.querySelector('footer#ft, footer.pied');
      const hd = document.querySelector('header#hd, header.hd');
      const logoPied = ft ? ft.querySelector('.ft-logo, .logo') : null;
      return {
        header: hd ? hd.tagName : null,
        footer: ft ? ft.tagName : null,
        logoPiedTag: logoPied ? logoPied.tagName.toLowerCase() : null,
        logoPiedHref: logoPied ? logoPied.getAttribute('href') : null,
        menus: ft ? Array.from(ft.querySelectorAll('.ft-links a')).map(a => a.getAttribute('href')) : [],
        footerVisible: ft ? getComputedStyle(ft).display !== 'none' : false,
      };
    });
    // Le logo du tiroir mobile
    const bm = await page.evaluate(() => {
      const a = document.querySelector('#burger-menu .bm-logo');
      return a ? { tag: a.tagName.toLowerCase(), href: a.getAttribute('href') } : null;
    });
    console.log(`\n  ${p}`);
    console.log('    header/footer :', etat.header, '/', etat.footer, '| pied visible :', etat.footerVisible);
    console.log('    logo du pied  :', etat.logoPiedTag, '->', etat.logoPiedHref);
    console.log('    tiroir logo   :', bm ? bm.tag + ' -> ' + bm.href : 'absent');
    console.log('    menus du pied :', etat.menus.join(' '));
  }
  await nav.close();
})();
