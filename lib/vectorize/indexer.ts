/**
 * Cloudflare Vectorize Integration for Code Search
 * 
 * This module provides semantic code search using Cloudflare's Vectorize
 * and AI embeddings. It indexes code chunks for similarity search,
 * enabling natural language queries like "find authentication logic"
 * or "where is error handling implemented".
 * 
 * Note: This requires Cloudflare Workers runtime. For local development,
 * use the mock implementation or connect to a deployed worker.
 */

import type { CodeChunk } from '../github/format-for-ai';

/**
 * Cloudflare Vectorize environment bindings
 */
export interface VectorizeEnv {
  AI: AiBinding;
  VECTORIZE: VectorizeIndex;
}

/**
 * Cloudflare AI binding interface
 */
export interface AiBinding {
  run(model: string, input: { text: string | string[] }): Promise<AiEmbeddingResponse>;
}

/**
 * AI embedding response
 */
export interface AiEmbeddingResponse {
  data: number[][];
}

/**
 * Vectorize index interface
 */
export interface VectorizeIndex {
  insert(vectors: VectorizeVector[]): Promise<VectorizeInsertResult>;
  query(vector: number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
  deleteByIds(ids: string[]): Promise<VectorizeDeleteResult>;
  getByIds(ids: string[]): Promise<VectorizeVector[]>;
}

/**
 * Vector to insert into index
 */
export interface VectorizeVector {
  id: string;
  values: number[];
  metadata?: Record<string, string | number | boolean>;
  namespace?: string;
}

/**
 * Insert operation result
 */
export interface VectorizeInsertResult {
  count: number;
  ids: string[];
}

/**
 * Delete operation result
 */
export interface VectorizeDeleteResult {
  count: number;
  ids: string[];
}

/**
 * Query options
 */
export interface VectorizeQueryOptions {
  topK?: number;
  returnMetadata?: boolean;
  returnValues?: boolean;
  namespace?: string;
  filter?: Record<string, string | number | boolean>;
}

/**
 * Query matches result
 */
export interface VectorizeMatches {
  matches: VectorizeMatch[];
  count: number;
}

/**
 * Single match from query
 */
export interface VectorizeMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Index configuration
 */
export const VECTORIZE_CONFIG = {
  MODEL: '@cf/baai/bge-base-en-v1.5',
  DIMENSIONS: 768, // BGE base model dimension
  BATCH_SIZE: 10,
  MAX_RETRIES: 3,
  SIMILARITY_THRESHOLD: 0.7,
};

/**
 * Index code chunks into Vectorize for semantic search
 */
export async function indexCodeChunks(
  chunks: CodeChunk[],
  env: VectorizeEnv,
  repoId: string
): Promise<{ indexed: number; errors: string[] }> {
  const errors: string[] = [];
  let indexed = 0;

  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += VECTORIZE_CONFIG.BATCH_SIZE) {
    const batch = chunks.slice(i, i + VECTORIZE_CONFIG.BATCH_SIZE);

    try {
      // Generate embeddings for the batch
      const texts = batch.map(chunk => prepareTextForEmbedding(chunk));
      
      const embeddingResponse = await env.AI.run(VECTORIZE_CONFIG.MODEL, {
        text: texts,
      });

      if (!embeddingResponse.data || embeddingResponse.data.length !== batch.length) {
        throw new Error('Embedding response mismatch');
      }

      // Create vectors with metadata
      const vectors: VectorizeVector[] = batch.map((chunk, j) => ({
        id: `${repoId}:${chunk.id}`,
        values: embeddingResponse.data[j],
        namespace: repoId,
        metadata: {
          path: chunk.path,
          type: chunk.type,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          language: chunk.metadata.language,
          name: chunk.metadata.name || '',
          tokens: chunk.metadata.tokens,
        },
      }));

      // Insert into Vectorize
      const result = await env.VECTORIZE.insert(vectors);
      indexed += result.count;

      console.log(`[Vectorize] Indexed batch ${Math.floor(i / VECTORIZE_CONFIG.BATCH_SIZE) + 1}: ${result.count} vectors`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Batch ${Math.floor(i / VECTORIZE_CONFIG.BATCH_SIZE) + 1}: ${errorMsg}`);
      console.error(`[Vectorize] Error indexing batch:`, error);
    }
  }

  console.log(`[Vectorize] Indexing complete: ${indexed}/${chunks.length} chunks indexed`);
  
  return { indexed, errors };
}

/**
 * Prepare text for embedding by combining relevant information
 */
function prepareTextForEmbedding(chunk: CodeChunk): string {
  const parts: string[] = [];

  // Add type context
  parts.push(`[${chunk.type.toUpperCase()}]`);

  // Add name if available
  if (chunk.metadata.name) {
    parts.push(`Name: ${chunk.metadata.name}`);
  }

  // Add path context
  parts.push(`File: ${chunk.path}`);

  // Add the actual code content
  parts.push(chunk.content);

  return parts.join('\n');
}

/**
 * Search for similar code using natural language query
 */
export async function searchSimilarCode(
  query: string,
  env: VectorizeEnv,
  options?: {
    repoId?: string;
    limit?: number;
    type?: CodeChunk['type'];
    language?: string;
    minScore?: number;
  }
): Promise<SearchResult[]> {
  const limit = options?.limit ?? 5;
  const minScore = options?.minScore ?? VECTORIZE_CONFIG.SIMILARITY_THRESHOLD;

  try {
    // Generate embedding for the query
    const embeddingResponse = await env.AI.run(VECTORIZE_CONFIG.MODEL, {
      text: query,
    });

    const queryVector = embeddingResponse.data[0];

    // Build query options
    const queryOptions: VectorizeQueryOptions = {
      topK: limit * 2, // Fetch more to account for filtering
      returnMetadata: true,
    };

    // Add namespace filter if searching specific repo
    if (options?.repoId) {
      queryOptions.namespace = options.repoId;
    }

    // Query Vectorize
    const matches = await env.VECTORIZE.query(queryVector, queryOptions);

    // Process and filter results
    const results: SearchResult[] = matches.matches
      .filter(match => {
        // Score threshold
        if (match.score < minScore) return false;

        // Type filter
        if (options?.type && match.metadata?.type !== options.type) return false;

        // Language filter
        if (options?.language && match.metadata?.language !== options.language) return false;

        return true;
      })
      .slice(0, limit)
      .map(match => ({
        id: match.id,
        path: String(match.metadata?.path || ''),
        type: String(match.metadata?.type || 'function') as CodeChunk['type'],
        score: match.score,
        metadata: {
          startLine: Number(match.metadata?.startLine || 1),
          endLine: Number(match.metadata?.endLine || 1),
          language: String(match.metadata?.language || 'text'),
          name: match.metadata?.name ? String(match.metadata.name) : undefined,
          tokens: Number(match.metadata?.tokens || 0),
        },
      }));

    console.log(`[Vectorize] Search found ${results.length} results for query: "${query.substring(0, 50)}..."`);

    return results;
  } catch (error) {
    console.error('[Vectorize] Search error:', error);
    throw new Error(`Vectorize search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search result interface
 */
export interface SearchResult {
  id: string;
  path: string;
  type: CodeChunk['type'];
  score: number;
  metadata: {
    startLine: number;
    endLine: number;
    language: string;
    name?: string;
    tokens: number;
  };
  content?: string; // Optionally populated from database
}

/**
 * Delete all vectors for a repository
 */
export async function deleteRepoVectors(
  repoId: string,
  env: VectorizeEnv
): Promise<{ deleted: number }> {
  try {
    // Note: Vectorize doesn't support namespace deletion directly
    // In production, you'd need to track IDs in a database or use a different approach
    console.log(`[Vectorize] Deleting vectors for repo: ${repoId}`);
    
    // This is a placeholder - actual implementation depends on how you track vector IDs
    // You might need to query all vectors in the namespace first, then delete by ID
    // For now, we acknowledge the env binding exists
    if (env.VECTORIZE) {
      // Future: Implement actual deletion logic
    }
    
    return { deleted: 0 };
  } catch (error) {
    console.error('[Vectorize] Delete error:', error);
    throw error;
  }
}

/**
 * Get related code chunks based on a specific chunk
 */
export async function findRelatedCode(
  chunk: CodeChunk,
  env: VectorizeEnv,
  options?: {
    repoId?: string;
    limit?: number;
    excludeSelf?: boolean;
  }
): Promise<SearchResult[]> {
  const text = prepareTextForEmbedding(chunk);
  
  const results = await searchSimilarCode(text, env, {
    repoId: options?.repoId,
    limit: (options?.limit ?? 5) + (options?.excludeSelf ? 1 : 0),
  });

  // Optionally exclude the input chunk itself
  if (options?.excludeSelf) {
    return results.filter(r => r.id !== chunk.id).slice(0, options?.limit ?? 5);
  }

  return results;
}

/**
 * Batch search for multiple queries
 */
export async function batchSearch(
  queries: string[],
  env: VectorizeEnv,
  options?: {
    repoId?: string;
    limitPerQuery?: number;
  }
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();

  // Process queries in parallel with some concurrency control
  const CONCURRENCY = 5;
  
  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    const batch = queries.slice(i, i + CONCURRENCY);
    
    const batchResults = await Promise.all(
      batch.map(query => 
        searchSimilarCode(query, env, {
          repoId: options?.repoId,
          limit: options?.limitPerQuery ?? 3,
        }).catch(error => {
          console.error(`[Vectorize] Batch search error for "${query}":`, error);
          return [] as SearchResult[];
        })
      )
    );

    batch.forEach((query, j) => {
      results.set(query, batchResults[j]);
    });
  }

  return results;
}

/**
 * Calculate semantic similarity between two code chunks
 */
export async function calculateSimilarity(
  chunk1: CodeChunk,
  chunk2: CodeChunk,
  env: VectorizeEnv
): Promise<number> {
  const text1 = prepareTextForEmbedding(chunk1);
  const text2 = prepareTextForEmbedding(chunk2);

  const embeddingResponse = await env.AI.run(VECTORIZE_CONFIG.MODEL, {
    text: [text1, text2],
  });

  const vec1 = embeddingResponse.data[0];
  const vec2 = embeddingResponse.data[1];

  // Calculate cosine similarity
  return cosineSimilarity(vec1, vec2);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Mock implementation for local development without Cloudflare Workers
 */
export class MockVectorizeIndex implements VectorizeIndex {
  private vectors = new Map<string, VectorizeVector>();

  async insert(vectors: VectorizeVector[]): Promise<VectorizeInsertResult> {
    const ids: string[] = [];
    for (const vector of vectors) {
      this.vectors.set(vector.id, vector);
      ids.push(vector.id);
    }
    return { count: ids.length, ids };
  }

  async query(vector: number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches> {
    const matches: VectorizeMatch[] = [];
    
    for (const [id, stored] of this.vectors) {
      if (options?.namespace && stored.namespace !== options.namespace) continue;
      
      const score = cosineSimilarity(vector, stored.values);
      matches.push({
        id,
        score,
        metadata: options?.returnMetadata ? stored.metadata : undefined,
        values: options?.returnValues ? stored.values : undefined,
      });
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return {
      matches: matches.slice(0, options?.topK ?? 10),
      count: matches.length,
    };
  }

  async deleteByIds(ids: string[]): Promise<VectorizeDeleteResult> {
    const deleted: string[] = [];
    for (const id of ids) {
      if (this.vectors.delete(id)) {
        deleted.push(id);
      }
    }
    return { count: deleted.length, ids: deleted };
  }

  async getByIds(ids: string[]): Promise<VectorizeVector[]> {
    return ids
      .map(id => this.vectors.get(id))
      .filter((v): v is VectorizeVector => v !== undefined);
  }
}

/**
 * Create a mock environment for local development
 */
export function createMockEnv(): VectorizeEnv {
  return {
    AI: {
      async run(_model: string, input: { text: string | string[] }): Promise<AiEmbeddingResponse> {
        // Generate random embeddings for testing
        const texts = Array.isArray(input.text) ? input.text : [input.text];
        const data = texts.map(() => {
          const embedding = new Array(VECTORIZE_CONFIG.DIMENSIONS);
          for (let i = 0; i < embedding.length; i++) {
            embedding[i] = Math.random() * 2 - 1;
          }
          // Normalize
          const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
          return embedding.map(val => val / norm);
        });
        return { data };
      },
    },
    VECTORIZE: new MockVectorizeIndex(),
  };
}

// Export types and utilities
export type { CodeChunk };
