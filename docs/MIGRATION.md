# ARTSS Agent mobile path

## Decision

The product currently has a production web client and no existing native iOS or Android client to preserve. The mobile implementation therefore uses a greenfield React Native client rather than a brownfield migration.

## Product boundary

The mobile client is intentionally thin:

- UI, local secure session, navigation and accessibility are native.
- Agent orchestration, AI provider credentials, GitHub credentials and repository writes remain server-side in Supabase Edge.
- The client never embeds provider keys, GitHub tokens, Supabase service-role credentials or agent service keys.

## Verification checkpoint

Representative flows:

1. Authenticate with the ARTSS gateway access code.
2. Read runtime health and provider availability.
3. Send a repository task and render answer/preview/executed states.
4. Open a returned GitHub Pull Request.
5. Receive a 401 and clear the local access credential.

Release readiness requires typecheck, component tests, iOS device/simulator smoke testing, and a TestFlight build before App Store distribution.
