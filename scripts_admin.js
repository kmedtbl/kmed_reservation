// 관리자 페이지 scripts_admin.js 전체 코드

const API_BASE = 'https://kmed-reservation.vercel.app/api/reservations';

const dateInput = document.getElementById('date');
const roomSelect = document.getElementById('room');
const weekTable = document.getElementById('weekTable');
const dayTable = document.getElementById('dayTable');
const formSection = document.getElementById('formSection');
const form = document.getElementById('reservationForm');
const repeatToggle = document.getElementById('repeatToggle');
const repeatOptions = document.getElementById('repeatOptions');
const weekNav = document.getElementById('weekNav');
const calendar = document.getElementById('calendar');

let slots = [];
let currentRoom = '';
let currentWeekStart = getMonday(new Date());

// 날짜 관련 유틸
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function formatDate(date) {
  return date.toISOString().split('T')[0];
}
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 초기 실행
window.addEventListener('DOMContentLoaded', async () => {
  dateInput.value = formatDate(new Date());

  await loadRooms();
  await loadSlots();

  if (currentRoom) {
    renderWeek(currentWeekStart);
  }

  // 이전/다음 주 이동
  document.getElementById('prevWeek').onclick = () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    renderWeek(currentWeekStart);
  };
  document.getElementById('nextWeek').onclick = () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    renderWeek(currentWeekStart);
  };

  // 날짜 선택 시 해당 주로 이동
  calendar.addEventListener('change', () => {
    const picked = new Date(calendar.value);
    currentWeekStart = getMonday(picked);
    renderWeek(currentWeekStart);
  });

  // 반복 예약 토글
  repeatToggle.addEventListener('change', () => {
    repeatOptions.style.display = repeatToggle.checked ? 'block' : 'none';
  });

  // 예약 입력 폼 제출
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {
      date: formData.get('date'),
      room: formData.get('room'),
      start: formData.get('start'),
      end: formData.get('end'),
      by: formData.get('by'),
      note: formData.get('note')
    };

    const repeat = formData.get('repeatToggle');
    const weeks = parseInt(formData.get('weeks') || '1');

    try {
      for (let i = 0; i < (repeat ? weeks : 1); i++) {
        const repeatDate = formatDate(addDays(new Date(payload.date), i * 7));
        const repeatPayload = { ...payload, date: repeatDate };
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(repeatPayload)
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
      }
      alert('예약이 등록되었습니다.');
      formSection.style.display = 'none';
      renderWeek(currentWeekStart);
    } catch (err) {
      alert('예약 실패: ' + err.message);
    }
  });
});

async function loadRooms() {
  try {
    const res = await fetch(`${API_BASE}?mode=rooms`);
    const data = await res.json();
    if (!data.rooms || !Array.isArray(data.rooms)) throw new Error();
    roomSelect.innerHTML = '';
    data.rooms.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room;
      opt.textContent = room;
      roomSelect.appendChild(opt);
    });
    currentRoom = data.rooms[0];
    roomSelect.value = currentRoom;
    roomSelect.onchange = () => {
      currentRoom = roomSelect.value;
      renderWeek(currentWeekStart);
    };
  } catch {
    alert('강의실 목록 로딩 실패');
  }
}

async function loadSlots() {
  try {
    const res = await fetch(`${API_BASE}?mode=slots`);
    const data = await res.json();
    if (!data.slots || !Array.isArray(data.slots)) throw new Error();
    slots = data.slots;
  } catch {
    alert('시간 구간 로딩 실패');
  }
}

async function renderWeek(startDate) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  document.getElementById('weekTitle').textContent = `${formatDate(dates[0])} ~ ${formatDate(dates[6])}`;

  let html = '<tr><th>시간</th>' + dates.map(d => `<th>${formatDate(d).slice(5)}</th>`).join('') + '</tr>';

  const res = await fetch(`${API_BASE}?mode=read&room=${encodeURIComponent(currentRoom)}`);
  const data = await res.json();
  const reservations = data.reservations || [];

  slots.forEach(([start, end]) => {
    html += `<tr><td>${start}~${end}</td>`;
    dates.forEach(date => {
      const day = formatDate(date);
      const isReserved = reservations.some(r => r[3] === day && r[4] === start);
      html += `<td class="dot-cell ${isReserved ? 'red' : 'green'}" data-date="${day}" data-start="${start}"></td>`;
    });
    html += '</tr>';
  });
  weekTable.innerHTML = html;

  // 상세 보기 연결
  document.querySelectorAll('.dot-cell').forEach(cell => {
    cell.onclick = () => renderDayDetail(cell.dataset.date);
  });
}

async function renderDayDetail(dateStr) {
  document.getElementById('detailDate').textContent = dateStr;
  const res = await fetch(`${API_BASE}?mode=read&room=${encodeURIComponent(currentRoom)}&date=${dateStr}`);
  const data = await res.json();
  const reservations = (data.reservations || []).filter(r => r[3] === dateStr);

  let html = '<tr><th>시간</th><th>강의/행사</th><th>예약자</th></tr>';
  slots.forEach(([start, end]) => {
    const match = reservations.find(r => r[4] === start);
    html += `<tr><td>${start}~${end}</td>`;
    if (match) {
      html += `<td>${match[5]}</td><td>${match[6]}</td>`;
    } else {
      html += `<td></td><td></td>`;
    }
    html += '</tr>';
  });
  dayTable.innerHTML = html;

  formSection.style.display = 'block';
  form.date.value = dateStr;
  form.room.value = currentRoom;

  form.start.innerHTML = '<option value="">시작</option>' + slots.map(s => `<option value="${s[0]}">${s[0]}</option>`).join('');
  form.end.innerHTML = '<option value="">종료</option>' + slots.map(s => `<option value="${s[1]}">${s[1]}</option>`).join('');
}
