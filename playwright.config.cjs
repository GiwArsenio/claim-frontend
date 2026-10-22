// playwright.config.cjs
//
// La configuration des parcours navigateur.
//
// Trois choix, chacun justifie.
//
// 1. Un seul worker. Les parcours partagent un backend simule et des
//    fixtures : les lancer en parallele n apporte aucun gain reel, et rend
//    les echecs difficiles a lire.
//
// 2. Aucune capture ni video en cas d echec, sauf demande explicite.
//    Les traces sont utiles mais lourdes ; on les produit a la demande.
//
// 3. Un delai par defaut genereux mais borne. Un parcours qui attend une
//    reponse simulee ne doit jamais depasser ce delai : un test qui expire
//    est un test casse, pas un test lent.

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: require('node:path').resolve(__dirname, 'tests/parcours'),
  testMatch: '**/*.test.cjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  timeout: 30000,
  expect: { timeout: 7000 },
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
});
