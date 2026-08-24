import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams.toString();

    // Configure the backend URL via env. Defaults to localhost for development.
    const backendBase = process.env.BACKEND_URL ?? "http://localhost:8000";
    const backendUrl = `${backendBase}/api/vtc/compare${params ? `?${params}` : ""}`;

    const backendResp = await fetch(backendUrl);
    const body = await backendResp.text();

    return new NextResponse(body, {
      status: backendResp.status,
      headers: {
        "content-type":
          backendResp.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
