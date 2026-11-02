const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

// Serve fixtures over HTTP: managed browsers may disallow file:// pages.
async function launchBrowser() {
  const root = __dirname;
  const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'};
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
      response.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch({headless:true, ...(process.env.TEST_BROWSER_EXECUTABLE
      ? {executablePath:process.env.TEST_BROWSER_EXECUTABLE}
      : {channel:process.env.TEST_BROWSER_CHANNEL || 'chrome'})});
    browser.once('disconnected', () => server.close());
    return {browser, pageURL: file => new URL(file, `${origin}/`).href};
  } catch (error) { server.close(); throw error; }
}
module.exports = {launchBrowser};
