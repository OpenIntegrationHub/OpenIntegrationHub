const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const iamLib = require('@openintegrationhub/iam-utils');
const DAO = require('../dao');
const conf = require('../conf');

const jsonParser = bodyParser.json();

async function createCollections() {
    for (const key of Object.keys(DAO)) {
        try {
            await DAO[key].createCollection();
        } catch (err) {

        }
    }
}

module.exports = class Server {
    constructor({ port, mongoDbConnection, dao }) {
        this.port = port || conf.port;
        this.app = express();
        this.app.disable('x-powered-by');
        this.mongoDbConnection = mongoDbConnection;

        // apply adapter
        // dao
        if (dao) {
            for (const key of Object.keys(dao)) {
                DAO[key] = dao[key];
            }
        }

        // enable advanced stdout logging
        if (conf.debugMode) {
            this.app.use(morgan('combined'));
        }

        this.app.use(jsonParser);
        // base routes
        this.app.use('/', require('./../route/root'));
        this.app.use('/healthcheck', require('./../route/healtcheck'));

        const apiBase = express.Router();

        apiBase.use((req, res, next) => {
            if (req.connection.remoteAddress === req.connection.localAddress) {
                if (req.method === 'GET' && req.originalUrl.match(/schemas.+/)) {
                    return next();
                }
            }
            iamLib.middleware(req, res, next);
        });

        // setup routes
        apiBase.use('/domains', require('./../route/domains'));

        this.app.use(conf.apiBase, apiBase);

        // error middleware
        this.app.use(require('./../middleware/error').default);
    }

    async setupDatabase() {
        const connectionString = this.mongoDbConnection
        || global.__MONGO_URI__
        || conf.mongoDbConnection;

        await mongoose.connect(connectionString, {
            poolSize: 50,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
            keepAlive: 120,
            useCreateIndex: true,
            useNewUrlParser: true,
        });
    }

    async start() {
        // setup database

        await this.setupDatabase();
        await createCollections();
        this.server = await this.app.listen(this.port);
    }

    async stop() {
        if (this.server) {
            mongoose.connection.close();
            this.server.close();
        }
    }
};
