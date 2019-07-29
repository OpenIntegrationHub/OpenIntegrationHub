

---

**Creator:** Philipp ([philecs](https://github.com/philecs)), Cloud Ecosystem e.V. <br>
**Last revised by:** - <br>
**Last update:** 23-07-2019

---

The OIH microservices mostly communicate asynchronously and via message queues. Most services emitts and consumes several events.

This document is designed to list all (for now: audit log relevant) events per service.

## IAM

### General Events

- User created - iam.user.created

- User removed - iam.user.deleted

- Tenant created - iam.tenant.created

- Tenant removed - iam.tenant.deleted

### AuditLog Events

- User:

1. Created, modified, deleted, assigned/removed to/from tenant, failed login attempt
2. e.g. iam.user.[operation]

- Tenant:

1. Created, modified, deleted
2. e.g. iam.tenant.[operation]

- Token / Roles / Permissions:

1. Created, modified, deleted
2. e.g. iam.role.[operation]

## Secret-Service

### AuditLog Events

- Secret:

1. Created, deleted
2. e.g. secret-service.secret.[operation], secret-service.auth-client.[operation]

- Access Token requested by Account:

1. e.g. secret-service.token.get

## Metadata

### AuditLog Events

- Domain / Schema

1. Created, modified, deleted
2. E.g. metadata.schema.[operation]

## Flow Repository

### AuditLog Events

- flowrepo.flow.created
- flowrepo.flow.modified
- flowrepo.flow.deleted
- flowrepo.flow.starting
- flowrepo.flow.stopping

## Component Orchestrator

### AuditLog Events

- flow.started
- flow.stopped
