document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.API_BASE || '';
  const roomSelect = document.getElementById('room');
  const summaryTitle = document.getElementById('summaryTitle');
  const summaryHead = document.getElementById('summaryHead');
  const summaryBody = document.getElementById('summaryBody');
  const detailTableArea = document.getElementById('detailTableArea');
  const detailTitle = document.getElementById('detailTitle');
  const detailBody = document.getElementById('detailBody');
  const backBtn = document.getElementById('backBtn');
  const status = document.getElementById('status');
  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  const jumpDateInput = document.getElementById('jumpDate');

  let slots = [];
  let baseDate = new Date();

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

  function formatKoreanDate(dLike) {
    const d = new Date(dLike);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
  }
  
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function renderCurrentWeek() {
    const monday = getMonday(baseDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dateRangeText = `${formatKoreanDate(monday)} ~ ${formatKoreanDate(sunday)}`;
    document.getElementById('dateRangeLabel').textContent = dateRangeText;
    
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
      const weekNames = ['일', '월', '화', '수', '목', '금', '토'];
      const day = `${date.getMonth() + 1}/${date.getDate()} (${weekNames[date.getDay()]})`;
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
    detailTableArea.style.display = 'block';
    document.getElementById('summaryTableArea').style.display = 'none';
    detailTitle.textContent = `${room} - ${date} 상세 시간표`;
    document.getElementById('dateRangeLabel').textContent = formatKoreanDate(date);

    try {
      const data = await getJSON(`${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`);
      detailBody.innerHTML = '';
      if (!data.reservations || data.reservations.length === 0) {
        detailBody.innerHTML = '<tr><td colspan="3">예약 없음</td></tr>';
        return;
      }
      data.reservations.forEach(r => {
        const row = document.createElement('tr');
        // ✅ 올바른 매핑: 시간 / 강의행사명 / 예약자
        row.innerHTML = `<td>${r[3]}~${r[4]}</td><td>${r[6]}</td><td>${r[5]}</td>`;
        detailBody.appendChild(row);
      });
    } catch {
      showStatus('상세 시간표 불러오기 실패');
    }
  }

  backBtn.addEventListener('click', () => {
    detailTableArea.style.display = 'none';
    document.getElementById('summaryTableArea').style.display = 'block';
    renderCurrentWeek();  // ✅ 요거 추가해야 주간 범위가 다시 표시됨
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('clickable-date') && e.target.dataset.date) {
      showDetail(e.target.dataset.date, roomSelect.value || 'R1');
    }
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
  } catch {
    showStatus('시간 구간 불러오기 실패');
    return;
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
