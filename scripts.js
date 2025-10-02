// scripts.js (사용자용)
document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const loadBtn = document.getElementById('loadBtn');
  const scheduleArea = document.getElementById('scheduleArea');
  const scheduleBody = document.getElementById('scheduleBody');

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

  // 예약 현황 불러오기
  loadBtn.addEventListener('click', async () => {
    const date = dateInput.value;
    const room = roomSelect.value;
    if (!date || !room) {
      alert('날짜와 강의실을 모두 선택하세요.');
      return;
    }
    try {
      const res = await fetch(`/api/reservations?mode=schedule&date=${date}&room=${room}`);
      const data = await res.json();
      scheduleBody.innerHTML = '';
      if (!data.reservations || data.reservations.length === 0) {
        scheduleArea.style.display = 'block';
        scheduleBody.innerHTML = '<tr><td colspan="3">예약 없음</td></tr>';
        return;
      }
      data.reservations.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row[3]} - ${row[4]}</td>
          <td>${row[5]}</td>
          <td>${row[6]}</td>
        `;
        scheduleBody.appendChild(tr);
      });
      scheduleArea.style.display = 'block';
    } catch (err) {
      console.error('예약 불러오기 오류:', err);
      alert('예약 정보를 불러오지 못했습니다.');
    }
  });
});
