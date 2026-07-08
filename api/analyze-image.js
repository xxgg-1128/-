import {
  buildAnalyzeImageRequest,
  buildQwenAnalyzeImageRequest,
  extractResponseText,
  extractQwenResponseText,
  normalizeAnalysisResult,
  parseAnalysisJson,
} from './_lib/ai-analysis.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};
const MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let totalLength = 0;
  for await (const chunk of request) {
    chunks.push(chunk);
    totalLength += chunk.length;
    if (totalLength > MAX_REQUEST_BODY_BYTES + 512 * 1024) {
      throw new Error('图片过大，请压缩后重试（建议 3MB 以内）');
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const AI_REQUEST_TIMEOUT_MS = 50000;

async function fetchWithTimeout(url, options, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI 分析超时，请压缩图片或稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (parseError) {
    throw new Error(`OpenAI 返回非 JSON 响应 (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const errorMsg = result.error?.message || result.message || `OpenAI API 错误 (${response.status})`;
    throw new Error(errorMsg);
  }

  return result;
}

async function callQwen(payload) {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not configured');
  }

  const response = await fetchWithTimeout('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (parseError) {
    throw new Error(`通义千问返回非 JSON 响应 (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const errorMsg = result.error?.message || result.message || `通义千问 API 错误 (${response.status})`;
    throw new Error(errorMsg);
  }

  return result;
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    sendJson(response, 200, { status: 'ok', provider: String(process.env.AI_PROVIDER || 'openai').toLowerCase() });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJson(request);
    const provider = String(process.env.AI_PROVIDER || 'openai').toLowerCase();
    const payloadInput = {
      fileName: body.fileName,
      dataUrl: body.dataUrl,
      tagLibrary: body.tagLibrary,
    };

    if (!payloadInput.dataUrl) {
      throw new Error('图片数据为空，请重新上传');
    }

    const aiResponse =
      provider === 'qwen'
        ? await callQwen(buildQwenAnalyzeImageRequest(payloadInput))
        : await callOpenAI(buildAnalyzeImageRequest(payloadInput));
    const outputText = provider === 'qwen' ? extractQwenResponseText(aiResponse) : extractResponseText(aiResponse);

    if (!outputText) {
      throw new Error('AI 没有返回有效分析结果，请重试');
    }

    const parsed = parseAnalysisJson(outputText);

    sendJson(response, 200, {
      analysis: normalizeAnalysisResult(parsed, body.tagLibrary),
      provider,
    });
  } catch (error) {
    console.error('AI analysis error:', error.message);
    sendJson(response, 500, {
      error: error.message || 'AI analysis failed',
      provider: String(process.env.AI_PROVIDER || 'openai').toLowerCase(),
    });
  }
}
