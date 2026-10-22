'use strict';
const {test: base, expect} = require('@playwright/test');
const {createSite} = require('./site.cjs');
const test = base.extend({
  site: async ({}, use) => {
    const site = await createSite();
    try { await use(site); } finally { await site.close(); }
  },
  cleanConsole: [async ({context}, use, testInfo) => {
    const errors = [];
    const watch = page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    await use();
    if (testInfo.status === testInfo.expectedStatus) expect(errors, 'Browser console errors').toEqual([]);
  }, {auto: true}]
});
module.exports = {test, expect};
