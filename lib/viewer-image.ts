/** A network load event does not guarantee that async image decoding has finished. */
export async function decodeViewerImage(image:Pick<HTMLImageElement,'decode'|'complete'|'naturalWidth'|'naturalHeight'|'isConnected'>):Promise<boolean>{
  try{await image.decode();}catch{return false;}
  return image.isConnected&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0;
}
