const vm = require('vm');
const path = require('path');
const fs = require('fs');

/**
 * Evaluates a template string in a safe sandbox using the provided context variables.
 * Uses JS template literal syntax internally.
 */
function evaluateTemplate(templateStr, context) {
  const sandbox = { ...context, String, Number, Math, Boolean, Date };
  vm.createContext(sandbox);

  // We wrap the template string in backticks to evaluate it as a JS template literal.
  // We must escape backslashes so Windows paths work. We do NOT escape backticks 
  // as it breaks nested template literals.
  const escapedTemplate = templateStr.replace(/\\/g, '\\\\');
  const code = `\`${escapedTemplate}\``;

  try {
    const result = vm.runInContext(code, sandbox);
    // Replace any backslashes with forward slashes for cross-platform consistency,
    // and remove any double slashes (except in protocols, though not applicable here)
    let normalized = result.replace(/\\/g, '/').replace(/\/\//g, '/');
    return normalized;
  } catch (err) {
    console.error('[Renamer] Template evaluation error:', err.message);
    throw new Error(`Invalid format template: ${err.message}`);
  }
}

/**
 * Moves and renames a file based on the template.
 */
async function moveAndRenameFile(sourcePath, templateStr, context) {
  let finalPath = evaluateTemplate(templateStr, context);
  
  // Normalize and resolve the path
  const targetPath = path.resolve(finalPath);
  
  // Ensure the extension is preserved if the template didn't include it
  const ext = path.extname(sourcePath);
  const targetExt = path.extname(targetPath);
  
  let finalTargetPath = targetPath;
  if (targetExt.toLowerCase() !== ext.toLowerCase()) {
     finalTargetPath += ext;
  }

  // Ensure directory exists
  const targetDir = path.dirname(finalTargetPath);
  await fs.promises.mkdir(targetDir, { recursive: true });

  // Move the file
  await fs.promises.rename(sourcePath, finalTargetPath);

  return finalTargetPath;
}

module.exports = { evaluateTemplate, moveAndRenameFile };
