import axios from 'axios'
import * as semver from 'semver'
import { StackType } from './deployStack'

type EnvVariables = Array<{
  name: string
  value: string
}>

type EndpointId = number

export type StackData = {
  Id: number
  Name: string
  EndpointId: EndpointId
  Env: EnvVariables
  Type?: number
}

type CreateStackParams = { type: number; method: string; endpointId: EndpointId }
type CreateStackParamsNew = { endpointId: EndpointId }
type CreateStackBody = { name: string; stackFileContent: string; swarmID?: string }
type UpdateStackParams = { endpointId: EndpointId }
type UpdateStackBody = {
  env: EnvVariables
  stackFileContent: string
  prune: boolean
  pullImage: boolean
}

type StackFileContent = {
  StackFileContent: string
}

export class PortainerApi {
  private axiosInstance

  constructor(host: string) {
    this.axiosInstance = axios.create({
      baseURL: `${host}/api`
    })
  }

  async useToken(token: string): Promise<void> {
    this.axiosInstance.defaults.headers.common['X-API-Key'] = token
  }

  async getStacks(endpointId?: number, swarmId?: string): Promise<StackData[]> {
    let params: Record<string, string> | undefined
    // if swarmId provided, filter by SwarmId (in Swarm mode filters by EndpointId do not work)
    if (swarmId) {
      params = { filters: JSON.stringify({ SwarmId: swarmId }) }
      // else, if endpointId is provided, use it to filter
    } else if (endpointId) {
      params = { filters: JSON.stringify({ EndpointId: endpointId }) }
      // else, no filters
    }
    const { data } = await this.axiosInstance.get<StackData[]>('/stacks', { params })
    return data
  }

  async getVersion(): Promise<string> {
    // first, try if /system/status endpoint is available
    try {
      const { data } = await this.axiosInstance.get<{ Version: string }>('/system/status')
      return data.Version
      // catch 404 error, which indicates that the endpoint does not exist
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        console.error('Error fetching Portainer version:', error)
        throw error
      }
    }
    const { data } = await this.axiosInstance.get<{ Version: string }>('/status')
    return data.Version
  }

  async createStack(params: CreateStackParams, body: CreateStackBody): Promise<void> {
    const version = await this.getVersion()
    // if version is less than 2.19.0, use the old endpoint
    if (semver.lt(version, '2.19.0')) {
      await this.axiosInstance.post('/stacks', body, { params: params })
    } else {
      // create CreateStackParamsNew for new endpoint
      const newParams: CreateStackParamsNew = { endpointId: params.endpointId }
      const type = params.type === StackType.COMPOSE ? 'standalone' : 'swarm'
      const url = '/stacks/create/' + type + '/string'

      console.log('Using new stack creation endpoint:', url)
      await this.axiosInstance.post(url, body, { params: newParams })
    }
  }

  async updateStack(id: number, params: UpdateStackParams, body: UpdateStackBody): Promise<void> {
    await this.axiosInstance.put(`/stacks/${id}`, body, { params: params })
  }

  async getStackFile(id: number): Promise<StackFileContent> {
    const { data } = await this.axiosInstance.get<StackFileContent>(`/stacks/${id}/file`)
    return data
  }
}
