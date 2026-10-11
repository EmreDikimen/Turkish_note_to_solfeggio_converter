// apps/mobile is NOT an npm workspace (React 19 here, React 18 in apps/web), so Metro is told
// where the shared core lives and to resolve every package from this app's own node_modules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, '../../packages/core');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [coreRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
