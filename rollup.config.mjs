import json from "@rollup/plugin-json";

export default {
  input: "./src/runCreate3dtiles.mjs",
  output: {
    file: "./dist/runCreate3dtiles.js",
    format: 'cjs'
  },
  plugins: [json()]
}