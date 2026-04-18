export function getServerConfig() {
  const port = Number(process.env.PORT || 3000);
  const sttProvider = process.env.STT_PROVIDER || 'mock';
  const mockTranscriptionText = process.env.MOCK_TRANSCRIPTION_TEXT || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const openaiSttModel = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';

  return {
    port,
    sttProvider,
    mockTranscriptionText,
    openaiApiKey,
    openaiSttModel
  };
}

export function validateServerConfig(config) {
  if (!Number.isFinite(config.port) || config.port <= 0) {
    throw createConfigError('PORT must be a positive number.');
  }

  const supportedProviders = ['mock', 'openai'];
  if (!supportedProviders.includes(config.sttProvider)) {
    throw createConfigError(`Unsupported STT_PROVIDER "${config.sttProvider}". Supported values: ${supportedProviders.join(', ')}.`);
  }

  if (config.sttProvider === 'openai') {
    if (!config.openaiApiKey) {
      throw createConfigError('OPENAI_API_KEY is required when STT_PROVIDER=openai.');
    }

    const supportedModels = ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'];
    if (!supportedModels.includes(config.openaiSttModel)) {
      throw createConfigError(`Unsupported OPENAI_STT_MODEL "${config.openaiSttModel}". Supported values: ${supportedModels.join(', ')}.`);
    }
  }
}

function createConfigError(message) {
  const error = new Error(message);
  error.code = 'INVALID_CONFIG';
  return error;
}
