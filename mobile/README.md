# ARTSS Agent Mobile

Native iPhone-first client for the ARTSS Agent Supabase Edge runtime.

## Runtime

- Expo SDK 57 / React Native 0.86
- New Architecture enabled
- Hermes is provided by React Native
- Access code stored with Expo SecureStore
- No AI, GitHub, Supabase service-role, or provider secret is embedded in the app
- POST requests go only through the protected `artss-agent` gateway

## Local test

```bash
cd mobile
npm install
npm run typecheck
npm test
npm run ios
```

For a physical iPhone, start Expo and open the development build / Expo Go as supported by the current SDK.

## Acceptance

1. Health chips show API / GitHub / execution status.
2. Login stores only the user-entered gateway access code.
3. A 401 clears the stored code and returns to login.
4. Chat can select OpenAI, DeepSeek, or Gemini.
5. Executed changes display branch metadata and a clickable Pull Request link.
