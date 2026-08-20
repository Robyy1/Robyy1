const { promisify } = require('util');
const dns = promisify(require('dns').lookup);

function formatError(err, req) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err.type === 'entity.parse.failed') {
    return { status: 400, message: 'Invalid JSON in request body' };
  }

  if (err.type === 'entity.too.large') {
    return { status: 413, message: 'Request entity too large' };
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = isProduction ? 'Internal server error' : err.message;

  if (process.env.NODE_ENV !== 'production') {
    return { status: statusCode, message, stack: err.stack };
  }

  return { status: statusCode, message };
}

function errorHandler(err, req, res, _next) {
  const { status, message, stack } = formatError(err, req);

  if (status === 500 && process.env.NODE_ENV !== 'production') {
    console.error('[error]', err.message);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({ error: message });
}

function rateLimiter(maxRequests, windowMs) {
  const attempts = new Map();
  const cleanupInterval = setInterval(() => {
    for (const [key, value] of attempts.entries()) {
      if (Date.now() - value.windowStart > windowMs) {
        attempts.delete(key);
      }
    }
  }, 60 * 1000);

  if (cleanupInterval.unref) cleanupInterval.unref();

  return function limiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = attempts.get(ip);

    if (!record) {
      attempts.set(ip, { count: 1, windowStart: now });
      return next();
    }

    if (now - record.windowStart > windowMs) {
      attempts.set(ip, { count: 1, windowStart: now });
      return next();
    }

    if (record.count >= maxRequests) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - record.windowStart)) / 1000)));
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    attempts.set(ip, { count: record.count + 1, windowStart: record.windowStart });
    next();
  };
}

async function resolveHostname(req) {
  try {
    const { address } = await dns(req.hostname || 'localhost');
    return address;
  } catch {
    return req.ip || 'unknown';
  }
}

module.exports = { errorHandler, rateLimiter };
