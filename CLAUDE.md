# English Notes (PWA)

A static PWA that shows English words/idioms the user is studying. All content lives in `data/words.json`.

## When the user asks about an English word or idiom (or a scheduled task asks for new ones)

1. Answer the user in Korean as usual.
2. Append one entry per word/idiom to the end of `data/words.json`:

```json
{
  "type": "idiom",            // "word", "idiom" (idioms and phrasal verbs), or "phrase" (useful collocations/sentence patterns that are not idioms, e.g. "remain functional", "become public")
  "term": "break the ice",
  "meaning": "어색한 분위기를 깨다",   // Korean meaning; for words, start with the part of speech, e.g. "(형)"
  "note": "...",              // optional: nuance, usage tip, or a similar expression (Korean)
  "examples": [               // exactly 3 natural, everyday sentences
    { "en": "...", "ko": "..." },
    { "en": "...", "ko": "..." },
    { "en": "...", "ko": "..." }
  ],
  "added": "YYYY-MM-DD"       // today's date
}
```

3. Skip a term that already exists in the file (compare `term` case-insensitively), and tell the user it's already saved.
4. Check the JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('data/words.json'))"`
5. Commit with a message like `Add: break the ice, awkward` and push to `claude/app-dev-execution-s9j9ld` (the repo's default branch, which GitHub Pages deploys from). The user has approved pushing word additions straight to this branch, even if the session was given a different working branch. The app at https://dtc03012.github.io/english_study/ updates once Pages redeploys (about 1 minute).

Do not change the app code (`index.html`, `app.js`, `style.css`, `sw.js`) when only adding words.

## When the user asks to add an article to read (읽기 탭)

Append to the end of `data/articles.json` (the app numbers them in this order):

```json
{ "title": "Article headline", "source": "WSJ", "url": "https://...", "added": "YYYY-MM-DD" }
```

Use the article's real headline; if the page can't be fetched, derive it from the URL slug and tell the user. Validate the JSON, commit (`Add article: <title>`), and push to the same branch as word additions.
