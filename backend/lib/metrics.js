const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const whatsappMessagesReceived = new promClient.Counter({
  name: 'whatsapp_messages_received_total',
  help: 'Total incoming WhatsApp messages',
  labelNames: ['teacher_id', 'intent']
});

const whatsappMessagesSent = new promClient.Counter({
  name: 'whatsapp_messages_sent_total',
  help: 'Total outgoing WhatsApp messages',
  labelNames: ['teacher_id', 'direction']
});

const whatsappProcessingDuration = new promClient.Histogram({
  name: 'whatsapp_message_processing_seconds',
  help: 'Time to process an incoming WhatsApp message',
  labelNames: ['teacher_id', 'intent']
});

const whatsappActiveSessions = new promClient.Gauge({
  name: 'whatsapp_active_sessions',
  help: 'Number of active WhatsApp sessions'
});

const geminiCalls = new promClient.Counter({
  name: 'gemini_calls_total',
  help: 'Total Gemini API calls',
  labelNames: ['result']
});

const geminiDuration = new promClient.Histogram({
  name: 'gemini_call_duration_seconds',
  help: 'Time for Gemini API call',
  labelNames: ['result']
});

register.registerMetric(whatsappMessagesReceived);
register.registerMetric(whatsappMessagesSent);
register.registerMetric(whatsappProcessingDuration);
register.registerMetric(whatsappActiveSessions);
register.registerMetric(geminiCalls);
register.registerMetric(geminiDuration);

module.exports = {
  register,
  whatsappMessagesReceived,
  whatsappMessagesSent,
  whatsappProcessingDuration,
  whatsappActiveSessions,
  geminiCalls,
  geminiDuration
};
