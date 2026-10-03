import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientSrc = path.join(repoRoot, 'client', 'src');

function walkSources(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSources(fullPath));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function importSpecifiers(source) {
  const specs = [];
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) specs.push(match[1]);
  for (const match of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(match[1]);
  return specs;
}

function resolvesInsideProduct(specifier, fromFile) {
  if (!specifier.startsWith('.')) return false;
  const resolved = path.normalize(path.join(path.dirname(fromFile), specifier));
  const relative = path.relative(clientSrc, resolved).replaceAll('\\', '/');
  return /^(app\/hooks|app\/services|app\/components)(\/|$)/.test(relative);
}

function exportedStringConstants(source) {
  const constants = {};
  for (const match of source.matchAll(/export const (\w+) = ['"]([^'"]+)['"]/g)) {
    constants[match[1]] = match[2];
  }
  return constants;
}

function routePathToken(token, constants) {
  if (token.startsWith("'") || token.startsWith('"')) return token.slice(1, -1);
  assert.ok(Object.hasOwn(constants, token), `route path ${token} is not an exported string constant`);
  return constants[token];
}

function topLevelRoutes(routerSource) {
  const start = routerSource.indexOf('createBrowserRouter(');
  assert.notEqual(start, -1, 'router.tsx does not call createBrowserRouter');
  const arrayStart = routerSource.indexOf('[', start);
  assert.notEqual(arrayStart, -1);
  const routes = [];
  let depth = 0;
  let objectStart = -1;
  for (let index = arrayStart; index < routerSource.length; index += 1) {
    const character = routerSource[index];
    if (character === '[' || character === '{') {
      if (character === '{' && depth === 1) objectStart = index;
      depth += 1;
    } else if (character === ']' || character === '}') {
      depth -= 1;
      if (character === '}' && depth === 1 && objectStart !== -1) {
        routes.push(routerSource.slice(objectStart, index + 1));
        objectStart = -1;
      }
      if (character === ']' && depth === 0) break;
    }
  }
  assert.ok(routes.length > 0, 'route table is empty');
  return routes;
}

test('landing sources do not import product hooks, HTTP client, or product screens', () => {
  const landingDir = path.join(clientSrc, 'landing');
  const files = walkSources(landingDir);
  assert.ok(files.length > 0, 'landing directory has no source files');
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      assert.equal(specifier.includes('app/hooks'), false, `${file} imports ${specifier}`);
      assert.equal(specifier.includes('app/services'), false, `${file} imports ${specifier}`);
      assert.equal(specifier.includes('app/components'), false, `${file} imports ${specifier}`);
      assert.equal(resolvesInsideProduct(specifier, file), false, `${file} resolves ${specifier} into the product tree`);
    }
  }
});

test('main.tsx renders the router instead of mounting the product shell as the root', () => {
  const main = fs.readFileSync(path.join(clientSrc, 'main.tsx'), 'utf8');
  assert.match(main, /from ['"]\.\/router['"]/);
  assert.match(main, /<RouterProvider\s+router=\{router\}\s*\/>/);
  assert.doesNotMatch(main, /app\/AppShell/);
  assert.doesNotMatch(main, /<AppShell[\s/>]/);
  assert.doesNotMatch(main, /<App[\s/>]/);
});

test('route table sends / to the landing and /app plus nested paths to the product shell', () => {
  const routerSource = fs.readFileSync(path.join(clientSrc, 'router.tsx'), 'utf8');
  const pathSource = fs.readFileSync(path.join(clientSrc, 'paths.ts'), 'utf8');
  const constants = exportedStringConstants(pathSource);
  const routes = topLevelRoutes(routerSource).map((block) => {
    const pathMatch = block.match(/path:\s*([A-Za-z0-9_]+|'[^']+'|"[^"]+")/);
    const elementMatch = block.match(/element:\s*<([A-Za-z0-9_]+)/);
    assert.ok(pathMatch, `route is missing a path: ${block}`);
    assert.ok(elementMatch, `route is missing an element: ${block}`);
    return {
      block,
      path: routePathToken(pathMatch[1], constants),
      element: elementMatch[1],
    };
  });

  const landing = routes.find((route) => route.path === '/' && route.element === 'LandingPage');
  const product = routes.find((route) => route.path === '/app' && route.element === 'AppShell');
  const unknown = routes.find((route) => route.path === '*');
  assert.ok(landing, 'no route renders LandingPage at /');
  assert.ok(product, 'no route renders AppShell at /app');
  assert.match(product.block, /path:\s*['"]\*['"]/, '/app route does not keep nested /app/* on the product shell');
  assert.ok(unknown, 'unknown paths have no route');
  assert.notEqual(unknown.element, 'AppShell', 'unknown paths mount the product shell');
  assert.equal(routes.some((route) => route.path === '/' && route.element === 'AppShell'), false);
});
