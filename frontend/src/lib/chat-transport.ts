import { EventType } from '@tanstack/ai'
import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai'
import {
  fetchServerSentEvents,
  type ConnectionAdapter,
  type RunAgentInputContext,
} from '@tanstack/ai-client'

export type DemoStage = 'filing' | 'preparation'

type ChatMessages = Array<UIMessage> | Array<ModelMessage>

const makeId = (prefix: string): string =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

const latestUserMessage = (messages: ChatMessages): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      role?: string
      content?: unknown
      parts?: Array<{ type?: string; content?: string }>
    }

    if (message.role !== 'user') continue

    if (typeof message.content === 'string') return message.content

    if (Array.isArray(message.parts)) {
      const text = message.parts
        .filter((part) => part.type === 'text' && typeof part.content === 'string')
        .map((part) => part.content)
        .join(' ')
      if (text) return text
    }
  }

  return 'your latest message'
}

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> => {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof globalThis.setTimeout>
    const onAbort = () => {
      globalThis.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * A deterministic local transport for demos and UI development. It has no
 * provider, network, eligibility, or document-generation behavior.
 */
export function createDemoConnection(stage: DemoStage): ConnectionAdapter {
  return {
    async *connect(
      messages: ChatMessages,
      _data?: Record<string, unknown>,
      abortSignal?: AbortSignal,
      runContext?: RunAgentInputContext,
    ): AsyncIterable<StreamChunk> {
      const threadId = runContext?.threadId ?? makeId('demo-thread')
      const runId = runContext?.runId ?? makeId('demo-run')
      const messageId = makeId('demo-message')
      const latest = latestUserMessage(messages).trim()
      const stageHint =
        stage === 'filing'
          ? 'You can review or update the structured details before filing.'
          : 'You can review or update the structured details, then use the final PDF button when ready.'
      const response = `Your message “${latest || 'your latest message'}” is saved in this preview. The connected assistant will use it to update your case. ${stageHint}`
      const chunks = response.match(/[\s\S]{1,24}/g) ?? [response]

      yield {
        type: EventType.RUN_STARTED,
        threadId,
        runId,
      } as StreamChunk
      yield {
        type: EventType.TEXT_MESSAGE_START,
        messageId,
        role: 'assistant',
      } as StreamChunk

      for (const delta of chunks) {
        await wait(35, abortSignal)
        yield {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta,
        } as StreamChunk
      }

      yield {
        type: EventType.TEXT_MESSAGE_END,
        messageId,
      } as StreamChunk
      yield {
        type: EventType.RUN_FINISHED,
        threadId,
        runId,
      } as StreamChunk
    },
  }
}

/** Create the production transport against a backend AG-UI SSE endpoint. */
export function createBackendConnection(url: string): ConnectionAdapter {
  return fetchServerSentEvents(url)
}
