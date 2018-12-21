const jwt = require('jsonwebtoken');
const rp = require('request-promise');
const logger = require('@basaas/node-logger');
// const { verify } = require('@openintegrationhub/iam-utils');
const conf = require('../../conf');

const log = logger.getLogger(`${conf.logging.namespace}/auth`);
const { ROLE } = require('../../constant');
const SecretsDAO = require('../../dao/secret');
const AuthClientDAO = require('../../dao/auth-client');

function extractToken(req) {
    const header = req.headers.authorization.split(' ');
    return header[1];
}

async function verifyToken(req) {
    if (process.env.NODE_ENV === 'test') {
        return jwt.decode(extractToken(req));
    }

    // return await verify(extractToken(req));
    return jwt.decode(extractToken(req));
}

async function verifyRole(validRoles, req, res, next) {
    try {
        req.user = req.user || await verifyToken(req);
        if (validRoles.indexOf(req.user.role) !== -1) {
            next();
        } else {
            next({ status: 401 });
        }
    } catch (err) {
        log.error(err);
        next({ status: 401 });
    }
}

async function userIsOwnerOf(dao, req, res, next) {
    // TODO check for entityType as well

    try {
        const doc = await dao.findOne({
            _id: req.params.id,
        });

        if (!doc) {
            return next({ status: 404 });
        }

        const userIsOwner = doc.owner.find(
            elem => elem.entityId === req.user.sub,
        );

        if (userIsOwner) {
            req.obj = doc;
            return next();
        }
        return next({ status: 403 });
    } catch (err) {
        log.error(err);
        next({ status: 401 });
    }
}

const getUserData = async (req, res, next) => {
    // TODO userinfo endpoint with users bearer token

    let token;

    try {
        token = extractToken(req);
    } catch (err) {
        return next({
            status: 401,
            message: 'Could not parse token',
        });
    }

    rp({
        method: 'POST',
        uri: conf.introspectEndpoint,
        body: {
            token,
        },
        headers: {
            authorization: `Bearer ${conf.iamToken}`,
            ...conf.introspectHeader,
        },
        json: true,
    })
        .then((body) => {
            req.user = body;
            req.user.sub = req.user.sub || body._id;
            return next();
        })
        .catch((err) => {
            log.error(err);
            return next({
                status: 500,
            });
        });
};

module.exports = {
    async isLoggedIn(req, res, next) {
        try {
            req.user = await verifyToken(req);
            next();
        } catch (err) {
            log.error(err);
            next({ status: 401 });
        }
    },
    getUserData,
    async isUser(req, res, next) {
        await verifyRole([ROLE.ADMIN, ROLE.USER], req, res, next);
    },
    async isAdmin(req, res, next) {
        await verifyRole([ROLE.ADMIN], req, res, next);
    },

    async userIsOwnerOfSecret(req, res, next) {
        await userIsOwnerOf(SecretsDAO, req, res, next);
    },

    async userIsOwnerOfAuthClient(req, res, next) {
        await userIsOwnerOf(AuthClientDAO, req, res, next);
    },

};
