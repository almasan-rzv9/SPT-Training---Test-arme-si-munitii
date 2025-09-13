// ============ SPT Training • Quiz (refactor) ============

(function(){
  'use strict';

  // Rulăm după ce DOM-ul e gata
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(){
    // ===== Elemente =====
    const els = {
      start: document.getElementById('start-screen'),
      quiz: document.getElementById('quiz-screen'),
      result: document.getElementById('result-screen'),

      startBtn: document.getElementById('start-btn'),
      nextBtn: document.getElementById('next-btn'),
      finishBtn: document.getElementById('finish-btn'),
      retryBtn: document.getElementById('retry-btn'),

      qtext: document.getElementById('question-text'),
      choices: document.getElementById('choices'),
      progress: document.getElementById('progress'),
      timer: document.getElementById('timer'),
      scoreMini: document.getElementById('score-mini'),

      scoreline: document.getElementById('scoreline'),
      reviewList: document.getElementById('review-list'),

      btnAll: document.getElementById('btn-all'),
      btn20: document.getElementById('btn-20'),
      btnCsv: document.getElementById('export-csv'),
      btnPdf: document.getElementById('export-pdf'),
    };

    // ===== Statistici (header) =====
    const stat = {
      total: document.getElementById('stat-total'),
      correct: document.getElementById('stat-correct'),
      wrong: document.getElementById('stat-wrong'),
      picked: document.getElementById('stat-picked'),
    };

    // ===== Preset timp =====
    const segBtns = Array.from(document.querySelectorAll('.seg-btn'));
    let quizMinutes = Number(document.querySelector('.seg-btn.active')?.dataset.min || 20);

    // ===== State =====
    let questions = [];
    let order = [];
    let current = 0;
    let answers = {};        // map: id -> index răspuns ales
    let picked = [];         // indicii selectate pentru sesiune (ALL/20)
    const SESSION_SIZE = 20; // implicit 20

    // Timer
    let timerId = null;
    let timeLeft = 0; // secunde

    // ===== Helpers UI =====
    const show = el => el.classList.remove('hidden');
    const hide = el => el.classList.add('hidden');
    const shuffle = arr => arr.slice().sort(()=>Math.random()-0.5);

    function setStats({ total, correct, wrong, pickedCount }){
      if(total !== undefined) stat.total.textContent = total;
      if(correct !== undefined) stat.correct.textContent = correct;
      if(wrong !== undefined) stat.wrong.textContent = wrong;
      if(pickedCount !== undefined) stat.picked.textContent = pickedCount;
    }

    function selectAll(){
      picked = questions.map((_,i)=>i);
      setStats({pickedCount:picked.length});
    }

    function selectRandom(n){
      picked = shuffle(questions.map((_,i)=>i)).slice(0, Math.min(n, questions.length));
      setStats({pickedCount:picked.length});
    }

    // ===== Timer =====
    function startTimer(seconds){
      clearInterval(timerId);
      timeLeft = seconds;
      updateTimerDisplay();
      timerId = setInterval(()=>{
        timeLeft--;
        updateTimerDisplay();
        if(timeLeft <= 0){
          clearInterval(timerId);
          finish();
        }
      }, 1000);
    }

    function updateTimerDisplay(){
      const m = Math.floor(timeLeft/60);
      const s = timeLeft % 60;
      els.timer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if(timeLeft <= 60) els.timer.classList.add('warning'); else els.timer.classList.remove('warning');
    }

    // ===== Data =====
    async function loadQuestions(){
      // încearcă questions.json, apoi fallback la questions_shuffled.json
      try{
        const a = await fetch('./questions.json', {cache:'no-store'});
        if(a.ok) return a.json();
      }catch{}
      const b = await fetch('./questions_shuffled.json', {cache:'no-store'});
      if(!b.ok) throw new Error('Nu s-au putut încărca întrebările.');
      return b.json();
    }

    // ===== Flux =====
    async function bootstrap(){
      try{
        questions = await loadQuestions();
        setStats({ total: questions.length, correct:0, wrong:0, pickedCount:0 });
      }catch(err){
        console.error(err);
        alert('Eroare la încărcarea întrebărilor.');
      }
    }

    function startQuiz(){
      current = 0;
      answers = {};

      const base = picked.length ? picked : shuffle(questions.map((_,i)=>i)).slice(0, Math.min(SESSION_SIZE, questions.length));
      order = shuffle(base);

      hide(els.start);
      hide(els.result);
      show(els.quiz);

      setStats({correct:0, wrong:0});
      render();

      const seconds = Math.max(1, quizMinutes|0) * 60;
      startTimer(seconds);
    }

    function render(){
      const q = questions[order[current]];
      if(!q) return;

      els.progress.textContent = `Întrebarea ${current+1}/${order.length}`;

      const liveCorrect = Object.keys(answers).reduce((acc, k)=>{
        const qq = questions.find(x=>x.id == k);
        return acc + (qq && answers[k]===qq.correctIndex ? 1 : 0);
      }, 0);
      els.scoreMini.textContent = `Corecte: ${liveCorrect}`;

      els.qtext.textContent = q.text;
      els.choices.innerHTML = '';

      q.choices.forEach((label, idx)=>{
        const row = document.createElement('label');
        row.className = 'choice';
        row.setAttribute('role','option');

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `q_${q.id}`;
        input.value = idx;

        const span = document.createElement('span');
        span.textContent = label;

        input.addEventListener('change', ()=>{
          answers[q.id] = idx;
          const correct = (idx === q.correctIndex);

          row.classList.add(correct ? 'correct' : 'wrong');

          if(!correct){
            const corr = els.choices.querySelector(`input[value="${q.correctIndex}"]`);
            if(corr) corr.parentElement.classList.add('correct');
          }

          els.choices.querySelectorAll(`input[name="q_${q.id}"]`).forEach(el=> el.disabled = true);

          let c=0,w=0;
          Object.keys(answers).forEach(k=>{
            const qq = questions.find(x=>x.id == k);
            if(answers[k] === qq?.correctIndex) c++; else w++;
          });
          setStats({correct:c, wrong:w});

          els.nextBtn.disabled = (current >= order.length - 1);
          els.finishBtn.disabled = (current < order.length - 1);
        });

        row.appendChild(input);
        row.appendChild(span);
        els.choices.appendChild(row);
      });

      // stare butoane
      els.nextBtn.disabled = true;
      els.finishBtn.disabled = (current < order.length - 1);

      // Progress bar
      const bar = document.getElementById('bar');
      if(bar){
        const pct = Math.round(((current) / Math.max(1, order.length)) * 100);
        bar.style.width = pct + '%';
      }
    }

    function next(){
      if(current < order.length - 1){
        current++;
        render();
      }
    }
    window.__goNext = next; // fallback compat

    function finish(){
      clearInterval(timerId);

      const used = order.map(i=>questions[i]);
      let correct = 0;
      used.forEach(q => { if(answers[q.id] === q.correctIndex) correct++; });

      const total = used.length;
      const pct = Math.round((correct/Math.max(1,total))*100);
      const pass = (total === 20 ? correct >= 18 : correct >= Math.ceil(0.9*total));

      els.scoreline.textContent = `Scor: ${pct}% — ${correct} din ${total}. ${pass ? '✅ PASS' : '❌ FAIL'}`;
      setStats({correct, wrong: total - correct});

      els.reviewList.innerHTML = '';
      used.forEach((q,i)=>{
        const your = answers[q.id];
        const ok = your === q.correctIndex;
        const item = document.createElement('div');
        item.className = 'review-item';
        item.innerHTML = `
          <div class="q"><strong>${i+1}.</strong> ${q.text}</div>
          <div>
            <span class="badge ${ok?'ok':'no'}">${ok?'Corect':'Greșit'}</span>
            <span style="margin-left:8px">Răspunsul tău: ${q.choices[your] ?? '-'}</span>
            <span style="margin-left:8px">Răspuns corect: ${q.choices[q.correctIndex]}</span>
          </div>`;
        els.reviewList.appendChild(item);
      });

      hide(els.quiz);
      show(els.result);

      // CSV cache
      window.__lastCsv = [
        ['#','Întrebare','Răspunsul tău','Răspuns corect','Corect?'],
        ...used.map((q,i)=>[
          i+1,
          q.text,
          q.choices[answers[q.id]] ?? '',
          q.choices[q.correctIndex],
          (answers[q.id]===q.correctIndex ? 'Da' : 'Nu')
        ])
      ];
    }

    // Exporturi
    function exportCSV(){
      const rows = window.__lastCsv || [];
      if(!rows.length){ alert('Nu există rezultate de exportat.'); return; }
      const csv = rows.map(r=>r.map(field => `"${String(field).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rezultate_quiz.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    function exportPDF(){ window.print(); }

    // Resetare workflow
    function resetToStart(){
      hide(els.quiz);
      hide(els.result);
      show(els.start);
      setStats({correct:0, wrong:0});
      answers = {};
      picked = [];
      current = 0;
      els.timer.textContent = '00:00';
      els.timer.classList.remove('warning');
      const bar = document.getElementById('bar');
      if(bar) bar.style.width = '0%';
    }

    // ===== Evenimente UI =====
    els.startBtn?.addEventListener('click', startQuiz);
    els.nextBtn?.addEventListener('click', next);
    els.finishBtn?.addEventListener('click', finish);
    els.retryBtn?.addEventListener('click', resetToStart);
    els.btnCsv?.addEventListener('click', exportCSV);
    els.btnPdf?.addEventListener('click', exportPDF);
    els.btnAll?.addEventListener('click', ()=> selectAll());
    els.btn20?.addEventListener('click', ()=> selectRandom(20));

    // Preset timp: butoane segment
    segBtns.forEach(b=>{
      b.addEventListener('click', ()=>{
        segBtns.forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        quizMinutes = Number(b.dataset.min || 20);
        try{ localStorage.setItem('spt_quiz_minutes', String(quizMinutes)); }catch{}
      });
    });
    // Restore timp din localStorage
    try{
      const saved = Number(localStorage.getItem('spt_quiz_minutes'));
      if(saved){
        quizMinutes = saved;
        segBtns.forEach(x=>{
          if(Number(x.dataset.min) === saved) x.classList.add('active');
          else x.classList.remove('active');
        });
      }
    }catch{}

    // Bootstrap
    bootstrap();
  }
})();
