import { readFileSync } from 'node:fs'

const fail = (message) => {
  console.error(`eshobe.theme.json: ${message}`)
  process.exitCode = 1
}

let manifest
try {
  manifest = JSON.parse(readFileSync(new URL('../eshobe.theme.json', import.meta.url), 'utf8'))
} catch (error) {
  fail(error instanceof Error ? error.message : 'is not valid JSON')
  process.exit()
}

const build = manifest.build
if (!build || typeof build !== 'object') fail('build must be an object')
if (!Number.isInteger(Number(build?.port)) || Number(build?.port) < 1 || Number(build?.port) > 65535) {
  fail('build.port must be an integer from 1 to 65535')
}
if (build?.healthCheckPath !== '/api/health') fail('build.healthCheckPath must be /api/health')
if (build?.buildPack !== 'dockerfile' || build?.dockerfileLocation !== 'Dockerfile') {
  fail('build must use the repository Dockerfile')
}

const deployment = manifest.deployment
const expectedImage = 'ghcr.io/hamidnoshady/cms-portfolio-theme'
if (!deployment || typeof deployment !== 'object') fail('deployment must be an object')
if (deployment?.strategy !== 'registry_image') fail('deployment.strategy must be registry_image')
if (deployment?.registryProvider !== 'ghcr') fail('deployment.registryProvider must be ghcr')
if (deployment?.registryImageRepository !== expectedImage) {
  fail(`deployment.registryImageRepository must be ${expectedImage}`)
}
if (!['public', 'private'].includes(deployment?.registryVisibility)) {
  fail('deployment.registryVisibility must be public or private')
}

if (!manifest.proxiesApi) fail('proxiesApi must be true for direct/Coolify deployments')
if (!manifest.settings || Array.isArray(manifest.settings) || typeof manifest.settings !== 'object') {
  fail('settings must be an object keyed by setting name')
}

if (process.exitCode) process.exit(process.exitCode)
console.log('eshobe.theme.json is valid for the Eshobe registry-image contract')
