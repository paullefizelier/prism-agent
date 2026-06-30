// Gemini embeddings (gemini-embedding-2) via the AI SDK. Server-only.
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

const EMBED_MODEL = 'gemini-embedding-2'
export const EMBED_DIMS = 1536 // must match the vector(1536) column

function embeddingModel() {
  const google = createGoogleGenerativeAI({
    apiKey: useRuntimeConfig().googleApiKey
  })
  return google.textEmbedding(EMBED_MODEL)
}

// RETRIEVAL_QUERY: embed a user's search query.
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
    providerOptions: {
      google: { outputDimensionality: EMBED_DIMS, taskType: 'RETRIEVAL_QUERY' }
    }
  })
  return embedding
}

// RETRIEVAL_DOCUMENT: embed product descriptions for indexing.
// Gemini's batch embed API caps at 100 items per request, so chunk by 100.
const MAX_BATCH = 100

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values: texts.slice(i, i + MAX_BATCH),
      providerOptions: {
        google: {
          outputDimensionality: EMBED_DIMS,
          taskType: 'RETRIEVAL_DOCUMENT'
        }
      }
    })
    out.push(...embeddings)
  }
  return out
}
