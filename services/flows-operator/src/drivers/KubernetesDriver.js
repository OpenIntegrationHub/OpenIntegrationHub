const BaseDriver = require('./BaseDriver');
const uuid = require('uuid/v4');
const _ = require('lodash');
const KubernetesRunningApp = require('./KubernetesRunningApp');

class KubernetesDriver extends BaseDriver {
    constructor(config, logger, k8s) {
        super();
        this._config = config;
        this._logger = logger;
        this._batchClient = k8s.getBatchClient();
    }

    async createApp(flow, node, queues) {
        return this._deployNode(flow, node, queues);
    }

    async destroyApp(appId) {
        //TODO wait until job really will be deleted
        this._logger.info({name: appId}, 'going to undeploy job from k8s');
        try {
            await this._batchClient.jobs.delete({
                name: appId,
                body: {
                    kind: 'DeleteOptions',
                    apiVersion: 'batch/v1',
                    propagationPolicy: 'Foreground'
                }
            });
        } catch (e) {
            this._logger.error(e, 'failed to undeploy job');
        }
    }

    async getAppList() {
        return ((await this._batchClient.jobs.get()).body.items || []).map(i => new KubernetesRunningApp(i));
    }

    async _deployNode(flow, node, queues) {
        let jobName = flow.id +'.'+ node.id;
        jobName = jobName.toLowerCase().replace(/[^0-9a-z]/g, '');
        this._logger.info({jobName}, 'Going to deploy job to k8s');
        const descriptor = this._buildDescriptor(flow, node, queues);
        this._logger.trace(descriptor, 'going to deploy a job to k8s');
        try {
            await this._batchClient.jobs.post({body: descriptor});
        } catch (e) {
            this._logger.error(e, 'Failed to deploy the job');
        }
    }

    _buildDescriptor(flow, node, queues) {
        let jobName = flow.id +'.'+ node.id;
        jobName = jobName.toLowerCase().replace(/[^0-9a-z]/g, '');
        const env = this._prepareEnvVars(flow, node, queues[node.id]);
        return this._generateAppDefinition(flow, jobName, env, node);
    }

    _generateAppDefinition(flow, appId, envVars, node) {
        const env = Object.keys(envVars).map(key => ({
            name: key,
            value: envVars[key]
        }));

        env.push({
            name: 'ELASTICIO_AMQP_URI',
            valueFrom: {
                secretKeyRef: {
                    name: flow.id,
                    key: 'AMQP_URI'
                }
            }
        });

        return {
            apiVersion: 'batch/v1',
            kind: 'Job',
            metadata: {
                name: appId,
                namespace: this._config.get('NAMESPACE'),
                annotations: {
                    [KubernetesRunningApp.ANNOTATION_KEY]: flow.metadata.resourceVersion
                },
                ownerReferences: [
                    {
                        apiVersion: 'elastic.io/v1',
                        kind: 'Flow',
                        controller: true,
                        name: flow.metadata.name,
                        uid: flow.metadata.uid
                    }
                ]
            },
            spec: {
                template: {
                    metadata: {
                        labels: {}
                    },
                    spec: {
                        restartPolicy: 'Never',
                        containers: [{
                            image: node.image,
                            name: 'apprunner',
                            imagePullPolicy: 'Always',
                            env,
                            resources: this._prepareResourcesDefinition(flow, node)
                        }]
                    }
                }
            }
        };
    }

    _prepareResourcesDefinition(flow, node) {
        const lc = 'resources.limits.cpu';
        const lm = 'resources.limits.memory';
        const rc = 'resources.requests.cpu';
        const rm = 'resources.requests.memory';

        const cpuLimit = _.get(node, lc) || _.get(flow, lc) || this._config.get('DEFAULT_CPU_LIMIT');
        const memLimit = _.get(node, lm) || _.get(flow, lm) || this._config.get('DEFAULT_MEM_LIMIT');
        const cpuRequest = _.get(node, rc) || _.get(flow, rc) || this._config.get('DEFAULT_CPU_REQUEST');
        const memRequest = _.get(node, rm) || _.get(flow, rm) || this._config.get('DEFAULT_MEM_REQUEST');

        return {
            limits: {
                cpu: cpuLimit,
                memory: memLimit
            },
            requests: {
                cpu: cpuRequest,
                memory: memRequest
            }
        };
    }

    _prepareEnvVars(flow, node, nodeQueues) {
        let envVars = Object.assign({}, nodeQueues);
        envVars.EXEC_ID = uuid().replace(/-/g, '');
        envVars.STEP_ID = node.id;
        envVars.FLOW_ID = flow.id;
        envVars.USER_ID = 'FIXME hardcode smth here';
        envVars.COMP_ID = 'does not matter';
        envVars.FUNCTION = node.function;
        envVars.API_URI = this._config.get('SELF_API_URI').replace(/\/$/, '');

        envVars.API_USERNAME = 'does not matter';
        envVars.API_KEY = 'does not matter';
        envVars = Object.entries(envVars).reduce((env, [k, v]) => {
            env['ELASTICIO_' + k] = v;
            return env;
        }, {});
        return Object.assign(envVars, node.env);
    }
}

module.exports = KubernetesDriver;
