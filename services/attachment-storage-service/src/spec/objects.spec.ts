import Maester from '../index';
import config from '../config';
import { step } from 'mocha-steps';
import chai from 'chai';
import { createHash, pseudoRandomBytes } from 'crypto';
import supertest, { agent } from 'supertest';
import { sign } from 'jsonwebtoken';
import uuid from 'uuid';
import { Readable, Writable } from 'stream';
import StorageObjectService from '../storage-drivers/redis/redis-storage';
import RedisStorageObject from '../storage-drivers/redis/redis-object';

const { expect } = chai;

function getCreate(
    id: string,
    value: string | Buffer,
    contentType: string,
    options: { timeout?: number; getJWT?: string; putJwt?: string } = {}
): void {
    const buf: Buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const bufMd5 = createHash('md5').update(buf).digest('hex');

    step('PUT', async function () {
        const { timeout, putJwt } = options;
        if (timeout) {
            this.timeout(timeout);
        }
        const jwt = putJwt || this.jwt;
        const res = await this.request
            .put(`/objects/${id}`)
            .set('Authorization', `Bearer ${jwt}`)
            .set('Content-Type', contentType)
            .send(value);
        expect(res).to.have.property('statusCode', 201);
        const storageObject = await this.storageObjects.find(id);
        expect(storageObject).is.instanceOf(RedisStorageObject);
        expect(await storageObject.calculateMd5Hash()).to.equal(bufMd5);
        expect(storageObject.md5).to.equal(bufMd5);
    });

    step('GET', async function () {
        const { timeout, getJWT } = options;
        if (timeout) {
            this.timeout(timeout);
        }
        const jwt = getJWT || this.jwt;
        const length = buf.length;
        const res = await this.request
            .get(`/objects/${id}`)
            .set('Authorization', `Bearer ${jwt}`)
            .responseType('buffer')
            .maxResponseSize(Number.MAX_VALUE);
        expect(res).to.have.property('statusCode', 200);
        expect(res.header).to.have.property('content-type', contentType);
        expect(res.header).to.have.property('content-length', String(length));
        expect(createHash('md5').update(res.body).digest('hex')).to.equal(bufMd5);
    });
}

describe(`/objects`, () => {
    const jwtPayload = {
        tenantId: 'tenant-id',
        contractId: 'contract-id',
        workspaceId: 'workspace-id',
        flowId: 'flow-id',
        userId: 'user-id'
    };
    before(async function () {
        this.maester = new Maester(config);
        await this.maester.connect();
        this.storageObjects = new StorageObjectService(this.maester.redis);
        this.request = agent(this.maester.serverCallback);
        await this.storageObjects.deleteAllStorageObjects();
        this.jwt = sign(
            jwtPayload,
            'test'
        );
    });

    after(async function () {
        await this.storageObjects.deleteAllStorageObjects();
        await this.maester.stop();
    });

    describe('/:id', () => {

        xit('should require auth', async function () {
            const id = uuid.v4();
            const res = await this.request.put(`/objects/${id}`)
                .set('Content-Type', 'application/octet-stream')
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 401);
            expect(res).to.have.property('text', 'Unauthorized');
        });

        xit('should validate auth', async function () {
            const id = uuid.v4();
            const jwt = sign(
                {
                    userId: 'user-id'
                },
                'test'
            );
            const res = await this.request.put(`/objects/${id}`)
                .set('Authorization', `Bearer ${jwt}`)
                .set('Content-Type', 'application/octet-stream')
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 401);
            expect(res).to.have.property('text', 'Unauthorized');
        });

        xit('should check auth', async function () {
            const id = uuid.v4();
            const newJwt = sign(
                {
                    ...jwtPayload,
                    contractId: `${jwtPayload.contractId}1`
                },
                'test'
            );

            let res = await this.request.put(`/objects/${id}`)
                .set('Authorization', `Bearer ${this.jwt}`)
                .set('Content-Type', 'application/octet-stream')
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 201);

            res = await this.request
                .get(`/objects/${id}`)
                .set('Authorization', `Bearer ${newJwt}`);

            expect(res).to.have.property('statusCode', 403);
            expect(res).to.have.property('text', 'Forbidden');
        });

        describe('access modifiers in token',  function () {

            describe('all tenants', () => {
                getCreate(
                    uuid.v4(),
                    pseudoRandomBytes(10),
                    'application/octet-stream',
                    {
                        getJWT: sign(
                            {
                                tenantId: '*'
                            },
                            'test'
                        )
                    }
                );
            });

            describe('all contracts', () => {
                getCreate(
                    uuid.v4(),
                    pseudoRandomBytes(10),
                    'application/octet-stream',
                    {
                        getJWT: sign(
                            {
                                tenantId: jwtPayload.tenantId,
                                contractId: '*'
                            },
                            'test'
                        )
                    }
                );
            });

            describe('all workspaces', () => {
                getCreate(
                    uuid.v4(),
                    pseudoRandomBytes(10),
                    'application/octet-stream',
                    {
                        getJWT: sign(
                            {
                                tenantId: jwtPayload.tenantId,
                                contractId: jwtPayload.contractId,
                                workspaceId: '*'
                            },
                            'test'
                        )
                    }
                );
            });

            describe('all flows', () => {
                getCreate(
                    uuid.v4(),
                    pseudoRandomBytes(10),
                    'application/octet-stream',
                    {
                        getJWT: sign(
                            {
                                tenantId: jwtPayload.tenantId,
                                contractId: jwtPayload.contractId,
                                workspaceId: jwtPayload.workspaceId,
                                flowId: '*'
                            },
                            'test'
                        )
                    }
                );
            });
        });

        it('should allow only uuid as object id', async function () {
            const id = 'definitely-not-uuid';
            const res = await this.request
                .put(`/objects/${id}`)
                .set('Content-Type', 'application/octet-stream')
                .set('Authorization', `Bearer ${this.jwt}`)
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 400);
            expect(res).to.have.property('text', 'Invalid object id');
        });

        it('should not allow to create object with same id', async function () {
            const id = uuid.v4();
            let res = await this.request.put(`/objects/${id}`)
                .set('Content-Type', 'application/octet-stream')
                .set('Authorization', `Bearer ${this.jwt}`)
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 201);
            res = await this.request.put(`/objects/${id}`)
                .set('Content-Type', 'application/octet-stream')
                .set('Authorization', `Bearer ${this.jwt}`)
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 409);
            expect(res).to.have.property('text', 'Object already exists');
        });

        it('should not allow empty content-type', async function () {
            const id = uuid.v4();
            const res = await this.request
                .put(`/objects/${id}`)
                .set('Authorization', `Bearer ${this.jwt}`)
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 415);
            expect(res).to.have.property('text', 'Object type not supported or missing');
        });

        it('should not allow unsupported content-types', async function () {
            const id = uuid.v4();
            const res = await this.request.put(`/objects/${id}`)
                .set('Authorization', `Bearer ${this.jwt}`)
                .set('Content-Type', 'unsupported/type')
                .send(pseudoRandomBytes(1024));
            expect(res).to.have.property('statusCode', 415);
            expect(res).to.have.property('text', 'Object type not supported or missing');
        });

        it('should not allow concurrent writes', async function () {
            const id = uuid.v4();
            const promises = [
                this.request.put(`/objects/${id}`)
                    .set('Content-Type', 'application/octet-stream')
                    .set('Authorization', `Bearer ${this.jwt}`)
                    .send(pseudoRandomBytes(1024)),
                this.request.put(`/objects/${id}`)
                    .set('Content-Type', 'application/octet-stream')
                    .set('Authorization', `Bearer ${this.jwt}`)
                    .send(pseudoRandomBytes(1024))
            ];
            const res = await Promise.all(promises);
            expect(res.filter(({ status }) => status === 201)).to.have.lengthOf(1);
            expect(res.filter(({ status }) => status === 409)).to.have.lengthOf(1);
        });

        it('should allow empty object', async function () {
            const id = uuid.v4();
            await this.request
                .put(`/objects/${id}`)
                .set('Content-Type', 'application/octet-stream')
                .set('Authorization', `Bearer ${this.jwt}`)
                .send(pseudoRandomBytes(0));

            const res = await this.request
                .get(`/objects/${id}`)
                .set('Authorization', `Bearer ${this.jwt}`);

            expect(res).to.have.property('statusCode', 204);
        });

        it('should wait for connection end on stop', async function () {
            const id = uuid.v4();
            const maester = new Maester(config);
            await maester.start();
            const [res] = await Promise.all([
                supertest(`http://localhost:${config.PORT}`)
                    .put(`/objects/${id}`)
                    .set('Content-Type', 'application/octet-stream')
                    .set('Authorization', `Bearer ${this.jwt}`)
                    .send(pseudoRandomBytes(1024)),
                (async () => {
                    await maester.stop();
                })
            ]);

            expect(res).to.have.property('statusCode', 201);
        });

        it('should handle redis unexpected disconnect', async function () {
            const id = uuid.v4();

            const stream = new Readable({
                read(size) {
                    this.push(pseudoRandomBytes(size));
                }
            });

            const maester = new Maester(config);
            await maester.connect();
            const request = supertest(maester.serverCallback);

            const req = <Writable> (<unknown> request
                .put(`/objects/${id}`)
                .set('Content-Type', 'application/octet-stream')
                .set('Authorization', `Bearer ${this.jwt}`));
            stream.pipe(req);

            await new Promise(resolve => setTimeout(() => resolve(), 10));
            await maester.disconnect(false);

            const res = await this.request
                .get(`/objects/${id}`)
                .set('Authorization', `Bearer ${this.jwt}`);

            expect(res).to.have.property('statusCode', 500);
        });

        describe('should create and fetch', () => {
            describe('text object', () => {
                getCreate(uuid.v4(), 'This is a message', 'text/plain');
            });

            describe('json object', () => {
                getCreate(uuid.v4(), JSON.stringify({ hello: 'json' }), 'application/json');
            });


            describe('xml object', () => {
                getCreate(
                    uuid.v4(),
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hello>xml</hello>',
                    'application/xml'
                );
            });

            describe('CSV object', () => {
                getCreate( uuid.v4(), 'hello,csv', 'text/csv');
            });

            describe('TSV object', () => {
                getCreate( uuid.v4(), 'hello\ttsv', 'text/tsv');
            });

            describe('Binary object', () => {
                getCreate( uuid.v4(), pseudoRandomBytes(10), 'application/octet-stream');

                describe.skip('512M', () => {
                    getCreate(
                        uuid.v4(),
                        pseudoRandomBytes(536870912), // 512MB - limit for one redis key
                        'application/octet-stream',
                        { timeout: 100000 }
                    );
                });

                describe.skip('640M', () => {
                    getCreate(
                        uuid.v4(),
                        pseudoRandomBytes(536870912 + 536870912 / 4), // 640MB - should be split into 2 chunks in redis
                        'application/octet-stream',
                        { timeout: 100000 }
                    );
                });

            });

        });

    });
});
