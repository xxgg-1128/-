import {
  buildAnalyzeImageRequest,
  extractResponseText,
  normalizeAnalysisResult,
} from './_lib/ai-analysis.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function callOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || 'OpenAI analysis failed');
  }

  return result;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJson(request);
    const openaiPayload = buildAnalyzeImageRequest({
      fileName: body.fileName,
      dataUrl: body.dataUrl,
    });
    const openaiResponse = await callOpenAI(openaiPayload);
    const outputText = extractResponseText(openaiResponse);
    const parsed = JSON.parse(outputText);

    sendJson(response, 200, {
      analysis: normalizeAnalysisResult(parsed),
      provider: 'openai',
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'AI analysis failed',
      provider: 'openai',
    });
  }
}
