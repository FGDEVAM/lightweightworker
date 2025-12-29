// ========================================
// LIGHTWEIGHT TERABOX URL CHECKER - NODE.JS
// For Render Deployment
// ========================================

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_HOST = "dm.nephobox.com";

// ========================================
// CORS MIDDLEWARE
// ========================================

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ========================================
// CORE API FUNCTION
// ========================================

async function fetchShortUrlInfo(shortUrl, cookie, host = DEFAULT_HOST) {
  try {
    const url = `https://${host}/api/shorturlinfo?clienttype=1&root=1&shorturl=${shortUrl}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Connection': 'keep-alive',
        'Cookie': cookie,
        'User-Agent': 'dubox;4.7.1;iPhone16ProMax;ios-iphone;26.0.1;en_IN'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.errno === 0) {
        return { success: true, data };
      }
      return { success: false, errno: data.errno, error: data.errmsg || 'API error' };
    }
    return { success: false, error: 'Request failed' };
  } catch (error) {
    return { success: false, error: 'Network error: ' + error.message };
  }
}

// ========================================
// MAIN CHECK FUNCTION
// ========================================

async function checkUrl(url, cookie, host = DEFAULT_HOST) {
  try {
    // Extract Short URL
    let shortUrl = null;
    
    try {
      const urlObj = new URL(url);
      if (urlObj.searchParams.has('surl')) {
        shortUrl = urlObj.searchParams.get('surl');
      } else {
        const match = url.match(/\/s\/([^\/\?&]+)/);
        if (match) shortUrl = match[1];
      }
    } catch (e) {
      return { exists: false, error: 'Invalid URL format' };
    }
    
    if (!shortUrl) {
      return { exists: false, error: 'Could not parse Short URL' };
    }
    
    // Handle the '1' prefix - strip it for API call
    const apiShortUrl = shortUrl.startsWith('1') && shortUrl.length > 1 
      ? shortUrl.substring(1) 
      : shortUrl;
    
    // Fetch info
    const result = await fetchShortUrlInfo(apiShortUrl, cookie, host);
    
    if (result.success) {
      const fileList = result.data.list || [];
      
      if (fileList.length === 0) {
        return { exists: false, error: 'No files found' };
      }
      
      // Build simple file list
      const files = fileList.map(file => ({
        name: file.server_filename,
        size: file.size,
        isdir: file.isdir
      }));
      
      return {
        exists: true,
        total_files: fileList.length,
        files: files
      };
    }
    
    return {
      exists: false,
      error: result.error || 'File not found or deleted'
    };
    
  } catch (error) {
    return { exists: false, error: 'Check failed: ' + error.message };
  }
}

// ========================================
// ROUTES
// ========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main check endpoint
app.get('/', async (req, res) => {
  const teraUrl = req.query.url;
  let cookie = req.query.cookie;
  const host = req.query.host || DEFAULT_HOST;
  
  // Show API info if no params
  if (!teraUrl && !cookie) {
    return res.json({
      name: 'TeraBox URL Checker',
      version: '1.0.0',
      description: 'Lightweight API to check if TeraBox files exist',
      usage: 'GET /?url=TERABOX_URL&cookie=ndus=YOUR_COOKIE',
      endpoints: {
        '/': 'Check URL',
        '/health': 'Health check'
      },
      response: {
        exists: 'true/false',
        total_files: 'number',
        files: '[{name, size, isdir}]'
      }
    });
  }
  
  // Validate params
  if (!teraUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }
  
  if (!cookie) {
    return res.status(401).json({ error: "Missing 'cookie' parameter" });
  }
  
  // Auto-add ndus= prefix if missing
  if (!cookie.startsWith('ndus=')) {
    cookie = `ndus=${cookie}`;
  }
  
  // Check the URL
  const result = await checkUrl(teraUrl, cookie, host);
  res.json(result);
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`🚀 TeraBox Checker running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 API: http://localhost:${PORT}/?url=TERABOX_URL&cookie=YOUR_COOKIE`);
});
