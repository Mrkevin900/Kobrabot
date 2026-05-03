const fs = require('fs');
const path = require('path');

function scanDir(dir, files = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath, files);
        } else if (item.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const commandsDir = path.join(__dirname, 'src', 'commands');
const commandFiles = scanDir(commandsDir);

console.log(`Checking ${commandFiles.length} command files...`);

let errors = 0;
for (const file of commandFiles) {
    try {
        const mod = require(file);
        const command = mod.default || mod;
        if (!command.data || !command.executeCommand) {
            console.error(`[ERROR] ${file}: Missing data or executeCommand`);
            errors++;
        } else {
            console.log(`[OK] ${file}: /${command.data.name}`);
        }
    } catch (err) {
        console.error(`[CRITICAL] ${file}: Failed to load - ${err.message}`);
        errors++;
    }
}

console.log(`\nAudit finished with ${errors} errors.`);
process.exit(errors > 0 ? 1 : 0);
