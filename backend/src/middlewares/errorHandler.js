// Centralized error handler. Controllers can throw ApiError (see utils/ApiError)
// or let Prisma/JWT errors bubble up — normalized here into a consistent shape.

const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.details || undefined,
    });
  }

  // Prisma known request errors (e.g. unique constraint violation)
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field(s): ${err.meta?.target?.join(', ') || 'unknown'}`,
    });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({
      success: false,
      message: 'This record is referenced by other data and cannot be modified/deleted',
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
