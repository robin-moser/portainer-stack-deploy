import * as core from '@actions/core'
import axios from 'axios'
import { deployStack } from './deployStack'

export async function run(): Promise<void> {
  try {
    const portainerHost: string = core.getInput('portainer-host', {
      required: true
    })
    const token: string = core.getInput('token', {
      required: true
    })
    const swarmId: string = core.getInput('swarm-id', {
      required: false
    })
    const endpointId: string = core.getInput('endpoint-id', {
      required: false
    })
    const stackName: string = core.getInput('stack-name', {
      required: true
    })
    const stackDefinitionFile: string = core.getInput('stack-definition', {
      required: false
    })
    const templateVariables: string = core.getInput('template-variables', {
      required: false
    })
    const tagReplacements: string = core.getInput('tag-replacements', {
      required: false
    })

    await deployStack({
      portainerHost,
      token,
      swarmId,
      endpointId: parseInt(endpointId) || 1,
      stackName,
      stackDefinitionFile: stackDefinitionFile || undefined,
      templateVariables: templateVariables ? JSON.parse(templateVariables) : undefined,
      tagReplacements: tagReplacements || undefined
    })
    core.info('✅ Deployment done')
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const {
        status,
        data,
        config: { url, method }
      } = error.response
      return core.setFailed(`AxiosError HTTP Status ${status} (${method} ${url}): ${data}`)
    }
    return core.setFailed(error as Error)
  }
}

run()
