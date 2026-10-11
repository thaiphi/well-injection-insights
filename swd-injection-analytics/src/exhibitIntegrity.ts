/** Exact JSON evidence validation: reject values serialization could erase or execute. */
export function assertJsonEvidence(value:unknown,path='exhibit',parents=new Set<object>()):void {
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  const array=Array.isArray(value);
  if(typeof value!=='object'||parents.has(value)||array&&Object.getPrototypeOf(value)!==Array.prototype||!array&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error(`${path}: require finite, acyclic plain JSON evidence`);
  const keys=Reflect.ownKeys(value);
  if(keys.some(key=>{const d=Object.getOwnPropertyDescriptor(value,key)!;return typeof key!=='string'||!('value' in d)||(!d.enumerable&&!(array&&key==='length'))||array&&key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=(value as unknown[]).length);})||array&&keys.length!==(value as unknown[]).length+1)throw Error(`${path}: JSON evidence cannot contain symbols, accessors, hidden fields or sparse/extended arrays`);
  parents.add(value);for(const [key,item]of Object.entries(value))assertJsonEvidence(item,`${path}.${key}`,parents);parents.delete(value);
}
const K=new Uint32Array([
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate=(x:number,n:number)=>(x>>>n)|(x<<(32-n));
/** SHA-256 (FIPS 180-4), UTF-8 bytes. Sync API preserves existing CSV/SVG callers.
 * This checks content consistency, not authorship or authenticity. Builder still uses WebCrypto. */
export function sha256Text(text:string):string {
 const bytes=new TextEncoder().encode(text),padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);
 padded.set(bytes);padded[bytes.length]=0x80;
 const view=new DataView(padded.buffer);view.setBigUint64(padded.length-8,BigInt(bytes.length)*8n,false);
 const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
 for(let offset=0;offset<padded.length;offset+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(offset+4*i,false);
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-16]+(rotate(b,17)^rotate(b,19)^(b>>>10))+w[i-7];}
  let [a,b,c,d,e,f,g,z]=h;
  for(let i=0;i<64;i++){const t1=z+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+w[i],t2=(rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c));z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
  [a,b,c,d,e,f,g,z].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
 }
 return Array.from(h,v=>v.toString(16).padStart(8,'0')).join('');
}
/** Validate before cloning and return the verified snapshot used by a serializer. */
export function verifiedExhibit<T extends {contentSha256:string}>(input:T):T {
 assertJsonEvidence(input);
 const snapshot=structuredClone(input),{contentSha256,...body}=snapshot;
 if(typeof contentSha256!=='string'||contentSha256!==sha256Text(JSON.stringify(body)))throw Error('Technical exhibit SHA-256 mismatch');
 return snapshot;
}
