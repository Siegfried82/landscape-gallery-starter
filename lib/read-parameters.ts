import {cleanParameters,type Parameters} from './photo-metadata';
// Select only camera/exposure tags. GPS, date/time, serial numbers and other
// original metadata never enter the public photo record.
export async function readParameters(file:Blob):Promise<Parameters>{
  try{
    const {default:exifr}=await import('exifr');
    const tags=await exifr.parse(file,{pick:['Make','Model','LensModel','FocalLength','FNumber','ExposureTime','ISO'],gps:false});
    if(!tags)return {};
    const text=(v:unknown)=>typeof v==='string'?v.replace(/\0/g,'').trim().slice(0,120):'';
    const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:0;
    const focal=number(tags.FocalLength),f=number(tags.FNumber),s=number(tags.ExposureTime),iso=number(tags.ISO);
    const model=text(tags.Model),make=text(tags.Make);
    const camera=model&&make&&!model.toLowerCase().includes(make.toLowerCase())?`${make} ${model}`:model||make;
    return cleanParameters({camera:camera.slice(0,120),lens:text(tags.LensModel),focalLength:focal?`${Math.round(focal*10)/10}mm`:'',aperture:f?`f/${Math.round(f*10)/10}`:'',shutter:s?(s<1?`1/${Math.round(1/s)}s`:`${Math.round(s*100)/100}s`):'',iso:iso?`ISO ${Math.round(iso)}`:''});
  }catch{return {};}
}
