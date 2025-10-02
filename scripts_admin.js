document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.API_BASE || '';

  // 요소 참조
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
  const endSelect = document.getElementById('end');
  const titleInput = document.getElementById('title');
  const byInput = document.getElementById('by');
  const conflictWarning = document.getElementById('conflictWarning');
  const repeatToggle = document.getElementById('repeatToggle');
  const repeatWeeks = document.getElementById('repeatWeeks');
  const submitBtn = document.getElementById('submitBtn');
  const resultDiv = document.getElementById('result');
  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  const jumpDateInput = document.getElementById('jumpDate');
  const status = document.getElementById('status');

  let slots = [];
  let baseDate = new Date();
  let currentDate = null;  // 상세보기 중인 날짜
  let currentRoom = null;  // 현재 선택된 강의실
  let currentReservations = [];

  function showStatus(msg, isError = true) {
    status.textContent = msg;
    status.style.color = isError ? '#c00' : '#0a0';
    status.style.display = msg ? 'block' : 'none';
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
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

  function formatKoreanDate(d) {
    return new Date(d).toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
    await Promise.all(dates.map(async (date) => {
      const data = await getJSON(`${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`);
      scheduleMap[date] = data.reservations || [];
    }));

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

  async function showDetail(date, room) {
    currentDate = date;
    currentRoom = room;

    detailTableArea.style.display = 'block';
    document.getElementById('summaryTableArea').style.display = 'none';
    detailTitle.textContent = `${room} - ${formatKoreanDate(date)} 일정`;

    try {
      const data = await getJSON(`${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`);
      currentReservations = data.reservations || [];
      detailBody.innerHTML = '';
      if (currentReservations.length === 0) {
        detailBody.innerHTML = '<tr><td colspan="3">예약 없음</td></tr>';
        return;
      }
      currentReservations.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${r[3]}~${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td>`;
        detailBody.appendChild(row);
      });
    } catch {
      showStatus('상세 시간표 불러오기 실패');
    }
  }

  function checkConflict(start, end) {
    return currentReservations.some(r => overlaps(start, end, r[3], r[4]));
  }

  function resetForm() {
    startSelect.value = '';
    endSelect.value = '';
    titleInput.value = '';
    byInput.value = '';
    conflictWarning.style.display = 'none';
    repeatToggle.checked = false;
    repeatWeeks.disabled = true;
    resultDiv.textContent = '';
  }

  toggleFormBtn.addEventListener('click', () => {
    reservationForm.style.display = reservationForm.style.display === 'none' ? 'block' : 'none';
  });

  repeatToggle.addEventListener('change', () => {
    repeatWeeks.disabled = !repeatToggle.checked;
  });

  submitBtn.addEventListener('click', async () => {
    const start = startSelect.value;
    const end = endSelect.value;
    const title = titleInput.value.trim();
    const by = byInput.value.trim();
    const repeat = repeatToggle.checked;
    const weeks = parseInt(repeatWeeks.value);

    if (!currentDate || !currentRoom || !start || !end || !title || !by) {
      resultDiv.textContent = '모든 항목을 입력해주세요.';
      return;
    }

    // 충돌 확인
    if (checkConflict(start, end)) {
      conflictWarning.style.display = 'block';
      return;
    } else {
      conflictWarning.style.display = 'none';
    }

    const payload = {
      date: currentDate,
      room: currentRoom,
      start,
      end,
      title,
      by,
      repeat,
      weeks
    };

    const res = await fetch(`${API_BASE}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      alert('예약이 등록되었습니다.');
      reservationForm.style.display = 'none';
      resetForm();
      renderCurrentWeek(); // 요약표로 복귀
      detailTableArea.style.display = 'none';
      document.getElementById('summaryTableArea').style.display = 'block';
    } else {
      resultDiv.textContent = '예약 실패: ' + (data.error || '알 수 없는 오류');
    }
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('clickable-date') && e.target.dataset.date) {
      showDetail(e.target.dataset.date, roomSelect.value || 'R1');
    }
  });

  backBtn.addEventListener('click', () => {
    detailTableArea.style.display = 'none';
    document.getElementById('summaryTableArea').style.display = 'block';
  });

  roomSelect.addEventListener('change', () => {
    renderCurrentWeek();
  });

  prevWeekBtn.addEventListener('click', () => {
    baseDate.setDate(baseDate.getDate() - 7);
    renderCurrentWeek();
  });

  nextWeekBtn.addEventListener('click', () => {
    baseDate.setDate(baseDate.getDate() + 7);
    renderCurrentWeek();
  });

  jumpDateInput.addEventListener('change', (e) => {
    const picked = new Date(e.target.value);
    if (!isNaN(picked)) {
      baseDate = picked;
      renderCurrentWeek();
    }
  });

  try {
    const slotData = await getJSON(`${API_BASE}/api/reservations?mode=slots`);
    slots = slotData.slots || [];

    slots.forEach(([start, end]) => {
      const sOpt = document.createElement('option');
      sOpt.value = start;
      sOpt.textContent = start;
      startSelect.appendChild(sOpt);

      const eOpt = document.createElement('option');
      eOpt.value = end;
      eOpt.textContent = end;
      endSelect.appendChild(eOpt);
    });
  } catch {
    showStatus('시간 구간 불러오기 실패');
  }

  try {
    const roomData = await getJSON(`${API_BASE}/api/reservations?mode=rooms`);
    roomSelect.innerHTML = '';
    roomData.rooms.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      roomSelect.appendChild(opt);
    });

    if (roomData.rooms.length > 0) {
      roomSelect.value = roomData.rooms[0];
    }

    renderCurrentWeek();
  } catch {
    showStatus('강의실 목록 불러오기 실패');
  }
});
