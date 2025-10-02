document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('date');
  const roomSelect = document.getElementById('room');
  const loadBtn = document.getElementById('loadBtn');
  const scheduleArea = document.getElementById('scheduleArea');
  const scheduleBody = document.getElementById('scheduleBody');

  // 날짜 기본값 오늘로 설정
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  // 강의실 목록 불러오기
  fetch('https://kmedtbl.vercel.app/api/reservations?mode=rooms')
    .then(res => res.json())
    .then(data => {
      if (!data.rooms || data.rooms.length === 0) throw new Error('no rooms');
      
      data.rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;             // ✅ 여기!
        option.textContent = room.name;       // ✅ 여기!
        roomSelect.appendChild(option);
      });
    })
    .catch(err => {
      alert('강의실 정보를 불러오지 못했습니다.');
      console.error(err);
    });

  // 버튼 클릭 시 예약 현황 불러오기
  loadBtn.addEventListener('click', () => {
    const date = dateInput.value;
    const room = roomSelect.value;
    if (!date || !room) {
      alert('날짜와 강의실을 모두 선택하세요.');
      return;
    }

    fetch(`https://kmedtbl.vercel.app/api/reservations?mode=schedule&date=${date}&room=${encodeURIComponent(room)}`)
      .then(res => res.json())
      .then(data => {
        const reservations = data.reservations || [];
        scheduleBody.innerHTML = '';

        if (reservations.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 3;
          td.textContent = '예약이 없습니다.';
          tr.appendChild(td);
          scheduleBody.appendChild(tr);
        } else {
          reservations.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${row[3]} ~ ${row[4]}</td>
              <td>${row[5]}</td>
              <td>${row[6]}</td>
            `;
            scheduleBody.appendChild(tr);
          });
        }

        scheduleArea.style.display = 'block';
      })
      .catch(err => {
        alert('예약 정보를 불러오지 못했습니다.');
        console.error(err);
      });
  });
});
