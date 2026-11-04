import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

test('CSV declares its Excel separator, keeps accents and quotes, and escapes spreadsheet formulas',async()=>{
 const source=await fs.readFile(new URL('../src/lib/types.ts',import.meta.url),'utf8');
 const {csvDocument}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));
 const text=csvDocument([['Medidor','Litros'],['Baño; "principal"',203.35],['=HYPERLINK("x")',0]]);
 assert.ok(text.startsWith('\uFEFFsep=;\r\n'));
 assert.ok(text.includes('"Baño; ""principal""";"203.35"'));
 assert.ok(text.includes('"\'=HYPERLINK(""x"")"'));
});
