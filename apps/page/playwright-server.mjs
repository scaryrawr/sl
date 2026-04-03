import path from 'node:path';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const basePath = '/sl';
const libDir = path.join(import.meta.dir, 'lib');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm']
]);

const resolvePathname = (pathname) => {
  if (pathname === `${basePath}/` || pathname === `${basePath}/index.html`) {
    return path.join(libDir, 'index.html');
  }

  if (pathname === `${basePath}/embed` || pathname === `${basePath}/embed.html`) {
    return path.join(libDir, 'embed.html');
  }

  if (!pathname.startsWith(`${basePath}/`)) {
    return null;
  }

  return path.join(libDir, pathname.slice(`${basePath}/`.length));
};

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === basePath) {
      return Response.redirect(new URL(`${basePath}/`, url).toString(), 302);
    }

    const filePath = resolvePathname(url.pathname);
    if (!filePath) {
      return new Response('Not found', { status: 404 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    const contentType = contentTypes.get(path.extname(filePath));
    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    return new Response(file, { headers });
  }
});

console.log(`Playwright server listening on http://127.0.0.1:${server.port}${basePath}/`);
