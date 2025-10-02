document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.API_BASE || '';
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const loadBtn = document.getElementById('loadBtn');
  const scheduleArea = document.getElementById('scheduleArea');
  const scheduleBody = document.getElementById('scheduleBody');
  const statusEl = document.getElementById('status');

  // 오늘 날짜 기본 설정
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];

  // 상태 메시지 표시
  function showStatus(msg, isError = true) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c00' : '#0a0';
    statusEl.style.display = msg ? 'block' : 'none';
  }

  // JSON 요청 유틸
  async function getJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[fetch error]', err);
      throw err;
    }
  }

  // 강의실 목록 불러오기
  try {
    showStatus('강의실 목록을 불러오는 중...');
    const roomData = await getJSON(`${API_BASE}/api/reservations?mode=rooms`);
    if (!roomData.rooms || !Array.isArray(roomData.rooms)) {
      throw new Error('rooms 배열이 비정상입니다.');
    }
    roomSelect.innerHTML = '<option value="">선택하세요</option>';
    roomData.rooms.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      roomSelect.appendChild(opt);
    });
    showStatus('');
  } catch (err) {
    showStatus('강의실 목록 불러오기 실패', true);
  }

  // 예약 현황 불러오기
  loadBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const room = roomSelect.value;
    if (!date || !room) {
      alert('날짜와 강의실을 모두 선택하세요.');
      return;
    }

    try {
      showStatus('예약 현황을 불러오는 중...');
      const url = `${API_BASE}/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`;
      const data = await getJSON(url);

      scheduleBody.innerHTML = '';

      if (!data.reservations || data.reservations.length === 0) {
        scheduleBody.innerHTML = '<tr><td colspan="3">예약 없음</td></tr>';
      } else {
        data.reservations.forEach(row => {
          // row가 배열 또는 객체일 수 있음
          const start = row[3] || row.start || '';
          const end = row[4] || row.end || '';
          const name = row[5] || row.name || '';
          const note = row[6] || row.note || '';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${start} - ${end}</td>
            <td>${name}</td>
            <td>${note}</td>
          `;
          scheduleBody.appendChild(tr);
        });
      }

      scheduleArea.style.display = 'block';
      showStatus('', false);
    } catch (err) {
      showStatus('예약 정보 불러오기 실패', true);
    }
  });
});
