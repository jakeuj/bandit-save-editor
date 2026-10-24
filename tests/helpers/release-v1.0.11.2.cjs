'use strict';
// The last V1.0.11.2 knowledge (editor v2.27): catalog and composite proof as shipped before the V1.0.12.2 lightweight
// migration. Historical proof machinery is checked against this matching pair, not against the live game version.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const fixtures=path.join(__dirname,'../fixtures/v1.0.11.2-release');
const text=name=>zlib.gunzipSync(fs.readFileSync(path.join(fixtures,name+'.gz'))).toString('utf8');
module.exports={catalogText:()=>text('catalog.json'),catalog:()=>JSON.parse(text('catalog.json')),proof:()=>JSON.parse(text('verification.json'))};
