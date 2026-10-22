const {execFile}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
async function copyPdf(file,{execute=execFile,platform=process.platform}={}){
 if(platform!=='win32')throw Error('PDF 文件剪贴板目前支持 Windows；其他系统请从文件管理器复制 PDF');
 const absolute=path.resolve(file);if(path.extname(absolute).toLowerCase()!=='.pdf'||!fs.statSync(absolute).isFile())throw Error('请选择实际存在的 PDF 文件');
 const script="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; $naiwaFiles=New-Object System.Collections.Specialized.StringCollection; [void]$naiwaFiles.Add($env:NAIWA_PDF_CLIPBOARD_FILE); [System.Windows.Forms.Clipboard]::SetFileDropList($naiwaFiles); if(-not [System.Windows.Forms.Clipboard]::ContainsFileDropList()){throw 'File clipboard unavailable'}";
 const command=Buffer.from(script,'utf16le').toString('base64');
 await new Promise((resolve,reject)=>execute(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-STA','-EncodedCommand',command],{windowsHide:true,timeout:15000,env:{...process.env,NAIWA_PDF_CLIPBOARD_FILE:absolute}},error=>error?reject(Error('无法复制 PDF 文件，请关闭占用剪贴板的程序后重试')):resolve()));
}
module.exports={copyPdf};
