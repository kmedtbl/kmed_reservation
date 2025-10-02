document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const startSelect = document.getElementById('start');
  const endSelect = document.getElementById('end');
  const byInput = document.getElementById('by');
  const noteInput = document.getElementById('note');
  const resultDiv = document.getElementById('result');
  const submitBtn = document.getElementById('submitBtn');

  // 기본값: 오늘 날짜
  dateInput.valueAsDate = new Date();

  // 🔧 강의실 불러오기 (API가 문자열 배열을 반환하므로 room.name이 아니라 room 그대로 사용)
  const roomRes = await fetch('/api/reservations?mode=rooms');
  const roomData = await roomRes.json();
  roomData.rooms.forEach(roomName => {
    const opt = document.createElement('option');
    opt.value = roomName;       // room.name ❌ → roomName ✅
    opt.textContent = roomName; // room.name ❌ → roomName ✅
    roomSelect.appendChild(opt);
  });

  // 시간 구간 불러오기
  const slotRes = await fetch('/api/reservations?mode=slots');
  const slotData = await slotRes.json();
  slotData.slots.forEach(slot => {
    const startOpt = document.createElement('option');
    startOpt.value = slot[0];
    startOpt.textContent = slot[0];
    startSelect.appendChild(startOpt);

    const endOpt = document.createElement('option');
    endOpt.value = slot[1];
    endOpt.textContent = slot[1];
    endSelect.appendChild(endOpt);
  });

  submitBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const room = roomSelect.value;
    const start = startSelect.value;
    const end = endSelect.value;
    const by = byInput.value;
    const note = noteInput.value;

    if (!date || !room || !start || !end || !by) {
      resultDiv.textContent = '모든 필수 항목을 입력해주세요.';
      return;
    }

    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, room, start, end, by, note })
    });
    const data = await res.json();

    if (data.success) {
      resultDiv.textContent = '예약이 등록되었습니다.';
    } else {
      resultDiv.textContent = '예약 실패: ' + (data.error || '알 수 없는 오류');
    }
  });
});
