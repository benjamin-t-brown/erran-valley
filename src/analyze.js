const fs = require('fs');
const FleschKincaid = require('flesch-kincaid');

const unified = require('unified');
const english = require('retext-english');
const stringify = require('retext-stringify');
const readability = require('retext-readability');
const simplify = require('retext-simplify');
const report = require('vfile-reporter');

const commonWords = fs
	.readFileSync('./commons.txt')
	.toString()
	.toLowerCase()
	.replace(/'/g, '')
	.replace(/\n/g, ' ')
	.split(' ');
const commonWordsMapping = commonWords.reduce((prev, curr) => {
	prev[curr] = true;
	return prev;
}, {});

const NUniqueWords = 35;
const NLongestWords = 5;
const NLongestSentences = 5;
const NLongestMonologues = 5;

async function getFileText(filename) {
	return new Promise((resolve, reject) => {
		fs.readFile(filename, (err, textData) => {
			if (err) {
				reject('could not read file: ' + err);
			} else {
				resolve(textData.toString('utf-8'));
				//resolve('The pizza, and the cat, and the dog, and the yard, and the orangutan, are not going;\n\n\n they are not going to not be here at the "barn" don\'t you think?  That would be... well kinda dumb lol.');
			}
		});
	});
}

function isSentenceEnder(ch) {
	return ch === '.' || ch === '?' || ch === '!';
}

function getLongestSentences(text) {
	text = text.replace(/Mr\./g, 'Mr');
	text = text.replace(/Mrs\./g, 'Mrs');
	text = text.replace(/!"^[\n]/g, ',"');

	let ret = [];
	const n = NLongestSentences;

	text.split(/\.|\?|!/).forEach((sentence) => {
		sentence = sentence
			.trim()
			.replace(/ - /g, '-')
			.replace(/\n/g, '');
		for (let i = 0; i < n; i++) {
			const sent2 = ret[i];
			if (!sent2 || sentence.length > sent2.length) {
				ret.splice(i, 0, sentence + '.');
				break;
			}
		}
		if (ret.length > n) {
			ret = ret.slice(0, n);
		}
	});

	return ret;
}

function getSentenceFromWord(word, text, i) {
	text = text.replace(/Mr\./g, 'Mr');
	text = text.replace(/Mrs\./g, 'Mrs');
	const ind = i || text.indexOf(word);

	if (ind === -1) {
		return '(could not find)';
	}

	let istart = ind;
	let iend = ind;
	while (!isSentenceEnder(text[istart]) && istart > 0) {
		istart--;
	}
	while (!isSentenceEnder(text[iend]) && iend < text.length) {
		iend++;
	}
	let ret = text.slice(istart + 1, iend + 1).replace(/\n/g, ' ');
	if (ret[0] === '"' && ret[1] === ' ') {
		ret = ret.slice(1).trim();
	}
	return ret;
}

function getLongestMonologues(text) {
	let agg = '';
	let aggregating = false;

	let ret = [];
	let n = NLongestMonologues;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (aggregating && ch === '\n') {
			aggregating = false;
			agg = '';
		}

		if (ch === '"') {
			if (aggregating) {
				agg += "'";
				aggregating = false;
				for (let j = 0; j < n; j++) {
					let agg2 = ret[j];
					if (!agg2 || agg.length > agg2.length) {
						ret.splice(j, 0, agg);
						break;
					}
				}
				if (ret.length > n) {
					ret = ret.slice(0, n);
				}
				agg = '';
			} else {
				aggregating = true;
				agg += ch;
			}
		} else {
			if (aggregating) {
				agg += ch;
			}
		}
	}
	return ret;
}

async function countWords(originalText) {
	let numCommonUsages = 0;

	originalText = originalText.replace(/[^.?"'!\s]\n/g, (a) => {
		return a[0] + '.' + '\n';
	});
	originalText = originalText.replace(/’/g, "'");
	originalText = originalText.replace(/\t/g, ' ');
	originalText = originalText.replace(/—/g, '-');
	originalText = originalText.replace(/[“”]/g, '"');
	originalText = originalText.replace(/\."/g, '." ');
	originalText = originalText.replace(/[-—/\\]/g, ' - ');
	originalText = originalText.replace('/\r/', '\n');
	//originalText = originalText.replace(/\n\n+/g, '\n');
	originalText = originalText.replace(/( )( )+/g, ' ');
	originalText = originalText.replace(/\.\.\./g, '.');

	let text = originalText;

	//let nlpText = nlp(originalText).normalize();
	//console.log(nlpText.people().firstNames().out('topk'));

	//let text = nlpText.out('text');

	const numSentences = text.split(/\.|\?|!/).length;
	const numQuestionMarks = text.split('?').length;
	const numExclamations = text.split('!').length;
	const maxLongestWords = NLongestWords;
	let longestWords = [''];
	let totalWordLength = 0;

	text = text.toLowerCase();

	text = text.replace(/-/g, ' ');
	text = text.replace(/[^a-z0-9\s]/g, '');
	text = text.replace(/\n/g, ' ');
	text = text.replace(/( )( )+/g, ' ');

	const words = {};
	text.split(/\s/).forEach((word) => {
		if (!word) {
			return;
		}

		if (commonWords.includes(word)) {
			numCommonUsages++;
		}

		totalWordLength += word.length;

		if (!words[word]) {
			words[word] = 1;

			for (let i = 0; i < maxLongestWords; i++) {
				const lword = longestWords[i];
				if (word.length > lword.length) {
					longestWords.splice(i, 0, word);
					break;
				}
			}
			if (longestWords.length > maxLongestWords) {
				longestWords = longestWords.slice(0, maxLongestWords);
			}
		} else {
			words[word]++;
		}
	});

	const sortedWords = Object.keys(words).sort((a, b) => {
		if (words[a] > words[b]) {
			return -1;
		} else {
			return words[a] > words[b] ? -1 : 1;
		}
	});

	const totalWords = Object.keys(words).reduce((prev, curr) => {
		return prev + words[curr];
	}, 0);

	let ctr = 0;
	let i = 0;
	while (i < NUniqueWords && ctr <= sortedWords.length) {
		const word = sortedWords[ctr];
		ctr++;
		if (!commonWordsMapping[word]) {
			let spaces = 10;
			const count = words[word];
			if (count < 10) {
				spaces = 10;
			} else if (count < 100) {
				spaces = 9;
			} else if (count < 1000) {
				spaces = 8;
			} else if (count < 10000) {
				spaces = 7;
			} else if (count < 100000) {
				spaces = 6;
			}
			let spaceText = '';
			for (let j = 0; j < spaces; j++) {
				spaceText += ' ';
			}

			console.log(` ${count}${spaceText}${word} (${((count * 100) / totalWords).toFixed(4)}%)`);
			i++;
		}
	}

	console.log();
	console.log('TOTAL WORDS = ' + totalWords);
	console.log('TOTAL SENTENCES = ' + numSentences);

	console.log('WORDS PER SENTENCE = ' + (totalWords / numSentences).toFixed(2));
	console.log(
		'NUM UNIQUE WORDS = ',
		Object.keys(words).length,
		`(${((Object.keys(words).length * 100) / totalWords).toFixed(2)}%)`,
	);
	console.log('COMMON PCT = ' + ((numCommonUsages * 100) / totalWords).toFixed(2) + '%');
	console.log('AVG WORD LENGTH = ' + (totalWordLength / totalWords).toFixed(4));

	console.log('');
	console.log('? per 1000 = ' + ((numQuestionMarks / totalWords) * 1000).toFixed(4), `(${numQuestionMarks})`);
	console.log('! per 1000 = ' + ((numExclamations / totalWords) * 1000).toFixed(4), `(${numExclamations})`);


	// unified().use(english).use(simplify).use(stringify).process(originalText, (err, file) => {
	// 	for (let i = 0; i < file.messages.length; i++) {
	// 		const e = file.messages[i];
	// 		const ind = e.location.start.offset;
	// 		const sentence = getSentenceFromWord('', originalText, ind)
	// 		.trim()
	// 		.replace(/ - /g, '-');
	// 		console.log(`${i + 1}.) ${e.message}`);
	// 		console.log('      ' + sentence);
	// 	}
	// });

	// console.log(' FleschKincaid rating = ' + FleschKincaid.rate(originalText).toFixed(4));
	// console.log(' FleschKincaid grade = ' + FleschKincaid.grade(originalText).toFixed(4), '(grade level)');
	console.log('');

	console.log('LONGEST WORDS:');
	console.log('');
	for (let i = 0; i < longestWords.length; i++) {
		const word = longestWords[i];
		const sentence = getSentenceFromWord(word, originalText)
			.trim()
			.replace(/ - /g, '-');
		console.log(`${i + 1}.) ${word} (len=${word.length})`);
		console.log('      ' + sentence);
	}
	console.log('');

	const longestSentences = getLongestSentences(originalText);

	console.log('Longest sentences:');
	for (let i = 0; i < longestSentences.length; i++) {
		const longestSentence = longestSentences[i];
		console.log(`  (${longestSentence.split(' ').length} words):`);
		console.log('::::::::::::::::::::');
		console.log(`    \`${longestSentence}\``);
		console.log('::::::::::::::::::::');
	}

	console.log();
	const longestMonologues = getLongestMonologues(originalText);

	console.log('Longest monologues:');
	for (let i = 0; i < longestMonologues.length; i++) {
		const longestMonologue = longestMonologues[i];
		console.log(`  (${longestMonologue.split(' ').length} words):`);
		console.log('""""""""""""""""""""');
		console.log(`    \`${longestMonologue.replace(/ - /g, '-')}\``);
		console.log('""""""""""""""""""""');
	}
}

async function main() {
	const numFiles = process.argv.length - 2;

	if (numFiles > 0) {
		console.log('Detected ' + numFiles + ' to be parsed.');

		for (let i = 0; i < numFiles; i++) {
			const filename = process.argv[i + 2];
			if (!filename) {
				throw 'Invalid filename given';
			}

			console.log('----------------------');
			console.log('COUNTING', filename);

			try {
				const text = await getFileText(filename);
				await countWords(text);
			} catch (e) {
				console.error(e);
			}

			console.log('----------------------');
			console.log();
		}
	} else {
		const files = await new Promise((resolve) => {
			fs.readdir('texts', (err, files) => {
				resolve(files);
			});
		});
		if (files.length) {
			for (let i = 0; i < files.length; i++) {
				const fname = files[i];
				const filename = 'texts/' + fname;
				if (!filename) {
					throw 'Invalid filename given';
				}

				console.log('----------------------');
				console.log('COUNTING', filename);

				try {
					const text = await getFileText(filename);
					await countWords(text);
				} catch (e) {
					console.error(e);
				}

				console.log('----------------------');
				console.log();
			}
		} else {
			console.log('Could not find files in the "./texts" directory');
		}
	}
}
main();
