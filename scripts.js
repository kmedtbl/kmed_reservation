// scripts.js (이용자 페이지용)
document.addEventListener("DOMContentLoaded", () => {
  const roomSelect = document.getElementById("room");
  const dateInput = document.getElementById("date");
  const prevWeekBtn = document.getElementById("prevWeek");
  const nextWeekBtn = document.getElementById("nextWeek");
  const weeklyTableBody = document.querySelector("#weeklyTable tbody");
  const weekHeader = document.getElementById("weekHeader");

  let slots = [];
  let currentStartOfWeek = getStartOfWeek(new Date());

  async function fetchRooms() {
    const response = await fetch("https://kmed-reservation.vercel.app/api/reservations?mode=rooms");
    const data = await response.json();
    data.rooms.forEach(room => {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = room.name;
      roomSelect.appendChild(option);
    });
  }

  async function fetchSlots() {
    const response = await fetch("https://kmed-reservation.vercel.app/api/reservations?mode=slots");
    const data = await response.json();
    slots = data.slots;
  }

  async function fetchReservations(roomId, startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    const response = await fetch(`https://kmed-reservation.vercel.app/api/reservations?room=${roomId}&start=${startStr}&end=${endStr}`);
    const data = await response.json();
    return data.reservations;
  }

  function getStartOfWeek(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  function formatDate(date) {
    return date.toISOString().split("T")[0];
  }

  function renderWeekHeader(startDate) {
    weekHeader.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      const th = document.createElement("th");
      th.textContent = `${day.getMonth() + 1}. ${day.getDate()} (${["일", "월", "화", "수", "목", "금", "토"][day.getDay()]})`;
      weekHeader.appendChild(th);
    }
  }

  function renderWeeklyTable(reservations, startDate) {
    weeklyTableBody.innerHTML = "";

    slots.forEach(slot => {
      const row = document.createElement("tr");
      const timeCell = document.createElement("td");
      timeCell.textContent = `${slot[0]}~${slot[1]}`;
      row.appendChild(timeCell);

      for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        const dateStr = formatDate(day);

        const isReserved = reservations.some(r => {
          return r.date === dateStr && !(r.end <= slot[0] || r.start >= slot[1]);
        });

        const cell = document.createElement("td");
        const circle = document.createElement("span");
        circle.classList.add("status-circle");
        if (isReserved) {
          circle.classList.add("status-unavailable");
        } else {
          circle.classList.add("status-available");
        }
        cell.appendChild(circle);
        row.appendChild(cell);
      }

      weeklyTableBody.appendChild(row);
    });
  }

  async function loadAndRender() {
    const roomId = roomSelect.value;
    const reservations = await fetchReservations(roomId, currentStartOfWeek);
    renderWeekHeader(currentStartOfWeek);
    renderWeeklyTable(reservations, currentStartOfWeek);
  }

  roomSelect.addEventListener("change", loadAndRender);

  dateInput.addEventListener("change", () => {
    const selectedDate = new Date(dateInput.value);
    currentStartOfWeek = getStartOfWeek(selectedDate);
    loadAndRender();
  });

  prevWeekBtn.addEventListener("click", () => {
    currentStartOfWeek.setDate(currentStartOfWeek.getDate() - 7);
    loadAndRender();
  });

  nextWeekBtn.addEventListener("click", () => {
    currentStartOfWeek.setDate(currentStartOfWeek.getDate() + 7);
    loadAndRender();
  });

  (async function init() {
    await fetchRooms();
    await fetchSlots();
    roomSelect.selectedIndex = 0;
    dateInput.value = formatDate(new Date());
    loadAndRender();
  })();
});
