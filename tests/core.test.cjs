const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const core=require('../src/core.js');
const item=(overrides={})=>({key:'SYNTH001',title:'Synthetic example',date:'2020',type:'book',creators:[{lastName:'Example'}],tags:[],attachments:[],...overrides});
test('CSV export protects spreadsheet formulas and preserves quotes',()=>{
 const csv=core.csv([{title:'=HYPERLINK("x")',evidence:'Line; "quoted"'}]);
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('""quoted""'));
});
test('package contains no database, account credentials or real document fixture',()=>{
 const manifest=require('../src/manifest.json');const pkg=require('../package.json');
 assert.equal(manifest.version,pkg.version);assert.equal(manifest.applications.zotero.id,pkg.zotero.id);
 assert.equal(manifest.applications.zotero.strict_min_version,'10.0');
 for(const file of fs.readdirSync('src'))assert.ok(!/\.(sqlite|pdf|docx|env)$/i.test(file));
 for(const file of fs.readdirSync('src').filter(x=>x.endsWith('.js')))new vm.Script(fs.readFileSync('src/'+file,'utf8'),{filename:file});
});
test('draft findings remain review signals with evidence, including papers about drafts',()=>{
 const rows=core.audit([item({attachments:[{key:'PDF00001',exists:true,contentType:'application/pdf',linkMode:'imported_file',text:'A study of a draft declaration. '+ 'Example '.repeat(30),totalPages:50,extractedPages:5}]})]);
 assert.ok(rows.some(x=>x.field==='version'&&x.severity==='Revisar'&&x.evidence));
 assert.ok(rows.some(x=>x.field==='pages'&&/5 de 50/.test(x.message)));
});
test('distinguishes missing file, external link, and absent OCR layer',()=>{
 const rows=core.audit([item({attachments:[{key:'PDF00001',exists:false,linkMode:'imported_file'},{key:'URL00001',linkMode:'linked_url'},{key:'SCAN0001',exists:true,contentType:'application/pdf',linkMode:'imported_file',text:''}]})]);
 assert.ok(rows.some(x=>x.key==='PDF00001'&&x.field==='attachment'));
 assert.ok(rows.some(x=>x.key==='URL00001'&&/link externo/.test(x.message)));
 assert.ok(rows.some(x=>x.key==='SCAN0001'&&x.field==='OCR'));
});
