/** Match the displayed original, including cache-version and retry parameters. */
export function isLoupeImageReady(image:{complete:boolean;naturalWidth:number;currentSrc?:string;src:string},expectedSrc:string,baseUrl:string){
  if(!image.complete||!image.naturalWidth)return false;
  try{return new URL(image.currentSrc||image.src,baseUrl).href===new URL(expectedSrc,baseUrl).href;}
  catch{return false;}
}
