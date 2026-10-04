import type { PrivateTransferStorage } from './contracts';
/** Server-only PK protocol. Not an R2/Cloudflare API or a publicly readable object namespace. */
export function createControlEndpoint(storage: PrivateTransferStorage, serviceSecret: string, sha256: (bytes: Uint8Array)=>Promise<string>) {
  if(serviceSecret.length<32)throw new Error('Invalid transfer control configuration');
  const encoder = new TextEncoder();
  return async(request:Request):Promise<Response> => {
    const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
    try {
      const url=new URL(request.url);
      if(request.method!=='POST'||url.pathname!=='/control'||url.search||url.hash)throw new Error();
      const actual=await sha256(encoder.encode(request.headers.get('authorization')||''));
      const expected=await sha256(encoder.encode('Bearer '+serviceSecret));
      let diff=actual.length^expected.length;
      for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(actual.charCodeAt(i)||0);
      if(diff!==0 || request.headers.get('content-type')!=='application/json' || !request.body)throw new Error();
      const reader=request.body.getReader();const parts:Uint8Array[]=[];let size=0;
      for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>8192){await reader.cancel();throw new Error();}parts.push(item.value);}
      const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
      const data=JSON.parse(new TextDecoder().decode(bytes));
      if(Object.keys(data).sort().join(',')!=='key,operation' || !['STATE','DELETE'].includes(data.operation) || typeof data.key!=='string' || !/^[a-zA-Z0-9_/-]{1,255}$/.test(data.key))throw new Error();
      if(data.operation==='DELETE')await storage.remove(data.key); // Must be idempotent and fence late writes.
      return Response.json({state:await storage.stat(data.key)},{headers});
    }catch{return Response.json({error:'Transfer control unavailable'},{status:403,headers});}
  };
}
