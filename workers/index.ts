/**
 * Cloudflare Worker for Code Crime Chronicles Vectorize API
 * 
 * This worker provides semantic code search capabilities using
 * Cloudflare Vectorize and AI embeddings.
 */

import { 
  indexCodeChunks, 
  searchSimilarCode, 
  deleteRepoVectors,
  batchSearch,
  type VectorizeEnv,
  type SearchResult,
  VECTORIZE_CONFIG 
} from '../lib/vectorize/indexer';
import type { CodeChunk } from '../lib/github/format-for-ai';

interface Env extends VectorizeEnv {
  ENVIRONMENT: string;
}

// Cloudflare Workers ExecutionContext type (kept for future use)
// interface ExecutionContext {
//   waitUntil(promise: Promise<unknown>): void;
//   passThroughOnException(): void;
// }

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health' || path === '/') {
        return jsonResponse({
          status: 'healthy',
          service: 'code-crime-chronicles-vectorize',
          environment: env.ENVIRONMENT,
          model: VECTORIZE_CONFIG.MODEL,
          dimensions: VECTORIZE_CONFIG.DIMENSIONS,
        }, corsHeaders);
      }

      // Index code chunks
      if (path === '/api/index' && request.method === 'POST') {
        const body = await request.json() as {
          repoId: string;
          chunks: CodeChunk[];
        };

        if (!body.repoId || !body.chunks || !Array.isArray(body.chunks)) {
          return jsonResponse(
            { error: 'Invalid request: repoId and chunks array required' },
            corsHeaders,
            400
          );
        }

        const result = await indexCodeChunks(body.chunks, env, body.repoId);

        return jsonResponse({
          success: true,
          indexed: result.indexed,
          total: body.chunks.length,
          errors: result.errors,
        }, corsHeaders);
      }

      // Search similar code
      if (path === '/api/search' && request.method === 'POST') {
        const body = await request.json() as {
          query: string;
          repoId?: string;
          limit?: number;
          type?: CodeChunk['type'];
          language?: string;
          minScore?: number;
        };

        if (!body.query) {
          return jsonResponse(
            { error: 'Invalid request: query required' },
            corsHeaders,
            400
          );
        }

        const results = await searchSimilarCode(body.query, env, {
          repoId: body.repoId,
          limit: body.limit,
          type: body.type,
          language: body.language,
          minScore: body.minScore,
        });

        return jsonResponse({
          success: true,
          query: body.query,
          results,
          count: results.length,
        }, corsHeaders);
      }

      // Batch search
      if (path === '/api/search/batch' && request.method === 'POST') {
        const body = await request.json() as {
          queries: string[];
          repoId?: string;
          limitPerQuery?: number;
        };

        if (!body.queries || !Array.isArray(body.queries)) {
          return jsonResponse(
            { error: 'Invalid request: queries array required' },
            corsHeaders,
            400
          );
        }

        const results = await batchSearch(body.queries, env, {
          repoId: body.repoId,
          limitPerQuery: body.limitPerQuery,
        });

        // Convert Map to object for JSON serialization
        const resultsObject: Record<string, SearchResult[]> = {};
        for (const [query, queryResults] of results) {
          resultsObject[query] = queryResults;
        }

        return jsonResponse({
          success: true,
          results: resultsObject,
          queriesProcessed: body.queries.length,
        }, corsHeaders);
      }

      // Delete repo vectors
      if (path === '/api/delete' && request.method === 'DELETE') {
        const body = await request.json() as {
          repoId: string;
        };

        if (!body.repoId) {
          return jsonResponse(
            { error: 'Invalid request: repoId required' },
            corsHeaders,
            400
          );
        }

        const result = await deleteRepoVectors(body.repoId, env);

        return jsonResponse({
          success: true,
          deleted: result.deleted,
        }, corsHeaders);
      }

      // 404 for unknown routes
      return jsonResponse(
        { error: 'Not found', path },
        corsHeaders,
        404
      );

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse(
        { 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        corsHeaders,
        500
      );
    }
  },
};

/**
 * Helper to create JSON responses
 */
function jsonResponse(
  data: unknown, 
  additionalHeaders: Record<string, string> = {},
  status: number = 200
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  });
}

export default worker;
