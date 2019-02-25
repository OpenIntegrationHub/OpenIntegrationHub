const mongoose = require('mongoose');
const AuthClient = require('../AuthClient');
const owners = require('../schema/owners');
const { AUTH_TYPE } = require('../../constant');

const {
    SIMPLE, API_KEY,
    OA1_TWO_LEGGED,
    OA2_AUTHORIZATION_CODE,
} = AUTH_TYPE;

const { Schema } = mongoose;

const secretBaseSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    owners: {
        type: [owners],
        required: true,
    },
    type: {
        type: String,
        enum: Object.keys(AUTH_TYPE),
        required: true,
    },
    lockedAt: Date,
    encryptedFields: {
        type: [String],
        default: [],
    },
    value: {},
}, {
    timestamps: true,
});

const Secret = mongoose.model('secret', secretBaseSchema);

module.exports = {
    full: Secret,
    [SIMPLE]:
        Secret.discriminator(`S_${SIMPLE}`, new Schema({
            value: {
                username: {
                    type: String,
                    required: true,
                },
                passphrase: {
                    type: String,
                    required: true,
                },
            },
        })),
    [API_KEY]:
        Secret.discriminator(`S_${API_KEY}`, new Schema({
            value: {
                key: {
                    type: String,
                    required: true,
                },
                headerName: String,
            },
        })),
    [OA1_TWO_LEGGED]:
        Secret.discriminator(`S_${OA1_TWO_LEGGED}`, new Schema({
            value: {
                expiresAt: String,
            },
        })),
    [OA2_AUTHORIZATION_CODE]: Secret.discriminator(`S_${OA2_AUTHORIZATION_CODE}`, new Schema({
        value: {
            authClientId: {
                type: Schema.Types.ObjectId,
                required: true,
                validate: {
                    isAsync: true,
                    validator(v, cb) {
                        AuthClient.full.findOne({ _id: v }, (err, doc) => {
                            if (err || !doc) {
                                cb(false);
                            } else {
                                cb(true);
                            }
                        });
                    },
                    // Default error message, overridden by 2nd argument to `cb()` above
                    message: 'Auth client is not existing',
                },
            },
            refreshToken: {
                type: String,
            },
            accessToken: {
                type: String,
                required: true,
            },
            scope: String,
            expires: String,
            externalId: String,
        },
    })),

};
