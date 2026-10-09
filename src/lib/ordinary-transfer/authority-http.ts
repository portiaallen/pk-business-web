import type { TransferAuthority, TransferLease } from './contracts';
/** PK-owned authority RPC for a separate transfer runtime. Only tiny metadata crosses this link. */
export function createHTTPAuthority(appOrigin: string, serviceSecret: string, fetcher: typeof fetch = fetch): TransferAuthority {
  let base: URL;
  try { base = new URL(appOrigin); } catch { throw new Error('Invalid transfer authority configuration'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash || serviceSecret.length < 32) throw new Error('Invalid transfer authority configuration');
  async function rpc(body: object): Promise<unknown> {
    try {
      const response = await fetcher(base.origin + '/api/ordinary-transfer/internal', {method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+serviceSecret},body:JSON.stringify(body)});
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
      for (;;) { const item = await reader.read(); if(item.done)break; size+=item.value.length; if(size>8192){await reader.cancel();throw new Error();}parts.push(item.value); }
      const bytes = new Uint8Array(size); let offset=0; for(const part of parts){bytes.set(part,offset);offset+=part.length;}
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { throw new Error('Transfer authority unavailable'); }
  }
  return {
    async claim(token,origin) {
      const lease=await rpc({action:'CLAIM',token,origin}) as TransferLease;
      if(!lease || !['UPLOAD','DOWNLOAD'].includes(lease.operation) || !Number.isSafeInteger(lease.size) || lease.size<1 || lease.size>25*1024*1024 || typeof lease.key!=='string' || lease.origin!==origin)throw new Error('Invalid transfer lease');
      return lease;
    },
    async finish(token,state){await rpc({action:'FINISH',token,state});},
    async fail(token){await rpc({action:'FAIL',token});},
    async auditDownload(token){await rpc({action:'DOWNLOAD_AUDIT',token});},
  };
}
