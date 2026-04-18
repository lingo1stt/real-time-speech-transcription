# Pre-Step-4 Checklist

This checklist tracks everything that should be done before overlap chunking and transcript de-duplication work begins.

## Done in code

- Browser-native `SpeechRecognition` has been removed from the recording flow.
- Frontend recording uses `getUserMedia` + `MediaRecorder`.
- Audio is split into timed chunks.
- Frontend uploads chunks to `POST /transcribe-chunk`.
- Backend validates the request contract.
- Backend returns API responses matching `docs/transcribe-chunk-api.md`.
- Session ids and chunk ids are carried through the pipeline.
- Final transcript appending is already wired into the frontend.
- Filler analysis runs on appended transcript text only.
- Backend config and provider selection are separated from the route handler.

## Still required to fully finish step 3B

- Install Node.js locally.
- Run `npm install`.
- Run `npm run check:config`.
- Start the backend with `npm start`.
- Verify `GET /health` returns `ok: true`.
- Record from the browser and confirm chunk uploads succeed.
- Set `STT_PROVIDER=openai` and provide `OPENAI_API_KEY`.
- Re-test the full browser -> backend -> transcript path with real speech.

## Verification targets before step 4

- Frontend can start and stop recording without browser speech APIs.
- Frontend shows upload progress for chunks.
- Backend rejects malformed uploads with JSON errors.
- Backend accepts valid uploads and returns a JSON transcript payload.
- Transcript text appears in the UI in response to backend results.
- Filler counts change only when `appendText` is returned.

## Known current limitation

- Real STT runtime support is implemented for OpenAI, but live verification is blocked until `OPENAI_API_KEY` is available.
