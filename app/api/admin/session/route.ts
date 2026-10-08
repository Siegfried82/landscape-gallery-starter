import {isOwnerAuthenticated} from '@/lib/owner';
export async function GET(request:Request){
 return Response.json({authenticated:await isOwnerAuthenticated(request)},{headers:{'Cache-Control':'no-store'}});
}
