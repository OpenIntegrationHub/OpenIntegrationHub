const QueueCreator = require('../src/QueueCreator');
const chai = require('chai');
const { expect } = chai;

const Flow = require('./Flow');

describe('QueueCreator', () => {
    let queueCreator;
    let channel;

    beforeEach(() => {
        channel = {
            assertExchange: () => {},
            assertQueue: () => {},
            bindQueue: () => {}
        };
        queueCreator = new QueueCreator(channel);
    });

    describe('#makeQueuesForTheFlow', () => {
        it('should return config', async () => {
            const flow = new Flow({
                id: '12345',
                graph: {
                    nodes: [
                        {id: 'step_1'},
                        {id: 'step_2'},
                        {id: 'step_3'}
                    ],
                    edges: [
                        {source: 'step_1', target: 'step_2'},
                        {source: 'step_2', target: 'step_3'}
                    ]
                }
            });

            const result = await queueCreator.makeQueuesForTheFlow(flow);
            expect(result).to.deep.equal({
                step_1: {
                    'DATA_ROUTING_KEY': '12345.step_1.message',
                    'ERROR_ROUTING_KEY': '12345.step_1.error',
                    'LISTEN_MESSAGES_ON': '12345:step_1:messages',
                    'PUBLISH_MESSAGES_TO': '12345',
                    'REBOUND_ROUTING_KEY': '12345.step_1.rebound',
                    'SNAPSHOT_ROUTING_KEY': '12345.step_1.snapshot'
                },
                step_2: {
                    'DATA_ROUTING_KEY': '12345.step_2.message',
                    'ERROR_ROUTING_KEY': '12345.step_2.error',
                    'LISTEN_MESSAGES_ON': '12345:step_2:messages',
                    'PUBLISH_MESSAGES_TO': '12345',
                    'REBOUND_ROUTING_KEY': '12345.step_2.rebound',
                    'SNAPSHOT_ROUTING_KEY': '12345.step_2.snapshot'
                },
                step_3: {
                    'DATA_ROUTING_KEY': '12345.step_3.message',
                    'ERROR_ROUTING_KEY': '12345.step_3.error',
                    'LISTEN_MESSAGES_ON': '12345:step_3:messages',
                    'PUBLISH_MESSAGES_TO': '12345',
                    'REBOUND_ROUTING_KEY': '12345.step_3.rebound',
                    'SNAPSHOT_ROUTING_KEY': '12345.step_3.snapshot'
                }
            });
        });
    });
});
