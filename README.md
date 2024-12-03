<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# Portainer Stack Deploy

Portainer-stack-deploy is a GitHub Action for deploying a newly updated stack to a Portainer v2 instance. This action is useful when you have a continuous deployment pipeline. The action itself is inspired by how you deploy a task definition to Amazon ECS.

**Currently works on Portainer API v2.**

## Action Inputs

| Input              | Description                                                                                                                                                                  | Default      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| portainer-host     | Portainer host, eg. `https://myportainer.instance.com`                                                                                                                       | **Required** |
| username           | Username for the Portainer login. **NOTE: Do not use admin account!** Create a new CI specific login instead                                                                 | **Required** |
| password           | Password for the Portainer login                                                                                                                                             | **Required** |
| swarm-id           | ID of the swarm. Only required if you deploy to a swarm                                                                                                                      |              |
| endpoint-id        | ID of the endpoint to deploy the stack to. When specified, only stacks within this endpoint will be considered for updates. | No | `1` |
| stack-name         | Name for the Portainer stack                                                                                                                                                 | **Required** |
| stack-definition   | The path to the docker-compose stack stack definition file from repo root, eg. `stack-definition.yml`                                                                        | **Required** |
| template-variables | If given, these variables will be replaced in docker-compose file by handlebars                                                                                              |              |
| image              | The URI of the container image to insert into the stack definition, eg. `ghcr.io/username/repo:sha-676cae2`. Will use existing image inside stack definition if not provided |              |

## Example

The example below shows how the `portainer-stack-deploy` action can be used to deploy a fresh version of your app to Portainer using ghcr.io.

```yaml
name: Deploy

on:
  push:
    branches:
      - master

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      GITHUB_REF: ${{ github.ref }}
      DOCKER_REGISTRY: ghcr.io
      DOCKER_IMAGE: github-username/my-awesome-web-app

    steps:
      - uses: actions/checkout@v2

      - name: Creating envs
        run: |
          echo "IMAGE_TAG=sha-$(git rev-parse --short HEAD)" >> $GITHUB_ENV
          echo "DOCKER_IMAGE_URI=${{ env.DOCKER_REGISTRY }}/${{ env.DOCKER_IMAGE }}" >> $GITHUB_ENV

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v1
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build docker image and push
        uses: docker/build-push-action@v2
        with:
          context: .
          push: true
          tags: ${{ env.DOCKER_IMAGE_URI }}:${{ env.IMAGE_TAG }},${{ env.DOCKER_IMAGE_URI }}:latest

      - name: Sleep for 10 seconds
        run: sleep 10s
        shell: bash

      - name: Deploy stack to Portainer
        uses: carlrygart/portainer-stack-deploy@v1
        with:
          portainer-host: ${{ secrets.PORTAINER_HOST }}
          token: ${{ secrets.PORTAINER_API_KEY }}
          stack-name: 'my-awesome-web-app'
          stack-definition: 'docker-compose.yml'
          template-variables: '{"username": "MrCool"}'
          image: ${{ env.DOCKER_IMAGE_URI }}:${{ env.IMAGE_TAG }}
```

The `stack-definition.yml` file would be placed in the root of the repository and might look something like this:

```yaml
version: '3.7'

services:
  server:
    image: ghcr.io/{{username}}/my-awesome-web-app:latest
    deploy:
      update_config:
        order: start-first
```

## Development

Feel free contributing.

### Running unit tests

```sh
npm test
```

### Build, check linting, run tests

```sh
npm run all
```

## Stack Deployment Behavior

When deploying or updating a stack:
- If `endpoint-id` is specified, the action will only look for existing stacks within that endpoint
- When multiple stacks with the same name exist across different endpoints, the action will correctly target the stack in the specified endpoint
- If no stack is found in the specified endpoint, a new stack will be created

### Parameters

| Input              | Description                                                                                                                                                                  | Required     | Default |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------- |
| portainer-host     | Portainer host, eg. `https://myportainer.instance.com`                                                                                                                       | **Required** |
| username           | Username for the Portainer login. **NOTE: Do not use admin account!** Create a new CI specific login instead                                                                 | **Required** |
| password           | Password for the Portainer login                                                                                                                                             | **Required** |
| swarm-id           | ID of the swarm. Only required if you deploy to a swarm                                                                                                                      |              |
| endpoint-id        | ID of the endpoint to deploy the stack to. When specified, only stacks within this endpoint will be considered for updates. | No | `1` |
| stack-name         | Name for the Portainer stack                                                                                                                                                 | **Required** |
| stack-definition   | The path to the docker-compose stack stack definition file from repo root, eg. `stack-definition.yml`                                                                        | **Required** |
| template-variables | If given, these variables will be replaced in docker-compose file by handlebars                                                                                              |              |
| image              | The URI of the container image to insert into the stack definition, eg. `ghcr.io/username/repo:sha-676cae2`. Will use existing image inside stack definition if not provided |              |
