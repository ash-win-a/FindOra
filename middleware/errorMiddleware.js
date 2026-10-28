/**
 * Central Error Handling Middleware
 */

// 404 Handler for API endpoints
const notFoundHandler = (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }
  // Otherwise serve 404 page
  res.status(404).sendFile('404.html', { root: './public' });
};

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  console.error('[Application Error]:', err.stack || err);

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Uploaded file is too large. Maximum allowed size is 5MB.'
    });
  }
  if (err.message && err.message.includes('Only image files are allowed')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      message: 'Invalid resource identifier format.'
    });
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join('. '),
      errors: messages
    });
  }

  // Handle MongoDB Duplicate Key (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(400).json({
      success: false,
      message: `An account with this ${field} already exists.`
    });
  }

  // Default server error
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.'
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
