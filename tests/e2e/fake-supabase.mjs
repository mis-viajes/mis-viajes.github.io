/**
 * SOLO PARA PRUEBAS. Servidor mínimo compatible con el subconjunto de la API de Supabase
 * (PostgREST + Storage) que usa la app, sobre un PostgreSQL local con supabase/schema.sql.
 * Cada petición se ejecuta con el rol `authenticated` y el `sub` del token, así que las
 * políticas de Row Level Security se aplican de verdad. El token NO se verifica.
 *
 * Uso: DATABASE_URL=postgres://postgres@127.0.0.1:54329/tm node tests/e2e/fake-supabase.mjs
 */
import http from "node:http";
import pg from "pg";

pg.types.setTypeParser(20, (v) => Number(v)); // bigint → número (como PostgREST)
pg.types.setTypeParser(1082, (v) => v); // date → "YYYY-MM-DD"
pg.types.setTypeParser(1184, (v) => v); // timestamptz → texto
pg.types.setTypeParser(1114, (v) => v);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/tm" });
const PORT = Number(process.env.PORT ?? 54321);
const files = new Map(); // almacenamiento en memoria: clave → { type, data }

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw Object.assign(new Error(`Identificador no válido: ${s}`), { status: 400, code: "PGRST100" });
  return `"${s}"`;
};

function claimsFrom(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}

function parseFilters(params, values) {
  const where = [];
  for (const [key, raw] of params) {
    if (["select", "order", "offset", "limit", "columns", "on_conflict"].includes(key)) continue;
    const col = ident(key);
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    const val = raw.slice(dot + 1);
    if (op === "eq") {
      values.push(val);
      where.push(`${col}::text = $${values.length}`);
    } else if (op === "in") {
      const items = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      values.push(items);
      where.push(`${col}::text = any($${values.length})`);
    } else if (op === "is") {
      where.push(`${col} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`);
    } else {
      throw Object.assign(new Error(`Operador no soportado: ${op}`), { status: 400, code: "PGRST100" });
    }
  }
  return where.length ? ` where ${where.join(" and ")}` : "";
}

function orderBy(params) {
  const order = params.get("order");
  if (!order) return "";
  return (
    " order by " +
    order
      .split(",")
      .map((part) => {
        const [col, dir, nulls] = part.split(".");
        return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : ""}`;
      })
      .join(", ")
  );
}

const toParam = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);

async function handleRest(req, res, table, params, body) {
  if (!/^tm_[a-z_]+$/.test(table)) throw Object.assign(new Error(`Tabla no encontrada: ${table}`), { status: 404, code: "PGRST205" });
  const claims = claimsFrom(req);
  const values = [];
  let sql;
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const returning = (req.headers.prefer ?? "").includes("return=representation");

  if (req.method === "GET") {
    sql = `select * from public.${ident(table)}${parseFilters(params, values)}${orderBy(params)}`;
    if (params.get("limit")) sql += ` limit ${Number(params.get("limit"))}`;
    if (params.get("offset")) sql += ` offset ${Number(params.get("offset"))}`;
  } else if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const tuples = rows.map(
      (r) =>
        `(${cols
          .map((c) => {
            if (!(c in r)) return "default";
            values.push(toParam(r[c]));
            return `$${values.length}`;
          })
          .join(", ")})`,
    );
    sql = `insert into public.${ident(table)} (${cols.map(ident).join(", ")}) values ${tuples.join(", ")}${returning ? " returning *" : ""}`;
  } else if (req.method === "PATCH") {
    const sets = Object.entries(body).map(([c, v]) => {
      values.push(toParam(v));
      return `${ident(c)} = $${values.length}`;
    });
    sql = `update public.${ident(table)} set ${sets.join(", ")}${parseFilters(params, values)}${returning ? " returning *" : ""}`;
  } else if (req.method === "DELETE") {
    sql = `delete from public.${ident(table)}${parseFilters(params, values)}${returning ? " returning *" : ""}`;
  } else {
    throw Object.assign(new Error("Método no soportado"), { status: 405 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await client.query(sql, values);
    await client.query("commit");
    const rows = result.rows ?? [];
    if (req.method !== "GET" && !returning) return send(res, 204);
    if (wantsObject) {
      if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${rows.length} rows`, hint: null });
      return send(res, req.method === "POST" ? 201 : 200, rows[0]);
    }
    return send(res, req.method === "POST" ? 201 : 200, rows);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function handleStorage(req, res, path, body, raw) {
  // /object/<bucket>/<key> (subir/leer) · /object/sign/<bucket>/<key> · /object/list/<bucket> · DELETE /object/<bucket>
  const claims = claimsFrom(req);
  const m = path.match(/^\/object\/(sign\/|list\/|public\/|authenticated\/)?([^/]+)\/?(.*)$/);
  if (!m) return send(res, 404, { message: "No encontrado" });
  const [, kind, bucket, key] = m;
  const own = (k) => k.split("/")[0] === claims.sub;
  if (kind === "sign/" && req.method === "GET") {
    const f = files.get(`${bucket}/${key}`);
    if (!f) return send(res, 404, { message: "No encontrado" });
    res.writeHead(200, { "Content-Type": f.type, ...cors });
    return res.end(f.data);
  }
  if (kind === "sign/") {
    if (!own(key) || !files.has(`${bucket}/${key}`)) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    return send(res, 200, { signedURL: `/object/sign/${bucket}/${key}?token=test` });
  }
  if (kind === "list/") {
    const prefix = `${bucket}/${body.prefix ?? ""}/`;
    const names = [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: k.slice(prefix.length) }));
    return send(res, 200, names);
  }
  if (req.method === "DELETE") {
    for (const p of body.prefixes ?? []) if (own(p)) files.delete(`${bucket}/${p}`);
    return send(res, 200, []);
  }
  if (req.method === "POST" || req.method === "PUT") {
    if (!own(key)) return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    files.set(`${bucket}/${key}`, { type: req.headers["content-type"], data: raw });
    return send(res, 200, { Key: `${bucket}/${key}`, Id: key });
  }
  if (req.method === "GET") {
    const f = files.get(`${bucket}/${key}`);
    if (!f) return send(res, 404, { message: "No encontrado" });
    res.writeHead(200, { "Content-Type": f.type, ...cors });
    return res.end(f.data);
  }
  return send(res, 405, { message: "Método no soportado" });
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range",
};

function send(res, status, json) {
  res.writeHead(status, { ...cors, ...(json === undefined ? {} : { "Content-Type": "application/json" }) });
  res.end(json === undefined ? undefined : JSON.stringify(json));
}

http
  .createServer(async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, "http://localhost");
    let body = {};
    if ((req.headers["content-type"] ?? "").includes("json") && raw.length) body = JSON.parse(raw.toString());
    try {
      if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url.pathname.slice(9), url.searchParams, body);
      if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(req, res, url.pathname.slice(11), body, raw);
      return send(res, 404, { message: "No encontrado" });
    } catch (e) {
      const status = e.status ?? (e.code === "42501" ? 403 : e.code?.startsWith("23") ? 409 : 400);
      return send(res, status, { code: e.code ?? "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`fake-supabase escuchando en http://127.0.0.1:${PORT}`));
