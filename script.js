const STORAGE_KEY = 'students';
let students = [];
let selectedId = null;

function uid(){ return 's_' + Math.random().toString(36).slice(2,9); }

function pct(s){ return s.total === 0 ? 0 : (s.present / s.total) * 100; }

function badgeInfo(p){
  if(p >= 85) return {label:'High', cls:'high'};
  if(p >= 75) return {label:'Moderate', cls:'moderate'};
  return {label:'Low', cls:'low'};
}

function currentStreak(history){
  let streak = 0;
  for(let i = history.length - 1; i >= 0; i--){
    if(history[i]) streak++;
    else break;
  }
  return streak;
}

// classes needed, attending consecutively, to reach 75%
function classesNeededFor75(present, total){
  const raw = 3*total - 4*present;
  return raw > 0 ? Math.ceil(raw) : 0;
}

// classes that can still be skipped while staying at/above 75%
function classesCanSkip(present, total){
  if(total === 0) return 0;
  const raw = Math.floor(present/0.75 - total);
  return raw > 0 ? raw : 0;
}

async function loadStudents(){
  try{
    const res = await window.storage.get(STORAGE_KEY, false);
    students = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){
    students = [];
  }
  render();
}

async function saveStudents(){
  try{
    await window.storage.set(STORAGE_KEY, JSON.stringify(students), false);
  }catch(e){
    console.error('Could not save', e);
  }
}

function addStudent(name){
  students.push({ id: uid(), name, present: 0, total: 0, history: [] });
  saveStudents();
  render();
}

function mark(id, present){
  const s = students.find(x => x.id === id);
  if(!s) return;
  s.total++;
  if(present) s.present++;
  s.history.push(present);
  if(s.history.length > 60) s.history.shift();
  saveStudents();
  render();
}

function undoLast(id){
  const s = students.find(x => x.id === id);
  if(!s || s.history.length === 0) return;
  const last = s.history.pop();
  s.total--;
  if(last) s.present--;
  saveStudents();
  render();
}

function removeStudent(id){
  students = students.filter(x => x.id !== id);
  if(selectedId === id) selectedId = null;
  saveStudents();
  render();
}

function selectStudent(id){
  selectedId = (selectedId === id) ? null : id;
  render();
}

function render(){
  renderStats();
  renderRoster();
  renderDetail();
}

function renderStats(){
  const total = students.length;
  const below75 = students.filter(s => s.total > 0 && pct(s) < 75).length;
  const avg = total === 0 ? 0 : students.reduce((a,s)=>a+pct(s),0)/total;
  document.getElementById('stats').innerHTML = `
    <div><span>${total}</span> students</div>
    <div><span>${avg.toFixed(0)}%</span> class avg</div>
    <div><span>${below75}</span> below 75%</div>
  `;
}

function renderRoster(){
  const body = document.getElementById('rosterBody');
  if(students.length === 0){
    body.innerHTML = `<tr><td colspan="6" class="empty">No students yet — add one above.</td></tr>`;
    return;
  }
  body.innerHTML = students.map(s => {
    const p = pct(s);
    const b = badgeInfo(p);
    const streak = currentStreak(s.history);
    const warn = s.total > 0 && p < 80;
    return `
      <tr class="${selectedId === s.id ? 'selected' : ''}" onclick="selectStudent('${s.id}')">
        <td data-label="Name" class="name-cell">${s.name}
          ${streak > 1 ? `<span class="streak">${streak} day streak</span>` : ''}
        </td>
        <td data-label="Present">${s.present}/${s.total}</td>
        <td data-label="%"><span class="pct">${s.total ? p.toFixed(1) + '%' : '—'}</span></td>
        <td data-label="Status">
          <span class="badge ${b.cls}">${b.label}</span>
          ${warn ? '<span class="warn" title="Below 80% — attendance is slipping">&#9888;</span>' : ''}
        </td>
        <td data-label="Mark today">
          <div class="mark-actions" onclick="event.stopPropagation()">
            <button class="present" onclick="mark('${s.id}', true)">Present</button>
            <button class="absent" onclick="mark('${s.id}', false)">Absent</button>
          </div>
        </td>
        <td onclick="event.stopPropagation()">
          <button class="icon-btn" title="Undo last mark" onclick="undoLast('${s.id}')">&#8630;</button>
          <button class="icon-btn" title="Remove student" onclick="removeStudent('${s.id}')">&times;</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderDetail(){
  const el = document.getElementById('detail');
  const s = students.find(x => x.id === selectedId);
  if(!s){ el.hidden = true; return; }
  el.hidden = false;

  const p = pct(s);
  const b = badgeInfo(p);
  const streak = currentStreak(s.history);
  const needed = classesNeededFor75(s.present, s.total);
  const canSkip = classesCanSkip(s.present, s.total);

  let tips = [];
  if(p < 75){
    tips.push(`Attend the next ${needed} class${needed===1?'':'es'} in a row without missing one to climb back to 75%.`);
    tips.push('Talk to the course coordinator about condonation rules before it affects exam eligibility.');
    tips.push('Set a recurring alarm 30 minutes before the class that gets skipped most often.');
  } else if(p < 80){
    tips.push('You are close to the 75% line — one more miss could push you below it. Prioritise this class this week.');
    tips.push(`You can afford to miss ${canSkip} more class${canSkip===1?'':'es'} and stay at or above 75%.`);
  } else {
    tips.push(`Comfortable margin — you can miss up to ${canSkip} more class${canSkip===1?'':'es'} and stay above 75%.`);
    tips.push('Keep the streak going: consistency compounds faster than last-minute catch-up.');
  }

  el.innerHTML = `
    <h3>${s.name}</h3>
    <span class="badge ${b.cls}">${b.label} attendance</span>
    ${streak > 1 ? `<span class="badge" style="background:#555">${streak}-day streak</span>` : ''}
    <div class="detail-note">${s.present} attended out of ${s.total} class${s.total===1?'':'es'} recorded so far.</div>
    <div class="calc-row">
      <div class="calc-card">
        <div class="val">${p < 75 ? needed : canSkip}</div>
        <div class="lbl">${p < 75 ? 'classes to attend in a row to reach 75%' : 'classes that can still be missed, staying at/above 75%'}</div>
      </div>
      <div class="calc-card">
        <div class="val">${streak}</div>
        <div class="lbl">current consecutive-present streak</div>
      </div>
    </div>
    <ul>
      ${tips.map(t => `<li>${t}</li>`).join('')}
    </ul>
  `;
}

document.getElementById('addForm').addEventListener('submit', function(e){
  e.preventDefault();
  const input = document.getElementById('nameInput');
  const name = input.value.trim();
  if(!name) return;
  addStudent(name);
  input.value = '';
});

loadStudents();
