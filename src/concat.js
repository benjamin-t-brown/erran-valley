const fs = require('fs');

const MASTER_FILE = 'master.txt';
const MASTER_FILE_DIR = __dirname + '/../out';

const TXT_DIR = __dirname + '/..';

const dir = fs.readdirSync(TXT_DIR);
const filesNames = dir.filter(fileName => fileName.slice(-4) === '.txt' && fileName.match(/^\d\d/));

const wordCounts = [];

const masterFileContent = filesNames.map((fileName) => {
	console.log(' read', fileName);
	const file = fs.readFileSync(TXT_DIR + '/' + fileName);
	wordCounts.push({
		count: file.toString().toLowerCase()
				  .replace(/'/g, '')
				  .replace(/\n/g, ' ')
				  .split(' ').filter(a => !!a).length,
		fileName
	});
	return file;
}).join('\n\n\n');

fs.writeFileSync(MASTER_FILE_DIR + '/' + MASTER_FILE, masterFileContent);

console.log('wrote', MASTER_FILE_DIR + '/' + MASTER_FILE);

const avg = wordCounts.reduce((sum, obj) => {
	return obj.count + sum;
}, 0) / wordCounts.length;

for (let i in wordCounts) {
	console.log(wordCounts[i].fileName, '\t\t', wordCounts[i].count);
}

console.log('WORDS PER CHAPTER', avg);