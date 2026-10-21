// Configuration Metro pour monorepo : surveille la racine et résout les paquets partagés.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// @dala/shared expose ses sources TypeScript via le champ "react-native".
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
