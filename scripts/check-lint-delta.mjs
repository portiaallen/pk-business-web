/** Compare changed-file diagnostics against the qualified baseline, ignoring shifted line numbers. */
import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const baseline='bb43bafc3a1a92c2be847e5df77394c93b0b8c32';
const files=[...new Set([...execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')])].filter(path=>/\.(?:[cm]?[jt]sx?)$/.test(path));
const lint=new ESLint();const counts={newErrors:0,newWarnings:0,preExistingErrors:0,preExistingWarnings:0,files:files.length};
const key=message=>JSON.stringify([message.ruleId,message.severity,message.message.split('\n')[0]]);
for(const path of files){
 let old='';try{old=execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{/* New file. */}
 const before=old?(await lint.lintText(old,{filePath:path}))[0].messages:[];
 const after=(await lint.lintText(readFileSync(path,'utf8'),{filePath:path}))[0].messages;
 const previous=new Map();for(const message of before)previous.set(key(message),(previous.get(key(message))||0)+1);
 for(const message of after){const code=key(message);if(previous.get(code)>0){previous.set(code,previous.get(code)-1);counts[message.severity===2?'preExistingErrors':'preExistingWarnings']++;}else{counts[message.severity===2?'newErrors':'newWarnings']++;}}
}
console.log(JSON.stringify(counts));if(counts.newErrors||counts.newWarnings)process.exitCode=1;
