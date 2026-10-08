// Legacy built-in categories are now unclassified. Custom names use a prefix
// so names such as "landscape" remain available without restoring old labels.
export function displayCategory(value:unknown){return typeof value==='string'&&value.startsWith('custom:')?value.slice(7):'';}
export function cleanCategory(value:unknown){
  if(typeof value!=='string'||value.length>100||/[\u0000-\u001f\u007f]/.test(value))throw Error('分类名称不能超过 100 字');
  const name=value.trim();return name?'custom:'+name:'';
}
export const parameterFields = [
  {key:'camera', label:'相机', placeholder:'Sony A7M4'},
  {key:'lens', label:'镜头', placeholder:'FE 35mm F1.4 GM'},
  {key:'focalLength', label:'焦距', placeholder:'35mm'},
  {key:'aperture', label:'光圈', placeholder:'f/1.4'},
  {key:'shutter', label:'快门', placeholder:'1/500s'},
  {key:'iso', label:'感光度', placeholder:'ISO 100'},
] as const;
export type Parameters = Partial<Record<typeof parameterFields[number]['key'],string>>;
export type Photo = {id:string;title:string;location:string;position:number;featured:number;curated?:number;featured_position?:number;display_key?:string;category:string;series:string;exif:Parameters};
export function cleanParameters(value:unknown):Parameters {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('拍摄参数格式不正确');
  const output:Parameters={};
  for(const {key} of parameterFields){const v=(value as Record<string,unknown>)[key];if(v===undefined)continue;if(typeof v!=='string'||v.length>120)throw Error('拍摄参数不能超过 120 字');output[key]=v.replace(/[\u0000-\u001f\u007f]/g,'').trim();}
  return output;
}
export function metadataFromInput(category:unknown,series:unknown,exif:unknown){
  const storedCategory=cleanCategory(category);
  if(typeof series!=='string'||series.length>100)throw Error('系列名称不能超过 100 字');
  return {category:storedCategory,series:series.trim(),exif:JSON.stringify(cleanParameters(exif))};
}
export function parameterSummary(p:Parameters){return parameterFields.map(f=>p[f.key]).filter(Boolean).join(' · ');}

/** Old uploads used camera filenames as titles; don't show those automatic labels. */
export function visibleTitle(title:string){
 const value=title.trim();
 return /^(?:未命名作品|P\d{7,}|(?:_?MG|IMG|DSC[NF]?|DCIM)[_ -]?\d+)(?:\.[a-z0-9]+)?$/i.test(value)?'':value;
}
