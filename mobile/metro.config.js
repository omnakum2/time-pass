// Metro config for the Bid Club mobile app inside the npm-workspaces monorepo.
// Expo SDK 57's getDefaultConfig auto-detects the workspace root and sets up
// watchFolders + node resolution, so we only widen watching to the repo root to
// pick up the pure-TS `shared` package.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
