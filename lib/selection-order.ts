/** Move a selected group before the target, preserving click-selection order. */
export function moveSelection(order:string[],selected:string[],dragged:string,target:string){
 const group=selected.includes(dragged)?selected:[dragged];
 if(group.includes(target))return order;
 const members=new Set(group);const rest=order.filter(id=>!members.has(id));
 const at=rest.indexOf(target);if(at<0||group.some(id=>!order.includes(id)))return order;
 return [...rest.slice(0,at),...group,...rest.slice(at)];
}
