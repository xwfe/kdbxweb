import { defineConfig } from 'vite';
import path from 'path';
import { createFilter } from '@rollup/pluginutils';
import * as pkg from './package.json';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';
import dts from 'vite-plugin-dts'

const mode = (process.env.NODE_ENV === 'production') ? 'prod' : 'debug'
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
        }),
        dts({
            tsconfigPath: path.join(
                'conf',
                `tsconfig.build-${mode}.json`
            ),
            entryRoot: './lib',
            outDir: './dist/types',
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
