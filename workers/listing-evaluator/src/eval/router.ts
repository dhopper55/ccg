// Entry point for the CCG Eval connector host (mcp.coalcreekguitars.com). Everything on that
// host is handled here and never reaches the existing www routes; the admin cookie is never
// accepted here, and connector tokens are never accepted by /api/*.
//
//   GET  /.well-known/oauth-protected-resource[/mcp]   resource metadata (RFC 9728)
//   GET  /.well-known/oauth-authorization-server       authorization server metadata (RFC 8414)
//   POST /register                                     dynamic client registration
//   GET  /authorize, POST /authorize                   owner-password sign-in
//   POST /token                                        tokens (authorization_code, refresh_token)
//   POST /mcp                                          MCP Streamable HTTP (stateless, JSON responses)

import type { Env } from '../env.js';
import { dbCountRecentToolCalls, dbLogToolCall } from './db.js';
import {
  handleAuthorizationServerMetadata,
  handleAuthorize,
  handleProtectedResourceMetadata,
  handleRegister,
  handleToken,
  resourceMetadataUrl,
  verifyAccessToken,
  type AccessTokenInfo,
} from './oauth.js';
import { findTool, listTools, type ToolLogTarget, type ToolResult } from './tools.js';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const TOOL_CALLS_PER_MINUTE = 60;

const SERVER_INSTRUCTIONS =
  'Tools for evaluating gear the owner queued in the Coal Creek Guitars admin ("Queue for Claude"). ' +
  'When the owner says eval or continue, call get_next_queued_item. If it returns queue_empty, reply "Nothing queued." and stop. ' +
  'Otherwise call get_item_photos, follow the evaluation_rules it returns, save with the matching save tool and the queue_id, ' +
  'then call get_next_queued_item again and keep going until the queue is empty.';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

const CONNECTOR_PATHS = new Set(['/mcp', '/register', '/authorize', '/token']);

// The connector host, or (for `wrangler dev`) a localhost request for one of the connector paths.
export function isMcpRequest(env: Env, url: URL): boolean {
  const host = (env.MCP_HOST || 'mcp.coalcreekguitars.com').toLowerCase();
  if (url.hostname.toLowerCase() === host) return true;
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return isLocal && (CONNECTOR_PATHS.has(url.pathname) || url.pathname.startsWith('/.well-known/oauth-'));
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleMcpHost(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') {
      return withCors(handleProtectedResourceMetadata(origin));
    }
    if (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/oauth-authorization-server/mcp') {
      return withCors(handleAuthorizationServerMetadata(origin));
    }
    if (path === '/register' && method === 'POST') return withCors(await handleRegister(request, env));
    if (path === '/authorize') return handleAuthorize(request, env);
    if (path === '/token') return withCors(await handleToken(request, env));
    if (path === '/mcp') return withCors(await handleMcp(request, env, origin));
    if (path === '/' && method === 'GET') {
      return new Response('CCG Eval connector. Add https://' + url.host + '/mcp as a custom connector in Claude.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return new Response('Not found', { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ccg-eval connector error', message);
    if (/no such table/i.test(message)) {
      return withCors(new Response(JSON.stringify({ error: 'server_error', error_description: 'Run d1-add-eval-connector.sql first.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return withCors(new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
  }
}

// ---------------------------------------------------------------------------------------------
// MCP over Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch) and
// gets a JSON response. No sessions and no server-to-client streams are needed for tools.
// ---------------------------------------------------------------------------------------------

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function unauthorized(origin: string, invalid: boolean): Response {
  const parts = [`Bearer resource_metadata="${resourceMetadataUrl(origin)}"`];
  if (invalid) parts.push('error="invalid_token"', 'error_description="The access token is missing, expired or revoked."');
  return new Response(JSON.stringify({ error: invalid ? 'invalid_token' : 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': parts.join(', ') },
  });
}

function rpcResult(id: JsonRpcMessage['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: JsonRpcMessage['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleMcp(request: Request, env: Env, origin: string): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'DELETE') {
    // No server-initiated stream and no sessions in this stateless server.
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }
  if (method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });

  const hasAuthHeader = Boolean(request.headers.get('authorization'));
  const token = await verifyAccessToken(request, env);
  if (!token) return unauthorized(origin, hasAuthHeader);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') {
      responses.push(rpcError(null, -32600, 'Invalid request'));
      continue;
    }
    const message = raw as JsonRpcMessage;
    // Notifications and client responses get no reply.
    if (!message.method || message.id === undefined || message.id === null) continue;
    responses.push(await handleRpc(message, env, token));
  }

  if (!responses.length) return new Response(null, { status: 202 });
  const body = Array.isArray(payload) ? responses : responses[0];
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

async function handleRpc(message: JsonRpcMessage, env: Env, token: AccessTokenInfo): Promise<unknown> {
  const params = message.params && typeof message.params === 'object' ? message.params : {};
  switch (message.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      return rpcResult(message.id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ccg-eval', title: 'CCG Eval', version: '1.0.0' },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(message.id, {});
    case 'tools/list':
      return rpcResult(message.id, { tools: listTools() });
    case 'tools/call':
      return rpcResult(message.id, await callTool(params, env, token));
    case 'resources/list':
      return rpcResult(message.id, { resources: [] });
    case 'prompts/list':
      return rpcResult(message.id, { prompts: [] });
    default:
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

async function callTool(params: Record<string, unknown>, env: Env, token: AccessTokenInfo): Promise<ToolResult> {
  const tool = findTool(params.name);
  const toolName = typeof params.name === 'string' ? params.name.slice(0, 80) : 'unknown';
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool "${toolName}".` }], isError: true };
  }

  const recent = await dbCountRecentToolCalls(env, token.tokenId, 60 * 1000);
  if (recent >= TOOL_CALLS_PER_MINUTE) {
    await dbLogToolCall(env, { tool: toolName, userId: token.userId, tokenId: token.tokenId, ok: false, error: 'rate limited' });
    return { content: [{ type: 'text', text: 'Too many tool calls in the last minute. Wait a minute and try again.' }], isError: true };
  }

  const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
    ? (params.arguments as Record<string, unknown>)
    : {};
  const log: ToolLogTarget = {};
  let result: ToolResult;
  try {
    result = await tool.run(args, { env, userId: token.userId, tokenId: token.tokenId }, log);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ccg-eval tool ${toolName} failed`, message);
    result = {
      content: [{ type: 'text', text: /no such table/i.test(message)
        ? 'The connector database tables are missing. Tell the owner to run d1-add-eval-connector.sql.'
        : 'The tool failed on the server. Try again once; if it fails again, tell the owner.' }],
      isError: true,
    };
  }
  await dbLogToolCall(env, {
    tool: toolName,
    kind: log.kind ?? null,
    recordId: log.recordId ?? null,
    userId: token.userId,
    tokenId: token.tokenId,
    ok: !result.isError,
    error: result.isError ? (result.content[0]?.type === 'text' ? result.content[0].text : 'error') : null,
  });
  return result;
}
