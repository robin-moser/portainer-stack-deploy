import nock from 'nock'
import { deployStack } from '../src/deployStack'

jest.mock('@actions/core')

process.env.GITHUB_WORKSPACE = './'

const BASE_API_URL = 'http://mock.url/api'

describe('deployStack', () => {
  beforeEach(() => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .get('/stacks')
      .reply(200, [
        { Id: 2, Name: 'stack-name', EndpointId: 1 },
        {
          Id: 3,
          Name: 'stack-name-with-env',
          EndpointId: 1,
          Env: [{ name: 'keyName', value: 'value1' }]
        }
      ])
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test('deploy swarm stack', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .post('/stacks')
      .query({
        type: 1,
        method: 'string',
        endpointId: 1
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      swarmId: 's4ny2nh7qt8lluhvddeu9ulwl',
      endpointId: 1,
      stackName: 'new-stack-name',
      stackDefinitionFile: 'example-stack-definition.yml',
      image: 'ghcr.io/username/repo:sha-0142c14'
    })

    nock.isDone()
  })

  test('deploy compose stack', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .post('/stacks')
      .query({
        type: 2,
        method: 'string',
        endpointId: 1
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      endpointId: 1,
      stackName: 'new-compose-stack-name',
      stackDefinitionFile: 'example-stack-definition.yml',
      image: 'ghcr.io/username/repo:sha-0142c14'
    })

    nock.isDone()
  })

  test('deploy existing stack', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .put('/stacks/2')
      .query({
        endpointId: 1
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      endpointId: 1,
      stackName: 'stack-name',
      stackDefinitionFile: 'example-stack-definition.yml',
      image: 'ghcr.io/username/repo:sha-0142c14'
    })

    nock.isDone()
  })

  test('deploy existing stack with env', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .put('/stacks/3')
      .query({
        endpointId: 1
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      endpointId: 1,
      stackName: 'stack-name-with-env',
      stackDefinitionFile: 'example-stack-definition.yml',
      image: 'ghcr.io/username/repo:sha-0142c14'
    })

    nock.isDone()
  })

  test('deploy with explicit endpoint id', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .post('/stacks')
      .query({
        type: 2,
        method: 'string',
        endpointId: 2
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      endpointId: 2,
      stackName: 'new-stack-name',
      stackDefinitionFile: 'example-stack-definition.yml',
      image: 'ghcr.io/username/repo:sha-0142c14'
    })

    nock.isDone()
  })

  test('deploy without specific image', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .post('/stacks')
      .query({
        type: 2,
        method: 'string',
        endpointId: 1
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      endpointId: 1,
      stackName: 'new-stack-name',
      stackDefinitionFile: 'example-stack-definition.yml'
    })

    nock.isDone()
  })

  test('deploy with template variables', async () => {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', 'token')
      .matchHeader('content-type', 'application/json')
      .post('/stacks')
      .query({
        type: 2,
        method: 'string',
        endpointId: 1
      })
      .reply(200)

    await deployStack({
      portainerHost: 'http://mock.url',
      token: 'token',
      endpointId: 1,
      stackName: 'new-stack-name',
      stackDefinitionFile: 'example-stack-definition-with-template-variables.yml',
      templateVariables: { username: 'testUsername' }
    })

    nock.isDone()
  })
})
