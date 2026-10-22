import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    files: [
      "src/App.tsx",
      "src/model.ts",
      "src/catalog.ts",
      "src/icons.tsx",
      "src/text-template.ts",
      "src/auto/**/*.ts",
      "src/editor/**/*.tsx",
      "src/effects/catalog.ts",
      "src/panels/**/*.tsx",
    ],
    rules: {
      // These files are the web UI and serializable editing data, not video frames.
      "@remotion/warn-native-media-tag": "off",
      "@remotion/non-pure-animation": "off",
    },
  },
];
