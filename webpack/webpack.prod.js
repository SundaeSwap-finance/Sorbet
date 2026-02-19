const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'production',
    performance: false,
    optimization: {
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor',
                    chunks(chunk) {
                        return ['popup', 'p2p_popup', 'options', 'log_devtool'].includes(chunk.name);
                    },
                    priority: 10,
                    enforce: true,
                },
            },
        },
    },
});