const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

export function createTranscriber(config) {
  if (config.sttProvider === 'mock') {
    return {
      mode: config.mockTranscriptionText ? 'mock-env-text' : 'mock-placeholder',
      async transcribeChunk(payload) {
        if (config.mockTranscriptionText) {
          return {
            text: `${config.mockTranscriptionText} [chunk ${payload.chunkId}]`
          };
        }

        return {
          text: `[mock transcript] chunk ${payload.chunkId} (${payload.language}, ${payload.chunkDurationMs}ms, ${payload.audio.originalname})`
        };
      }
    };
  }

  if (config.sttProvider === 'openai') {
    return {
      mode: `openai:${config.openaiSttModel}`,
      async transcribeChunk(payload) {
        return transcribeWithOpenAI(payload, config);
      }
    };
  }

  throw createTranscriberError(`STT provider "${config.sttProvider}" is not implemented.`);
}

async function transcribeWithOpenAI(payload, config) {
  const formData = new FormData();
  const audioBlob = new Blob([payload.audio.buffer], { type: payload.audio.mimetype || payload.mimeType });

  formData.append('file', audioBlob, payload.audio.originalname);
  formData.append('model', config.openaiSttModel);

  const normalizedLanguage = normalizeLanguage(payload.language);
  if (normalizedLanguage) {
    formData.append('language', normalizedLanguage);
  }

  if (config.openaiSttModel === 'whisper-1') {
    formData.append('response_format', 'json');
  }

  const prompt = buildPrompt(payload);
  if (prompt) {
    formData.append('prompt', prompt);
  }

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: formData
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const apiMessage = data?.error?.message || 'OpenAI transcription request failed.';
    throw createTranscriberError(apiMessage, 'OPENAI_TRANSCRIPTION_FAILED', 502);
  }

  const text = extractTranscriptText(data);
  return { text };
}

function normalizeLanguage(language) {
  if (!language) {
    return '';
  }

  const lower = language.toLowerCase();
  const directMappings = {
    'zh-tw': 'zh',
    'zh-cn': 'zh',
    'en-us': 'en',
    'ja-jp': 'ja'
  };

  if (directMappings[lower]) {
    return directMappings[lower];
  }

  return lower.split('-')[0];
}

function buildPrompt(payload) {
  if (!payload.language) {
    return '';
  }

  return `Transcribe this audio chunk in ${payload.language}. Preserve the spoken language and keep punctuation natural.`;
}

function extractTranscriptText(data) {
  if (!data) {
    throw createTranscriberError('OpenAI returned an empty response.', 'OPENAI_TRANSCRIPTION_FAILED', 502);
  }

  if (typeof data.text === 'string') {
    return data.text.trim();
  }

  if (typeof data === 'string') {
    return data.trim();
  }

  throw createTranscriberError('OpenAI returned an unexpected transcription payload.', 'OPENAI_TRANSCRIPTION_FAILED', 502);
}

function createTranscriberError(message, code = 'UNSUPPORTED_PROVIDER', statusCode = 500) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}
