import { NextResponse } from 'next/server';

// Refactor to proxy to Express backend
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentId, workspaceId, elementId, rules } = body;
    if (!documentId || !workspaceId || !elementId) {
      return NextResponse.json({ error: 'Missing required parameters (documentId, workspaceId, elementId).' }, { status: 400 });
    }
    // Proxy to Express backend
    const apiRes = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BASE_URL || "http://localhost:3001"}/api/proxy/check-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ documentId, workspaceId, elementId, rules }),
    });
    const data = await apiRes.json();
    return NextResponse.json(data, { status: apiRes.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
