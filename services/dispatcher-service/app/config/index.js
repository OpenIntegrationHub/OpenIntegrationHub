// General configuration file for variable urls, settings, etc.

const general = {
  mongoUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/dispatcherDev',
  amqpUrl: process.env.QUEUE_URL || 'amqp://guest:guest@localhost:5672',
  createEventName: process.env.CREATE_EVENT_NAME || 'data-hub.record.created',
  updateEventName: process.env.UPDATE_EVENT_NAME || 'data-hub.record.updated',
  flowRepoUrl: process.env.FLOWREPO_URL || 'http://localhost:3001',
  flowToken: process.env.FLOW_TOKEN || 'exampleToken',
  sdfAdapterId: process.env.SDF_ID || '12345abcde',
  sdfAdapterPublishAction: process.env.SDF_INBOUND || 'sendMessageToOih',
  sdfAdapterReceiveAction: process.env.SDF_OUTBOUND || 'receiveEvents',
  sdfAdapterRecordAction: process.env.SDF_RECORD || 'processRecordUid',
};

module.exports = general;
