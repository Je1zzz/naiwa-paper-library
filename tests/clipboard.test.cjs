const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {copyPdf}=require('../src/clipboard');
test('PDF file clipboard uses STA file-drop format; filename is passed as data',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naiwa-clipboard-')),pdf=path.join(dir,'论文 $ (test).pdf');fs.writeFileSync(pdf,'%PDF-1.4 fixture');let captured;
 try{await copyPdf(pdf,{platform:'win32',execute:(command,args,options,callback)=>{captured={command,args,options};callback(null);}});assert.ok(captured.args.includes('-STA'));const script=Buffer.from(captured.args.at(-1),'base64').toString('utf16le');assert.match(script,/SetFileDropList/);assert.equal(captured.options.env.NAIWA_PDF_CLIPBOARD_FILE,pdf);assert.ok(!script.includes(pdf));assert.ok(!script.includes('SetText'));}
 finally{fs.unlinkSync(pdf);fs.rmdirSync(dir);}
});
test('unsupported systems and non-PDF paths fail without invoking clipboard',async()=>{
 await assert.rejects(copyPdf('file.pdf',{platform:'linux'}),/Windows/);await assert.rejects(copyPdf('file.txt',{platform:'win32'}),/PDF/);
});
