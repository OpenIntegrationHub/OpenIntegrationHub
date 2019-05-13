# Scheduler
Schedules flows for execution. Based on [@openintegrationhub/scheduler](../../lib/scheduler).

## How it works
It's looking for polling flows ready for the next execution cycle and triggers a flow execution by sending a message to the queue of the first node in the flow.

## Prerequisites
- RabbitMQ
- MongoDB

## How to build
```
docker build -t openintegrationhub/scheduler:latest -f Dockerfile ../../
```
or
```
VERSION=latest npm run build:docker
```

## How to deploy
Kubernetes descriptors for Scheduler along with the other core platform microservices can be found in the [k8s](./k8s) directory.

## Environment variables

#### General
| Name | Description |
| --- | --- |
| LISTEN_PORT | Port for HTTP interface. |
| LOG_LEVEL | Log level for logger. |
| MONGODB_URI | MongoDB connection string. |
| POLLING_INTERVAL | Time interval of the scheduler's "tick". |
| RABBITMQ_URI | RabbitMQ connection URI for the Resource Coordinator application. |
