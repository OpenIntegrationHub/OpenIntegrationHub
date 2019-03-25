const { QueueCreator, App } = require('backend-commons-lib');
const { ComponentOrchestrator } = require('@openintegrationhub/component-orchestrator');
const KubernetesDriver = require('./drivers/kubernetes/KubernetesDriver');
const HttpApi = require('./HttpApi');
const FlowsDao = require('./dao/FlowsDao');
const RabbitMqQueuesManager = require('./queues-manager/RabbitMqQueuesManager');
const { asValue, asClass, asFunction } = require('awilix');
const mongoose = require('mongoose');
const { EventBus, RabbitMqTransport } = require('@openintegrationhub/event-bus');
const MongoDbCredentialsStorage = require('./queues-manager/credentials-storage/MongoDbCredentialsStorage');

class ComponentOrchestratorApp extends App {
    async _run() {
        const container = this.getContainer();
        const config = container.resolve('config');
        const amqp = container.resolve('amqp');
        const k8s = container.resolve('k8s');
        await amqp.start();
        await k8s.start();

        const channel = await amqp.getConnection().createChannel();
        const queueCreator = new QueueCreator(channel);

        await mongoose.connect(config.get('MONGODB_URI'), {useNewUrlParser: true});

        container.register({
            queueCreator: asValue(queueCreator),
            flowsDao: asClass(FlowsDao),
            httpApi: asClass(HttpApi).singleton(),
            driver: asClass(KubernetesDriver),
            queuesManager: asClass(RabbitMqQueuesManager),
            credentialsStorage: asClass(MongoDbCredentialsStorage),
            transport: asClass(RabbitMqTransport, {
                injector: () => ({rabbitmqUri: config.get('RABBITMQ_URI')})
            }),
            eventBus: asClass(EventBus, {
                injector: () => ({serviceName: this.constructor.NAME})
            }).singleton(),
            componentOrchestrator: asClass(ComponentOrchestrator)
        });

        container.loadModules(['./src/event-handlers/**/*.js'], {
            formatName: 'camelCase',
            resolverOptions: {
                register: asFunction
            }
        });

        const httpApi = container.resolve('httpApi');
        httpApi.listen(config.get('LISTEN_PORT'));

        await container.resolve('eventHandlers').connect();
        const componentOrchestrator = container.resolve('componentOrchestrator');
        await componentOrchestrator.start();
    }

    static get NAME() {
        return 'component-orchestrator';
    }
}
module.exports = ComponentOrchestratorApp;
