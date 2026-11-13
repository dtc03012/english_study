# English Notes (PWA)

A static PWA that shows English words/idioms the user is studying. All content lives in `data/words.json`.

## When the user asks about an English word or idiom (or a scheduled task asks for new ones)

1. Answer the user in Korean as usual.
2. Append one entry per word/idiom to the end of `data/words.json`:

```json
{
  "type": "idiom",            // "word" or "idiom" (phrasal verbs and expressions count as "idiom")
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
