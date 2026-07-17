const fs = require('fs').promises;
const path = require('path');

async function saveFile(filePath, buffer) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
}

async function deleteFile(filePath) {
    try {
        await fs.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`Błąd usuwania pliku ${filePath}:`, err);
        }
    }
}

async function listFiles(dirPath) {
    try {
        return await fs.readdir(dirPath);
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

async function deleteFilesMatching(dirPath, prefix) {
    const files = await listFiles(dirPath);
    for (const file of files) {
        if (file.startsWith(prefix)) {
            await deleteFile(path.join(dirPath, file));
        }
    }
}

module.exports = { saveFile, deleteFile, listFiles, deleteFilesMatching };
