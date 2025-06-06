import * as fs from 'fs';
import * as path from 'path';
import { walkSync } from '@nodelib/fs.walk';

/* ---------- CLI 颜色 ---------- */
const c = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

console.log(`${c.bright}${c.blue}开始修复 TypeScript 类型导入问题...${c.reset}\n`);

/* ---------- 1. 收集所有导出类型 ---------- */
const tsFiles = walkSync('lib', {
    entryFilter: e => e.name.endsWith('.ts') || e.name.endsWith('.tsx')
});

console.log(`${c.cyan}发现 ${tsFiles.length} 个 TypeScript 文件${c.reset}`);

const exportedTypes = new Map<string, Set<string>>();

console.log(`\n${c.cyan}第一步：收集所有导出的类型...${c.reset}`);
const projectRoot = process.cwd();   // ← 新增

for (const file of tsFiles) {
    const filePath = path.posix.relative(
        projectRoot,
        path.posix.normalize(file.path)
    );

    const content = fs.readFileSync(filePath, 'utf8');

    const typeMatches =
        content.matchAll(/export\s+(?:type|interface|enum)\s+(\w+)/g);

    const names = new Set<string>();
    for (const [, name] of typeMatches) names.add(name);

    if (names.size) {
        exportedTypes.set(filePath, names);
        console.log(`  ${c.dim}${filePath}${c.reset}: ${[...names].join(', ')}`);
    }
}

/* ---------- 2. 修复导入语句 ---------- */
console.log(`\n${c.cyan}第二步：修复文件中的类型导入...${c.reset}`);

let fixedFileCount = 0;
let fixedImportCount = 0;

const importRegex =
    /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"][ \t]*;?/g;

for (const file of tsFiles) {
    const filePath = path.posix.normalize(file.path);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    const matches = [...content.matchAll(importRegex)];
    if (matches.length) {
        console.log(
            `  -> ${matches.length} 条导入候选 in ${path.relative(process.cwd(), filePath)}`
        );
    }

    content = content.replace(importRegex, (full, isType, clause, modPath) => {
        // 已经是 import type，直接跳过
        if (isType) return full;

        // 分析 import 子句
        // 可能出现: 默认导入 + 命名导入
        // 先把命名导入部分拿出来
        let defaultImport = '';
        let namedPart = '';

        const parts = clause.split('{');
        if (parts.length === 2) {
            defaultImport = parts[0].trim().replace(/,$/, '');
            namedPart = parts[1].replace(/}$/, '').trim();
        } else {
            // 只有命名或只有默认
            if (clause.includes('{')) {
                namedPart = clause.replace(/[{}]/g, '').trim();
            } else {
                defaultImport = clause.trim();
            }
        }

        // 解析 import 路径 → 先绝对，再转为相对工程根目录
        const resolvedAbs = path.posix.normalize(
            path.resolve(path.dirname(filePath), modPath)
        );
        const resolved = path.posix.relative(projectRoot, resolvedAbs);

        const probes = [
            resolved,
            `${resolved}.ts`,
            `${resolved}.tsx`,
            `${resolved}.d.ts`,
            `${resolved}/index.ts`,
            `${resolved}/index.tsx`
        ];

        const matched = [...exportedTypes].find(([p]) =>
            probes.some(probe => p === probe || p.startsWith(`${probe}/`))
        );

        if (!matched) return full;          // 不是本仓库内部文件，跳过

        const [, typeSet] = matched;

        // 把命名导入拆分并分类
        const namedImports = namedPart
            ? namedPart.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        const typeImports: string[] = [];
        const valueImports: string[] = [];

        for (const imp of namedImports) {
            // 处理别名: X as Y
            const [orig] = imp.split(/\s+as\s+/);
            if (typeSet.has(orig)) typeImports.push(imp);
            else valueImports.push(imp);
        }

        if (!typeImports.length) return full;   // 没有类型要拆分

        /* ---------- 生成替换文本 ---------- */
        const lines: string[] = [];

        // 保留默认导入 / 值命名导入
        if (defaultImport || valueImports.length) {
            const named = valueImports.length ? ` { ${valueImports.join(', ')} }` : '';
            lines.push(`import ${[defaultImport, named].filter(Boolean).join(',')} from '${modPath}';`);
        }

        // 类型导入
        lines.push(`import type { ${typeImports.join(', ')} } from '${modPath}';`);

        fixedImportCount++;
        modified = true;

        console.log(`  ${c.green}修复${c.reset} ${c.dim}${filePath}${c.reset}`);
        console.log(`    ${c.yellow}原:${c.reset} ${full.trim()}`);
        console.log(`    ${c.green}新:${c.reset} ${lines.join(' ')}`);

        return lines.join('\n');
    });

    if (modified) {
        fs.writeFileSync(filePath, content);
        fixedFileCount++;
    }
}

console.log(`\n${c.bright}${c.green}修复完成！${c.reset}`);
console.log(`  共修改 ${fixedFileCount} 个文件，${fixedImportCount} 处导入`);
console.log(`  如仍有构建错误，可再执行：${c.yellow}npm run vite:build${c.reset}\n`);
