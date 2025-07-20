import { deployStack, StackType } from '../src/deployStack'
import { StackData } from '../src/api'
import fs from 'fs'

import {
  integrationConfig,
  getSwarmId,
  cleanupStack,
  getStacksByFilter
} from './integration.config'

import axios from 'axios'
import * as yaml from 'js-yaml'

process.env.GITHUB_WORKSPACE = './'

describe('deployStack Integration Tests', () => {
  // Longer timeout for integration tests
  jest.setTimeout(30000)

  let swarmId: string

  // Helper function to get stack file content
  async function getStackFileContent(stackId: number): Promise<string> {
    const response = await axios.get(
      `${integrationConfig.portainerHost}/api/stacks/${stackId}/file`,
      {
        headers: {
          'X-API-KEY': integrationConfig.portainerToken
        }
      }
    )
    return response.data.StackFileContent
  }

  async function cleanupStacks(): Promise<void> {
    const stacksToCleanup = [
      { name: 'integration-test-compose-stack', isSwarm: false },
      { name: 'integration-test-compose-update-stack', isSwarm: false },
      { name: 'integration-test-compose-template-stack', isSwarm: false },
      { name: 'integration-test-swarm-stack', isSwarm: true },
      { name: 'integration-test-swarm-update-stack', isSwarm: true },
      { name: 'integration-test-swarm-template-stack', isSwarm: true }
    ]

    for (const stack of stacksToCleanup) {
      await cleanupStack(
        integrationConfig.portainerHost,
        integrationConfig.portainerToken,
        integrationConfig.endpointId,
        stack.name,
        stack.isSwarm ? swarmId : undefined
      )
    }
  }

  interface StackFileContent {
    services: {
      [key: string]: {
        image: string
        user?: string
      }
    }
  }

  // Helper function to parse YAML content
  function parseYamlContent(content: string): StackFileContent {
    return yaml.load(content) as StackFileContent
  }

  beforeAll(async () => {
    // Get the swarm ID once for all tests
    swarmId = await getSwarmId(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId
    )
    console.log(`Using Swarm ID: ${swarmId}`)
  })

  beforeAll(async () => {
    // Cleanup any existing stacks before running tests
    await cleanupStacks()
  })

  afterAll(async () => {
    if (integrationConfig.cleanupStacks === 1) {
      await cleanupStacks()
    }
  })

  test('should connect to Portainer API and fetch stacks', async () => {
    // This test verifies basic API connectivity for both types
    const composeStacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId
    )

    const swarmStacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId,
      swarmId
    )

    expect(Array.isArray(composeStacks)).toBe(true)
    expect(Array.isArray(swarmStacks)).toBe(true)
    console.log(
      `Found ${composeStacks.length} compose stacks and ${swarmStacks.length} swarm stacks`
    )
  })

  /**
   * This test deploys a new Compose stack using the provided stack definition file.
   * The deployed yaml should match the original file content.
   */
  test('should deploy a new compose stack', async () => {
    const stackName = 'integration-test-compose-stack'

    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      stackDefinitionFile: integrationConfig.stackDefinitionFile,
      stackName
    })

    // Verify the stack was created (Compose stacks use EndpointId filter)
    const stacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId
    )

    const createdStack = stacks.find((stack: StackData) => stack.Name === stackName)
    expect(createdStack).toBeDefined()

    expect(createdStack?.EndpointId).toBe(integrationConfig.endpointId)
    expect(createdStack?.Type).toBe(StackType.COMPOSE)

    // Verify the stack file content contains the updated image
    const stackDeployedRaw = await getStackFileContent(createdStack!.Id)
    const stackOriginalRaw = await fs.promises.readFile(
      integrationConfig.stackDefinitionFile,
      'utf8'
    )
    expect(stackDeployedRaw).toBe(stackOriginalRaw)
  })

  /**
   * This test deploys a new Compose stack using the provided stack definition file.
   * It then updates the stack with a different file and verifies the content.
   * Finally, it updates the stack again without a file, using image replacements from the config
   * and verifies the images were updated correctly.
   */
  test('should update a new compose stack', async () => {
    const stackName = 'integration-test-compose-update-stack'

    // First, create a stack
    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      stackDefinitionFile: integrationConfig.stackDefinitionFile,
      stackName
    })

    // Then update it with a different stack definition file
    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      stackDefinitionFile: integrationConfig.stackDefinitionUpdateFile,
      stackName
    })

    // Verify the stack was updated by checking the yaml content to the local file
    const stacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId
    )

    const updatedStack = stacks.find((stack: StackData) => stack.Name === stackName)
    expect(updatedStack).toBeDefined()

    const stackUpdatedRaw = await getStackFileContent(updatedStack!.Id)
    const stackUpdateFileRaw = await fs.promises.readFile(
      integrationConfig.stackDefinitionUpdateFile,
      'utf8'
    )
    expect(stackUpdatedRaw).toBe(stackUpdateFileRaw)

    // Update the stack without a file, using image replacements from the config tagReplacements
    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      stackName,
      tagReplacements: integrationConfig.tagReplacements
    })

    // Verify the stack was updated by parsing the yaml content
    const stackAfterTagReplacement = await getStackFileContent(updatedStack!.Id)
    const parsedStack = parseYamlContent(stackAfterTagReplacement)

    // Check that alpine images were updated to 3.20
    // Check that busybox images were updated to 1.37.0
    expect(parsedStack.services.first.image).toBe('alpine:3.20')
    expect(parsedStack.services.second.image).toBe('alpine:3.20')
    expect(parsedStack.services.third.image).toBe('nginx:latest')
    expect(parsedStack.services.fourth.image).toBe('busybox:1.37.0')
    expect(parsedStack.services.fifth.image).toBe('busybox:1.37.0')
  })

  test('should deploy a compose stack with template variables', async () => {
    const stackName = 'integration-test-compose-template-stack'

    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      stackDefinitionFile: integrationConfig.stackDefinitionTemplateFile,
      stackName,
      templateVariables: integrationConfig.templateVariables
    })

    // Verify the stack was created (Compose stacks use EndpointId filter)
    const stacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId
    )

    const createdStack = stacks.find((stack: StackData) => stack.Name === stackName)
    expect(createdStack).toBeDefined()

    expect(createdStack?.EndpointId).toBe(integrationConfig.endpointId)
    expect(createdStack?.Type).toBe(StackType.COMPOSE)

    // Verify that the stack file is deployed with the template variables replaced
    const stackDeployedRaw = await getStackFileContent(createdStack!.Id)
    const stackDeployed = parseYamlContent(stackDeployedRaw)

    // Check that {{user}} was replaced with 'testuser' in the second service
    expect(stackDeployed.services.second.user).toBe(integrationConfig.templateVariables.user)
    // Check that {{image}} was replaced with 'nginx:latest' in the third service
    expect(stackDeployed.services.third.image).toBe(integrationConfig.templateVariables.image)
  })

  /**
   * This test deploys a new Swarm stack using the provided stack definition file.
   * The deployed yaml should match the original file content.
   */
  test('should deploy a new swarm stack', async () => {
    const stackName = 'integration-test-swarm-stack'

    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      swarmId,
      stackDefinitionFile: integrationConfig.stackDefinitionFile,
      stackName
    })

    // Verify the stack was created (Swarm stacks use SwarmId filter)
    const stacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId,
      swarmId
    )

    const createdStack = stacks.find((stack: StackData) => stack.Name === stackName)
    expect(createdStack).toBeDefined()

    expect(createdStack?.EndpointId).toBe(integrationConfig.endpointId)
    expect(createdStack?.Type).toBe(StackType.SWARM)

    // Verify the stack file content contains the updated image
    const stackDeployedRaw = await getStackFileContent(createdStack!.Id)
    const stackOriginalRaw = await fs.promises.readFile(
      integrationConfig.stackDefinitionFile,
      'utf8'
    )
    expect(stackDeployedRaw).toBe(stackOriginalRaw)
  })

  /**
   * This test deploys a new Swarm stack using the provided stack definition file.
   * It then updates the stack with a different file and verifies the content.
   * Finally, it updates the stack again without a file, using image replacements from the config
   * and verifies the images were updated correctly.
   */
  test('should update a new swarm stack', async () => {
    const stackName = 'integration-test-swarm-update-stack'

    // First, create a stack
    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      swarmId,
      stackDefinitionFile: integrationConfig.stackDefinitionFile,
      stackName
    })

    // Then update it with a different stack definition file
    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      swarmId,
      stackDefinitionFile: integrationConfig.stackDefinitionUpdateFile,
      stackName
    })

    // Verify the stack was updated by checking the yaml content to the local file
    const stacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId,
      swarmId
    )

    const updatedStack = stacks.find((stack: StackData) => stack.Name === stackName)
    expect(updatedStack).toBeDefined()

    const stackUpdatedRaw = await getStackFileContent(updatedStack!.Id)
    const stackUpdateFileRaw = await fs.promises.readFile(
      integrationConfig.stackDefinitionUpdateFile,
      'utf8'
    )
    expect(stackUpdatedRaw).toBe(stackUpdateFileRaw)

    // Update the stack without a file, using image replacements from the config tagReplacements
    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      swarmId,
      stackName,
      tagReplacements: integrationConfig.tagReplacements
    })

    // Verify the stack was updated by parsing the yaml content
    const stackAfterTagReplacement = await getStackFileContent(updatedStack!.Id)
    const parsedStack = parseYamlContent(stackAfterTagReplacement)

    // Based on tagReplacements in .env: "alpine:3.20" and "busybox:1.37.0"
    // Check that alpine images were updated to 3.20
    expect(parsedStack.services.first.image).toBe('alpine:3.20')
    expect(parsedStack.services.second.image).toBe('alpine:3.20')

    // Check that busybox images were updated to 1.37.0
    expect(parsedStack.services.fourth.image).toBe('busybox:1.37.0')
    expect(parsedStack.services.fifth.image).toBe('busybox:1.37.0')
  })

  test('should deploy a swarm stack with template variables', async () => {
    const stackName = 'integration-test-swarm-template-stack'

    await deployStack({
      portainerHost: integrationConfig.portainerHost,
      token: integrationConfig.portainerToken,
      endpointId: integrationConfig.endpointId,
      swarmId,
      stackDefinitionFile: integrationConfig.stackDefinitionTemplateFile,
      stackName,
      templateVariables: integrationConfig.templateVariables
    })

    // Verify the stack was created (Swarm stacks use SwarmId filter)
    const stacks = await getStacksByFilter(
      integrationConfig.portainerHost,
      integrationConfig.portainerToken,
      integrationConfig.endpointId,
      swarmId
    )

    const createdStack = stacks.find((stack: StackData) => stack.Name === stackName)
    expect(createdStack).toBeDefined()

    expect(createdStack?.EndpointId).toBe(integrationConfig.endpointId)
    expect(createdStack?.Type).toBe(StackType.SWARM)

    // Verify that the stack file is deployed with the template variables replaced
    const stackDeployedRaw = await getStackFileContent(createdStack!.Id)
    const parsedStack = parseYamlContent(stackDeployedRaw)

    // Based on template variables from config:
    // - username: 'testuser' (should replace {{username}})
    // - image: 'nginx:latest' (should replace {{image}})

    // Check that {{user}} was replaced with 'testuser' in the second service
    expect(parsedStack.services.second.user).toBe(integrationConfig.templateVariables.user)
    // Check that {{image}} was replaced with 'nginx:latest' in the third service
    expect(parsedStack.services.third.image).toBe(integrationConfig.templateVariables.image)
  })
})
