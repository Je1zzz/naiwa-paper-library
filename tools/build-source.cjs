'use strict';
const fs=require('node:fs'), path=require('node:path');
function loadEsbuild() {
  let resolved;try { resolved=require.resolve('esbuild'); } catch { throw Error('Install the pinned devDependency first: npm install --ignore-scripts=false'); }
  const esbuild=require(resolved);
  if(esbuild.version!=='0.28.2')throw Error('Expected esbuild 0.28.2; run npm install');
  return esbuild;
}
function build(root, externals=['obsidian','@codemirror/state','@codemirror/view']) {
  return loadEsbuild().buildSync({entryPoints:[path.join(root,'src','plugin.js')],absWorkingDir:root,outfile:path.join(root,'plugin','main.js'),bundle:true,platform:'node',format:'cjs',external:externals,target:'es2022',charset:'utf8',legalComments:'eof',sourcemap:false,metafile:true,write:false});
}
if(require.main===module) {
  const result=build(path.resolve(__dirname,'..'));for(const output of result.outputFiles)fs.writeFileSync(output.path,output.contents);
}
module.exports={build,loadEsbuild};
