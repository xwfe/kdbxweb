import { defineConfig } from 'vite';
import path from 'path';
import { createFilter } from '@rollup/pluginutils';
import * as pkg from './package.json';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';

// 自定义插件：在构建过程中修改文件中的 `// node:buffer`
function mpPolyfillPlugin() {
    const filter = createFilter('**/*.{js,ts}', 'node_modules/**');

    return {
        name: 'add-console-log',
        transform(code, id) {
            if (!filter(id)) return;

            // @zxing/text-encoding
            if (code.includes('// node:stream')) {
                return code.replace(
                    /\/\/ node:buffer/g,
                    "console.log('// node:stream'); // node:stream"
                );
            }
        }
    };
}

// Vite 配置
export default defineConfig({
    plugins: [
        inject({
            TextEncoder: ['@zxing/text-encoding', 'TextEncoder'],
            TextDecoder: ['@zxing/text-encoding', 'TextDecoder']
        }),
        // Node.js polyfills 插件
        nodePolyfills({
            include: ['stream']
        })
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, 'lib/index.ts'),
            name: 'kdbxweb',
            fileName: (format) => `kdbxweb.${format}.js`
        },
        sourcemap: false,
        rollupOptions: {
            external: ['@xmldom/xmldom'],
            output: {
                globals: {
                    zlib: 'zlib',
                    '@xmldom/xmldom': 'xmldom'
                },
                banner: `/* kdbxweb v${pkg.version}, (c) ${new Date().getFullYear()} ${pkg.author.name}, opensource.org/licenses/${pkg.license} */`
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './')
        }
    }
});
