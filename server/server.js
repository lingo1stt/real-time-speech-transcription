import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getServerConfig, validateServerConfig } from './config.js';
import { createTranscriber } from './transcriber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const config = getServerConfig();
validateServerConfig(config);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const sessions = new Map();
const transcriber = createTranscriber(config);

app.use(express.static(projectRoot));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'transcribe-chunk',
    mode: transcriber.mode
  });
});

app.post('/transcribe-chunk', upload.single('audio'), async (req, res) => {
  try {
    validateRequest(req);

    const payload = buildChunkPayload(req);
    const transcription = await transcriber.transcribeChunk(payload);
    const sessionState = getOrCreateSession(payload.sessionId);
    const appendText = buildAppendText(sessionState, transcription.text, payload.chunkId);

    res.json({
      sessionId: payload.sessionId,
      chunkId: payload.chunkId,
      text: transcription.text,
      appendText,
      isFinal: true,
      receivedAt: new Date().toISOString()
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: {
        code: error.code || 'TRANSCRIPTION_FAILED',
        message: error.message || 'Unable to transcribe this chunk.'
      }
    });
  }
});

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Transcriber mode: ${transcriber.mode}`);
});

function validateRequest(req) {
  if (!req.body || typeof req.body !== 'object') {
    throw createError(400, 'INVALID_REQUEST', 'Expected multipart/form-data fields in the request body.');
  }

  const requiredFields = [
    'sessionId',
    'chunkId',
    'language',
    'mimeType',
    'chunkStartMs',
    'chunkEndMs',
    'chunkDurationMs'
  ];

  for (const field of requiredFields) {
    if (!req.body[field]) {
      throw createError(400, 'INVALID_REQUEST', `Missing required field "${field}".`);
    }
  }

  if (!req.file) {
    throw createError(400, 'MISSING_AUDIO', 'The "audio" file field is required.');
  }

  const numericFields = ['chunkId', 'chunkStartMs', 'chunkEndMs', 'chunkDurationMs'];
  for (const field of numericFields) {
    if (!Number.isFinite(Number(req.body[field]))) {
      throw createError(400, 'INVALID_REQUEST', `"${field}" must be numeric.`);
    }
  }
}

function buildChunkPayload(req) {
  return {
    sessionId: req.body.sessionId,
    chunkId: Number(req.body.chunkId),
    language: req.body.language,
    mimeType: req.body.mimeType,
    chunkStartMs: Number(req.body.chunkStartMs),
    chunkEndMs: Number(req.body.chunkEndMs),
    chunkDurationMs: Number(req.body.chunkDurationMs),
    audio: req.file
  };
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      processedChunkIds: new Set(),
      lastTranscript: ''
    });
  }

  return sessions.get(sessionId);
}

function buildAppendText(sessionState, text, chunkId) {
  if (sessionState.processedChunkIds.has(chunkId)) {
    return '';
  }

  sessionState.processedChunkIds.add(chunkId);
  sessionState.lastTranscript = text;

  if (!text) {
    return '';
  }

  return text.endsWith(' ') ? text : `${text} `;
}

function createError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
