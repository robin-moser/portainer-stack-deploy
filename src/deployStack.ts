import { PortainerApi } from './api'
import path from 'path'
import fs from 'fs'
import Handlebars from 'handlebars'
import * as core from '@actions/core'

type DeployStack = {
  portainerHost: string
  token: string
  swarmId?: string
  endpointId: number
  stackName: string
  stackDefinitionFile?: string
  templateVariables?: object
  tagReplacements?: string
}

export enum StackType {
  SWARM = 1,
  COMPOSE = 2
}

function generateNewStackDefinition(
  stackDefinitionFile: string,
  templateVariables?: object
): string {
  const stackDefFilePath = path.join(process.env.GITHUB_WORKSPACE as string, stackDefinitionFile)
  core.info(`Reading stack definition file from ${stackDefFilePath}`)
  let stackDefinition = fs.readFileSync(stackDefFilePath, 'utf8')
  if (!stackDefinition) {
    throw new Error(`Could not find stack-definition file: ${stackDefFilePath}`)
  }

  if (templateVariables) {
    core.info(`Applying template variables for keys: ${Object.keys(templateVariables)}`)
    stackDefinition = Handlebars.compile(stackDefinition)(templateVariables)
  }

  return stackDefinition
}

function replaceImageTags(stackDefinition: string, imageTags: string): string {
  // imagetags is a multiline string in the format "imageName:newTag\nimageName2:newTag2"
  const lines = imageTags
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  for (const line of lines) {
    const [imageName, newTag] = line.split(':')
    if (imageName && newTag) {
      const imageRegex = new RegExp(`(\\s+image:\\s+)${imageName}(:[^\\s]*)?`, 'g')
      stackDefinition = stackDefinition.replace(imageRegex, `$1${imageName}:${newTag}`)
    }
  }

  return stackDefinition
}

export async function deployStack({
  portainerHost,
  token,
  swarmId,
  endpointId,
  stackName,
  stackDefinitionFile,
  templateVariables,
  tagReplacements
}: DeployStack): Promise<void> {
  const portainerApi = new PortainerApi(portainerHost)
  await portainerApi.useToken(token)
  core.info(`Using host: ${portainerHost}`)

  try {
    if (!stackDefinitionFile && !tagReplacements) {
      throw new Error('Either stackDefinitionFile or tagReplacements must be provided')
    }

    const allStacks = await portainerApi.getStacks(endpointId, swarmId)
    const existingStack = allStacks.find(s => s.Name === stackName)

    if (!stackDefinitionFile && !existingStack) {
      throw new Error(
        `No stack definition file provided and no existing stack found with name: ${stackName}`
      )
    }

    let stackDefinitionToDeploy: string

    // If stackDefinitionFile is provided, parse it and generate the new stack definition
    if (stackDefinitionFile) {
      core.info(`Using stack definition file: ${stackDefinitionFile}`)
      stackDefinitionToDeploy = generateNewStackDefinition(stackDefinitionFile, templateVariables)
    } else {
      if (!existingStack) {
        throw new Error(
          `No stack definition file provided and no existing stack found with name: ${stackName}`
        )
      }
      core.info(`No stack definition file provided. Will use existing stack definition.`)
      const stackFile = await portainerApi.getStackFile(existingStack.Id)
      stackDefinitionToDeploy = stackFile.StackFileContent
    }

    // console.log(`Stack definition to deploy: ${stackDefinitionToDeploy}`)
    // If tagReplacements is provided, replace the image tags in the stack definition
    if (tagReplacements) {
      core.info(`Using image tag replacements: ${tagReplacements}`)
      stackDefinitionToDeploy = replaceImageTags(stackDefinitionToDeploy, tagReplacements)
    }

    // console.log(stackDefinitionToDeploy)

    if (existingStack) {
      core.info(`Found existing stack with name: ${stackName} in endpoint: ${endpointId}`)
      core.info('Updating existing stack...')
      await portainerApi.updateStack(
        existingStack.Id,
        { endpointId: existingStack.EndpointId },
        {
          env: existingStack.Env,
          stackFileContent: stackDefinitionToDeploy,
          pullImage: true,
          prune: true
        }
      )
      core.info('Successfully updated existing stack')
    } else {
      core.info('Deploying new stack...')
      await portainerApi.createStack(
        {
          type: swarmId ? StackType.SWARM : StackType.COMPOSE,
          method: 'string',
          endpointId: endpointId
        },
        {
          name: stackName,
          stackFileContent: stackDefinitionToDeploy,
          swarmID: swarmId ? swarmId : undefined
        }
      )
      core.info(`Successfully created new stack with name: ${stackName}`)
    }
  } catch (error) {
    throw new Error(
      `Failed to deploy stack: ${stackName} on endpoint: ${endpointId}. Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}
