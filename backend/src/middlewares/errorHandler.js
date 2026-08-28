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

  // Thrown when a query references a field/model the currently-generated
  // Prisma Client doesn't know about yet — almost always means the
  // schema changed (e.g. a new column was added) but `prisma migrate
  // dev` / `prisma generate` hasn't been run since. Surfaced explicitly
  // because otherwise this is indistinguishable from "the feature just
  // doesn't work" from the client's point of view.
  if (err.name === 'PrismaClientValidationError') {
    console.error('⚠️  Possible schema/client mismatch — run `npx prisma migrate dev` and restart the server.');
    return res.status(500).json({
      success: false,
      message:
        'Server database schema is out of date. Run `npx prisma migrate dev` on the backend and restart it.',
    });
  }

  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
