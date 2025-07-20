import nock from 'nock'
import { deployStack, StackType } from '../src/deployStack'
import { StackData } from '../src/api'

jest.mock('@actions/core')

process.env.GITHUB_WORKSPACE = './'

// Mock configuration matching integration test structure
const mockConfig = {
  portainerHost: 'http://mock.portainer',
  portainerToken: 'mock-token',
  endpointId: 1,
  stackDefinitionFile: '__tests__/data/compose-definition.yml',
  stackDefinitionUpdateFile: '__tests__/data/compose-definition-update.yml',
  stackDefinitionTemplateFile: '__tests__/data/compose-definition-template.yml',
  tagReplacements: 'alpine:3.20\nbusybox:1.37.0',
  templateVariables: {
    user: 'nobody',
    image: 'nginx:latest'
  }
}

const BASE_API_URL = 'http://mock.portainer/api'

describe('deployStack Unit Tests', () => {
  const mockSwarmId = 'mock-swarm-id-123'

  beforeEach(() => {
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  // Helper function to setup basic stack listing mock
  function mockGetStacks(stacks: StackData[] = [], swarmId?: string): void {
    const filters = swarmId ? { SwarmId: swarmId } : { EndpointId: mockConfig.endpointId }

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .get('/stacks')
      .query({ filters: JSON.stringify(filters) })
      .reply(200, stacks)
  }

  // Helper function to setup stack file content mock
  function mockGetStackFile(stackId: number, content: string): void {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .get(`/stacks/${stackId}/file`)
      .reply(200, { StackFileContent: content })
  }

  // Helper function to setup version mock (for newer Portainer versions)
  function mockGetVersion(version = '2.20.0'): void {
    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .get('/system/status')
      .reply(200, { Version: version })
  }

  test('should deploy a new compose stack', async () => {
    mockGetStacks([])
    mockGetVersion()

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks/create/standalone/string')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200, { Id: 1, Name: 'test-compose-stack' })

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'test-compose-stack',
      stackDefinitionFile: mockConfig.stackDefinitionFile
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should deploy a new swarm stack', async () => {
    mockGetStacks([], mockSwarmId)
    mockGetVersion()

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks/create/swarm/string')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200, { Id: 1, Name: 'test-swarm-stack' })

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      swarmId: mockSwarmId,
      stackName: 'test-swarm-stack',
      stackDefinitionFile: mockConfig.stackDefinitionFile
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should update an existing compose stack', async () => {
    const existingStack: StackData = {
      Id: 2,
      Name: 'existing-compose-stack',
      EndpointId: mockConfig.endpointId,
      Type: StackType.COMPOSE,
      Env: []
    }

    mockGetStacks([existingStack])

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .put('/stacks/2')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200)

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'existing-compose-stack',
      stackDefinitionFile: mockConfig.stackDefinitionUpdateFile
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should update an existing swarm stack', async () => {
    const existingStack: StackData = {
      Id: 3,
      Name: 'existing-swarm-stack',
      EndpointId: mockConfig.endpointId,
      Type: StackType.SWARM,
      Env: []
    }

    mockGetStacks([existingStack], mockSwarmId)

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .put('/stacks/3')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200)

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      swarmId: mockSwarmId,
      stackName: 'existing-swarm-stack',
      stackDefinitionFile: mockConfig.stackDefinitionUpdateFile
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should deploy compose stack with template variables', async () => {
    mockGetStacks([])
    mockGetVersion()

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks/create/standalone/string')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200, { Id: 4, Name: 'template-stack' })

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'template-stack',
      stackDefinitionFile: mockConfig.stackDefinitionTemplateFile,
      templateVariables: mockConfig.templateVariables
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should deploy swarm stack with template variables', async () => {
    mockGetStacks([], mockSwarmId)
    mockGetVersion()

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks/create/swarm/string')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200, { Id: 5, Name: 'swarm-template-stack' })

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      swarmId: mockSwarmId,
      stackName: 'swarm-template-stack',
      stackDefinitionFile: mockConfig.stackDefinitionTemplateFile,
      templateVariables: mockConfig.templateVariables
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should update existing stack with tag replacements', async () => {
    const existingStack: StackData = {
      Id: 6,
      Name: 'tag-replacement-stack',
      EndpointId: mockConfig.endpointId,
      Type: StackType.COMPOSE,
      Env: []
    }

    const mockStackContent = `version: '3.7'
services:
  first:
    image: alpine:latest
  second:
    image: alpine:latest
  third:
    image: nginx:latest
  fourth:
    image: busybox:latest
  fifth:
    image: busybox:latest`

    mockGetStacks([existingStack])
    mockGetStackFile(6, mockStackContent)

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .put('/stacks/6')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200)

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'tag-replacement-stack',
      tagReplacements: mockConfig.tagReplacements
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should fail when trying tag replacement on non-existing stack', async () => {
    mockGetStacks([])

    await expect(
      deployStack({
        portainerHost: mockConfig.portainerHost,
        token: mockConfig.portainerToken,
        endpointId: mockConfig.endpointId,
        stackName: 'non-existing-stack',
        tagReplacements: mockConfig.tagReplacements
      })
    ).rejects.toThrow(
      'No stack definition file provided and no existing stack found with name: non-existing-stack'
    )

    expect(nock.isDone()).toBe(true)
  })

  test('should deploy to specific endpoint', async () => {
    const alternateEndpointId = 2

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .get('/stacks')
      .query({ filters: JSON.stringify({ EndpointId: alternateEndpointId }) })
      .reply(200, [])

    mockGetVersion()

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks/create/standalone/string')
      .query({ endpointId: alternateEndpointId })
      .reply(200, { Id: 7, Name: 'endpoint-specific-stack' })

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: alternateEndpointId,
      stackName: 'endpoint-specific-stack',
      stackDefinitionFile: mockConfig.stackDefinitionFile
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should handle existing stack with environment variables', async () => {
    const existingStackWithEnv: StackData = {
      Id: 8,
      Name: 'stack-with-env',
      EndpointId: mockConfig.endpointId,
      Type: StackType.COMPOSE,
      Env: [
        { name: 'ENV_VAR_1', value: 'value1' },
        { name: 'ENV_VAR_2', value: 'value2' }
      ]
    }

    mockGetStacks([existingStackWithEnv])

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .put('/stacks/8')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200)

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'stack-with-env',
      stackDefinitionFile: mockConfig.stackDefinitionFile
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should deploy compose stack when no swarmId provided', async () => {
    mockGetStacks([])
    mockGetVersion()

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks/create/standalone/string')
      .query({ endpointId: mockConfig.endpointId })
      .reply(200, { Id: 9, Name: 'compose-stack-no-swarm' })

    // Don't provide swarmId - should create compose stack
    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'compose-stack-no-swarm',
      stackDefinitionFile: mockConfig.stackDefinitionFile
      // no swarmId provided
    })

    expect(nock.isDone()).toBe(true)
  })

  test('should handle older Portainer version (pre-2.19)', async () => {
    mockGetStacks([])
    // Mock older version
    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .get('/system/status')
      .reply(200, { Version: '2.18.0' })

    nock(BASE_API_URL)
      .matchHeader('x-api-key', mockConfig.portainerToken)
      .matchHeader('content-type', 'application/json')
      .post('/stacks')
      .query({
        type: StackType.COMPOSE,
        method: 'string',
        endpointId: mockConfig.endpointId
      })
      .reply(200, { Id: 10, Name: 'legacy-stack' })

    await deployStack({
      portainerHost: mockConfig.portainerHost,
      token: mockConfig.portainerToken,
      endpointId: mockConfig.endpointId,
      stackName: 'legacy-stack',
      stackDefinitionFile: mockConfig.stackDefinitionFile
    })

    expect(nock.isDone()).toBe(true)
  })
})
