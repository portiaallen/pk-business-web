import {readFileSync,writeFileSync} from 'node:fs';
export function hardenNetlifyArtifact(path) {
  const context = process.env.CONTEXT;
  if (!process.env.NETLIFY || !['production','deploy-preview','branch-deploy','dev'].includes(context))
    throw new Error('Explicit Netlify build context required; qualification blocked');
  let text=readFileSync(path,'utf8');
  if (!text.includes("'http.target': req.url,") || !text.includes('const requestContext = createRequestContext(req, context)')) throw new Error('Unknown Netlify handler shape; qualification blocked');
  text=text.replace("'http.target': req.url,", "'http.target': pkSafeRoute(req.url),");
  text=text.replace('const requestContext = createRequestContext(req, context)', `const safeHeaders = new Headers(req.headers)
  safeHeaders.delete('x-nf-debug-logging')
  safeHeaders.delete('x-next-debug-logging')
  const requestContext = createRequestContext({ headers: safeHeaders }, context)`);
  text=text.replace('const response = await serverHandler(req, context, span, requestContext)', `let response
      try { response = await serverHandler(req, context, span, requestContext) }
      catch { response = Response.json({error:'Request unavailable'}, {status:503, headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}}) }`);
  // Netlify build-only markers are not guaranteed to exist in Functions. Carry the
  // trusted build context into this artifact, never derive it from a request.
  text = `if (process.env.VERCEL || process.env.VERCEL_ENV || (process.env.CONTEXT && process.env.CONTEXT !== ${JSON.stringify(context)})) throw new Error('Conflicting hosting context');
process.env.NETLIFY = 'true';
process.env.CONTEXT = ${JSON.stringify(context)};
` + text;
  // Metadata spans never receive object identifiers, query strings, filenames or request URLs.
  text += `\nfunction pkSafeRoute(value) {
    const path = new URL(value).pathname
    if (path.startsWith('/api/ordinary-transfer')) return '/api/ordinary-transfer'
    if (path.startsWith('/api/auth')) return '/api/auth'
    if (path.startsWith('/api/')) return '/api'
    if (path.startsWith('/portal')) return '/portal'
    if (path.startsWith('/admin')) return '/admin'
    return '/public'
  }\n`;
  writeFileSync(path,text);
}
