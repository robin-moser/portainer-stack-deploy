"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationConfig = exports.getStacksByFilter = exports.cleanupStack = exports.getSwarmId = void 0;
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const axios_1 = __importDefault(require("axios"));
// Load integration test environment variables
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '.env') });
function getRequiredEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set. Please create __tests__/.env file with integration test configuration.`);
    }
    return value;
}
function getRequiredNumberEnv(key) {
    const value = getRequiredEnv(key);
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
    }
    return parsed;
}
async function getSwarmId(portainerHost, token, endpointId) {
    try {
        const response = await axios_1.default.get(`${portainerHost}/api/endpoints/${endpointId}/docker/swarm`, {
            headers: {
                'X-API-KEY': token
            }
        });
        return response.data.ID;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(`Failed to fetch swarm ID from ${portainerHost}/api/endpoints/${endpointId}/docker/swarm: ${error.message}`);
        }
        throw error;
    }
}
exports.getSwarmId = getSwarmId;
async function cleanupStack(portainerHost, token, endpointId, stackName, swarmId) {
    try {
        let response;
        if (swarmId) {
            // For Swarm stacks, filter by SwarmID
            response = await axios_1.default.get(`${portainerHost}/api/stacks`, {
                headers: {
                    'X-API-KEY': token
                },
                params: {
                    filters: JSON.stringify({ SwarmID: swarmId })
                }
            });
        }
        else {
            // For Compose stacks, filter by EndpointId
            response = await axios_1.default.get(`${portainerHost}/api/stacks`, {
                headers: {
                    'X-API-KEY': token
                },
                params: {
                    filters: JSON.stringify({ EndpointId: endpointId })
                }
            });
        }
        const stack = response.data.find((s) => s.Name === stackName);
        if (stack) {
            console.log(`Cleaning up stack: ${stackName} (ID: ${stack.Id})`);
            await axios_1.default.delete(`${portainerHost}/api/stacks/${stack.Id}`, {
                headers: {
                    'X-API-KEY': token
                },
                params: {
                    endpointId: endpointId
                }
            });
        }
    }
    catch (error) {
        // Stack might not exist, which is fine for cleanup
        console.log(`Cleanup note: Could not remove stack ${stackName} (may not exist)`);
    }
}
exports.cleanupStack = cleanupStack;
async function getStacksByFilter(portainerHost, token, endpointId, swarmId) {
    let response;
    if (swarmId) {
        // For Swarm stacks, filter by SwarmID
        response = await fetch(`${portainerHost}/api/stacks?filters=${encodeURIComponent(JSON.stringify({ SwarmID: swarmId }))}`, {
            headers: {
                'X-API-KEY': token
            }
        });
    }
    else if (endpointId) {
        // For Compose stacks, filter by EndpointId
        response = await fetch(`${portainerHost}/api/stacks?filters=${encodeURIComponent(JSON.stringify({ EndpointId: endpointId }))}`, {
            headers: {
                'X-API-KEY': token
            }
        });
    }
    else {
        // Don't filter stacks at all
        response = await fetch(`${portainerHost}/api/stacks`, {
            headers: {
                'X-API-KEY': token
            }
        });
    }
    if (!response.ok) {
        throw new Error(`Failed to fetch stacks: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}
exports.getStacksByFilter = getStacksByFilter;
exports.integrationConfig = {
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
};
