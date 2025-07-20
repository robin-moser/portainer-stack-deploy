import { config } from 'dotenv'
import { join } from 'path'
import axios from 'axios'
import { StackData } from '../src/api'

// Load integration test environment variables
config({ path: join(__dirname, '.env') })

export interface IntegrationConfig {
  cleanupStacks: number
  portainerHost: string
  portainerToken: string
  endpointId: number
  stackDefinitionFile: string
  stackDefinitionUpdateFile: string
  stackDefinitionTemplateFile: string
  tagReplacements: string
  templateVariables: {
    user: string
    image: string
  }
}

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Required environment variable ${key} is not set. Please create __tests__/.env file with integration test configuration.`
    )
  }
  return value
}

function getRequiredNumberEnv(key: string): number {
  const value = getRequiredEnv(key)
  const parsed = parseInt(value)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`)
  }
  return parsed
}

export async function getSwarmId(
  portainerHost: string,
  token: string,
  endpointId: number
): Promise<string> {
  try {
    const response = await axios.get(`${portainerHost}/api/endpoints/${endpointId}/docker/swarm`, {
      headers: {
        'X-API-KEY': token
      }
    })
    return response.data.ID
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch swarm ID from ${portainerHost}/api/endpoints/${endpointId}/docker/swarm: ${error.message}`
      )
    }
    throw error
  }
}

export async function cleanupStack(
  portainerHost: string,
  token: string,
  endpointId: number,
  stackName: string,
  swarmId?: string
): Promise<void> {
  try {
    let response

    if (swarmId) {
      // For Swarm stacks, filter by SwarmID
      response = await axios.get(`${portainerHost}/api/stacks`, {
        headers: {
          'X-API-KEY': token
        },
        params: {
          filters: JSON.stringify({ SwarmID: swarmId })
        }
      })
    } else {
      // For Compose stacks, filter by EndpointId
      response = await axios.get(`${portainerHost}/api/stacks`, {
        headers: {
          'X-API-KEY': token
        },
        params: {
          filters: JSON.stringify({ EndpointId: endpointId })
        }
      })
    }

    const stack = response.data.find((s: StackData) => s.Name === stackName)
    if (stack) {
      console.log(`Cleaning up stack: ${stackName} (ID: ${stack.Id})`)
      await axios.delete(`${portainerHost}/api/stacks/${stack.Id}`, {
        headers: {
          'X-API-KEY': token
        },
        params: {
          endpointId: endpointId
        }
      })
    }
  } catch (error) {
    // Stack might not exist, which is fine for cleanup
    console.log(`Cleanup note: Could not remove stack ${stackName} (may not exist)`)
  }
}

export async function getStacksByFilter(
  portainerHost: string,
  token: string,
  endpointId?: number,
  swarmId?: string
): Promise<StackData[]> {
  let response

  if (swarmId) {
    // For Swarm stacks, filter by SwarmID
    response = await fetch(
      `${portainerHost}/api/stacks?filters=${encodeURIComponent(
        JSON.stringify({ SwarmID: swarmId })
      )}`,
      {
        headers: {
          'X-API-KEY': token
        }
      }
    )
  } else if (endpointId) {
    // For Compose stacks, filter by EndpointId
    response = await fetch(
      `${portainerHost}/api/stacks?filters=${encodeURIComponent(
        JSON.stringify({ EndpointId: endpointId })
      )}`,
      {
        headers: {
          'X-API-KEY': token
        }
      }
    )
  } else {
    // Don't filter stacks at all
    response = await fetch(`${portainerHost}/api/stacks`, {
      headers: {
        'X-API-KEY': token
      }
    })
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch stacks: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

export const integrationConfig: IntegrationConfig = {
  cleanupStacks: getRequiredNumberEnv('INTEGRATION_CLEANUP_AFTER_TEST'),
  // Portainer configuration
  portainerHost: getRequiredEnv('INTEGRATION_PORTAINER_HOST'),
  portainerToken: getRequiredEnv('INTEGRATION_PORTAINER_TOKEN'),
  endpointId: getRequiredNumberEnv('INTEGRATION_PORTAINER_ENDPOINT_ID'),
  // Stack configuration
  stackDefinitionFile: getRequiredEnv('INTEGRATION_TEST_STACK_DEFINITION_FILE'),
  stackDefinitionUpdateFile: getRequiredEnv('INTEGRATION_TEST_STACK_DEFINITION_UPDATE_FILE'),
  stackDefinitionTemplateFile: getRequiredEnv('INTEGRATION_TEST_STACK_DEFINITION_TEMPLATE_FILE'),

  tagReplacements: getRequiredEnv('INTEGRATION_TEST_TAG_REPLACEMENTS'),
  templateVariables: {
    user: getRequiredEnv('INTEGRATION_TEST_TEMPLATE_USER'),
    image: getRequiredEnv('INTEGRATION_TEST_TEMPLATE_IMAGE')
  }
}
