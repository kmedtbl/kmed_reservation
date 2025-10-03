const API_BASE = window.API_BASE || '';

document.addEventListener('DOMContentLoaded', async () => {
  const roomSelect = document.getElementById('room');
  const summaryTitle = document.getElementById('summaryTitle');
  const summaryHead = document.getElementById('summaryHead');
  const summaryBody = document.getElementById('summaryBody');
  const detailTitle = document.getElementById('detailTitle');
  const detailTableArea = document.getElementById('detailTableArea');
  const detailBody = document.getElementById('detailBody');
  const backBtn = document.getElementById('backBtn');
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const reservationForm = document.getElementById('reservationForm');
  const startSelect = document.getElementById('start');
  const endSelect   = document.getElementById('end');
  const titleInput  = document.getElementById('title');
  const byInput     = document.getElementById('by');
  const conflictWarning = document.getElementById('conflictWarning');
  const repeatToggle = document.getElementById('repeatToggle');
  const repeatWeeks  = document.getElementById('repeatWeeks');
  const submitBtn    = document.getElementById('submitBtn');
  const prevWeekBtn  = document.getElementById('prevWeekBtn');
  const nextWeekBtn  = document.getElementById('nextWeekBtn');
  const jumpDateInput= document.getElementById('jumpDate');
  const status       = document.getElementById('status');

  let slots = [];
  let baseDate = new Date();
  let currentDate = null;   // Date 객체로 유지
  let currentRoom = null;
  let currentReservations = [];

  function showStatus(msg, isError = true) {
    status.textContent = msg;
    status.style.color = isError ? '#c00' : '#0a0';
    status.style.display = msg ? 'block' : 'none';
  }

  // ---------- 시간 유틸 ----------
  const HM_RE = /^\d{1,2}:\d{2}$/;
  function isValidHM(t){ return typeof t === 'string' && HM_RE.test(t); }
  function timeToMinutes(t) {
    if (!isValidHM(t)) return NaN;
    const [h, m] = t.split(':').map(s => Number(s));
    return h * 60 + m;
  }
  function endLaterThanStart(start,end){
    const s = timeToMinutes(start), e = timeToMinutes(end);
    return Number.isFinite(s) && Number.isFinite(e) && e > s;
  }
  function overlaps(s1, e1, s2, e2) {
    return Math.max(timeToMinutes(s1), timeToMinutes(s2)) < Math.min(timeToMinutes(e1), timeToMinutes(e2));
  }

  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }
  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }
  function formatKoreanDate(dLike) {
    const d = new Date(dLike);
    return d.toLocaleDateString('ko-KR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function renderCurrentWeek() {
    const monday = getMonday(baseDate);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    });
    renderSummary(roomSelect.value || 'R1', dates);
  }

  async function renderSummary(room, dates) {
    summaryTitle.textContent = `일주일 예약 현황 (${room})`;
    summaryHead.innerHTML = '';
    summaryBody.innerHTML = '';

    const headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('th'));
    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      const day = date.toLocaleDateString('ko-KR', { weekday: 'short', month: 'numeric', day: 'numeric' });
      const th = document.createElement('th');
      th.textContent = day;
      th.dataset.date = dateStr;
      th.classList.add('clickable-date');
      headRow.appendChild(th);
    });
    summaryHead.appendChild(headRow);

    const scheduleMap = {};
    await Promise.all(
      dates.map(async date => {
        const data = await getJSON(
          `${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`
        );
        scheduleMap[date] = data.reservations || [];
      })
    );

    slots.forEach(([start, end]) => {
      const tr = document.createElement('tr');
      const timeTd = document.createElement('td');
      timeTd.textContent = `${start}~${end}`;
      tr.appendChild(timeTd);

      dates.forEach(dateStr => {
        const td = document.createElement('td');
        const reservations = scheduleMap[dateStr] || [];
        const hasConflict = reservations.some(r => overlaps(start, end, r[3], r[4]));
        const dot = document.createElement('span');
        dot.className = `status-dot ${hasConflict ? 'unavailable' : 'available'}`;
        td.appendChild(dot);
        td.dataset.date = dateStr;
        td.classList.add('clickable-date');
        tr.appendChild(td);
      });

      summaryBody.appendChild(tr);
    });
  }

  async function showDetail(dateArg, room) {
    // dateArg가 string이든 Date든 안전 처리
    const dateStr = typeof dateArg === 'string' ? dateArg : formatDate(dateArg);
    currentDate = typeof dateArg === 'string' ? new Date(dateArg) : dateArg;
    currentRoom = room;

    detailTableArea.style.display = 'block';
    document.getElementById('summaryTableArea').style.display = 'none';
    detailTitle.textContent = `${room} - ${formatKoreanDate(dateStr)} 일정`;

    try {
      const data = await getJSON(
        `${API_BASE}/api/reservations?mode=schedule&date=${dateStr}&room=${encodeURIComponent(room)}`
      );
      currentReservations = data.reservations || [];
      currentReservations.sort((a, b) => a[3].localeCompare(b[3]));
      detailBody.innerHTML = '';
      if (currentReservations.length === 0) {
        detailBody.innerHTML = '<tr><td colspan="4">예약 없음</td></tr>';
        return;
      }
      currentReservations.forEach(r => {
        // r = [id, date, room, start, end, by, note]
        const row = document.createElement('tr');
        row.innerHTML =
          `<td>${r[3]}~${r[4]}</td><td>${r[6]}</td><td>${r[5]}</td>` +
          `<td><button class='delete-btn' data-info='${encodeURIComponent(JSON.stringify(r))}'>삭제</button></td>`;
        detailBody.appendChild(row);
      });
    } catch {
      showStatus('상세 시간표 불러오기 실패');
    }

    updateConflictWarning();
  }

  function resetForm() {
    startSelect.value = '';
    endSelect.value = '';
    titleInput.value = '';
    byInput.value = '';
    conflictWarning.style.display = 'none';
    repeatToggle.checked = false;
    repeatWeeks.disabled = true;
    Array.from(endSelect.options).forEach(opt => { opt.disabled = false; });
  }

  toggleFormBtn.addEventListener('click', () => {
    reservationForm.style.display = reservationForm.style.display === 'none' ? 'block' : 'none';
  });
  repeatToggle.addEventListener('change', () => {
    repeatWeeks.disabled = !repeatToggle.checked;
  });

  function restrictEndOptions() {
    const s = startSelect.value;
    const sMin = timeToMinutes(s);
    Array.from(endSelect.options).forEach(opt => {
      if (!isValidHM(opt.value)) { opt.disabled = true; return; }
      const eMin = timeToMinutes(opt.value);
      opt.disabled = !(Number.isFinite(sMin) && Number.isFinite(eMin) && eMin > sMin);
    });
    if (endSelect.value && (endSelect.selectedOptions[0]?.disabled)) {
      endSelect.value = '';
    }
  }

  function updateConflictWarning() {
    const s = startSelect.value, e = endSelect.value;
    if (isValidHM(s) && isValidHM(e) && endLaterThanStart(s,e)) {
      const has = currentReservations.some(r => overlaps(s,e,r[3],r[4]));
      conflictWarning.style.display = has ? 'block' : 'none';
    } else {
      conflictWarning.style.display = 'none';
    }
  }

  startSelect.addEventListener('change', () => { restrictEndOptions(); updateConflictWarning(); });
  endSelect.addEventListener('change',   () => { updateConflictWarning(); });

  // ------- 제출(등록) -------
  submitBtn.addEventListener('click', async () => {
    const start = startSelect.value.trim();
    const end   = endSelect.value.trim();
    const note  = titleInput.value.trim();  // 강의/행사명 = note
    const by    = byInput.value.trim();
    const repeat= repeatToggle.checked;
    const weeks = parseInt(repeatWeeks.value || '1');

    if (!currentDate || !currentRoom || !start || !end || !note || !by) {
      alert('모든 항목을 입력해주세요.');
      return;
    }
    if (!isValidHM(start) || !isValidHM(end)) {
      alert('시간 형식이 올바르지 않습니다. 예) 09:00');
      return;
    }
    if (!endLaterThanStart(start, end)) {
      alert('종료시간은 시작시간보다 늦어야 합니다.');
      return;
    }

    let output = '';

    for (let i = 0; i < (repeat ? weeks : 1); i++) {
      if (!endLaterThanStart(start, end)) {
        output += `❌ 잘못된 시간: 종료가 시작보다 이릅니다.\n`;
        continue;
      }

      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + i * 7);
      const dateStr = formatDate(newDate);

      const payload = { date: dateStr, room: currentRoom, start, end, note, by };

      try {
        const res = await fetch(`${API_BASE}/api/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          output += `✅ ${dateStr} 예약 성공\n`;
        } else {
          output += `❌ ${dateStr} 실패: ${data.error || '알 수 없는 오류'}\n`;
        }
      } catch (err) {
        output += `❌ ${dateStr} 오류 발생\n`;
      }
    }

    alert(output);
    reservationForm.style.display = 'none';
    resetForm();
    renderCurrentWeek();
    detailTableArea.style.display = 'none';
    document.getElementById('summaryTableArea').style.display = 'block';
  });

  // ------- 날짜 클릭/뒤로가기 -------
  document.addEventListener('click', e => {
    if (e.target.classList.contains('clickable-date') && e.target.dataset.date) {
      showDetail(e.target.dataset.date, roomSelect.value || 'R1');
    }
  });
  backBtn.addEventListener('click', () => {
    detailTableArea.style.display = 'none';
    document.getElementById('summaryTableArea').style.display = 'block';
  });

  // ------- 주간 네비 -------
  roomSelect.addEventListener('change', renderCurrentWeek);
  prevWeekBtn.addEventListener('click', () => { baseDate.setDate(baseDate.getDate() - 7); renderCurrentWeek(); });
  nextWeekBtn.addEventListener('click', () => { baseDate.setDate(baseDate.getDate() + 7); renderCurrentWeek(); });
  jumpDateInput.addEventListener('change', (e) => {
    const picked = new Date(e.target.value);
    if (!isNaN(picked)) { baseDate = picked; renderCurrentWeek(); }
  });

  // ---------- 초기 로딩 ----------
  try {
    const slotData = await getJSON(`${API_BASE}/api/reservations?mode=slots`);
    slots = slotData.slots || [];
    slots.forEach(([start, end]) => {
      const sOpt = document.createElement('option'); sOpt.value = start; sOpt.textContent = start; startSelect.appendChild(sOpt);
      const eOpt = document.createElement('option'); eOpt.value = end;   eOpt.textContent = end;   endSelect.appendChild(eOpt);
    });
  } catch {
    showStatus('시간 구간 불러오기 실패');
  }

  try {
    const roomData = await getJSON(`${API_BASE}/api/reservations?mode=rooms`);
    roomSelect.innerHTML = '';
    (roomData.rooms || []).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      roomSelect.appendChild(opt);
    });
    if ((roomData.rooms || []).length > 0) {
      roomSelect.value = roomData.rooms[0];
    }
    renderCurrentWeek();
  } catch {
    showStatus('강의실 목록 불러오기 실패');
  }

  // ---------- 삭제 ----------
  detailBody.addEventListener('click', async e => {
    if (!e.target.classList.contains('delete-btn')) return;
    const confirmDelete = confirm('정말 이 예약을 삭제하시겠습니까?');
    if (!confirmDelete) return;

    const raw = decodeURIComponent(e.target.dataset.info);
    // r = [id, date, room, start, end, by, note]
    const [id, , room, start, end, actualBy, actualNote] = JSON.parse(raw);
    const dateStr = currentDate instanceof Date ? formatDate(currentDate) : String(currentDate);

    // 가능한 한 id 기반 삭제가 가장 정확함
    const payload = { mode: 'delete', id, date: dateStr, room, start, end, note: actualNote, by: actualBy };

    try {
      const res = await fetch(`${API_BASE}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        alert('예약이 삭제되었습니다.');
        baseDate = new Date(currentDate);         // ✅ baseDate 업데이트
        renderCurrentWeek();                      // ✅ 주간 화면 리렌더링
        detailTableArea.style.display = 'none';  // ✅ 상세 화면 숨김
        document.getElementById('summaryTableArea').style.display = 'block'; // ✅ 주간 요약 보이기
      } else {
        console.error('❌ 삭제 실패 - payload:', payload);
        alert('삭제 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('서버 통신 오류로 삭제 실패');
      console.error(err);
    }
  });
});
