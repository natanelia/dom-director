/** Bounded data-only JSON shared by optional authoring packages. */
export const MAX_BYTES:number;
export const MAX_DEPTH:number;
export const MAX_NODES:number;
export function parseJSON(text:string):unknown;
export function cloneData(input:unknown):unknown;
export function freezeData<T>(value:T):Readonly<T>;
export function canonical(value:unknown):string;
