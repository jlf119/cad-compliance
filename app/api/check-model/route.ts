import { NextResponse } from 'next/server';

const ONSHAPE_API_URL = 'https://cad.onshape.com/api';

// Helper: Initiate STEP translation
async function initiateStepTranslation(documentId: string, workspaceId: string, elementId: string, accessToken: string) {
  const translationUrl = `${ONSHAPE_API_URL}/documents/d/${documentId}/w/${workspaceId}/e/${elementId}/translations`;
  const translationBody = {
    formatName: "STEP",
    storeInDocument: false,
    flattenAssemblies: false,
    configuration: "default"
  };
  const resp = await fetch(translationUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(translationBody)
  });
  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Failed to start translation: ${errorText}`);
  }
  return resp.json();
}

// Helper: Poll for translation completion
async function pollTranslation(translationId: string, accessToken: string) {
  for (let i = 0; i < 20; i++) { // Poll up to 10 seconds (20 x 500ms)
    await new Promise(res => setTimeout(res, 500));
    const pollResp = await fetch(`${ONSHAPE_API_URL}/translations/${translationId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const pollData = await pollResp.json();
    if (pollData.requestState === "DONE") {
      return pollData;
    }
    if (pollData.requestState === "FAILED") {
      throw new Error(`Translation failed: ${pollData.failureReason}`);
    }
  }
  throw new Error('Translation timed out');
}

// Helper: Get STEP download URL
function getStepDownloadUrl(documentId: string, externalId: string) {
  return `${ONSHAPE_API_URL}/documents/d/${documentId}/externaldata/${externalId}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentId, workspaceId, elementId, accessToken } = body;
    if (!documentId || !workspaceId || !elementId || !accessToken) {
      return NextResponse.json({ error: 'Missing required parameters (documentId, workspaceId, elementId, accessToken).' }, { status: 400 });
    }
    // 1. Initiate translation
    const startData = await initiateStepTranslation(documentId, workspaceId, elementId, accessToken);
    const translationId = startData.id;
    // 2. Poll for completion
    const translationResult = await pollTranslation(translationId, accessToken);
    // 3. Get download URL
    const externalId = translationResult.resultExternalDataIds[0];
    const downloadUrl = getStepDownloadUrl(documentId, externalId);
    return NextResponse.json({ success: true, downloadUrl, translationId });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
