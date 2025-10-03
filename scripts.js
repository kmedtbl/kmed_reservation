const BASE_URL = 'https://kmed-reservation.vercel.app/api/reservations';

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()); // 시분초 제거
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatKoreanDate(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일(${days[date.getDay()]})`;
}

async function fetchRooms() {
  const res = await fetch(`${BASE_URL}?mode=rooms`);
  const data = await res.json();
  return data.rooms || [];
}

async function fetchSlots() {
  const res = await fetch(`${BASE_URL}?mode=slots`);
  const data = await res.json();
  return data.slots || [];
}

async function fetchReservations(room) {
  const res = await fetch(`${BASE_URL}?mode=reservations&room=${room}`);
  const data = await res.json();
  return data.reservations || [];
}

function renderSummaryTable(slots, reservations, selectedDate, roomName) {
  const table = document.getElementById("summaryTable");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th"));

  const monday = getMonday(selectedDate);
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(date);

    const th = document.createElement("th");
    th.textContent = date.toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    th.dataset.date = formatDate(date);
    th.classList.add("clickable-date");
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);

  slots.forEach((slot) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = slot.time;
    tr.appendChild(th);

    weekDates.forEach((date) => {
      const td = document.createElement("td");
      const dateStr = formatDate(date);
      const isReserved = reservations.some(
        (r) => r.date === dateStr && r.slot === slot.id
      );
      const dot = document.createElement("div");
      dot.classList.add("dot", isReserved ? "red" : "green");
      td.appendChild(dot);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  const label = document.getElementById("dateRangeLabel");
  const startLabel = formatKoreanDate(weekDates[0]);
  const endLabel = formatKoreanDate(weekDates[6]);
  label.textContent = `${startLabel} ~ ${endLabel}`;
}

function renderDetailTable(slots, reservations, selectedDate, roomName) {
  const table = document.getElementById("summaryTable");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  const headerRow = document.createElement("tr");
  ["시간", "예약자", "비고"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const selectedDateStr = formatDate(selectedDate);

  slots.forEach((slot) => {
    const tr = document.createElement("tr");

    const timeCell = document.createElement("td");
    timeCell.textContent = slot.time;
    tr.appendChild(timeCell);

    const reservation = reservations.find(
      (r) => r.date === selectedDateStr && r.slot === slot.id
    );

    const userCell = document.createElement("td");
    userCell.textContent = reservation ? reservation.name : "";
    tr.appendChild(userCell);

    const memoCell = document.createElement("td");
    memoCell.textContent = reservation ? reservation.memo : "";
    tr.appendChild(memoCell);

    tbody.appendChild(tr);
  });

  const label = document.getElementById("dateRangeLabel");
  label.textContent = `${formatKoreanDate(selectedDate)}`;
}

async function loadAndRenderSummary(selectedDate, selectedRoom) {
  const slots = await fetchSlots();
  const reservations = await fetchReservations(selectedRoom);
  const roomName =
    document.querySelector(`#room option[value="${selectedRoom}"]`)?.textContent || "";
  renderSummaryTable(slots, reservations, selectedDate, roomName);
}

async function loadAndRenderDetail(selectedDate, selectedRoom) {
  const slots = await fetchSlots();
  const reservations = await fetchReservations(selectedRoom);
  const roomName =
    document.querySelector(`#room option[value="${selectedRoom}"]`)?.textContent || "";
  renderDetailTable(slots, reservations, selectedDate, roomName);
}

document.addEventListener("DOMContentLoaded", async () => {
  const dateInput = document.getElementById("date");
  const roomSelect = document.getElementById("room");

  const today = new Date();
  dateInput.value = formatDate(today);

  const rooms = await fetchRooms();
  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.name;
    roomSelect.appendChild(option);
  });

  const initialRoom = rooms[0]?.id || "";
  await loadAndRenderSummary(today, initialRoom);

  roomSelect.addEventListener("change", async () => {
    const selectedDate = new Date(dateInput.value);
    const selectedRoom = roomSelect.value;
    await loadAndRenderSummary(selectedDate, selectedRoom);
  });

  dateInput.addEventListener("change", async () => {
    const selectedDate = new Date(dateInput.value);
    const selectedRoom = roomSelect.value;
    await loadAndRenderSummary(selectedDate, selectedRoom);
  });

  document
    .getElementById("summaryTable")
    .addEventListener("click", async (e) => {
      if (e.target.closest("th")?.classList.contains("clickable-date")) {
        const dateStr = e.target.closest("th").dataset.date;
        const selectedDate = new Date(dateStr);
        const selectedRoom = document.getElementById("room").value;
        document.getElementById("date").value = formatDate(selectedDate);
        await loadAndRenderDetail(selectedDate, selectedRoom);
      }
    });
});
