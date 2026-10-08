export type ViewerPoint={x:number;y:number};
export type ViewerPose=ViewerPoint&{scale:number};

/** Keep the same image point under the gesture anchor as the scale changes. */
export function zoomAt(pose:ViewerPose,scale:number,anchor:ViewerPoint):ViewerPose{
 const ratio=scale/pose.scale;
 return {scale,x:anchor.x-(anchor.x-pose.x)*ratio,y:anchor.y-(anchor.y-pose.y)*ratio};
}

/** Bind when the portal's stage mounts, rather than before its ref exists. */
export function bindViewerWheel(element:HTMLElement,zoom:(delta:number,point:ViewerPoint)=>void){
 const wheel=(event:WheelEvent)=>{
  event.preventDefault();event.stopPropagation();
  if(event.deltaY)zoom(event.deltaY<0?.2:-.2,{x:event.clientX,y:event.clientY});
 };
 element.addEventListener('wheel',wheel,{passive:false});
 return()=>element.removeEventListener('wheel',wheel);
}
