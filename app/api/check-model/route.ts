import { NextResponse } from 'next/server';
import crypto from 'crypto';

// You should store these in your environment variables!
const ONSHAPE_ACCESS_KEY = process.env.OAUTH_CLIENT_ID;
const ONSHAPE_SECRET_KEY = process.env.OAUTH_CLIENT_SECRET;
const ONSHAPE_API_URL = 'https://cad.onshape.com/api';

function signRequest(method: string, url: string, date: string, accessKey: string, secretKey: string) {
  // See Onshape docs for canonical string and HMAC-SHA256 signature
  // This is a simplified version; for production, use their full signing process!
  const canonicalString = `${method}\n${url}\n${date}\n${accessKey}`;
  const signature = crypto.createHmac('sha256', secretKey).update(canonicalString).digest('base64');
  return `On ${accessKey}:HmacSHA256:${signature}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rules, documentId, workspaceId, elementId } = body;

    if (!documentId || !workspaceId || !elementId) {
      return NextResponse.json({ error: 'Missing Onshape document/workspace/element IDs.' }, { status: 400 });
    }

    // Prepare Onshape API request
    const method = 'GET';
    const apiPath = `/documents/${documentId}/w/${workspaceId}/e/${elementId}/export`;
    const url = `${ONSHAPE_API_URL}${apiPath}?format=STEP&version=14`;

    const date = new Date().toUTCString();
    const authHeader = signRequest(method, apiPath, date, ONSHAPE_ACCESS_KEY!, ONSHAPE_SECRET_KEY!);

    const resp = await fetch(url, {
      method,
      headers: {
        'Date': date,
        'Authorization': authHeader,
        'Accept': 'application/octet-stream'
      }
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json({ error: 'Onshape API error', details: errorText }, { status: resp.status });
    }

    // For demo: return a message, or you could stream the file or upload to your analysis service
    // const stepFile = await resp.arrayBuffer(); // If you want the file contents
    return NextResponse.json({ message: 'STEP export successful', status: resp.status });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
