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
  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  const jumpDateInput = document.getElementById('jumpDate');
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const reservationForm = document.getElementById('reservationForm');
  const startSelect = document.getElementById('start');
  const endSelect = document.getElementById('end');
  const titleInput = document.getElementById('title');
  const byInput = document.getElementById('by');
  const repeatToggle = document.getElementById('repeatToggle');
  const repeatWeeksWrapper = document.getElementById('repeatWeeksWrapper');
  const repeatWeeks = document.getElementById('repeatWeeks');
  const submitBtn = document.getElementById('submitBtn');
  const resultDiv = document.getElementById('result');

  let slots = [];
  let baseDate = new Date();
  let selectedDate = new Date();
  let selectedRoom = '';

  function showStatus(el, msg, isError = true) {
    el.textContent = msg;
    el.style.color = isError ? '#c00' : '#0a0';
    el.style.display = msg ? 'block' : 'none';
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

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function renderWeekSummary(room, monday) {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    });

    summaryTitle.textContent = `${room} - 주간 예약 현황`;
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

  async function renderDayDetail(date, room) {
    detailTableArea.style.display = 'block';
    document.getElementById('summaryTableArea').style.display = 'none';
    reservationForm.style.display = 'none';
    detailTitle.textContent = `${room} - ${date} 상세 예약표`;
    selectedDate = new Date(date);
    selectedRoom = room;

    try {
      const data = await getJSON(`${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`);
      detailBody.innerHTML = '';
      if (!data.reservations || data.reservations.length === 0) {
        detailBody.innerHTML = '<tr><td colspan="3">예약 없음</td></tr>';
        return;
      }
      data.reservations.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${r[3]}~${r[4]}</td><td>${r[6]}</td><td>${r[5]}</td>`;
        detailBody.appendChild(row);
      });
    } catch {
      showStatus(resultDiv, '상세 시간표 불러오기 실패');
    }
  }

  backBtn.addEventListener('click', () => {
    detailTableArea.style.display = 'none';
    document.getElementById('summaryTableArea').style.display = 'block';
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('clickable-date') && e.target.dataset.date) {
      renderDayDetail(e.target.dataset.date, roomSelect.value);
    }
  });

  toggleFormBtn.addEventListener('click', () => {
    reservationForm.style.display = reservationForm.style.display === 'none' ? 'block' : 'none';
  });

  repeatToggle.addEventListener('change', () => {
    repeatWeeksWrapper.style.display = repeatToggle.checked ? 'block' : 'none';
  });

  submitBtn.addEventListener('click', async () => {
    const start = startSelect.value;
    const end = endSelect.value;
    const by = byInput.value.trim();
    const title = titleInput.value.trim();
    const repeatCount = repeatToggle.checked ? parseInt(repeatWeeks.value) || 0 : 0;

    if (!start || !end || !by || !title) {
      showStatus(resultDiv, '모든 필드를 입력하세요.', true);
      return;
    }

    try {
      for (let i = 0; i <= repeatCount; i++) {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + i * 7);
        const payload = {
          date: formatDate(date),
          room: selectedRoom,
          start,
          end,
          by,
          note: title
        };
        await fetch(`${API_BASE}/api/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      showStatus(resultDiv, '예약이 등록되었습니다.', false);
      renderDayDetail(formatDate(selectedDate), selectedRoom);
    } catch (err) {
      showStatus(resultDiv, '예약 등록 실패', true);
    }
  });

  prevWeekBtn.addEventListener('click', () => {
    baseDate.setDate(baseDate.getDate() - 7);
    renderWeekSummary(roomSelect.value, getMonday(baseDate));
  });

  nextWeekBtn.addEventListener('click', () => {
    baseDate.setDate(baseDate.getDate() + 7);
    renderWeekSummary(roomSelect.value, getMonday(baseDate));
  });

  jumpDateInput.addEventListener('change', (e) => {
    const picked = new Date(e.target.value);
    if (!isNaN(picked)) {
      baseDate = picked;
      renderWeekSummary(roomSelect.value, getMonday(baseDate));
    }
  });

  try {
    const roomData = await getJSON(`${API_BASE}/api/reservations?mode=rooms`);
    roomSelect.innerHTML = '';
    roomData.rooms.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      roomSelect.appendChild(opt);
    });
    roomSelect.value = roomData.rooms[0];
  } catch {
    showStatus(resultDiv, '강의실 목록 불러오기 실패');
  }

  try {
    const slotData = await getJSON(`${API_BASE}/api/reservations?mode=slots`);
    slots = slotData.slots || [];
    slots.forEach(([time]) => {
      const opt1 = document.createElement('option');
      opt1.value = time;
      opt1.textContent = time;
      startSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = time;
      opt2.textContent = time;
      endSelect.appendChild(opt2);
    });
  } catch {
    showStatus(resultDiv, '시간 구간 불러오기 실패');
  }

  renderWeekSummary(roomSelect.value, getMonday(baseDate));
});
