// apps/mobile is NOT an npm workspace (React 19 here, React 18 in apps/web), so Metro is told
// where the shared code lives and to resolve every package from this app's own node_modules.
// `tools/render` is the web app's stitcher (decoded tokens → notes), reused as is — M1, 2026-10-29.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, '../../packages/core');
const stitchRoot = path.resolve(projectRoot, '../../tools/render');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [coreRoot, stitchRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
