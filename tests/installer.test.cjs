const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'naiwa-installer-test-'));
 t.after(()=>{assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('naiwa-installer-test-'));fs.rmSync(base,{recursive:true,force:true});});
 const packagePath=path.join(base,'下载 副本'),vault=path.join(base,'中文 文献库');fs.mkdirSync(packagePath);
 for(const name of ['plugin','tools','zotero-addon'])fs.cpSync(path.join(root,name),path.join(packagePath,name),{recursive:true});
 fs.copyFileSync(path.join(root,'install.cmd'),path.join(packagePath,'install.cmd'));
 const run=(args=[],extra={})=>cp.spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(packagePath,'tools/install.ps1'),...args],{encoding:'utf8',windowsHide:true,...extra});
 return {base,packagePath,vault,run};
}
const windows={skip:process.platform!=='win32'};
test('downloaded package installs into a new Chinese/spaced vault and repeat install preserves user data',windows,t=>{
 const {packagePath,vault,run}=fixture(t);let result=run(['-VaultPath',vault,'-SkipProbes']);assert.equal(result.status,0,result.stderr);
 const dest=path.join(vault,'.obsidian/plugins/paper-library');
 for(const entry of JSON.parse(fs.readFileSync(path.join(packagePath,'tools/install-manifest.json'))).files)assert.deepEqual(fs.readFileSync(path.join(dest,entry.path)),fs.readFileSync(path.join(packagePath,'plugin',entry.path)));
 const saved=new Map([[path.join(dest,'data.json'),'private configuration'],[path.join(dest,'custom.txt'),'custom file'],[path.join(vault,'阅读笔记/手写.md'),'My notes'],[path.join(vault,'文献/test.pdf'),'PDF fixture'],[path.join(vault,'文献首页.md'),'My home']]);
 for(const [file,text]of saved)fs.writeFileSync(file,text);
 fs.writeFileSync(path.join(vault,'.obsidian/community-plugins.json'),'["other-plugin","paper-library"]');
 result=run(['-VaultPath',vault,'-SkipProbes']);assert.equal(result.status,0,result.stderr);
 for(const [file,text]of saved)assert.equal(fs.readFileSync(file,'utf8'),text);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/community-plugins.json'))),['other-plugin','paper-library']);
});
test('dry run never creates directories and checksum failures never write',windows,t=>{
 const {vault,packagePath,run}=fixture(t);
 assert.equal(run(['-VaultPath',vault,'-DryRun','-SkipProbes']).status,0);assert.ok(!fs.existsSync(vault));
 fs.appendFileSync(path.join(packagePath,'plugin/main.js'),'\n// tampered');
 assert.notEqual(run(['-VaultPath',vault,'-SkipProbes']).status,0);assert.ok(!fs.existsSync(vault));
});
test('registered-vault chooser supports a numbered selection and cancellation',windows,t=>{
 const {vault,base,run}=fixture(t),appdata=path.join(base,'appdata');fs.mkdirSync(path.join(appdata,'obsidian'),{recursive:true});fs.mkdirSync(vault);
 fs.writeFileSync(path.join(appdata,'obsidian/obsidian.json'),JSON.stringify({vaults:{test:{path:vault}}}));
 const env={...process.env,APPDATA:appdata};
 let result=run(['-SkipProbes'],{env,input:'1\n'});assert.equal(result.status,0,result.stderr);assert.ok(fs.existsSync(path.join(vault,'.obsidian/plugins/paper-library/main.js')));
 result=run(['-SkipProbes'],{env,input:'\n'});assert.notEqual(result.status,0);
});
test('unsafe targets and manifest traversal are rejected before writing',windows,t=>{
 const {vault,packagePath,base,run}=fixture(t);
 for(const target of [path.parse(base).root,base+'/../escape',packagePath])assert.notEqual(run(['-VaultPath',target,'-SkipProbes']).status,0,target);
 const indexPath=path.join(packagePath,'tools/install-manifest.json'),index=JSON.parse(fs.readFileSync(indexPath));index.files[0].path='../escape.js';fs.writeFileSync(indexPath,JSON.stringify(index));
 assert.notEqual(run(['-VaultPath',vault,'-SkipProbes']).status,0);assert.ok(!fs.existsSync(vault));
});
