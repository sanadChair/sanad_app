const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// roslib optionally `import("ws")`, which needs Node built-ins (stream, etc.)
// that do not exist in React Native. Always use the platform WebSocket.
const shims = {
  ws: path.join(__dirname, 'shims/ws.js'),
  stream: path.join(__dirname, 'shims/stream.js'),
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...shims,
};

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (Object.prototype.hasOwnProperty.call(shims, moduleName)) {
    return { type: 'sourceFile', filePath: shims[moduleName] };
  }
  // fast-png does `new TextDecoder('latin1')` at module scope, but Expo's
  // TextDecoder only accepts UTF-8 labels — this crashes native startup
  // as soon as roslib (and thus MapService) is imported.
  const origin = context.originModulePath || '';
  if (
    origin.includes(`${path.sep}fast-png${path.sep}`) &&
    (moduleName === './helpers/text.js' || moduleName.endsWith('/helpers/text.js'))
  ) {
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, 'shims', 'fast-png-text.js'),
    };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
