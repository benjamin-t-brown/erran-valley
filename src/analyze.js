const fs = require('fs');
const FleschKincaid = require('flesch-kincaid');

// const unified = require('unified');
// const english = require('retext-english');
// const stringify = require('retext-stringify');
// const readability = require('retext-readability');
// const simplify = require('retext-simplify');
// const report = require('vfile-reporter');
const colemanLiau = require('coleman-liau');
const syllable = require('syllable');

let VERBOSE = true;

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

const NUniqueWords = 45;
const NLongestWords = 7;
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

  text.split(/\.|\?|!/).forEach(sentence => {
    sentence = sentence.trim().replace(/ - /g, '-').replace(/\n/g, '');
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
  let count = 0;
  let nMonologues = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (aggregating && ch === '\n') {
      aggregating = false;
      agg = '';
    }

    if (ch === '"') {
      if (aggregating) {
        agg += '"';
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
        count += agg.split(' ').length;
        nMonologues++;
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
  return { monologues: ret, count, countOccurrences: nMonologues };
}

function mean(arr) {
  return arr.reduce((agg, val) => agg + val, 0) / arr.length;
}

function getGradeScores(textWithNewlinesAndPunctuation) {
  let colemanLiauScores = [];
  let fleschKincaidScores = [];

  const paragraphs = textWithNewlinesAndPunctuation.split('\n');
  paragraphs.forEach(paragraph => {
    let numSentences = paragraph.split(/[.!?]+/).length - 1;
    if (numSentences === 0) {
      numSentences = 1;
    }
    paragraph = paragraph.replace(/[.!?]+/g, '');
    paragraph = paragraph.replace(/[^a-z0-9\s]/g, '');
    const numWords = paragraph.split(/\s/).length;
    const numSyllables = paragraph.split(/\s/).reduce((prev, curr) => {
      return prev + syllable(curr);
    }, 1);
    const numLetters = paragraph.replace(/\s/g, '').replace(/\.|\?|!/g, '')
      .length;

    paragraph = paragraph.trim();
    if (paragraph.length === 0) {
      return;
    }

    colemanLiauScores.push(
      colemanLiau({
        sentence: numSentences,
        word: numWords,
        letter: numLetters,
      })
    );
    fleschKincaidScores.push(
      FleschKincaid({
        sentence: numSentences,
        word: numWords,
        syllable: numSyllables,
      })
    );

    if (isNaN(fleschKincaidScores[fleschKincaidScores.length - 1])) {
      console.log(
        `paragraph: "${paragraph}"`,
        `"${paragraph.trim()}"`,
        numSentences,
        numWords,
        numSyllables,
        numLetters
      );
      throw 'NaN found in paragraph';
    }
  });

  return {
    colemanLiau: mean(colemanLiauScores),
    fleschKincaid: mean(fleschKincaidScores),
  };
}

async function countWords(originalText) {
  let numCommonUsages = 0;

  originalText = originalText.replace(/[^.?"'!\s]\n/g, a => {
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
  text = text.replace(/( )( )+/g, ' ');

  const textWithNewlinesAndPunctuation = text.replace(/(\n)+/g, '\n');
  text = text.replace(/[^a-z0-9\s]/g, '');
  text = text.replace(/\n/g, ' ');

  const words = {};
  text.split(/\s/).forEach(word => {
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

      console.log(
        ` ${count}${spaceText}${word} (${((count * 100) / totalWords).toFixed(
          4
        )}%)`
      );
      i++;
    }
  }

  console.log();
  console.log('TOTAL WORDS = ' + totalWords.toLocaleString());
  console.log('TOTAL SENTENCES = ' + numSentences.toLocaleString());

  console.log('WORDS PER SENTENCE = ' + (totalWords / numSentences).toFixed(2));
  console.log(
    'NUM UNIQUE WORDS = ',
    Object.keys(words).length.toLocaleString(),
    `(${((Object.keys(words).length * 100) / totalWords).toFixed(2)}%)`
  );
  console.log(
    'COMMON PCT = ' + ((numCommonUsages * 100) / totalWords).toFixed(2) + '%'
  );
  console.log('AVG WORD LENGTH = ' + (totalWordLength / totalWords).toFixed(4));
  const {
    monologues: longestMonologues,
    count: numWordsInQuotes,
    countOccurrences: numMonologues,
  } = getLongestMonologues(originalText);
  console.log(
    'PCT WORDS IN QUOTES =',
    ((numWordsInQuotes * 100) / totalWords).toFixed(2) + '%'
  );
  console.log(
    'MONOLOGUE RATIO (words per quoted section) =',
    (numWordsInQuotes / numMonologues).toFixed(4)
  );

  const { colemanLiau, fleschKincaid } = getGradeScores(
    textWithNewlinesAndPunctuation
  );

  console.log(
    'COLEMAN-LIAU GRADE (mean per paragraph) = ',
    colemanLiau.toFixed(4)
  );
  console.log(
    'FLESCH-KINKAID GRADE (mean per paragraph) = ',
    fleschKincaid.toFixed(4)
  );

  console.log('');
  console.log(
    '? per 1000 = ' + ((numQuestionMarks / totalWords) * 1000).toFixed(4),
    `(${numQuestionMarks})`
  );
  console.log(
    '! per 1000 = ' + ((numExclamations / totalWords) * 1000).toFixed(4),
    `(${numExclamations})`
  );

  // unified().use(english).use(simplify).use(stringify).process(originalText, (err, file) => {
  //   for (let i = 0; i < file.messages.length; i++) {
  //     const e = file.messages[i];
  //     const ind = e.location.start.offset;
  //     const sentence = getSentenceFromWord('', originalText, ind)
  //     .trim()
  //     .replace(/ - /g, '-');
  //     console.log(`${i + 1}.) ${e.message}`);
  //     console.log('      ' + sentence);
  //   }
  // });

  console.log('');

  if (VERBOSE) {
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

    console.log('Longest monologues:');
    for (let i = 0; i < longestMonologues.length; i++) {
      const longestMonologue = longestMonologues[i];
      console.log(`  (${longestMonologue.split(' ').length} words):`);
      console.log('""""""""""""""""""""');
      console.log(`    \`${longestMonologue.replace(/ - /g, '-')}\``);
      console.log('""""""""""""""""""""');
    }
  }
}

async function main() {
  let numFiles = process.argv.length - 2;

  if (process.argv[2] === 'NOT_VERBOSE') {
    VERBOSE = false;
    process.argv.splice(2, 1);
    numFiles--;
  }

  if (process.argv[2] === 'test') {
    const text = process.argv[3];
    if (!text) {
      throw 'Text must be specified when testing: node analyze.js test "some text here"';
    }
    console.log('Test mode.');
    await countWords(text);
  } else if (numFiles > 0) {
    console.log('Detected ' + numFiles + ' to be parsed.');

    for (let i = 0; i < numFiles; i++) {
      const filename = process.argv[i + 2];
      if (!filename) {
        throw 'Invalid filename given: "' + filename + '"';
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
    const files = await new Promise(resolve => {
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
