const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const srcDir = path.join(__dirname, "..", "src");

module.exports = {
  entry: {
    popup: path.join(srcDir, "popup.tsx"),
    options: path.join(srcDir, "options.tsx"),
    background: path.join(srcDir, "background.ts"),
    content_script: path.join(srcDir, "content_script.ts"),
    injectedScript: path.join(srcDir, "injectedScript.ts"),
    devtools: path.join(srcDir, "devtools/index.ts"),
    log_devtool: path.join(srcDir, "devtools/log_devtool.tsx"),
  },
  output: {
    path: path.join(__dirname, "../dist/js"),
    filename: "[name].js",
    clean: true,
  },
  experiments: {
    topLevelAwait: true,
    asyncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.(m?js|ts)x?$/,
        exclude: /node_modules/,
        use: {
          loader: "swc-loader",
          options: {
            jsc: {
              target: "es2020",
              transform: {
                react: {
                  runtime: "automatic",
                },
              },
              parser: {
                syntax: "typescript",
                tsx: true,
                dynamicImport: true,
                useBuiltIns: true,
              },
            },
          },
        },
      }
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    fallback: {
      buffer: require.resolve("buffer"),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: ".", to: "../", context: "public" }],
      options: {},
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
};
