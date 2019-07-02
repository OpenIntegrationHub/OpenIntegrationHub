/* eslint no-unused-expressions: "off" */
/* eslint no-underscore-dangle: "off" */
/* eslint max-len: "off" */
/* eslint consistent-return: "off" */

const express = require('express');

const swaggerUi = require('swagger-ui-express');
const iamMiddleware = require('@openintegrationhub/iam-utils');
const cors = require('cors');
const config = require('./config/index');
const flow = require('./api/controllers/flow');
const { connectQueue, disconnectQueue } = require('./utils/eventBus');
const startstop = require('./api/controllers/startstop');
const healthcheck = require('./api/controllers/healthcheck');
const swaggerDocument = require('./api/swagger/swagger.json');


const log = require('./config/logger');

class Server {
  constructor() {
    this.app = express();
    this.app.disable('x-powered-by');
  }

  async setupCors() {
    const whitelist = config.originWhitelist;

    // For development, add localhost to permitted origins
    if (process.env.NODE_ENV !== 'production') {
      whitelist.push('http://localhost:3001');
    }

    const corsOptions = {
      origin(origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
          callback(null, true);
        } else {
          log.info('Blocked by CORS');
          log.info(origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    };

    // Enables preflight OPTIONS requests
    this.app.options('/', cors());

    // enables CORS
    this.app.use('/flows', cors(corsOptions));
  }

  async setupMiddleware() {
    log.info('Setting up middleware');

    // This middleware simple calls the IAM middleware to add user data to req.
    this.app.use('/flows', iamMiddleware.middleware);

    // This middleware compiles the relevant membership ids generated by the IAM iam middleware and passes them on
    this.app.use('/flows', async (req, res, next) => {
      if (this.mongoose.connection.readyState !== 1) {
        return res.status(500).send({ errors: [{ message: `NO DB. Please try again later ${this.mongoose.connection.readyState}`, code: 500 }] });
      }

      return next();
    });

    log.info('Middleware set up');
  }

  async setupQueue() {  // eslint-disable-line
    log.info('Connecting to Queue');
    await connectQueue();
  }

  async terminateQueue() {  // eslint-disable-line
    log.info('Disconnecting from Queue');
    await disconnectQueue();
  }

  setupRoutes() {
    // configure routes
    this.app.use('/flows', flow);
    this.app.use('/flows', startstop);
    this.app.use('/healthcheck', healthcheck);

    // Reroute to docs
    this.app.use('/docs', (req, res) => {
      res.redirect('/api-docs');
    });

    // Error handling
      this.app.use(function (err, req, res, next) { // eslint-disable-line
      return res.status(err.status || 500).send({ errors: [{ message: err.message, code: err.status }] });
    });

    log.info('Routes set');
  }

  async setup(mongoose) {
    log.info('Connecting to mongoose');
    // Configure MongoDB
    // Use the container_name, bec containers in the same network can communicate using their service name
    this.mongoose = mongoose;

    const options = {
      keepAlive: 1, connectTimeoutMS: 30000, reconnectInterval: 1000, reconnectTries: Number.MAX_VALUE, useNewUrlParser: true,
    }; //

    // Will connect to the mongo container by default, but to localhost if testing is active
    mongoose.connect(config.mongoUrl, options);

    // Get Mongoose to use the global promise library
    mongoose.Promise = global.Promise;  // eslint-disable-line
    // Get the default connection
    this.db = mongoose.connection;
    // Bind connection to error event (to get notification of connection errors)
    this.db.on('error', console.error.bind(console, 'MongoDB connection error:'));
    log.info('Connecting done');
  }

  setupSwagger() {
    log.info('adding swagger api');
    // Configure the Swagger-API
    /*eslint-disable */
        var config = {
          appRoot: __dirname, // required config

          // This is just here to stop Swagger from complaining, without actual functionality

          swaggerSecurityHandlers: {
            Bearer: function (req, authOrSecDef, scopesOrApiKey, cb) {
              if (true) {
                cb();
              } else {
                cb(new Error('access denied!'));
              }
            }
          }
        };
        /* eslint-enable */

    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { explorer: true }));
  }

  listen(port) {
    const cport = typeof port !== 'undefined' ? port : 3001;
    log.info(`opening port ${cport}`);
    return this.app.listen(cport);
  }
}

module.exports = Server;
