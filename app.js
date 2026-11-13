const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const filterBtns = document.querySelectorAll('.filters button');

let entries = [];
let typeFilter = 'all';

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
          <span class="tag">${e.type === 'idiom' ? '숙어' : '단어'}</span>
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
  render();
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
