// scripts_admin.js (관리자용)
document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const startSelect = document.getElementById('start');
  const endSelect = document.getElementById('end');
  const byInput = document.getElementById('by');
  const noteInput = document.getElementById('note');
  const resultDiv = document.getElementById('result');
  const submitBtn = document.getElementById('submitBtn');

  dateInput.valueAsDate = new Date();

  // 강의실 불러오기
  try {
    const roomRes = await fetch('/api/reservations?mode=rooms');
    const roomData = await roomRes.json();
    if (!roomData.rooms || !Array.isArray(roomData.rooms)) {
      alert('강의실 목록을 불러오는 데 실패했습니다.');
      return;
    }
    roomSelect.innerHTML = '<option value="">선택하세요</option>';
    roomData.rooms.forEach(roomName => {
      const opt = document.createElement('option');
      opt.value = roomName;
      opt.textContent = roomName;
      roomSelect.appendChild(opt);
    });
  } catch (error) {
    console.error('강의실 로딩 오류:', error);
    alert('강의실 목록을 불러오는 중 오류가 발생했습니다.');
  }

  // 시간 구간 불러오기
  try {
    const slotRes = await fetch('/api/reservations?mode=slots');
    const slotData = await slotRes.json();
    if (!slotData.slots || !Array.isArray(slotData.slots)) {
      alert('시간 구간을 불러오는 데 실패했습니다.');
      return;
    }
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
  } catch (error) {
    console.error('시간 구간 로딩 오류:', error);
    alert('시간 구간을 불러오는 중 오류가 발생했습니다.');
  }

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

    try {
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
    } catch (err) {
      console.error('예약 등록 오류:', err);
      resultDiv.textContent = '예약 등록 중 오류 발생';
    }
  });
});
