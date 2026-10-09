/** Disposable qualification tool. NOT a production storage adapter. Never holds real client data. */
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {createHTTPAuthority} from '../src/lib/ordinary-transfer/authority-http';
import {createTransferEndpoint} from '../src/lib/ordinary-transfer/endpoint';
import {createControlEndpoint} from '../src/lib/ordinary-transfer/control-endpoint';
import type {ObjectState} from '../src/lib/ordinary-transfer/contracts';
if(process.env.PK_ENVIRONMENT!=='test' || process.env.PK_TRANSFER_SYNTHETIC_ONLY!=='true')throw Error('Explicit disposable synthetic environment required');
const appOrigin=process.env.PK_TRANSFER_SYNTHETIC_APP_ORIGIN||'';
let host: string;
try { host = new URL(appOrigin).hostname; } catch { throw Error('Invalid synthetic origin'); }
if(!(host.startsWith('pk-qualification-') || host.includes('--pk-qualification-')) || (!host.endsWith('.netlify.app') && !host.endsWith('.vercel.app')))throw Error('Dedicated qualification hostname required');
const secret=process.env.PK_TRANSFER_SERVICE_SECRET||'';
const authority=createHTTPAuthority(appOrigin,secret);
const objects=new Map<string,{bytes:Uint8Array;state:ObjectState}>();const tombstones=new Set<string>();
const canary='PK_SYNTHETIC_TRANSFER_ONLY';
const storage={
 async putIfAbsent(key:string,bytes:Uint8Array,state:ObjectState){
  // A synthetic canary is mandatory and only ephemeral memory is used. It is not a data classifier.
  if(!new TextDecoder().decode(bytes.slice(0,2048)).includes(canary) || objects.has(key) || tombstones.has(key))throw Error('Synthetic transfer refused');
  objects.set(key,{bytes,state});
 },
 async read(key:string){return objects.get(key)?.bytes||null;},
 async stat(key:string){return objects.get(key)?.state||null;},
 async remove(key:string){tombstones.add(key);objects.delete(key);},
};
const sha=async(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const transfer=createTransferEndpoint(storage,authority,sha,appOrigin);
const control=createControlEndpoint(storage,secret,sha);
const port=Number(process.env.PK_TRANSFER_SYNTHETIC_PORT||4352);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid synthetic port');
createServer(async(incoming,outgoing)=>{
 try{
  const headers=new Headers();for(const [key,value]of Object.entries(incoming.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  const method=incoming.method||'GET';
  const init:RequestInit & {duplex?:'half'}={method,headers};
  if(!['GET','HEAD'].includes(method)){init.body=Readable.toWeb(incoming) as ReadableStream<Uint8Array>;init.duplex='half';}
  const req=new Request('http://127.0.0.1:'+port+(incoming.url||'/'),init);
  const response=await (new URL(req.url).pathname==='/control'?control:transfer)(req);
  outgoing.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body)Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(outgoing);else outgoing.end();
 }catch{outgoing.writeHead(503,{'Cache-Control':'private, no-store'});outgoing.end('Synthetic transfer unavailable');}
}).listen(port,'127.0.0.1',()=>process.stdout.write('Disposable synthetic provider listening on loopback only. No persistent storage; no production use.\n'));
