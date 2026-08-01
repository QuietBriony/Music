const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "Vary": "Authorization, X-Lyric-Lab-Token"
};

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;
const MAX_DRAFTS_PER_REQUEST = 500;
const MAX_REQUEST_BYTES = 2_000_000;
const MAX_DRAFT_JSON_BYTES = 256_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function text(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function constantTimeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function requireAuth(request, env) {
  const expected = env.LYRIC_LAB_TOKEN;
  if (!expected) return text("Cloud sync disabled: set LYRIC_LAB_TOKEN.", 503);
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const provided = request.headers.get("x-lyric-lab-token") || bearer;
  if (!constantTimeEqual(provided, expected)) return text("Unauthorized.", 401);
  return null;
}

function dbFromEnv(env) {
  return env.LYRIC_LAB_DB || env.DB;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function clip(value, max) {
  return String(value || "").slice(0, max);
}

function isoDate(value, fallback = new Date().toISOString()) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonByteLength(value) {
  if (value == null) return 0;
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function normalizeDraft(input) {
  const now = new Date().toISOString();
  const id = clip(input.id, 160) || `draft-${Date.now()}-${crypto.randomUUID()}`;
  const settings = isJsonObject(input.settings) ? input.settings : {};
  const result = isJsonObject(input.result) ? input.result : null;
  const updatedAt = isoDate(input.updatedAt, now);
  return {
    id,
    title: clip(input.title || result?.title || "Untitled", 240),
    sourceUrl: clip(input.sourceUrl, 2048),
    seed: clip(input.seed, 100000),
    settings,
    result,
    reroll: Number.isFinite(Number(input.reroll)) ? Number(input.reroll) : 0,
    activeView: clip(input.activeView || "draft", 32),
    createdAt: isoDate(input.createdAt, updatedAt),
    updatedAt
  };
}

function rowToDraft(row) {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url || "",
    seed: row.seed || "",
    settings: parseJson(row.settings_json, {}),
    result: parseJson(row.result_json, null),
    reroll: row.reroll || 0,
    activeView: row.active_view || "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listDrafts(db, url) {
  const requestedLimit = url.searchParams.get("limit");
  const numericLimit = requestedLimit ? Number(requestedLimit) : DEFAULT_LIST_LIMIT;
  const limit = Number.isFinite(numericLimit)
    ? Math.min(Math.max(Math.trunc(numericLimit), 1), MAX_LIST_LIMIT)
    : DEFAULT_LIST_LIMIT;
  const query = `
    SELECT id, title, source_url, seed, settings_json, result_json, reroll,
           active_view, created_at, updated_at
    FROM lyric_drafts
    ORDER BY updated_at DESC
    LIMIT ?
  `;
  const { results } = await db.prepare(query).bind(limit).all();
  return json({ drafts: (results || []).map(rowToDraft) });
}

async function upsertDrafts(db, request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return text("Draft request is too large.", 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return text("Draft request is too large.", 413);
  }
  let body = null;
  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    return text("Expected { drafts: [...] }.", 400);
  }
  const rawDrafts = Array.isArray(body) ? body : body?.drafts;
  if (!Array.isArray(rawDrafts)) return text("Expected { drafts: [...] }.", 400);
  if (rawDrafts.length > MAX_DRAFTS_PER_REQUEST) return text("Too many drafts in one request.", 413);
  if (!rawDrafts.every(isJsonObject)) return text("Every draft must be a JSON object.", 400);
  if (rawDrafts.some((draft) =>
    jsonByteLength(draft.settings) + jsonByteLength(draft.result) > MAX_DRAFT_JSON_BYTES
  )) {
    return text("Draft settings/result payload is too large.", 413);
  }
  const drafts = rawDrafts.map(normalizeDraft);
  if (!drafts.length) return json({ ok: true, count: 0 });

  const statements = drafts.map((draft) =>
    db.prepare(`
      INSERT INTO lyric_drafts (
        id, title, source_url, seed, settings_json, result_json, reroll,
        active_view, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        source_url = excluded.source_url,
        seed = excluded.seed,
        settings_json = excluded.settings_json,
        result_json = excluded.result_json,
        reroll = excluded.reroll,
        active_view = excluded.active_view,
        updated_at = excluded.updated_at
    `).bind(
      draft.id,
      draft.title,
      draft.sourceUrl,
      draft.seed,
      JSON.stringify(draft.settings),
      draft.result ? JSON.stringify(draft.result) : null,
      draft.reroll,
      draft.activeView,
      draft.createdAt,
      draft.updatedAt
    )
  );

  await db.batch(statements);
  return json({ ok: true, count: drafts.length });
}

async function deleteDraft(db, url) {
  const id = url.searchParams.get("id");
  if (!id) return text("Missing id.", 400);
  await db.prepare("DELETE FROM lyric_drafts WHERE id = ?").bind(id).run();
  return json({ ok: true, id });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

  const authError = requireAuth(request, env);
  if (authError) return authError;

  const db = dbFromEnv(env);
  if (!db) return text("Cloud sync disabled: missing LYRIC_LAB_DB binding.", 503);

  const url = new URL(request.url);
  try {
    if (request.method === "GET") return await listDrafts(db, url);
    if (request.method === "POST" || request.method === "PUT") return await upsertDrafts(db, request);
    if (request.method === "DELETE") return await deleteDraft(db, url);
    return text("Method not allowed.", 405);
  } catch (error) {
    return text("Lyric draft API failed.", 500);
  }
}
