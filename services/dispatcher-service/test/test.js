/* eslint no-underscore-dangle: "off" */
/* eslint no-unused-vars: "off" */

const mongoose = require('mongoose');

process.env.MONGODB_URL = global.__MONGO_URI__;
process.env.NODE_ENV = 'test';

const hostUrl = 'http://localhost';
const port = process.env.PORT || 3013;
const request = require('supertest')(`${hostUrl}:${port}`);
const nock = require('nock');
const iamMock = require('./utils/iamMock.js');
const Server = require('../app/server');
const Configuration = require('../app/models/configuration');
const { createDispatches, getTargets, checkFlows } = require('../app/utils/handlers');
const { makeFlow, createFlows } = require('../app/utils/flowCreator');

const mainServer = new Server();

const log = require('../app/utils/logger'); // eslint-disable-line

let app;

beforeAll(async () => {
  iamMock.setup();
  mainServer.setupMiddleware();
  mainServer.setupRoutes();
  mainServer.setupSwagger();
  await mainServer.setup(mongoose);
  app = mainServer.listen();
});

afterAll(async () => {
  mongoose.connection.close();
  app.close();
});

describe('Documentation', () => {
  test('should display the swagger-generated HTML page', async () => {
    const res = await request.get('/api-docs/');
    expect(res.text).not.toHaveLength(0);
    expect(res.text).toMatch(/HTML for static distribution bundle build/);
  });
});

describe('API', () => {
  const connections = [
    {
      source: {
        applicationUid: 'Snazzy',
        domain: 'Addresses',
      },
      targets: [
        {
          applicationUid: 'Wice',
          routingKey: 'WiceAddressesABCDE',
          flowId: 'ABCDE',
          active: true,
        },
        {
          applicationUid: 'Outlook',
          routingKey: 'OutlookAddressesFGHI',
          flowId: 'FGHI',
          active: true,
        },
      ],
    },
  ];

  test('should post a new configuration', async () => {
    const res = await request
      .put('/dispatches')
      .set('Authorization', 'Bearer userToken')
      .set('accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(
        connections,
      );
    expect(res.status).toEqual(201);
    expect(res.text).not.toHaveLength(0);
    expect(res.body.data.tenant).toEqual('TestTenant');
    expect(res.body.data.connections).toEqual(connections);
  });

  test('should get the new configuration', async () => {
    const res = await request
      .get('/dispatches')
      .set('Authorization', 'Bearer userToken')
      .set('accept', 'application/json')
      .set('Content-Type', 'application/json');
    expect(res.status).toEqual(200);
    expect(res.text).not.toHaveLength(0);
    expect(res.body.data.tenant).toEqual('TestTenant');
    expect(res.body.data.connections).toEqual(connections);
  });

  test('should not get the new configuration from another tenant', async () => {
    const res = await request
      .get('/dispatches')
      .set('Authorization', 'Bearer guestToken')
      .set('accept', 'application/json')
      .set('Content-Type', 'application/json');
    expect(res.status).toEqual(404);
    expect(res.text).not.toHaveLength(0);
  });

  test('should update the configuration', async () => {
    const newConnections = connections;
    newConnections[0].targets.push(
      {
        applicationUid: 'GoogleContacts',
        routingKey: 'GoogleContactsAddressesJKLM',
        flowId: 'JLKM',
        active: true,
      },
    );
    const res = await request
      .put('/dispatches')
      .set('Authorization', 'Bearer userToken')
      .set('accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(
        newConnections,
      );
    expect(res.status).toEqual(201);
    expect(res.text).not.toHaveLength(0);
    expect(res.body.data.tenant).toEqual('TestTenant');
    expect(res.body.data.connections).toEqual(newConnections);

    // Ensure it updates and does not insert
    const allConfigs = await Configuration.find().lean();
    expect(allConfigs).toHaveLength(1);
  });

  test('should delete the configuration', async () => {
    const res = await request
      .delete('/dispatches')
      .set('Authorization', 'Bearer userToken')
      .set('accept', 'application/json')
      .set('Content-Type', 'application/json');
    expect(res.status).toEqual(200);
    expect(res.text).not.toHaveLength(0);

    const allConfigs = await Configuration.find().lean();
    expect(allConfigs).toHaveLength(0);
  });
});

describe('Event Handlers', () => {
  beforeAll(async () => {
    const config = {
      tenant: 'Test Tenant',
      connections: [
        {
          source: {
            flowId: 'abc',
            applicationUid: 'Snazzy',
          },
          targets: [
            {
              applicationUid: 'Wice',
              flowId: 'def',
            },
            {
              applicationUid: 'Outlook',
              flowId: 'ghi',
            },
          ],
        },
      ],
    };

    const storeConf = new Configuration(config);
    await storeConf.save();
  });

  test('should get the target flow ids for a given source', async () => {
    const targets = await getTargets('abc');
    expect(targets).toEqual([{ flowId: 'def', applicationUid: 'Wice' }, { flowId: 'ghi', applicationUid: 'Outlook' }]);
  });

  test('should check flow repository for the status of flows', async () => {
    const firstGet = nock('http://localhost:3001/flows/def')
      .get('')
      .reply(200, { data: { status: 'active' } });

    const secondGet = nock('http://localhost:3001/flows/ghi')
      .get('')
      .reply(200, { data: { status: 'inactive' } });

    const flowStart = nock('http://localhost:3001/flows/ghi/start')
      .post('')
      .reply(200, {});

    await checkFlows([{ flowId: 'def', applicationUid: 'Wice' }, { flowId: 'ghi', applicationUid: 'Outlook' }]);
  });

  test('should generate correct events for a given configuration', async () => {
    const payload = {
      meta: {
        flowId: 'abc',
        oihUid: 'harbl',
        refs: [
          {
            applicationUid: 'Wice',
            recordUid: '1234',
          },
          {
            applicationUid: 'Outlook',
            recordUid: '5678',
          },
        ],
      },
      data: {
        firstName: 'Jane',
        lastName: 'Doe',
      },
    };

    const ev1 = {
      headers: {
        name: 'dispatch.def',
      },
      payload: {
        meta: {
          flowId: 'abc',
          oihUid: 'harbl',
          applicationUid: 'Wice',
          recordUid: '1234',
        },
        data: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      },
    };

    const ev2 = {
      headers: {
        name: 'dispatch.ghi',
      },
      payload: {
        meta: {
          flowId: 'abc',
          oihUid: 'harbl',
          applicationUid: 'Outlook',
          recordUid: '5678',
        },
        data: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      },
    };

    const events = await createDispatches([{ flowId: 'def', applicationUid: 'Wice' }, { flowId: 'ghi', applicationUid: 'Outlook' }], payload);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(ev1);
    expect(events[1]).toEqual(ev2);
  });
});

describe('Flow Creation', () => {
  test('Generate a valid inbound flow', async () => {
    const getFlow = makeFlow(
      'testAdapterId',
      'testTransformerId',
      'getPersons',
      'transformPersonToOih',
      'testSecretId',
      'GET',
    );

    const reference = {
      name: 'Hub&Spoke Flow',
      description: 'This flow was automatically generated',
      graph: {
        nodes: [
          {
            id: 'step_1',
            componentId: 'testAdapterId',
            credentials_id: 'testSecretId',
            name: 'Source Adapter',
            function: 'getPersons',
            description: 'Fetches data',
          },
          {
            id: 'step_2',
            componentId: 'testTransformerId',
            name: 'Source Transformer',
            function: 'transformPersonToOih',
            description: 'Transforms data',
          },
          {
            id: 'step_3',
            componentId: '12345abcde',
            name: 'SDF Adapter',
            function: 'sendMessageToOih',
            description: 'Passes data to SDF',
          },
        ],
        edges: [
          {
            source: 'step_1',
            target: 'step_2',
          },
          {
            source: 'step_2',
            target: 'step_3',
          },
        ],
      },
      type: 'ordinary',
      cron: '* * * * *',
    };

    expect(getFlow).toEqual(reference);
  });

  test('Generate a valid outbound update flow', async () => {
    const updateFlow = makeFlow(
      'testAdapterId',
      'testTransformerId',
      'updatePerson',
      'transformPersonFromOih',
      'testSecretId',
      'UPDATE',
    );

    const reference = {
      name: 'Hub&Spoke Flow',
      description: 'This flow was automatically generated',
      graph: {
        nodes: [
          {
            id: 'step_1',
            componentId: '12345abcde',
            name: 'SDF Adapter',
            function: 'receiveEvents',
            description: 'Receives data from SDF',
          },
          {
            id: 'step_2',
            componentId: 'testTransformerId',
            name: 'Target Transformer',
            function: 'transformPersonFromOih',
            description: 'Transforms data',
          },
          {
            id: 'step_3',
            componentId: 'testAdapterId',
            credentials_id: 'testSecretId',
            name: 'Target Adapter',
            function: 'updatePerson',
            description: 'Pushes data',
          },
          {
            id: 'step_4',
            componentId: '12345abcde',
            name: 'SDF Adapter',
            function: 'processRecordUid',
            description: 'Updates recordUid',
          },
        ],
        edges: [
          {
            source: 'step_1',
            target: 'step_2',
          },
          {
            source: 'step_2',
            target: 'step_3',
          },
          {
            source: 'step_3',
            target: 'step_4',
          },
        ],
      },
      type: 'ordinary',
      cron: '* * * * *',
    };

    expect(updateFlow).toEqual(reference);
  });

  test('Generate a valid outbound create flow', async () => {
    const createFlow = makeFlow(
      'testAdapterId',
      'testTransformerId',
      'updatePerson',
      'transformPersonFromOih',
      'testSecretId',
      'CREATE',
    );

    const reference = {
      name: 'Hub&Spoke Flow',
      description: 'This flow was automatically generated',
      graph: {
        nodes: [
          {
            id: 'step_1',
            componentId: '12345abcde',
            name: 'SDF Adapter',
            function: 'receiveEvents',
            description: 'Receives data from SDF',
          },
          {
            id: 'step_2',
            componentId: 'testTransformerId',
            name: 'Target Transformer',
            function: 'transformPersonFromOih',
            description: 'Transforms data',
          },
          {
            id: 'step_3',
            componentId: 'testAdapterId',
            credentials_id: 'testSecretId',
            name: 'Target Adapter',
            function: 'updatePerson',
            description: 'Pushes data',
          },
          {
            id: 'step_4',
            componentId: '12345abcde',
            name: 'SDF Adapter',
            function: 'processRecordUid',
            description: 'Updates recordUid',
          },
        ],
        edges: [
          {
            source: 'step_1',
            target: 'step_2',
          },
          {
            source: 'step_2',
            target: 'step_3',
          },
          {
            source: 'step_3',
            target: 'step_4',
          },
        ],
      },
      type: 'ordinary',
      cron: '* * * * *',
    };

    expect(createFlow).toEqual(reference);
  });

  test('Make calls to Flow Repository to create flows', async () => {
    const getFlow = nock('http://localhost:3001/flows')
      .post('', {
        name: 'Hub&Spoke Flow',
        description: 'This flow was automatically generated',
        graph: {
          nodes: [{
            id: 'step_1', credentials_id: 'snazzySecretId', name: 'Source Adapter', function: 'getPersons', description: 'Fetches data',
          }, {
            id: 'step_2', name: 'Source Transformer', function: 'transformToOih', description: 'Transforms data',
          }, {
            id: 'step_3', componentId: '12345abcde', name: 'SDF Adapter', function: 'sendMessageToOih', description: 'Passes data to SDF',
          }],
          edges: [{ source: 'step_1', target: 'step_2' }, { source: 'step_2', target: 'step_3' }],
        },
        type: 'ordinary',
        cron: '* * * * *',
      })
      .reply(201, { data: { id: 'OutboundId' } });

    const createFlow = nock('http://localhost:3001/flows')
      .post('', {
        name: 'Hub&Spoke Flow',
        description: 'This flow was automatically generated',
        graph: {
          nodes: [{
            id: 'step_1', componentId: '12345abcde', name: 'SDF Adapter', function: 'receiveEvents', description: 'Receives data from SDF',
          }, {
            id: 'step_2', name: 'Target Transformer', function: 'transformFromOih', description: 'Transforms data',
          }, {
            id: 'step_3', credentials_id: 'snazzySecretId', name: 'Target Adapter', function: 'createPerson', description: 'Pushes data',
          }, {
            id: 'step_4', componentId: '12345abcde', name: 'SDF Adapter', function: 'processRecordUid', description: 'Updates recordUid',
          }],
          edges: [{ source: 'step_1', target: 'step_2' }, { source: 'step_2', target: 'step_3' }, { source: 'step_3', target: 'step_4' }],
        },
        type: 'ordinary',
        cron: '* * * * *',
      })
      .reply(201, { data: { id: 'InboundIdCreate' } });

    const updateFlow = nock('http://localhost:3001/flows')
      .post('', {
        name: 'Hub&Spoke Flow',
        description: 'This flow was automatically generated',
        graph: {
          nodes: [{
            id: 'step_1', componentId: '12345abcde', name: 'SDF Adapter', function: 'receiveEvents', description: 'Receives data from SDF',
          }, {
            id: 'step_2', name: 'Target Transformer', function: 'transformFromOih', description: 'Transforms data',
          }, {
            id: 'step_3', credentials_id: 'snazzySecretId', name: 'Target Adapter', function: 'updatePerson', description: 'Pushes data',
          }, {
            id: 'step_4', componentId: '12345abcde', name: 'SDF Adapter', function: 'processRecordUid', description: 'Updates recordUid',
          }],
          edges: [{ source: 'step_1', target: 'step_2' }, { source: 'step_2', target: 'step_3' }, { source: 'step_3', target: 'step_4' }],
        },
        type: 'ordinary',
        cron: '* * * * *',
      })
      .reply(201, { data: { id: 'InboundIdUpdate' } });

    const deleteFlow = nock('http://localhost:3001/flows')
      .post('', {
        name: 'Hub&Spoke Flow',
        description: 'This flow was automatically generated',
        graph: {
          nodes: [{
            id: 'step_1', componentId: '12345abcde', name: 'SDF Adapter', function: 'receiveEvents', description: 'Receives data from SDF',
          }, {
            id: 'step_2', name: 'Target Transformer', function: 'transformFromOih', description: 'Transforms data',
          }, {
            id: 'step_3', credentials_id: 'snazzySecretId', name: 'Target Adapter', function: 'deletePerson', description: 'Pushes data',
          }, {
            id: 'step_4', componentId: '12345abcde', name: 'SDF Adapter', function: 'processRecordUid', description: 'Updates recordUid',
          }],
          edges: [{ source: 'step_1', target: 'step_2' }, { source: 'step_2', target: 'step_3' }, { source: 'step_3', target: 'step_4' }],
        },
        type: 'ordinary',
        cron: '* * * * *',
      })
      .reply(201, { data: { id: 'InboundIdDelete' } });

    const applications = [
      {
        adapterComponentId: 'snazzyAdapterId',
        transformerComponentId: 'snazzyTransformerId',
        secretId: 'snazzySecretId',

        outbound: {
          active: true,
          flows: [
            {
              transformerAction: 'transformToOih',
              adapterAction: 'getPersons',
            },
          ],
        },

        inbound: {
          active: true,
          flows: [
            {
              operation: 'CREATE',
              transformerAction: 'transformFromOih',
              adapterAction: 'createPerson',
            },
            {
              operation: 'UPDATE',
              transformerAction: 'transformFromOih',
              adapterAction: 'updatePerson',
            },
            {
              operation: 'DELETE',
              transformerAction: 'transformFromOih',
              adapterAction: 'deletePerson',
            },
          ],
        },
      },
    ];

    const newApplications = await createFlows(applications, 'aBearerToken');

    expect(newApplications[0].outbound.flows[0].flowId).toEqual('OutboundId');
    expect(newApplications[0].inbound.flows[0].flowId).toEqual('InboundIdCreate');
    expect(newApplications[0].inbound.flows[1].flowId).toEqual('InboundIdUpdate');
    expect(newApplications[0].inbound.flows[2].flowId).toEqual('InboundIdDelete');
  });
});
