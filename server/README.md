# Backend Setup

This project includes a Node.js backend for `POST /transcribe-chunk`.

## What is already implemented

- Serves the frontend from the project root
- Accepts chunk uploads at `/transcribe-chunk`
- Validates the request fields expected by the frontend
- Returns JSON matching `docs/transcribe-chunk-api.md`
- Separates config loading from transcription provider logic
- Supports a mock transcriber mode out of the box
- Supports OpenAI speech-to-text via the Audio Transcriptions API

## Files

- `server/server.js`
  - Express server and `/transcribe-chunk` route
- `server/config.js`
  - Loads and validates environment configuration
- `server/transcriber.js`
  - Provider abstraction for speech-to-text

## Install and run

1. Install Node.js 18 or newer.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` if you want to customize settings.
4. Validate config:

```bash
npm run check:config
```

5. Start the server:

```bash
npm start
```

6. Open:

```txt
http://localhost:3000
```

## Health check

```txt
GET /health
```

Expected JSON:

```json
{
  "ok": true,
  "service": "transcribe-chunk",
  "mode": "mock-placeholder"
}
```

## Mock mode

By default, the backend returns a placeholder transcript such as:

```txt
[mock transcript] chunk 1 (zh-TW, 4000ms, chunk-1.webm)
```

If you want a custom mock string:

Windows PowerShell:

```powershell
$env:MOCK_TRANSCRIPTION_TEXT="hello from mock stt"
npm start
```

## OpenAI STT mode

Set these environment variables:

```powershell
$env:STT_PROVIDER="openai"
$env:OPENAI_API_KEY="your_api_key"
$env:OPENAI_STT_MODEL="gpt-4o-mini-transcribe"
npm start
```

Supported models in this project:

- `gpt-4o-mini-transcribe`
- `gpt-4o-transcribe`
- `whisper-1`

Notes:

- The backend sends recorded `webm` chunks to OpenAI's `POST /v1/audio/transcriptions`.
- Input file uploads for this endpoint are documented by OpenAI as supporting formats including `webm`, with file uploads limited to 25 MB.
- For `gpt-4o-transcribe` and `gpt-4o-mini-transcribe`, the project expects JSON responses containing a `text` field.

Source:

- https://platform.openai.com/docs/guides/speech-to-text
- https://platform.openai.com/docs/api-reference/audio/createTranscription

## Provider extension point

Add or modify branches in `server/transcriber.js` if you want to support another STT provider.

That provider already receives:

- `sessionId`
- `chunkId`
- `language`
- `mimeType`
- `chunkStartMs`
- `chunkEndMs`
- `chunkDurationMs`
- `audio.buffer`

Return shape:

```js
return {
  text: 'real transcript for this chunk'
};
```
