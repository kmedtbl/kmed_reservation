document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.API_BASE || '';
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const startSelect = document.getElementById('start');
  const endSelect = document.getElementById('end');
  const byInput = document.getElementById('by');
  const noteInput = document.getElementById('note');
  const resultDiv = document.getElementById('result');
  const submitBtn = document.getElementById('submitBtn');

  // 오늘 날짜 기본 설정
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];

  function showResult(msg, isError = true) {
    resultDiv.textContent = msg;
    resultDiv.style.color = isError ? '#c00' : '#0a0';
    resultDiv.style.display = msg ? 'block' : 'none';
  }

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

  // 강의실 불러오기
  try {
    showResult('강의실 목록을 불러오는 중...', false);
    const roomData = await getJSON(`${API_BASE}/api/reservations?mode=rooms`);
    if (!roomData.rooms || !Array.isArray(roomData.rooms)) throw new Error();
    roomSelect.innerHTML = '<option value="">선택하세요</option>';
    roomData.rooms.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room;
      opt.textContent = room;
      roomSelect.appendChild(opt);
    });
    showResult('');
  } catch {
    showResult('강의실 목록을 불러오지 못했습니다.', true);
  }

  // 시간 구간 불러오기
  try {
    const slotData = await getJSON(`${API_BASE}/api/reservations?mode=slots`);
    if (!slotData.slots || !Array.isArray(slotData.slots)) throw new Error();
    startSelect.innerHTML = '<option value="">선택</option>';
    endSelect.innerHTML = '<option value="">선택</option>';
    slotData.slots.forEach(slot => {
      const [start, end] = slot;
      const startOpt = document.createElement('option');
      startOpt.value = start;
      startOpt.textContent = start;
      startSelect.appendChild(startOpt);

      const endOpt = document.createElement('option');
      endOpt.value = end;
      endOpt.textContent = end;
      endSelect.appendChild(endOpt);
    });
  } catch {
    showResult('시간 구간을 불러오지 못했습니다.', true);
  }

  // 예약 등록
  submitBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const room = roomSelect.value;
    const start = startSelect.value;
    const end = endSelect.value;
    const by = byInput.value.trim();
    const note = noteInput.value.trim();

    if (!date || !room || !start || !end || !by) {
      showResult('모든 필수 항목을 입력해주세요.', true);
      return;
    }

    try {
      showResult('예약을 등록 중입니다...', false);
      const res = await fetch(`${API_BASE}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, room, start, end, by, note })
      });
      const data = await res.json();

      if (data.success) {
        showResult('예약이 등록되었습니다.', false);
      } else {
        showResult(`예약 실패: ${data.error || '알 수 없는 오류'}`, true);
      }
    } catch (err) {
      console.error('예약 등록 오류:', err);
      showResult('예약 등록 중 오류가 발생했습니다.', true);
    }
  });
});
