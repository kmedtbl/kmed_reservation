// scripts_admin.js

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const startSelect = document.getElementById('start');
  const endSelect = document.getElementById('end');
  const byInput = document.getElementById('by');
  const noteInput = document.getElementById('note');
  const resultDiv = document.getElementById('result');
  const submitBtn = document.getElementById('submitBtn');
  const repeatToggle = document.getElementById('repeatToggle');
  const repeatWeeksSelect = document.getElementById('repeatWeeks');
  const repeatWeeksWrapper = document.getElementById('repeatWeeksWrapper');

  dateInput.valueAsDate = new Date();

  let allSlots = [];
  let bookedSlots = [];

  // 강의실 불러오기
  async function loadRooms() {
    try {
      const res = await fetch('https://kmed-reservation.vercel.app/api/reservations?mode=rooms');
      const data = await res.json();
      if (!data.rooms || !Array.isArray(data.rooms)) throw new Error('Invalid room data');
      roomSelect.innerHTML = '<option value="">선택하세요</option>';
      data.rooms.forEach(room => {
        const opt = document.createElement('option');
        opt.value = room;
        opt.textContent = room;
        roomSelect.appendChild(opt);
      });
    } catch (err) {
      alert('강의실 목록 로딩 실패');
      console.error(err);
    }
  }

  // 시간 슬롯 불러오기
  async function loadSlots() {
    try {
      const res = await fetch('https://kmed-reservation.vercel.app/api/reservations?mode=slots');
      const data = await res.json();
      if (!data.slots || !Array.isArray(data.slots)) throw new Error('Invalid slot data');
      allSlots = data.slots;
      renderSlotOptions();
    } catch (err) {
      alert('시간 구간 로딩 실패');
      console.error(err);
    }
  }

  // 선택된 날짜와 강의실의 기존 예약 정보 조회
  async function loadBookedSlots(date, room) {
    try {
      const res = await fetch(`https://kmed-reservation.vercel.app/api/reservations?date=${date}&room=${room}`);
      const data = await res.json();
      bookedSlots = data.reservations.map(r => [r.start, r.end]);
      renderSlotOptions();
    } catch (err) {
      console.error('예약 정보 로딩 실패', err);
    }
  }

  // 겹치는 시간대 필터링
  function isSlotAvailable(start, end) {
    for (const [bStart, bEnd] of bookedSlots) {
      if (!(end <= bStart || start >= bEnd)) {
        return false; // 겹침
      }
    }
    return true;
  }

  // 시간 옵션 렌더링
  function renderSlotOptions() {
    startSelect.innerHTML = '<option value="">선택</option>';
    endSelect.innerHTML = '<option value="">선택</option>';
    allSlots.forEach(([start, end]) => {
      const disabled = !isSlotAvailable(start, end);

      const sOpt = document.createElement('option');
      sOpt.value = start;
      sOpt.textContent = start;
      sOpt.disabled = disabled;
      startSelect.appendChild(sOpt);

      const eOpt = document.createElement('option');
      eOpt.value = end;
      eOpt.textContent = end;
      eOpt.disabled = disabled;
      endSelect.appendChild(eOpt);
    });
  }

  // 날짜/강의실 변경 시 예약 확인
  dateInput.addEventListener('change', () => {
    if (dateInput.value && roomSelect.value) {
      loadBookedSlots(dateInput.value, roomSelect.value);
    }
  });

  roomSelect.addEventListener('change', () => {
    if (dateInput.value && roomSelect.value) {
      loadBookedSlots(dateInput.value, roomSelect.value);
    }
  });

  // 반복 예약 토글
  repeatToggle.addEventListener('change', () => {
    repeatWeeksWrapper.style.display = repeatToggle.checked ? 'block' : 'none';
  });

  // 예약 등록
  submitBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const room = roomSelect.value;
    const start = startSelect.value;
    const end = endSelect.value;
    const by = byInput.value;
    const note = noteInput.value;
    const repeat = repeatToggle.checked;
    const weeks = repeat ? parseInt(repeatWeeksSelect.value) : 1;

    if (!date || !room || !start || !end || !by) {
      resultDiv.textContent = '모든 필수 항목을 입력해주세요.';
      return;
    }

    const requests = [];
    for (let i = 0; i < weeks; i++) {
      const repeatDate = new Date(date);
      repeatDate.setDate(repeatDate.getDate() + i * 7);
      const repeatDateStr = repeatDate.toISOString().slice(0, 10);

      requests.push(
        fetch('https://kmed-reservation.vercel.app/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: repeatDateStr, room, start, end, by, note })
        })
      );
    }

    try {
      const results = await Promise.all(requests);
      const successCount = results.filter(r => r.ok).length;
      resultDiv.textContent = `${successCount}건의 예약이 등록되었습니다.`;
    } catch (err) {
      console.error(err);
      resultDiv.textContent = '예약 등록 중 오류 발생';
    }
  });

  await loadRooms();
  await loadSlots();
});
