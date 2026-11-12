import {canonical} from './json.js';
/** Closed subset used by our embedded schemas. No external resolution or user-supplied schemas. */
export function schemaErrors(value,schema,roots) {
  const errors=[];
  function validate(value,s,path,report=true,root=schema){
    let valid=true;const bad=keyword=>{valid=false;if(report&&errors.length<100)errors.push({code:'SCHEMA_INVALID',phase:'compile',severity:'error',path,message:`Schema constraint '${keyword}' failed.`,recoveries:['edit-script']});};
    if(s.$ref){
      let target=root,ref=s.$ref;
      if(!ref.startsWith('#/')){const split=ref.indexOf('#');const id=split<0?ref:ref.slice(0,split);target=Object.values(roots).find(candidate=>candidate.$id===id);ref=split<0?'':ref.slice(split);}
      if(!target){bad('$ref');return false;}
      const base=target;
      for(const key of ref.replace(/^#\//,'').split('/').filter(Boolean))target=target?.[key.replaceAll('~1','/').replaceAll('~0','~')];
      if(!target){bad('$ref');return false;}
      if(!validate(value,target,path,report,base))valid=false;
    }
    if(s.oneOf&&s.oneOf.filter(option=>validate(value,option,path,false,root)).length!==1)bad('oneOf');
    if(s.not&&validate(value,s.not,path,false,root))bad('not');
    if(Object.hasOwn(s,'const')&&canonical(value)!==canonical(s.const))bad('const');
    if(s.enum&&!s.enum.some(item=>canonical(value)===canonical(item)))bad('enum');
    const type=value===null?'null':Array.isArray(value)?'array':typeof value;
    if(s.type&&(s.type==='integer'?!(type==='number'&&Number.isInteger(value)):type!==s.type)){bad('type');return false;}
    if(type==='object'){
      const keys=Object.keys(value);
      if(s.maxProperties!==undefined&&keys.length>s.maxProperties)bad('maxProperties');
      for(const key of s.required||[])if(!Object.hasOwn(value,key))bad('required');
      for(const key of keys){
        if(s.propertyNames&&!validate(key,s.propertyNames,path,false,root))bad('propertyNames');
        const definition=s.properties?.[key];
        if(definition){if(!validate(value[key],definition,path+'/'+key.replaceAll('~','~0').replaceAll('/','~1'),report,root))valid=false;}
        else if(s.additionalProperties===false)bad('additionalProperties');
        else if(typeof s.additionalProperties==='object'&&!validate(value[key],s.additionalProperties,path+'/'+key,report,root))valid=false;
      }
    }
    if(type==='array'){
      if(s.minItems!==undefined&&value.length<s.minItems)bad('minItems');
      if(s.maxItems!==undefined&&value.length>s.maxItems)bad('maxItems');
      if(s.uniqueItems&&new Set(value.map(canonical)).size!==value.length)bad('uniqueItems');
      if(s.items)for(let i=0;i<value.length;i++)if(!validate(value[i],s.items,path+'/'+i,report,root))valid=false;
    }
    if(type==='number')for(const [key,check]of [['minimum',x=>value<x],['maximum',x=>value>x],['exclusiveMinimum',x=>value<=x]])if(s[key]!==undefined&&check(s[key]))bad(key);
    if(type==='string'){
      const length=[...value].length;
      if(s.minLength!==undefined&&length<s.minLength)bad('minLength');
      if(s.maxLength!==undefined&&length>s.maxLength)bad('maxLength');
      if(s.pattern&&!new RegExp(s.pattern,'u').test(value))bad('pattern');
    }
    return valid;
  }
  validate(value,schema,'');return errors;
}
