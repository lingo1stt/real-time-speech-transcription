# `/transcribe-chunk` API Spec

This document defines the HTTP contract expected by the frontend chunk upload flow.

## Endpoint

- Method: `POST`
- Path: `/transcribe-chunk`
- Content-Type: `multipart/form-data`

## Request fields

- `sessionId`
  - Type: `string`
  - Purpose: Identifies one recording session across many chunks.
- `chunkId`
  - Type: `integer`
  - Purpose: Monotonic sequence number from the browser.
- `language`
  - Type: `string`
  - Purpose: BCP-47 language tag such as `zh-TW`, `zh-CN`, `en-US`, or `ja-JP`.
- `mimeType`
  - Type: `string`
  - Purpose: Audio MIME type produced by `MediaRecorder`.
- `chunkStartMs`
  - Type: `integer`
  - Purpose: Relative start time of the chunk inside the session.
- `chunkEndMs`
  - Type: `integer`
  - Purpose: Relative end time of the chunk inside the session.
- `chunkDurationMs`
  - Type: `integer`
  - Purpose: Duration used by the browser chunk timer.
- `audio`
  - Type: file
  - Purpose: The recorded audio blob for this chunk.

## Success response

Status: `200 OK`

```json
{
  "sessionId": "3c29d6af-6fb8-4f59-9ad1-8053588d5ff8",
  "chunkId": 4,
  "text": "this is the full transcript for chunk 4",
  "appendText": "this text should be appended to the final transcript",
  "isFinal": true,
  "receivedAt": "2026-04-13T09:21:00.000Z"
}
```

## Response field meaning

- `sessionId`
  - Echo the request session id.
- `chunkId`
  - Echo the processed chunk id.
- `text`
  - The full transcription for this chunk.
- `appendText`
  - The de-duplicated text that the frontend should append to the final transcript.
  - This lets the backend handle overlap removal if you add overlap chunking later.
- `isFinal`
  - `true` when the backend considers this chunk stable enough for transcript accumulation.
- `receivedAt`
  - ISO timestamp for debugging and ordering.

## Error response

Status: `4xx` or `5xx`

```json
{
  "error": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "Unable to transcribe this chunk."
  }
}
```

## Backend behavior requirements

- Process chunks in a way that preserves ordering per `sessionId`.
- Return `appendText` as an empty string when the chunk was transcribed but should not yet change the final transcript.
- Validate that `chunkId`, `chunkStartMs`, `chunkEndMs`, and `chunkDurationMs` are numeric.
- Reject requests without `audio`.
- Return JSON on both success and failure.

## Minimal backend pseudocode

```txt
1. Accept multipart/form-data.
2. Read metadata fields and audio file.
3. Convert the uploaded blob into the format required by your STT provider if needed.
4. Send the audio to the speech-to-text engine.
5. Build:
   - text: full chunk transcript
   - appendText: the transcript delta safe to append
6. Return the JSON success payload.
```
