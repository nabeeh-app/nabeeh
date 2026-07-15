/**
 * Wraps an async route handler to catch errors and forward to error middleware.
 * Eliminates the need for try/catch in every route handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
