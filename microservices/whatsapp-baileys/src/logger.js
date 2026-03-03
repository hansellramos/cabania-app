const Sentry = require('@sentry/node');

module.exports = {
  info(msg, ctx = {}) {
    console.log(msg, Object.keys(ctx).length ? ctx : '');
    Sentry.logger.info(msg, ctx);
  },
  warn(msg, ctx = {}) {
    console.warn(msg, Object.keys(ctx).length ? ctx : '');
    Sentry.logger.warn(msg, ctx);
  },
  error(msg, ctx = {}) {
    console.error(msg, Object.keys(ctx).length ? ctx : '');
    Sentry.logger.error(msg, ctx);
  },
};
