const Server = require('../../../../src/Server');
const supertest = require('supertest');
const { expect } = require('chai');
const Component = require('../../../../src/models/Component');

describe('DELETE /components/:id', () => {
    let server;
    let request;

    beforeEach(async () => {
        const config = {
            get(key) {
                return this[key];
            },
            MONGODB_URI: 'mongodb://localhost/test'
        };
        const logger = {
            info: () => {},
            debug: () => {},
            warn: () => {},
            error: () => {},
            trace: () => {}
        };
        const iam = {
            middleware(req, res, next) {
                req.user = {
                    sub: '123'
                };
                return next();
            },
            can() {
                return (req, res, next) => next()
            }
        };
        server = new Server({config, logger, iam});
        request = supertest(await server.start());

        await Component.deleteMany({});
    });

    afterEach(async () => {
        await server.stop();
    });

    it('should delete component', async () => {
        const component = await Component.create({
            name: 'Test',
            description: 'Test description',
            distribution: {
                image: 'kokoko'
            },
            owners: [
                {id: '123', type: 'user'}
            ]
        });
        const result = await request.delete('/components/' + component.id);

        expect(result.statusCode).to.equal(204);
        expect(await Component.findById(component.id)).to.be.null;
    });

    it('should return 404', async () => {
        const { body, statusCode } = await request.delete('/components/5cda861b119a4020a0d504b4');
        expect(statusCode).to.equal(404);
        expect(body).to.deep.equal({
            'errors': [
                {
                    'message': 'Component is not found'
                }
            ]
        });
    });
});

