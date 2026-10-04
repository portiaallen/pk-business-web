/** Ordinary-file signature checks are not malware scanning and do not confer Vault approval. */
export function validOrdinaryBytes(bytes: Uint8Array, mime: string): boolean {
  const starts = (values: number[]) => values.every((value,index) => bytes[index]===value);
  if(mime==='application/pdf')return starts([37,80,68,70,45]);
  if(mime==='image/png')return starts([137,80,78,71,13,10,26,10]);
  if(mime==='image/jpeg')return starts([255,216,255]);
  if(mime==='image/webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
  if(['application/msword','application/vnd.ms-excel'].includes(mime))return starts([208,207,17,224,161,177,26,225]);
  if(['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(mime))return starts([80,75,3,4]);
  if(mime==='text/plain'||mime==='text/csv') {
    if(bytes.includes(0))return false;
    try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return true;}catch{return false;}
  }
  return false;
}
