import { randomUUID } from 'node:crypto';
import { opencodeGoProvider } from '@earendil-works/pi-ai/providers/opencode-go';
import { setProvider } from '@flue/runtime';
import { config } from '../config.js';

let configured = false;

export function configureOpenCodeGoProvider(): void {
  if (configured) return;
  configured = true;
  if (config.openCodeGoKey) process.env.OPENCODE_API_KEY = config.openCodeGoKey;

  const base = opencodeGoProvider();
  const provider: typeof base = {
    ...base,
    name: 'OpenCode Go for SCT pre-filing',
    headers: {
      ...base.headers,
      'x-opencode-client': 'smu-lit-sct-prefiling',
    },
    getModels: () => base.getModels().map((model) => ({
      ...model,
      baseUrl: config.openCodeGoBaseUrl,
    })),
    stream(model, context, options) {
      const sessionId = options?.sessionId ?? randomUUID();
      return base.stream(model, context, {
        ...options,
        sessionId,
        headers: {
          ...options?.headers,
          'x-opencode-client': 'smu-lit-sct-prefiling',
          'x-opencode-session': sessionId,
        },
      } as never);
    },
    streamSimple(model, context, options) {
      const sessionId = options?.sessionId ?? randomUUID();
      return base.streamSimple(model, context, {
        ...options,
        sessionId,
        headers: {
          ...options?.headers,
          'x-opencode-client': 'smu-lit-sct-prefiling',
          'x-opencode-session': sessionId,
        },
      });
    },
  };
  setProvider(provider);
}
