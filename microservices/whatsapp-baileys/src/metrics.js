/**
 * In-memory pipeline metrics for WhatsApp message processing.
 * Tracks message flow health to detect silent failures.
 */

const metrics = {
  // Timestamps
  last_message_received_at: null,
  last_message_sent_at: null,
  last_chat_api_call_at: null,
  last_chat_api_error_at: null,

  // Counters (since process start)
  messages_received: 0,
  messages_sent: 0,
  messages_failed: 0,
  chat_api_errors: 0,
  connection_drops: 0,

  // Last error info
  last_error: null,
  last_error_step: null,
};

function recordReceived() {
  metrics.last_message_received_at = new Date();
  metrics.messages_received++;
}

function recordSent() {
  metrics.last_message_sent_at = new Date();
  metrics.messages_sent++;
}

function recordFailed(step, error) {
  metrics.messages_failed++;
  metrics.last_error = error;
  metrics.last_error_step = step;
}

function recordChatApiCall() {
  metrics.last_chat_api_call_at = new Date();
}

function recordChatApiError(status, error) {
  metrics.last_chat_api_error_at = new Date();
  metrics.chat_api_errors++;
  metrics.last_error = `Chat API ${status}: ${error}`;
  metrics.last_error_step = 'chat_api_error';
}

function recordConnectionDrop() {
  metrics.connection_drops++;
}

function getMetrics() {
  return { ...metrics };
}

module.exports = {
  recordReceived,
  recordSent,
  recordFailed,
  recordChatApiCall,
  recordChatApiError,
  recordConnectionDrop,
  getMetrics,
};
