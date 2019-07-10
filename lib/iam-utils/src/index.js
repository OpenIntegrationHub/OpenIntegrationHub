const Logger = require('@basaas/node-logger');
const rp = require('request-promise');
const base64url = require('base64url');
const NodeCache = require('node-cache');

const log = Logger.getLogger('iam-middleware');
const CONF = require('./conf');
const CONSTANTS = require('./constants');

let tokenCache;

if (CONF.tokenCacheTTL) {
    tokenCache = new NodeCache({ stdTTL: parseInt(CONF.tokenCacheTTL, 10) });
}

log.info(
    'iam-middleware config',
    Object.assign(
        {},
        { ...CONF },
        {
            iamToken: CONF.iamToken.replace(/.(?=.{4,}$)/g, '*'),
            oidcServiceClientSecret: CONF.oidcServiceClientSecret.replace(/.(?=.{4,}$)/g, '*'),
        },
    ),
);

const allRequiredElemsExistsInArray = (array, requiredElems) => {
    let hit = 0;

    for (let i = 0; i < requiredElems.length; i += 1) {
        if (array.indexOf(requiredElems[i]) >= 0) {
            hit += 1;
        }
    }

    return hit === requiredElems.length;
};

module.exports = {
    getUserData: async ({ token, introspectType }) => {

        introspectType = introspectType || CONF.introspectType;
        const introspectEndpoint = introspectType.toLowerCase() === CONSTANTS.AUTH_TYPES.basic ? CONF.introspectEndpointBasic : CONF.introspectEndpointOidc;

        try {
            const body = await rp.post({
                uri: introspectEndpoint,
                headers: introspectType.toLowerCase() === CONSTANTS.AUTH_TYPES.oidc ? {
                    authorization: `Basic ${base64url(`${
                        encodeURIComponent(CONF.oidcServiceClientId)}:${encodeURIComponent(CONF.oidcServiceClientSecret)}`)
                    }`,
                } : {
                    'x-auth-type': CONSTANTS.AUTH_TYPES.basic,
                    authorization: `Bearer ${CONF.iamToken}`,
                },
                ...(introspectType.toLowerCase() === CONSTANTS.AUTH_TYPES.oidc ? {
                    form: {
                        token,
                    },
                } : {
                    body: {
                        token,
                    },
                }),
                json: true,
            });

            if (introspectEndpoint === CONF.introspectEndpointOidc && body.active === false) {
                return {
                    error: 'Token expired',
                };
            }

            const user = {
                ...body,
                ...body.claims,
            };

            if (user.memberships) {
                user.currentContext = user.memberships.find(membership => membership.active);
            }

            user.sub = user.sub || body._id;

            user.tenantId = body.tenantId;

            if (tokenCache) {
                log.debug('iam.getUserData.setCache');
                tokenCache.set(token, user);
            }

            return user;
        } catch (err) {
            log.error(err);

            log.debug('iam.getUserData.Error', {
                introspectType, token, iam_token: CONF.iamToken, msg: err.message,
            });

            if (err.statusCode === 404) {
                log.error('Token not found in IAM', { introspectType, token });
                throw new Error('Token not found in IAM');
            }

            throw new Error('Authorization failed');
        }
    },

    middleware: async (req, res, next) => {

        let payload = null;
        let token = null;
        if (!req.headers.authorization) {
            return next({ status: 401, message: 'Missing authorization header.' });
        }

        try {
            const header = req.headers.authorization.split(' ');
            if (!header || header.length < 2) {
                log.debug('Authorization header length is incorrect');
                return next({ status: 401, message: 'Invalid authorization header' });
            }
            token = header[1];
            if (tokenCache) {
                log.debug('iam.middleware.fetchFromCache');
                payload = tokenCache.get(token);
            }
            payload = payload || await module.exports.getUserData({ token, introspectType: req.headers['x-auth-type'] });
            if (payload.error) {
                return next({ status: 401, message: `Token invalid. Error: ${payload.error}.` });
            }
        } catch (err) {
            log.debug('Failed to parse token', err);
            return next({ status: 401, message: `Token invalid. Error: ${err.name}. Details: ${err.message}` });
        }

        if (payload) {
            req.user = payload;
            /* @deprecated */
            req.__HEIMDAL__ = req.user;
            return next();
        } else {
            log.error('Payload is empty or undefined', { payload });
            return next({ status: 400, message: 'Payload is either empty or undefined' });
        }
    },

    // @todo: don't duplicate code
    async koaMiddleware(ctx, next) {
        let payload = null;
        let token = null;
        if (!ctx.headers.authorization) {
            return ctx.throw(401, 'Missing authorization header.');
        }

        try {
            const header = ctx.headers.authorization.split(' ');
            if (!header || header.length < 2) {
                log.debug('Authorization header length is incorrect');
                return ctx.throw(401, 'Invalid authorization header');
            }
            token = header[1];
            if (tokenCache) {
                log.debug('iam.middleware.fetchFromCache');
                payload = tokenCache.get(token);
            }
            payload = payload || await module.exports.getUserData({ token, introspectType: ctx.headers['x-auth-type'] });
            if (payload.error) {
                return ctx.throw(401, `Token invalid. Error: ${payload.error}.`);
            }
        } catch (err) {
            log.debug('Failed to parse token', err);
            return ctx.throw(401, `Token invalid. Error: ${err.name}. Details: ${err.message}`);
        }

        if (payload) {
            ctx.state.user = payload;
            return next();
        } else {
            log.error('Payload is empty or undefined', { payload });
            return ctx.throw(400, 'Payload is either empty or undefined');
        }
    },

    hasAll: ({ user, requiredPermissions }) => {
        if (!Array.isArray(requiredPermissions)) {
            requiredPermissions = [requiredPermissions];
        }

        const { role, permissions, currentContext } = user;

        /** requester is either admin, or a service account with correct permissions
         or a user in context of a tenant with her permissions
         */
        if (role === CONSTANTS.ROLES.ADMIN
            || (role === CONSTANTS.ROLES.SERVICE_ACCOUNT
                && permissions.length
                && allRequiredElemsExistsInArray(permissions, requiredPermissions)
            )
            || (
                currentContext && currentContext.permissions.length
                && allRequiredElemsExistsInArray(currentContext.permissions, requiredPermissions)
            )
        ) {
            return true;
        }

        return false;
    },

    hasOneOf: ({ user, requiredPermissions }) => {
        if (!Array.isArray(requiredPermissions)) {
            requiredPermissions = [requiredPermissions];
        }

        const { role, permissions, currentContext } = user;

        /** requester is either admin, or a service account with correct permissions
         or a user in context of a tenant with her permissions
         */
        if (role === CONSTANTS.ROLES.ADMIN
            || (role === CONSTANTS.ROLES.SERVICE_ACCOUNT
                && permissions.length
                && requiredPermissions.find(reqPerm => permissions.find(userPerm => userPerm === reqPerm))
            )
            || (
                currentContext && currentContext.permissions.length
                && requiredPermissions.find(reqPerm => currentContext.permissions.find(userPerm => userPerm === reqPerm))
            )
        ) {
            return true;
        }

        return false;
    },

    /**
     * @param {Array} requiredPermissions
     * */
    can: requiredPermissions => async (req, res, next) => {
        const userHasPermissions = module.exports.hasAll({
            requiredPermissions,
            user: req.user,
        });

        if (userHasPermissions) {
            return next();
        }
        return next({
            status: 403,
            message: CONSTANTS.ERROR_CODES.MISSING_PERMISSION,
            details: JSON.stringify(requiredPermissions),
        });
    },

    isOwnerOf({ entity, user }) {
        const userIsOwner = !!entity.owners.find(
            elem => elem.id === user.sub,
        );
    
        const tenantIsOwner = !!entity.owners.find(
            elem => elem.id === user.tenantId,
        );
    
        return (
            (user.role === CONSTANTS.ROLES.TENANT_ADMIN && tenantIsOwner)
            || userIsOwner
        );
    },

};
