module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 57) automatically applies the react-native-worklets
  // Babel plugin required by Reanimated 4 — do not add it again here or it warns.
  return {
    presets: ['babel-preset-expo'],
  };
};
