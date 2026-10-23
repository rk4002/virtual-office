import { signIn, localLogin } from "@/lib/auth";
import { NextResponse } from "next/server";

// Automatisk lokal indlogning. Kun aktiv naar LOCAL_LOGIN=true.
export async function GET(req: Request) {
  if (!localLogin) {
    return NextResponse.json({ error: "Lokal login er slaaet fra" }, { status: 404 });
  }
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("callbackUrl") || "/";
  await signIn("local", { redirectTo });
}
