// scripts_admin.js (관리자용)
document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const startSelect = document.getElementById('start');
  const endSelect = document.getElementById('end');
  const eventInput = document.getElementById('event');
  const byInput = document.getElementById('by');
  const noteInput = document.getElementById('note');
  const submitBtn = document.getElementById('submitBtn');
  const toggleFormBtn = document.getElementById('toggleFormBtn');
  const reservationForm = document.getElementById('reservationForm');
  const resultDiv = document.getElementById('result');
  const weeklySummary = document.getElementById('weekly-summary');
  const dailyDetails = document.getElementById('daily-details');
  const repeatToggle = document.getElementById('repeatToggle');
  const repeatWeeksGroup = document.getElementById('repeatWeeksGroup');
  const repeatWeeks = document.getElementById('repeatWeeks');

  // 기본 날짜 설정
  dateInput.valueAsDate = new Date();

  // 토글 이벤트
  toggleFormBtn.addEventListener('click', () => {
    reservationForm.classList.toggle('hidden');
  });

  // 반복 예약 여부 토글
  repeatToggle.addEventListener('change', () => {
    repeatWeeksGroup.classList.toggle('hidden', !repeatToggle.checked);
  });

  // 강의실 로드
  try {
    const res = await fetch('/api/reservations?mode=rooms');
    const data = await res.json();
    data.rooms.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room;
      opt.textContent = room;
      roomSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('강의실 로딩 실패:', err);
  }

  // 시간 구간 로드
  let timeSlots = [];
  try {
    const res = await fetch('/api/reservations?mode=slots');
    const data = await res.json();
    timeSlots = data.slots;
    updateTimeOptions(timeSlots);
  } catch (err) {
    console.error('시간 구간 로딩 실패:', err);
  }

  function updateTimeOptions(slots) {
    startSelect.innerHTML = '<option value="">선택</option>';
    endSelect.innerHTML = '<option value="">선택</option>';
    slots.forEach(([start, end]) => {
      const startOpt = document.createElement('option');
      startOpt.value = start;
      startOpt.textContent = start;
      startSelect.appendChild(startOpt);

      const endOpt = document.createElement('option');
      endOpt.value = end;
      endOpt.textContent = end;
      endSelect.appendChild(endOpt);
    });
  }

  // 주간 요약표 로드 (예시: R1)
  const defaultRoom = 'R1';
  loadWeeklySummary(defaultRoom);
  loadDailyDetails(dateInput.value, defaultRoom);

  dateInput.addEventListener('change', () => {
    const date = dateInput.value;
    const room = roomSelect.value || defaultRoom;
    loadDailyDetails(date, room);
  });

  async function loadWeeklySummary(room) {
    // 구현 생략 (주간 요약표 렌더링)
    weeklySummary.innerHTML = `<p><strong>${room}</strong> 주간 시간표 표시 예정</p>`;
  }

  async function loadDailyDetails(date, room) {
    try {
      const res = await fetch(`/api/reservations?mode=day&date=${date}&room=${room}`);
      const data = await res.json();
      renderDailyDetails(data.reservations);
    } catch (err) {
      console.error('상세 예약 로딩 실패:', err);
    }
  }

  function renderDailyDetails(reservations) {
    dailyDetails.innerHTML = '';
    if (!reservations || reservations.length === 0) {
      dailyDetails.innerHTML = '<p>예약된 일정이 없습니다.</p>';
      return;
    }
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr><th>시간</th><th>강의/행사</th><th>예약자</th></tr>
      </thead>
      <tbody>
        ${reservations.map(r => `
          <tr>
            <td>${r.start}~${r.end}</td>
            <td>${r.event || ''}</td>
            <td>${r.by || ''}</td>
          </tr>`).join('')}
      </tbody>
    `;
    dailyDetails.appendChild(table);
  }

  // 예약 등록
  submitBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const room = roomSelect.value || defaultRoom;
    const start = startSelect.value;
    const end = endSelect.value;
    const event = eventInput.value;
    const by = byInput.value;
    const note = noteInput.value;
    const repeatCount = repeatToggle.checked ? parseInt(repeatWeeks.value) : 1;

    if (!date || !room || !start || !end || !by) {
      resultDiv.textContent = '필수 항목을 모두 입력해주세요';
      return;
    }

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, room, start, end, event, by, note, repeat: repeatCount })
      });
      const data = await res.json();
      if (data.success) {
        resultDiv.textContent = '예약이 등록되었습니다.';
        loadDailyDetails(date, room);
        reservationForm.classList.add('hidden');
      } else {
        resultDiv.textContent = '예약 실패: ' + (data.error || '알 수 없는 오류');
      }
    } catch (err) {
      console.error('예약 등록 실패:', err);
      resultDiv.textContent = '예약 등록 중 오류 발생';
    }
  });
});
