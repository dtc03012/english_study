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
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  speechSynthesis.speak(u);
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const shown = entries.filter((e) =>
    (typeFilter === 'all' || e.type === typeFilter) &&
    (!q || [e.term, e.meaning, e.note || ''].join(' ').toLowerCase().includes(q))
  );

  if (!shown.length) {
    listEl.innerHTML = `<p class="empty">${entries.length ? '검색 결과가 없습니다.' : '아직 저장된 표현이 없습니다.'}</p>`;
    return;
  }

  let html = '';
  let lastDate = '';
  for (const e of shown) {
    if (e.added !== lastDate) {
      html += `<div class="date">${esc(e.added)}</div>`;
      lastDate = e.added;
    }
    html += `
      <article class="card">
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
  }
  listEl.innerHTML = html;
}

listEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.speak');
  if (btn) speak(btn.dataset.say);
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
  listEl.hidden = view !== 'list';
  searchEl.hidden = view !== 'list';
  quizEl.hidden = view !== 'quiz';
  if (view === 'quiz') startQuiz();
}));

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
