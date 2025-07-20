# Portainer Stack Deploy

Portainer-stack-deploy is a GitHub Action for deploying a newly updated stack
to a Portainer v2 instance or updating an existing stack with new image tags or
a new stack definition file.

It allows you to manage your Docker Swarm or standalone Docker deployments through
Portainer, making it easier to automate your deployment workflows.

> This action works with Portainer v2 and was **updated** to support Portainer
> Versions v2.27 and above.

## Features

- **Deploy new stacks** with a compose file
- **Update existing stacks** with a new compose file
- **Update image tags** in existing stacks without providing a compose file
- **Multi-endpoint support** - target specific Portainer endpoints
- **Template variable replacement** using Handlebars syntax in your compose files
- **Docker Swarm and Standalone Compose support**

## Action Inputs

| Input              | Description                                                                                                   | Required     | Default |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------ | ------- |
| portainer-host     | Portainer host, eg. `https://myportainer.instance.com`                                                        | **Required** |         |
| token              | Access Token for the Portainer API                                                                            | **Required** |         |
| swarm-id           | SwarmId. Only required if you deploy to a swarm                                                               | No           |         |
| endpoint-id        | ID of the endpoint to deploy the stack to. Only stacks within this endpoint will be considered for updates    | No           | `1`     |
| stack-name         | Name of the Portainer stack                                                                                   | **Required** |         |
| stack-definition   | The path to the compose file, eg. `docker-compose.yml`. Optional if using tag-replacements on existing stacks | No           |         |
| template-variables | If given, these variables will be replaced in a compose file by handlebars. See the example below for usage   | No           |         |
| tag-replacements   | Multiline string of image:tag replacements for updating image tags in compose files.                          | No           |         |

## Example

The example below shows how the `portainer-stack-deploy` action can be used to
deploy a fresh version of your app to Portainer using ghcr.io.

```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

env:
  IMAGE_NAME: user/my-awesome-app
  STACK_NAME: my-awesome-app

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Registry
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGENAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest

      - name: Build and push ${{ matrix.component }}
        uses: docker/build-push-action@v6
        with:
          push: true
          platforms: linux/amd64
          file: ./Dockerfile
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

      - name: Sleep for 5 seconds
        run: sleep 5
        shell: bash

      - name: Deploy stack to Portainer
        uses: robin-moser/portainer-stack-deploy@v1
        with:
          portainer-host: ${{ secrets.PORTAINER_HOST }}
          token: ${{ secrets.PORTAINER_API_KEY }}
          stack-name: ${{ env.STACK_NAME }}
          stack-definition: 'docker/docker-compose.yml'
          template-variables: '{"branch": "${{ github.ref }}"}'
          tag-replacements: |
            user/my-awesome-app:${{ steps.meta.outputs.version }}
            redis:7.0
```

The `docker/stack-compose.yml` file might look like this:

```yaml
version: '3.8'

services:
  server:
    image: user/my-awesome-app:placeholder # gets replaced with the tag from the metadata action
    environment:
      - BRANCH={{branch}} # gets replaced with the branch name

  redis:
    image: redis:placeholder # gets replaced with the tag 7.0
```

## Tag Replacements Example

You can update image tags in existing stacks without providing a new stack
definition file. This is useful when you don't track you compose files in the
same repository where you build your images.

Every image that matches the base name (without the tag) gets the new tag.
It's possible to provide multiple replacements for different images.

```yaml
- name: Update stack with new image tags
  uses: robin-moser/portainer-stack-deploy@v1
  with:
    portainer-host: ${{ secrets.PORTAINER_HOST }}
    token: ${{ secrets.PORTAINER_API_KEY }}
    stack-name: 'my-awesome-app'
    tag-replacements: |
      user/my-awesome-app:${{ steps.meta.outputs.version }}
      redis:7.0
```

This will update the existing stack by replacing:

- Any `user/my-awesome-app:*` image with `my-awesome-app:${{ steps.meta.outputs.version }}`
- Any `redis:*` image with `redis:7.0`

## Development and Testing

### Test Types

There are two types of testing supported:

#### 1. Unit Tests (Default)

- Use mocked HTTP requests via [nock](https://github.com/nock/nock)
- Don't connect to real services
- Fast and safe to run anywhere
- Default test configuration

#### 2. Integration Tests

- Connect to a real Portainer instance
- Actually deploy and manage stacks
- ** WARNING**: Will create, update, and delete stacks on your Portainer instance
- Only run against test/development Portainer instances

### Running Tests

```sh
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Build, check linting, run tests
npm run all
```

### Integration Test Setup

#### Prerequisites

1. **Portainer Instance**: Running Portainer instance (Community or Business Edition)
2. **Docker Swarm**: Required for swarm stack tests - run `docker swarm init` if needed
3. **API Access**: Valid Portainer API token with stack management permissions

#### Single Instance Testing

1. Configure `__tests__/.env` with your Portainer details:

   ```env
   INTEGRATION_PORTAINER_HOST=http://localhost:9000
   INTEGRATION_PORTAINER_TOKEN=ptr_XXX
   INTEGRATION_PORTAINER_ENDPOINT_ID=1
   INTEGRATION_CLEANUP_AFTER_TEST=1
   ```

2. Run integration tests:
   ```sh
   npm run test:integration
   ```

#### Multi-Version Testing (Automated)

For comprehensive testing against multiple Portainer versions (2.11, 2.15, 2.19, 2.27):

1. **Initialize Docker Swarm**:

   ```sh
   docker swarm init
   ```

2. **Deploy Portainer Matrix**:

   ```sh
   docker stack deploy -c __tests__/portainer-matrix-compose.yml portainer-matrix
   ```

3. **Wait for Stack to Start**:

   ```sh
   docker stack ps portainer-matrix
   ```

4. **Run Automated Tests**:

   ```sh
   cd __tests__
   ./portainer-matrix-testall.sh
   ```

5. **Cleanup**:
   ```sh
   docker stack rm portainer-matrix
   ```

The automated script will:

- Test against Portainer instances on ports 16000-16003
- Automatically create CI users and API tokens
- Run integration tests against each version
- Clean up tokens after testing

#### What Integration Tests Do

1. **API Connectivity**: Verifies connection and authentication
2. **Deploy New Stacks**: Creates Docker Compose and Swarm stacks
3. **Update Existing Stacks**: Modifies stacks with new configuration
4. **Template Variables**: Tests Handlebars template variable substitution
5. **Tag Replacements**: Tests image tag updating functionality
