const http = require('http');
const url = require('url');

// Choose port
const PORT = 3000;

// Helper to send responses
function sendResponse(res, statusCode, data, contentType = 'application/json') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(data);
}

// Handle requests
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Root
  if (path === '/' && method === 'GET') {
    sendResponse(res, 200, `
      <h1>Schoolio Server</h1>
      <p>✅ Proxy backend is online!</p>
    `, 'text/html');
    return;
  }

  // /api/test
  if (path === '/api/test' && method === 'GET') {
    sendResponse(res, 200, JSON.stringify({ working: true, message: "Schoolio connected successfully!" }));
    return;
  }

  // /api/github
  if (path === '/api/github' && method === 'GET') {
    // Use built-in https for request
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/microsoft/vscode',
      headers: { 'User-Agent': 'Schoolio' }
    };
    const reqGitHub = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        const parsed = JSON.parse(data);
        sendResponse(res, 200, JSON.stringify({
          name: parsed.name,
          stars: parsed.stargazers_count,
          description: parsed.description
        }));
      });
    });
    reqGitHub.on('error', () => {
      sendResponse(res, 500, JSON.stringify({ error: 'Request failed' }));
    });
    reqGitHub.end();
    return;
  }

  // /proxy?url=...
  if (path === '/proxy' && method === 'GET') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      sendResponse(res, 400, JSON.stringify({ error: "Missing 'url' query parameter" }));
      return;
    }
    // Fetch the target URL using http or https
    const fetchUrl = new URL(targetUrl);
    const lib = fetchUrl.protocol === 'https:' ? require('https') : require('http');

    const options = {
      hostname: fetchUrl.hostname,
      port: fetchUrl.port || (fetchUrl.protocol === 'https:' ? 443 : 80),
      path: fetchUrl.pathname + fetchUrl.search,
      method: 'GET',
      headers: { 'User-Agent': 'Schoolio' }
    };

    const reqFetch = lib.request(options, (resp) => {
      res.writeHead(resp.statusCode, resp.headers);
      resp.pipe(res);
    });
    reqFetch.on('error', () => {
      sendResponse(res, 500, JSON.stringify({ error: 'Error fetching target URL' }));
    });
    reqFetch.end();
    return;
  }

  // Not found
  sendResponse(res, 404, JSON.stringify({ error: 'Not found' }));
});

// Run server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
