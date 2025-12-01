const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

async function findJsWithTsCounterparts(dir) {
  const filesToDelete = [];
  const items = await readdir(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      // Skip node_modules and dist directories
      if (item !== 'node_modules' && item !== 'dist') {
        const subDirFiles = await findJsWithTsCounterparts(fullPath);
        filesToDelete.push(...subDirFiles);
      }
    } else if (stats.isFile()) {
      // Check if this is a .js file with a corresponding .ts file
      if (item.endsWith('.js')) {
        const tsFile = item.replace(/\.js$/, '.ts');
        const tsPath = path.join(dir, tsFile);
        
        if (fs.existsSync(tsPath)) {
          filesToDelete.push(fullPath);
        }
      }
    }
  }
  
  return filesToDelete;
}

async function main() {
  try {
    console.log('Finding .js files with .ts counterparts...');
    const filesToDelete = await findJsWithTsCounterparts(path.join(__dirname, 'backend/src'));
    
    console.log(`Found ${filesToDelete.length} .js files to delete:`);
    filesToDelete.forEach(file => console.log(`- ${file}`));
    
    const shouldDelete = process.argv.includes('--delete');
    
    if (shouldDelete) {
      console.log('\nDeleting files...');
      for (const file of filesToDelete) {
        await unlink(file);
        console.log(`Deleted: ${file}`);
      }
      console.log('Deletion complete!');
    } else {
      console.log('\nRun with --delete flag to actually delete these files.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
