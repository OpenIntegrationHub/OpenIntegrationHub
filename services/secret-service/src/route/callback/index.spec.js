const getPort = require('get-port');
const supertest = require('supertest');
const nock = require('nock');
const base64url = require('base64url');
const iamMock = require('../../test/iamMock');

const Secret = require('../../model/Secret');
const { AUTH_TYPE } = require('../../constant');
const AuthFlow = require('../../model/AuthFlow');
const conf = require('../../conf');
const Server = require('../../server');
const {
    OA2_AUTHORIZATION_CODE,
} = require('../../constant').AUTH_TYPE;

let port;
let request;
let server;

describe('callback', () => {
    beforeAll(async (done) => {
        port = await getPort();
        request = supertest(`http://localhost:${port}${conf.apiBase}`);
        server = new Server({
            mongoDbConnection: `${global.__MONGO_URI__}-auth-clients`,
            port,
            adapter: {
                externalId: {
                    test: require('../../adapter/external-id/test'),
                },
            },
        });

        iamMock.setup();

        await server.start();
        done();
    });

    afterAll(async (done) => {
        await server.stop();
        done();
    });

    test('Run full flow', async () => {
        // // create mocked api
        const example = nock('https://example-callback.com');
        const scope = 'scope1 scope2';
        const secretName = 'My Secret';
        // create auth client first
        const authClient = (await request.post('/auth-clients')
            .set(...global.userAuth1)
            .send({
                data: {
                    type: OA2_AUTHORIZATION_CODE,
                    name: 'google oAuth2',
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    redirectUri: `http://localhost:${conf.port}/callback`,
                    endpoints: {
                        auth: 'https://example-callback.com/auth?'
                            + 'scope={{scope}}&'
                            + 'access_type=offline&'
                            + 'include_granted_scopes=true&'
                            + 'state={{state}}&'
                            + 'redirect_uri={{redirectUri}}&'
                            + 'response_type=code&'
                            + 'client_id={{clientId}}',
                        token: 'https://example-callback.com/exchange',
                        userinfo: 'https://example-callback.com/token',
                    },
                    mappings: {
                        externalId: {
                            source: 'id_token',
                            key: 'sub',
                        },
                    },
                },
            })
            .expect(200)).body.data;

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope,
                    secretName,
                },
            })
            .expect(200);

        const authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'asdasd',
                expires_in: 3600,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        // simulate external api call

        const state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));
        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const { _id } = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        const name = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data.name;

        expect(name).toEqual(secretName);
    });

    test('Run full flow and update secret with different user', async () => {
        // // create mocked api
        const example = nock('https://example-callback.com');
        const scope = 'scope1 scope3';
        const secretName = 'My Secret';
        // create auth client first
        const authClient = (await request.post('/auth-clients')
            .set(...global.userAuth1)
            .send({
                data: {
                    type: OA2_AUTHORIZATION_CODE,
                    name: 'google oAuth2',
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    redirectUri: `http://localhost:${conf.port}/callback`,
                    endpoints: {
                        auth: 'https://example-callback.com/auth?'
                            + 'scope={{scope}}&'
                            + 'access_type=offline&'
                            + 'include_granted_scopes=true&'
                            + 'state={{state}}&'
                            + 'redirect_uri={{redirectUri}}&'
                            + 'response_type=code&'
                            + 'client_id={{clientId}}',
                        token: 'https://example-callback.com/exchange',
                        userinfo: 'https://example-callback.com/token',
                    },
                    mappings: {
                        externalId: {
                            source: 'id_token',
                            key: 'sub',
                        },
                    },
                },
            })
            .expect(200)).body.data;

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope,
                    secretName,
                },
            })
            .expect(200);

        let authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'asdasd',
                expires_in: 3600,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        // simulate external api call

        let state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));
        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const { _id } = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        let secret = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data;

        expect(secret.name).toEqual(secretName);
        expect(secret.owners).toHaveLength(1);

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth2)
            .send({
                data: {
                    scope,
                    secretName,
                },
            })
            .expect(200);

        authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'asdasd',
                expires_in: 3600,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        // simulate external api call

        state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));
        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const secret_ = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        secret = (await request.get(`/secrets/${secret_._id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data;

        expect(secret.name).toEqual(secretName);
        expect(secret.owners).toHaveLength(2);

        secret = (await request.get(`/secrets/${secret_._id}`)
            .set(...global.userAuth2)
            .expect(200)).body.data;

        expect(secret.name).toEqual(secretName);
        expect(secret.owners).toHaveLength(2);
    });


    test('Check for externalId in id_token', async () => {
        const example = nock('https://example-callback.com');
        const scope = 'id_token';

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'asdasd',
                expires_in: 3601,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                // sub: 1234567890
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        const authClient = (await request.post('/auth-clients')
            .set(...global.userAuth1)
            .send({
                data: {
                    type: OA2_AUTHORIZATION_CODE,
                    name: 'google oAuth2',
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    redirectUri: `http://localhost:${conf.port}/callback`,
                    endpoints: {
                        auth: 'https://example-callback.com/auth?'
                                + 'scope={{scope}}&'
                                + 'access_type=offline&'
                                + 'include_granted_scopes=true&'
                                + 'state={{state}}&'
                                + 'redirect_uri={{redirectUri}}&'
                                + 'response_type=code&'
                                + 'client_id={{clientId}}',
                        token: 'https://example-callback.com/exchange',
                        userinfo: 'https://example-callback.com/token',
                    },
                    mappings: {
                        externalId: {
                            source: 'id_token',
                            key: 'sub',
                        },
                    },
                },
            })
            .expect(200)).body.data;

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope,
                },
            })
            .expect(200);

        const authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        // simulate external api call
        const state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));
        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const { _id } = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        const externalId = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data.value.externalId;

        expect(externalId.length).toBeGreaterThan(0);
    });

    test('Check for externalId in access_token', async () => {
        const example = nock('https://example-callback.com');
        const scope = 'access_token';

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                expires_in: 3602,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                // sub: 1234567890
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        const authClient = (await request.post('/auth-clients')
            .set(...global.userAuth1)
            .send({
                data: {
                    type: OA2_AUTHORIZATION_CODE,
                    name: 'google oAuth2',
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    redirectUri: `http://localhost:${conf.port}/callback`,
                    endpoints: {
                        auth: 'https://example-callback.com/auth?'
                                + 'scope={{scope}}&'
                                + 'access_type=offline&'
                                + 'include_granted_scopes=true&'
                                + 'state={{state}}&'
                                + 'redirect_uri={{redirectUri}}&'
                                + 'response_type=code&'
                                + 'client_id={{clientId}}',
                        token: 'https://example-callback.com/exchange',
                        userinfo: 'https://example-callback.com/token',
                    },
                    mappings: {
                        externalId: {
                            source: 'access_token',
                            key: 'sub',
                        },
                    },
                },
            })
            .expect(200)).body.data;

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope,
                },
            })
            .expect(200);

        const authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        // simulate external api call
        const state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));
        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const { _id } = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        const externalId = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data.value.externalId;

        expect(externalId.length).toBeGreaterThan(0);
    });

    test('Check for externalId in userinfo', async () => {
        const example = nock('https://example-provider.com');
        const scope = 'userinfo';

        const authClient = (await request.post('/auth-clients')
            .set(...global.userAuth1)
            .send({
                data: {
                    type: OA2_AUTHORIZATION_CODE,
                    name: 'google oAuth222222',
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    redirectUri: `http://localhost:${conf.port}/callback`,
                    endpoints: {
                        auth: 'https://example-provider.com/auth?'
                                + 'scope={{scope}}&'
                                + 'access_type=offline&'
                                + 'include_granted_scopes=true&'
                                + 'state={{state}}&'
                                + 'redirect_uri={{redirectUri}}&'
                                + 'response_type=code&'
                                + 'client_id={{clientId}}',
                        token: 'https://example-provider.com/exchange',
                        userinfo: 'https://example-provider.com/userinfo',
                    },
                    mappings: {
                        externalId: {
                            source: 'userinfo',
                            key: 'sub',
                        },
                    },
                },
            })
            .expect(200)).body.data;

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope,
                },
            })
            .expect(200);

        let authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        // simulate external api call
        let state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                expires_in: 3603,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                // sub: 1234567890
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        example
            .get('/userinfo')
            .reply(200, {
                sub: '1234567890',
                token_type: 'Bearer',
            });

        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const { _id } = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        let secret = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data;

        const { externalId } = secret.value;
        const expires1 = secret.value.expires;
        expect(externalId.length).toBeGreaterThan(0);

        // update secret to change scope
        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope: 'new scope',
                },
            })
            .expect(200);

        authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        // simulate external api call
        state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                expires_in: 60,
                refresh_token: 'asdasd',
                scope: 'new scope',
                token_type: 'Bearer',
                // sub: 1234567890
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        example
            .get('/userinfo')
            .reply(200, {
                sub: '1234567890',
            });

        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        secret = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data;

        const newScope = secret.value.scope;
        const expires2 = secret.value.expires;

        expect(newScope).toEqual('new scope');
        expect(expires2).not.toEqual(expires1);
        expect(nock.isDone()).toBeTruthy();
    });

    test('Check for externalId in custom adapter', async () => {
        const example = nock('https://example-provider.com');
        const scope = 'userinfo';

        const authClient = (await request.post('/auth-clients')
            .set(...global.userAuth1)
            .send({
                data: {
                    type: OA2_AUTHORIZATION_CODE,
                    name: 'google oAuth222222',
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    redirectUri: `http://localhost:${conf.port}/callback`,
                    endpoints: {
                        auth: 'https://example-provider.com/auth?'
                                + 'scope={{scope}}&'
                                + 'access_type=offline&'
                                + 'include_granted_scopes=true&'
                                + 'state={{state}}&'
                                + 'redirect_uri={{redirectUri}}&'
                                + 'response_type=code&'
                                + 'client_id={{clientId}}',
                        token: 'https://example-provider.com/exchange',
                        userinfo: 'https://example-provider.com/userinfo',
                    },
                    mappings: {
                        externalId: {
                            source: 'adapter.externalId.test',
                            key: 'sub',
                        },
                    },
                },
            })
            .expect(200)).body.data;

        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope,
                },
            })
            .expect(200);

        let authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        // simulate external api call
        let state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                expires_in: 3603,
                refresh_token: 'asdasd',
                scope,
                token_type: 'Bearer',
                // sub: 1234567890
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        example
            .get('/userinfo')
            .reply(200, {
                sub: '1234567890',
                token_type: 'Bearer',
            });

        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        const { _id } = await Secret[AUTH_TYPE.OA2_AUTHORIZATION_CODE].findOne({
            'value.scope': scope,
        });

        let secret = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data;

        const { externalId } = secret.value;
        const expires1 = secret.value.expires;

        expect(externalId).toEqual('fooo');

        // update secret to change scope
        await request.post(`/auth-clients/${authClient._id}/start-flow`)
            .set(...global.userAuth1)
            .send({
                data: {
                    scope: 'new scope',
                },
            })
            .expect(200);

        authFlow = await AuthFlow.findOne({
            authClientId: authClient._id,
        });

        // simulate external api call
        state = base64url(JSON.stringify({
            flowId: authFlow._id,
            payload: {},
        }));

        example
            .post('/exchange')
            .reply(200, {
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                expires_in: 60,
                refresh_token: 'asdasd',
                scope: 'new scope',
                token_type: 'Bearer',
                // sub: 1234567890
                id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            });

        await request.get(`/callback?state=${state}&code=123456`)
            .expect(200);

        secret = (await request.get(`/secrets/${_id}`)
            .set(...global.userAuth1)
            .expect(200)).body.data;

        const newScope = secret.value.scope;
        const expires2 = secret.value.expires;

        expect(newScope).toEqual('new scope');
        expect(expires2).not.toEqual(expires1);
    });
});
