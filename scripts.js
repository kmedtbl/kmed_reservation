// scripts.js (이용자용)
const BASE_URL = 'https://kmed-reservation.vercel.app/api/reservations';

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const fetchRooms = async () => {
  const res = await fetch(`${BASE_URL}?mode=rooms`);
  const data = await res.json();
  return data.rooms || [];
};

const fetchSlots = async () => {
  const res = await fetch(`${BASE_URL}?mode=slots`);
  const data = await res.json();
  return data.slots || [];
};

const fetchReservations = async (room) => {
  const res = await fetch(`${BASE_URL}?mode=all&room=${room}`);
  const data = await res.json();
  return data.reservations || [];
};

const buildWeeklyTable = (slots, reservations, startOfWeek, room) => {
  const table = document.getElementById('scheduleTable');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).textContent = '시간';
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(day.getDate() + i);
    const th = document.createElement('th');
    th.textContent = `${day.getMonth() + 1}/${day.getDate()} (${['일','월','화','수','목','금','토'][day.getDay()]})`;
    th.dataset.date = formatDate(day);
    th.classList.add('clickable-date');
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  slots.forEach(([start]) => {
    const row = document.createElement('tr');
    const timeCell = document.createElement('td');
    timeCell.textContent = start;
    row.appendChild(timeCell);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      const dateStr = formatDate(day);
      const cell = document.createElement('td');

      const reserved = reservations.some(r => {
        return r.date === dateStr && r.room === room && start >= r.start && start < r.end;
      });

      const circle = document.createElement('span');
      circle.className = `circle ${reserved ? 'reserved' : 'available'}`;
      cell.appendChild(circle);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  document.getElementById('hintText').textContent = '원하는 날짜를 클릭하면 상세 일정을 볼 수 있습니다.';
};

let currentDate = new Date();
let currentRoom = null;

const loadAndRender = async (selectedDate = new Date()) => {
  const rooms = await fetchRooms();
  if (rooms.length === 0) return;

  const roomSelect = document.getElementById('roomSelect');
  roomSelect.innerHTML = '';

  rooms.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room;
    opt.textContent = room;
    roomSelect.appendChild(opt);
  });

  currentRoom = roomSelect.value = rooms[0];

  const slots = await fetchSlots();
  const reservations = await fetchReservations(currentRoom);
  const startOfWeek = getStartOfWeek(selectedDate);

  buildWeeklyTable(slots, reservations, startOfWeek, currentRoom);
};

const handleNavigation = (direction) => {
  const delta = direction === 'next' ? 7 : -7;
  currentDate.setDate(currentDate.getDate() + delta);
  loadAndRender(currentDate);
};

window.addEventListener('DOMContentLoaded', () => {
  loadAndRender();

  document.getElementById('roomSelect').addEventListener('change', async (e) => {
    currentRoom = e.target.value;
    const slots = await fetchSlots();
    const reservations = await fetchReservations(currentRoom);
    const startOfWeek = getStartOfWeek(currentDate);
    buildWeeklyTable(slots, reservations, startOfWeek, currentRoom);
  });

  document.getElementById('prevWeek').addEventListener('click', () => handleNavigation('prev'));
  document.getElementById('nextWeek').addEventListener('click', () => handleNavigation('next'));

  document.getElementById('datePicker').addEventListener('change', async (e) => {
    const selected = new Date(e.target.value);
    currentDate = selected;
    loadAndRender(selected);
  });

  document.getElementById('scheduleTable').addEventListener('click', async (e) => {
    if (e.target.classList.contains('clickable-date')) {
      const date = e.target.dataset.date;
      const room = document.getElementById('roomSelect').value;
      window.location.href = `details.html?room=${room}&date=${date}`;
    }
  });
});
