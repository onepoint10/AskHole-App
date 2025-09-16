# Custom Providers and Models Feature

This feature allows users to add their own LLM providers and models to the application through the settings interface.

## How to Use

### Adding Custom Providers

1. Open the Settings dialog (gear icon in the sidebar)
2. Go to the "API Keys" tab
3. Scroll down to the "Custom Providers" section
4. Click "Add Provider"
5. Fill in the following information:
   - **Provider Name**: A friendly name for your provider (e.g., "My Custom Provider")
   - **Base URL**: The base URL for your provider's API (e.g., "https://api.example.com/v1")
   - **API Key**: Your provider's API key

### Adding Custom Models

1. Open the Settings dialog
2. Go to the "Models" tab
3. Scroll down to the "Custom Models" section
4. Click "Add Model"
5. Enter the model identifier (e.g., "tngtech/deepseek-r1t2-chimera:free")

### Using Custom Models

Once you've added custom providers and models:

1. The custom models will appear in the model selector dropdown
2. They will be labeled as "(Custom)" to distinguish them from built-in models
3. You can select them just like any other model
4. The application will automatically route requests to the appropriate custom provider

## Supported Providers

The custom provider system works with any API that follows the OpenAI-compatible format, including:

- **OpenRouter**: Already built-in, but you can add additional endpoints
- **AI/ML providers**: Various AI/ML service providers
- **NanoGPT**: Local or hosted NanoGPT instances
- **Nvidia Cloud**: Nvidia's AI services
- **Any OpenAI-compatible API**: Including self-hosted models

### Data Storage

Custom providers and models are stored in the browser's localStorage as part of the settings object.

## Security Notes

- API keys are stored in the browser's localStorage (encrypted in production)
- Custom providers are validated on the backend before use
- Each custom provider is isolated and cannot access other providers' data

## Troubleshooting

### Common Issues

1. **"Custom client not found for model"**: Make sure the model name exactly matches what your provider expects
2. **"Failed to initialize custom client"**: Check that the base URL and API key are correct
3. **Models not appearing**: Try refreshing the page after adding a provider

### Provider Requirements

Your custom provider must:
- Support the OpenAI API format
- Have a `/models` endpoint that returns available models
- Have a `/chat/completions` endpoint for generating responses
- Accept standard OpenAI parameters (temperature, max_tokens, etc.)
