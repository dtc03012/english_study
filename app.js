const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const filterBtns = document.querySelectorAll('.filters button');

let entries = [];
let typeFilter = 'all';
const TYPE_LABEL = { word: '단어', idiom: '숙어', phrase: '표현' };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  stopAll();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  speechSynthesis.speak(u);
}

let shown = [];
let startIdx = null; // index in `shown` to start play-all from, or null for the top
const sortBtn = document.getElementById('sort');
let oldestFirst = false;
try { oldestFirst = localStorage.getItem('english-notes-sort') === 'oldest'; } catch (_) {}
sortBtn.textContent = oldestFirst ? '오래된순' : '최신순';
sortBtn.addEventListener('click', () => {
  oldestFirst = !oldestFirst;
  sortBtn.textContent = oldestFirst ? '오래된순' : '최신순';
  try { localStorage.setItem('english-notes-sort', oldestFirst ? 'oldest' : 'newest'); } catch (_) {}
  render();
  window.scrollTo(0, 0);
});

function render() {
  stopAll();
  startIdx = null;
  setPlaying(false);
  const q = searchEl.value.trim().toLowerCase();
  shown = entries.filter((e) =>
    (typeFilter === 'all' || e.type === typeFilter) &&
    (!q || [e.term, e.meaning, e.note || ''].join(' ').toLowerCase().includes(q))
  );
  // entries are newest-first; reversing gives oldest-first in the order they were added.
  if (oldestFirst) shown.reverse();

  if (!shown.length) {
    listEl.innerHTML = `<p class="empty">${entries.length ? '검색 결과가 없습니다.' : '아직 저장된 표현이 없습니다.'}</p>`;
    return;
  }

  let html = '';
  let lastDate = '';
  shown.forEach((e, idx) => {
    if (e.added !== lastDate) {
      html += `<div class="date">${esc(e.added)}</div>`;
      lastDate = e.added;
    }
    html += `
      <article class="card" data-idx="${idx}">
        <div class="head">
          <h2 class="term">${esc(e.term)}</h2>
          <span class="tag">${TYPE_LABEL[e.type] || '단어'}</span>
          <button class="speak" data-say="${esc(e.term)}" aria-label="발음 듣기">🔊</button>
        </div>
        <p class="meaning">${esc(e.meaning)}</p>
        ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
        <ul class="examples">
          ${e.examples.map((x) => `
            <li>
              <div class="en"><span>${esc(x.en)}</span><button class="speak" data-say="${esc(x.en)}" aria-label="예문 듣기">🔊</button></div>
              <div class="ko">${esc(x.ko)}</div>
            </li>`).join('')}
        </ul>
      </article>`;
  });
  listEl.innerHTML = html;
}

listEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.speak');
  if (btn) return speak(btn.dataset.say);
  // Tapping a card marks it as the play-all starting point (tap again to clear).
  const card = ev.target.closest('.card');
  if (!card) return;
  const idx = Number(card.dataset.idx);
  startIdx = startIdx === idx ? null : idx;
  listEl.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
  if (startIdx !== null) card.classList.add('selected');
  if (playing) { stopAll(); playAll(); } else setPlaying(false);
});

searchEl.addEventListener('input', render);

filterBtns.forEach((btn) => btn.addEventListener('click', () => {
  filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
  typeFilter = btn.dataset.type;
  if (view === 'quiz') startQuiz(); else render();
}));

// Swipe left/right on the list to move between the filter tabs.
let touchStart = null;
listEl.addEventListener('touchstart', (ev) => {
  const t = ev.touches[0];
  touchStart = ev.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
listEl.addEventListener('touchend', (ev) => {
  if (!touchStart) return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const btns = [...filterBtns];
  const next = btns.findIndex((b) => b.dataset.type === typeFilter) + (dx < 0 ? 1 : -1);
  if (next < 0 || next >= btns.length) return;
  btns[next].click();
  window.scrollTo(0, 0);
});

// ---- Quiz: 4-choice questions, term -> meaning or meaning -> term ----
const quizEl = document.getElementById('quiz');
const tabBtns = document.querySelectorAll('.tabs button');
const QUIZ_LEN = 10;
let view = 'list';
let quiz = null; // { questions, index, wrong: [] }

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function startQuiz() {
  const pool = entries.filter((e) => typeFilter === 'all' || e.type === typeFilter);
  if (pool.length < 4) {
    quizEl.innerHTML = '<p class="empty">퀴즈를 하려면 표현이 4개 이상 필요합니다.</p>';
    return;
  }
  const questions = shuffle(pool).slice(0, QUIZ_LEN).map((answer) => {
    // Prefer distractors of the same type so choices look alike.
    const same = pool.filter((e) => e !== answer && e.type === answer.type);
    const others = pool.filter((e) => e !== answer && e.type !== answer.type);
    const distractors = [...shuffle(same), ...shuffle(others)].slice(0, 3);
    return { answer, choices: shuffle([answer, ...distractors]), reverse: Math.random() < 0.5 };
  });
  quiz = { questions, index: 0, wrong: [] };
  renderQuestion();
}

function renderQuestion() {
  const { questions, index } = quiz;
  const q = questions[index];
  const prompt = q.reverse ? q.answer.meaning : q.answer.term;
  quizEl.innerHTML = `
    <div class="q-progress">${index + 1} / ${questions.length}</div>
    <article class="card">
      <div class="head">
        <h2 class="q-prompt">${esc(prompt)}</h2>
        ${q.reverse ? '' : `<button class="speak" data-say="${esc(prompt)}" aria-label="발음 듣기">🔊</button>`}
      </div>
      <p class="q-hint">${q.reverse ? '알맞은 영어 표현은?' : '알맞은 뜻은?'}</p>
      <div class="choices">
        ${q.choices.map((c, i) => `<button class="choice" data-i="${i}">${esc(q.reverse ? c.term : c.meaning)}</button>`).join('')}
      </div>
      <div class="explain"></div>
    </article>`;
}

function answer(i) {
  const q = quiz.questions[quiz.index];
  const buttons = quizEl.querySelectorAll('.choice');
  if (buttons[0].disabled) return;
  buttons.forEach((b, j) => {
    b.disabled = true;
    if (q.choices[j] === q.answer) b.classList.add('right');
  });
  if (q.choices[i] !== q.answer) {
    buttons[i].classList.add('wrong');
    quiz.wrong.push(q.answer);
  }
  const ex = q.answer.examples[0];
  const last = quiz.index === quiz.questions.length - 1;
  quizEl.querySelector('.explain').innerHTML = `
    <p class="meaning">${esc(q.answer.term)} — ${esc(q.answer.meaning)}</p>
    ${ex ? `<div class="en"><span>${esc(ex.en)}</span><button class="speak" data-say="${esc(ex.en)}" aria-label="예문 듣기">🔊</button></div><div class="ko">${esc(ex.ko)}</div>` : ''}
    <button class="primary" data-next>${last ? '결과 보기' : '다음'}</button>`;
}

function renderResult() {
  const total = quiz.questions.length;
  const right = total - quiz.wrong.length;
  quizEl.innerHTML = `
    <div class="score">${right} / ${total}</div>
    <p class="empty" style="margin-top:0">${right === total ? '전부 맞혔어요! 🎉' : '틀린 표현을 다시 확인해 보세요.'}</p>
    ${quiz.wrong.map((e) => `
      <article class="card">
        <div class="head"><h2 class="term">${esc(e.term)}</h2><button class="speak" data-say="${esc(e.term)}" aria-label="발음 듣기">🔊</button></div>
        <p class="meaning">${esc(e.meaning)}</p>
      </article>`).join('')}
    <button class="primary" data-restart>다시 하기</button>`;
}

quizEl.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.closest('.speak')) return speak(t.closest('.speak').dataset.say);
  if (t.closest('.choice')) return answer(Number(t.closest('.choice').dataset.i));
  if (t.closest('[data-next]')) {
    quiz.index++;
    return quiz.index < quiz.questions.length ? renderQuestion() : renderResult();
  }
  if (t.closest('[data-restart]')) startQuiz();
});

tabBtns.forEach((btn) => btn.addEventListener('click', () => {
  view = btn.dataset.view;
  tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
  stopAll();
  listEl.hidden = view !== 'list';
  searchEl.hidden = view !== 'list';
  document.getElementById('list-actions').hidden = view !== 'list';
  quizEl.hidden = view !== 'quiz';
  settingsEl.hidden = view !== 'settings';
  readingEl.hidden = view !== 'reading';
  document.querySelector('.filters').hidden = view === 'settings' || view === 'reading';
  if (view === 'quiz') startQuiz();
  if (view === 'reading') renderReading();
}));

// ---- Play all: read every shown entry aloud, with repeat counts from settings ----
const playBtn = document.getElementById('play-all');
const settingsEl = document.getElementById('settings');
const setTerm = document.getElementById('set-term');
const setExample = document.getElementById('set-example');
const SETTINGS_KEY = 'english-notes-settings';
let settings = { termRepeat: 1, exampleRepeat: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (_) {}
setTerm.value = settings.termRepeat;
setExample.value = settings.exampleRepeat;
[setTerm, setExample].forEach((el) => el.addEventListener('change', () => {
  settings = { termRepeat: Number(setTerm.value), exampleRepeat: Number(setExample.value) };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}));

let playToken = 0;
let playing = false;

function say(text, lang) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.onend = u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

// "(동/명) 조사(하다)" -> "조사(하다)": drop the leading part-of-speech tag before reading.
const spokenMeaning = (m) => m.replace(/^\([^)]*\)\s*/, '');

function setPlaying(on) {
  playing = on;
  playBtn.textContent = on ? '■ 정지' : startIdx === null ? '▶ 전체 재생' : '▶ 여기부터 재생';
  playBtn.classList.toggle('on', on);
  listEl.querySelectorAll('.card.now').forEach((c) => c.classList.remove('now'));
}

function stopAll() {
  if (!playing) return;
  playToken++;
  speechSynthesis.cancel();
  setPlaying(false);
}

async function playAll() {
  const token = ++playToken;
  const items = [...shown];
  setPlaying(true);
  for (let i = startIdx ?? 0; i < items.length; i++) {
    const e = items[i];
    listEl.querySelectorAll('.card.now').forEach((c) => c.classList.remove('now'));
    const card = listEl.querySelector(`.card[data-idx="${i}"]`);
    if (card) {
      card.classList.add('now');
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    for (let r = 0; r < settings.termRepeat; r++) {
      await say(e.term, 'en-US');
      if (token !== playToken) return;
      await say(spokenMeaning(e.meaning), 'ko-KR');
      if (token !== playToken) return;
    }
    for (const ex of e.examples) {
      for (let r = 0; r < settings.exampleRepeat; r++) {
        await say(ex.en, 'en-US');
        if (token !== playToken) return;
      }
    }
  }
  setPlaying(false);
}

playBtn.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  if (playing) stopAll();
  else if (shown.length) playAll();
});

// ---- Reading list: articles to read, numbered in the order they were added ----
const readingEl = document.getElementById('reading');
const isAndroid = /Android/i.test(navigator.userAgent);

// On Android, an intent: link opens the page in Chrome even when a news app
// (e.g. WSJ) would otherwise claim the link; other devices use the plain URL.
function chromeHref(url) {
  if (!isAndroid) return url;
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

function renderReading() {
  fetch('data/articles.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((articles) => {
      readingEl.innerHTML = articles.length ? articles.map((a, i) => `
        <article class="card">
          <div class="head">
            <span class="num">${i + 1}</span>
            <h2 class="term article-title">${esc(a.title)}</h2>
          </div>
          <p class="note">${esc(a.source || new URL(a.url).hostname)} · ${esc(a.added)}</p>
          <a class="article-link" href="${esc(chromeHref(a.url))}" target="_blank" rel="noopener">${esc(a.url)}</a>
        </article>`).join('') : '<p class="empty">아직 저장된 글이 없습니다.</p>';
    })
    .catch(() => { readingEl.innerHTML = '<p class="empty">글 목록을 불러오지 못했습니다.</p>'; });
}

fetch('data/words.json', { cache: 'no-store' })
  .then((r) => r.json())
  .then((data) => {
    // Newest first; within the same day, later-added entries first.
    entries = data.map((e, i) => ({ ...e, _i: i }))
      .sort((a, b) => b.added.localeCompare(a.added) || b._i - a._i);
    render();
  })
  .catch(() => {
    listEl.innerHTML = '<p class="empty">데이터를 불러오지 못했습니다.</p>';
  });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
