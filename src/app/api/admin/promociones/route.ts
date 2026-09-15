import { GET as getBanner, POST as postBanner } from "@/app/api/banner/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return getBanner();
}

export async function POST(req: any) {
  return postBanner(req);
}
