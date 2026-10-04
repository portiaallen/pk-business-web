// Actual packaged handler; platform cache mocked to synthetic misses, all network blocked.
import {resolve} from 'node:path';
const root=resolve('.netlify/functions-internal/___netlify-server-handler');
for(const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env,{NODE_ENV:'production',NETLIFY:'true',CONTEXT:'deploy-preview',PK_ENVIRONMENT:'preview',LAMBDA_TASK_ROOT:root});
process.env.NETLIFY_BLOBS_CONTEXT=Buffer.from(JSON.stringify({deployID:'synthetic',siteID:'synthetic',token:'synthetic-not-a-token',apiURL:'https://blobs.synthetic.invalid'})).toString('base64');
globalThis.fetch=async(input)=>{const url=new URL(typeof input==='string'?input:input.url||input);if(url.hostname!=='blobs.synthetic.invalid')throw new Error('Synthetic handler smoke forbids network');return new Response(null,{status:404});};
process.chdir(root);
const {default:handler}=await import(root+'/___netlify-server-handler.mjs');
for(const [path,method,expected] of [['/api/vault/documents','GET',503],['/api/setup/seed','POST',403],['/api/portal/documents','GET',401],['/api/stripe/webhook','POST',503]]){
 try{
 const res=await handler(new Request('https://pk-qualification.example.test'+path,{method,headers:{origin:'https://pk-qualification.example.test'}}),{account:{id:'synthetic'},site:{id:'synthetic'},deploy:{id:'synthetic'},requestId:'synthetic'});
 console.log(JSON.stringify({path,status:res.status,expected,pass:res.status===expected}));if(res.status!==expected)process.exitCode=1;
 }catch{console.log(JSON.stringify({path,pass:false,reason:'LOCAL_HANDLER_RUNTIME_FAILED'}));process.exitCode=1;}
}
