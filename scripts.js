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

  const DAYS = 7;
  let slots = [];
  let selectedRoom = 'R1';

  function showStatus(msg, isError = true) {
    status.textContent = msg;
    status.style.color = isError ? '#c00' : '#0a0';
    status.style.display = msg ? 'block' : 'none';
  }

  function getDateStr(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // 강의실 목록 불러오기
  try {
    const roomData = await getJSON(`${API_BASE}/api/reservations?mode=rooms`);
    roomSelect.innerHTML = '';
    roomData.rooms.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      roomSelect.appendChild(opt);
    });
    roomSelect.value = 'R1';
  } catch (err) {
    showStatus('강의실 목록 불러오기 실패');
  }

  // 시간 구간 불러오기
  try {
    const slotData = await getJSON(`${API_BASE}/api/reservations?mode=slots`);
    slots = slotData.slots || [];
  } catch {
    showStatus('시간 구간 불러오기 실패');
  }

  // 요약표 생성
  async function renderSummary(room) {
    summaryTitle.textContent = `일주일 예약 현황 (${room})`;
    summaryHead.innerHTML = '';
    summaryBody.innerHTML = '';

    // 헤더 행: 날짜
    const headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('th')); // 시간 칸
    for (let i = 0; i < DAYS; i++) {
      const dateStr = getDateStr(i);
      const th = document.createElement('th');
      const date = new Date(dateStr);
      const day = date.toLocaleDateString('ko-KR', { weekday: 'short', month: 'numeric', day: 'numeric' });
      th.textContent = day;
      th.dataset.date = dateStr;
      th.classList.add('clickable-date');
      headRow.appendChild(th);
    }
    summaryHead.appendChild(headRow);

    // 날짜별 예약정보 병렬로 받아오기
    const scheduleMap = {};
    await Promise.all(Array.from({ length: DAYS }, async (_, i) => {
      const date = getDateStr(i);
      const data = await getJSON(`${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`);
      scheduleMap[date] = data.reservations || [];
    }));

    // 행: 시간 슬롯별 예약 여부
    slots.forEach(([start, end]) => {
      const tr = document.createElement('tr');
      const timeTd = document.createElement('td');
      timeTd.textContent = `${start}~${end}`;
      tr.appendChild(timeTd);

      for (let i = 0; i < DAYS; i++) {
        const dateStr = getDateStr(i);
        const td = document.createElement('td');
        const reservations = scheduleMap[dateStr];
        const hasConflict = reservations.some(r => r[3] === start && r[4] === end);

        const dot = document.createElement('span');
        dot.className = `status-dot ${hasConflict ? 'unavailable' : 'available'}`;
        td.appendChild(dot);
        td.dataset.date = dateStr;
        td.classList.add('clickable-date');
        tr.appendChild(td);
      }

      summaryBody.appendChild(tr);
    });
  }

  // 상세표 렌더링
  async function showDetail(date, room) {
    detailTableArea.style.display = 'block';
    document.getElementById('summaryTableArea').style.display = 'none';
    detailTitle.textContent = `${room} - ${date} 상세 시간표`;

    try {
      const data = await getJSON(`${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`);
      detailBody.innerHTML = '';
      if (!data.reservations || data.reservations.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3">예약 없음</td>';
        detailBody.appendChild(row);
        return;
      }
      data.reservations.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${r[3]}~${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td>`;
        detailBody.appendChild(row);
      });
    } catch (err) {
      showStatus('상세 시간표 불러오기 실패');
    }
  }

  // 돌아가기
  backBtn.addEventListener('click', () => {
    detailTableArea.style.display = 'none';
    document.getElementById('summaryTableArea').style.display = 'block';
  });

  // 날짜 클릭 → 상세로 이동
  document.addEventListener('click', e => {
    if (e.target.classList.contains('clickable-date') && e.target.dataset.date) {
      showDetail(e.target.dataset.date, roomSelect.value || 'R1');
    }
  });

  // 강의실 변경 시 갱신
  roomSelect.addEventListener('change', () => {
    selectedRoom = roomSelect.value;
    renderSummary(selectedRoom);
  });

  // 최초 로딩
  renderSummary('R1');
});
