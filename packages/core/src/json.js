import {DirectorError,requireValue} from './errors.js';
export const MAX_BYTES=1024*1024, MAX_DEPTH=40, MAX_NODES=100000;
const reserved=new Set(['__proto__','constructor','prototype']);
const fail=()=>{throw new DirectorError('INPUT_INVALID','Expected bounded, data-only JSON.','parse');};
const checkString=s=>{if(s.length>MAX_BYTES)fail();for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=s.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))fail();}else if(c>=0xdc00&&c<=0xdfff)fail();}return s;};
/** JSON.parse discards duplicate keys; this parser rejects them before that information is lost. */
export function parseJSON(text) {
  requireValue(typeof text==='string'&&text.length<=MAX_BYTES&&new TextEncoder().encode(text).length<=MAX_BYTES,'INPUT_LIMIT','Script exceeds the JSON byte limit.','parse');
  let i=0,nodes=0;
  const space=()=>{while(i<text.length&&' \r\n\t'.includes(text[i]))i++;};
  function string(){
    const start=i++;let escaped=false;
    while(i<text.length){const c=text[i++];if(!escaped&&c==='"'){try{return checkString(JSON.parse(text.slice(start,i)));}catch{fail();}}if(!escaped&&c==='\\')escaped=true;else escaped=false;}
    fail();
  }
  function read(depth){
    if(depth>MAX_DEPTH||++nodes>MAX_NODES)fail();space();const c=text[i];
    if(c==='"')return string();
    if(c==='{'||c==='['){
      const object=c==='{', end=object?'}':']', output=object?Object.create(null):[];i++;space();
      if(text[i]===end){i++;return output;}
      for(;;){
        space();let key;
        if(object){if(text[i]!=='"')fail();key=string();if(reserved.has(key)||Object.hasOwn(output,key))fail();space();if(text[i++]!==':')fail();}
        const value=read(depth+1);if(object)output[key]=value;else output.push(value);
        space();const next=text[i++];if(next===end)return output;if(next!==',')fail();
      }
    }
    for(const [token,value]of [['true',true],['false',false],['null',null]])if(text.startsWith(token,i)){i+=token.length;return value;}
    const number=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
    if(!number)fail();i+=number[0].length;const value=Number(number[0]);if(!Number.isFinite(value))fail();return value;
  }
  const output=read(0);space();if(i!==text.length)fail();return output;
}
/** Plain objects are copied using descriptors: accessors, prototypes, cycles and functions are rejected. */
export function cloneData(input) {
  if(typeof input==='string')return parseJSON(input);
  let nodes=0;const seen=new Set();
  function copy(value,depth){
    if(++nodes>MAX_NODES||depth>MAX_DEPTH)fail();
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='string')return checkString(value);
    if(typeof value==='number'){if(!Number.isFinite(value))fail();return value;}
    if(typeof value!=='object'||seen.has(value)||Object.getOwnPropertySymbols(value).length)fail();
    const array=Array.isArray(value), proto=Object.getPrototypeOf(value);
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)fail();
    seen.add(value);const out=array?[]:Object.create(null), descriptors=Object.getOwnPropertyDescriptors(value);
    if(array){
      if(value.length>MAX_NODES||Object.keys(descriptors).length!==value.length+1)fail();
      for(let i=0;i<value.length;i++){const d=descriptors[i];if(!d||!Object.hasOwn(d,'value'))fail();out.push(copy(d.value,depth+1));}
    }else for(const [key,d]of Object.entries(descriptors)){
      if(reserved.has(key)||!d.enumerable||!Object.hasOwn(d,'value'))fail();checkString(key);out[key]=copy(d.value,depth+1);
    }
    seen.delete(value);return out;
  }
  const out=copy(input,0);
  requireValue(new TextEncoder().encode(JSON.stringify(out)).length<=MAX_BYTES,'INPUT_LIMIT','Script exceeds the JSON byte limit.','parse');
  return out;
}
export function freezeData(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freezeData(item);Object.freeze(value);}return value;}
export function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
