const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

let quotesData = [];
let codeSnippetsData = [];
let dictionaryData = [];

try {
  const quotesPath = path.join(__dirname, '..', 'data', 'quotes.json');
  quotesData = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'));
} catch (err) {
  console.warn('[texts] Could not load quotes.json:', err.message);
}

try {
  const snippetsPath = path.join(__dirname, '..', 'data', 'code-snippets.json');
  codeSnippetsData = JSON.parse(fs.readFileSync(snippetsPath, 'utf-8'));
} catch (err) {
  console.warn('[texts] Could not load code-snippets.json:', err.message);
}

try {
  const dictPath = path.join(__dirname, '..', 'data', 'dictionary.json');
  dictionaryData = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
} catch (err) {
  console.warn('[texts] Could not load dictionary.json:', err.message);
}

// Number of random words per length setting.
const DICTIONARY_WORD_COUNT = { '15s': 30, '30s': 60, '60s': 120, '120s': 240, full: 200 };

function getDictionaryText(length) {
  if (dictionaryData.length === 0) return null;
  const count = DICTIONARY_WORD_COUNT[length] || 60;
  const words = shuffleArray(dictionaryData).slice(0, count);
  return words.join(' ');
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRandomQuote(length) {
  if (quotesData.length === 0) {
    return null;
  }

  let filtered = quotesData;

  if (length) {
    const lengthMap = {
      short: ['short'],
      medium: ['medium'],
      long: ['long'],
    };
    const allowedLengths = lengthMap[length] || Object.values(lengthMap).flat();
    filtered = filtered.filter(q => allowedLengths.includes(q.length));
  }

  if (filtered.length === 0) {
    filtered = quotesData;
  }

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}

function getRandomSnippet(language, difficulty) {
  if (codeSnippetsData.length === 0) {
    return null;
  }

  let filtered = codeSnippetsData;

  if (language) {
    const validLanguages = ['javascript', 'python', 'java', 'cpp', 'go', 'rust', 'typescript', 'sql'];
    if (validLanguages.includes(language)) {
      filtered = filtered.filter(s => s.language === language);
    } else {
      return null;
    }
  }

  if (difficulty) {
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (validDifficulties.includes(difficulty)) {
      filtered = filtered.filter(s => s.difficulty === difficulty);
    } else {
      return null;
    }
  }

  if (filtered.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}

router.get('/random', (req, res) => {
  try {
    const { mode, language, difficulty, length } = req.query;

    if (!mode || !['general', 'code', 'dictionary'].includes(mode)) {
      return res.status(400).json({ error: 'Mode is required and must be "general", "code", or "dictionary"' });
    }

    if (mode === 'dictionary') {
      const text = getDictionaryText(length);
      if (!text) {
        return res.status(404).json({ error: 'Dictionary unavailable' });
      }
      return res.json({
        mode: 'dictionary',
        text,
      });
    }

    if (mode === 'general') {
      const quote = getRandomQuote(length);

      if (!quote) {
        return res.status(404).json({ error: 'No general text available' });
      }

      return res.json({
        mode: 'general',
        text: quote.text,
        length: quote.length,
      });
    }

    if (mode === 'code') {
      const snippet = getRandomSnippet(language, difficulty);

      if (!snippet) {
        return res.status(404).json({ error: 'No code snippet available for the given criteria' });
      }

      return res.json({
        mode: 'code',
        language: snippet.language,
        difficulty: snippet.difficulty,
        title: snippet.title,
        text: snippet.code,
      });
    }
  } catch (err) {
    console.error('[texts/random] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/list', (req, res) => {
  try {
    const { mode, language, difficulty } = req.query;

    if (!mode || !['general', 'code'].includes(mode)) {
      return res.status(400).json({ error: 'Mode is required and must be "general" or "code"' });
    }

    if (mode === 'general') {
      let filtered = quotesData;

      if (language) {
        filtered = filtered.filter(q => q.language === language);
      }

      if (difficulty) {
        const validDifficulties = ['easy', 'medium', 'hard'];
        if (validDifficulties.includes(difficulty)) {
          filtered = filtered.filter(q => q.difficulty === difficulty);
        }
      }

      return res.json({ mode: 'general', texts: filtered });
    }

    if (mode === 'code') {
      let filtered = codeSnippetsData;

      if (language) {
        const validLanguages = ['javascript', 'python', 'java', 'cpp', 'go', 'rust', 'typescript', 'sql'];
        if (validLanguages.includes(language)) {
          filtered = filtered.filter(s => s.language === language);
        } else {
          return res.status(400).json({ error: 'Invalid language' });
        }
      }

      if (difficulty) {
        const validDifficulties = ['beginner', 'intermediate', 'advanced'];
        if (validDifficulties.includes(difficulty)) {
          filtered = filtered.filter(s => s.difficulty === difficulty);
        } else {
          return res.status(400).json({ error: 'Invalid difficulty' });
        }
      }

      return res.json({ mode: 'code', texts: filtered });
    }
  } catch (err) {
    console.error('[texts/list] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/languages', (_req, res) => {
  const languages = [...new Set(codeSnippetsData.map(s => s.language))].sort();
  res.json({ languages });
});

module.exports = router;
