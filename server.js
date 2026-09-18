const http = require('http');
const url = require('url');
const { request } = require('http');

const PORT = 3000;

// Helper to send responses
function sendResponse(res, statusCode, data, contentType = 'application/json') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(data);
}

// Handle incoming requests
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Root route
  if (path === '/' && method === 'GET') {
    sendResponse(res, 200, `
      <h1>Schoolio Server</h1>
      <p>✅ Proxy backend is online!</p>
    `, 'text/html');
    return;
  }

  // Test API
  if (path === '/api/test' && method === 'GET') {
    sendResponse(res, 200, JSON.stringify({
      working: true,
      message: "Schoolio connected successfully!"
    }));
    return;
  }

  // Example /api/github endpoint
  if (path === '/api/github' && method === 'GET') {
    try {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/microsoft/vscode',
        headers: {
          'User-Agent': 'Schoolio'
        }
      };

      const githubReq = request(options, (githubRes) => {
        let data = '';
        githubRes.on('data', chunk => data += chunk);
        githubRes.on('end', () => {
          const parsed = JSON.parse(data);
          sendResponse(res, 200, JSON.stringify({
            name: parsed.name,
            stars: parsed.stargazers_count,
            description: parsed.description
          }));
        });
      });

      githubReq.on('error', () => {
        sendResponse(res, 500, JSON.stringify({ error: 'Request failed' }));
      });

      githubReq.end();
    } catch {
      sendResponse(res, 500, JSON.stringify({ error: 'Request failed' }));
    }
    return;
  }

  // Proxy endpoint
  if (path === '/proxy' && method === 'GET') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      sendResponse(res, 400, JSON.stringify({ error: "Missing 'url' query parameter" }));
      return;
    }

    // Fetch the target URL using built-in http/https
    const fetchUrl = new URL(targetUrl);
    const options = {
      hostname: fetchUrl.hostname,
      port: fetchUrl.port || (fetchUrl.protocol === 'https:' ? 443 : 80),
      path: fetchUrl.pathname + fetchUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Schoolio'
      }
    };

    const lib = fetchUrl.protocol === 'https:' ? require('https') : require('http');

    const proxyReq = lib.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', () => {
      sendResponse(res, 500, JSON.stringify({ error: 'Error fetching target URL' }));
    });

    proxyReq.end();
    return;
  }

  // 404 for other routes
  sendResponse(res, 404, JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
