const Domain = require('../../model/Domain');

module.exports = {

    async createCollection() {
        await Domain.createCollection();
    },
    async countBy(query) {
        return await Domain.countDocuments(query);
    },
    async create(obj) {
        const domain = new Domain({ ...obj });
        await domain.save();
        return domain.toObject();
    },

    async findOne(query) {
        return await Domain.findOne(query);
    },

    async findByEntityWithPagination(
        id,
        props,
    ) {
        return await Domain.find({
            'owners.id': id,
        },
        'name description public owners',
        props);
    },
    async delete(id) {
        return await Domain.deleteOne({
            _id: id,
        });
    },
};
