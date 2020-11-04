const fs = require('fs');

const MASTER_FILE = 'master.txt';
const MASTER_FILE_DIR = __dirname + '/../out';

const TXT_DIR = __dirname + '/..';

const dir = fs.readdirSync(TXT_DIR);
const filesNames = dir.filter(fileName => fileName.slice(-4) === '.txt');

const masterFileContent = filesNames.map((fileName) => {
	console.log(' read', fileName);
	return fs.readFileSync(TXT_DIR + '/' + fileName);
}).join('\n\n\n');

fs.writeFileSync(MASTER_FILE_DIR + '/' + MASTER_FILE, masterFileContent);

console.log('wrote', MASTER_FILE_DIR + '/' + MASTER_FILE);

