
module.exports = {
    isLocalRequest(req) {
        if (req.connection.remoteAddress === req.connection.localAddress) {
            if (req.method === 'GET' && req.originalUrl.match(/schemas.+/)) {
                return true;
            }
        }
        return false;
    },
    maskString: string => (string ? string.replace(/.(?=.{4,}$)/g, '*') : ''),

};
