#!/usr/bin/env node
/**
 * Transform route files: remove try/catch, add asyncHandler, update errorHandler.
 */
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js') && f !== 'mock.js');

for (const file of files) {
  const filePath = path.join(ROUTES_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Add asyncHandler import if not present and file has try/catch patterns
  if (content.includes('catch (error)') && !content.includes("require('../middleware/asyncHandler')")) {
    // Find the last require() line and add asyncHandler after it
    const lines = content.split('\n');
    let lastRequireIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/require\(/) && lines[i].trim().startsWith('const')) {
        lastRequireIdx = i;
      }
    }
    if (lastRequireIdx >= 0) {
      lines.splice(lastRequireIdx + 1, 0, "const asyncHandler = require('../middleware/asyncHandler');");
      content = lines.join('\n');
      changed = true;
    }
  }

  // 2. Remove logger import if it's only used in catch blocks
  // Check if logger is used outside of catch blocks
  if (content.includes("const logger = require('../lib/logger')")) {
    // Check if logger is used in non-catch contexts
    const lines = content.split('\n');
    let loggerUsedOutsideCatch = false;
    let inCatchBlock = false;
    let braceDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('} catch')) {
        inCatchBlock = true;
        continue;
      }
      if (inCatchBlock && line === '}') {
        inCatchBlock = false;
        continue;
      }
      if (!inCatchBlock && line.includes('logger.')) {
        loggerUsedOutsideCatch = true;
        break;
      }
    }
    
    if (!loggerUsedOutsideCatch) {
      content = content.replace(/const logger = require\('\.\.\/lib\/logger'\);\n/g, '');
      changed = true;
    }
  }

  // 3. Remove try/catch blocks from named handler functions
  // Pattern: const handlerName = async (req, res) => { try { ... } catch (error) { ... } };
  // We want to remove the try { and the catch { ... } block, keeping the inner content
  
  // Simple approach: remove "try {" at start of handler body, and remove the catch block
  // This is tricky to do with regex because of nested braces
  
  // Let's use a line-by-line approach
  const lines = content.split('\n');
  const newLines = [];
  let skipUntilBrace = false;
  let catchDepth = 0;
  let inCatchBlock = false;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect start of catch block
    if (trimmed.match(/^} catch \(error\) \{/) || trimmed.match(/^} catch \(err\) \{/) || trimmed.match(/^}\s*catch\s*\(/)) {
      inCatchBlock = true;
      catchDepth = 1;
      // Remove the trailing empty line before catch if present
      if (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
        newLines.pop();
      }
      continue;
    }
    
    if (inCatchBlock) {
      // Count braces to find end of catch block
      for (const ch of trimmed) {
        if (ch === '{') catchDepth++;
        if (ch === '}') catchDepth--;
      }
      
      if (catchDepth <= 0) {
        inCatchBlock = false;
        // Check if this is the end of a function (has }; after the })
        // Skip the closing } of catch, but keep the function closing
      }
      continue; // Skip catch block lines
    }
    
    // Remove "try {" lines at the start of handler functions
    if (trimmed === 'try {' || trimmed === 'try{') {
      // Check if previous non-empty line is a function opening
      let prevIdx = newLines.length - 1;
      while (prevIdx >= 0 && newLines[prevIdx].trim() === '') prevIdx--;
      if (prevIdx >= 0 && (newLines[prevIdx].includes('async (req, res)') || newLines[prevIdx].includes('async (req, res, next)') || newLines[prevIdx].endsWith('{'))) {
        changed = true;
        continue; // Skip the try { line
      }
    }
    
    newLines.push(line);
  }
  
  if (newLines.length !== lines.length || newLines.join('\n') !== content) {
    content = newLines.join('\n');
    changed = true;
  }

  // 4. Wrap named handler references in router.* calls with asyncHandler
  // Pattern: router.get('/path', middleware1, handlerName);
  // Becomes: router.get('/path', middleware1, asyncHandler(handlerName));
  
  // Find all handler function names that are defined as const xxx = async (req, res) => {
  const handlerNames = [];
  const handlerRegex = /const (\w+) = async \(req, res(?:, next)?\) => \{/g;
  let match;
  while ((match = handlerRegex.exec(content)) !== null) {
    handlerNames.push(match[1]);
  }
  
  for (const name of handlerNames) {
    // Wrap in router calls - but not if already wrapped
    const routeRegex = new RegExp(`(router\\.(get|post|put|delete|patch)\\([^,]+,[^,]*(?:,[^,]+)*,\\s*)${name}\\)`, 'g');
    const newContent = content.replace(routeRegex, `$1asyncHandler(${name}))`);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  // 5. Also handle inline arrow functions in router calls
  // Pattern: router.post('/path', middleware, async (req, res) => { ... });
  // These need to be wrapped with asyncHandler
  // Actually, these are already inline so asyncHandler wrapping them would work
  // But we need to be careful - the try/catch removal already happened for these

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${file}`);
  } else {
    console.log(`⏭️  Skipped (no changes): ${file}`);
  }
}
