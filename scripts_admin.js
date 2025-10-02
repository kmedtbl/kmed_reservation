const BASE_URL = "https://kmed-reservation.vercel.app/api/reservations";

document.addEventListener("DOMContentLoaded", async () => {
  const today = new Date();
  document.getElementById("date").value = today.toISOString().split("T")[0];
  await loadRooms();
  await loadSchedule();
  await populateTimeOptions();
});

function goBack() {
  window.location.href = "index.html";
}

async function loadRooms() {
  const res = await fetch(`${BASE_URL}?mode=rooms`);
  const data = await res.json();
  const select = document.getElementById("room");
  data.rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room;
    option.textContent = room;
    select.appendChild(option);
  });
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

async function loadSchedule() {
  const date = document.getElementById("date").value;
  const room = document.getElementById("room").value;
  const startOfWeek = getStartOfWeek(new Date(date));
  const summaryHead = document.querySelector("#summaryTable thead");
  const summaryBody = document.querySelector("#summaryTable tbody");
  summaryHead.innerHTML = "";
  summaryBody.innerHTML = "";

  const slotRes = await fetch(`${BASE_URL}?mode=slots`);
  const { slots } = await slotRes.json();

  const weekDates = [...Array(7)].map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th")); // Time column
  weekDates.forEach((date) => {
    const th = document.createElement("th");
    th.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
    th.dataset.date = formatDate(date);
    th.addEventListener("click", () => showDetail(formatDate(date)));
    headerRow.appendChild(th);
  });
  summaryHead.appendChild(headerRow);

  slots.forEach((slot) => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    timeCell.textContent = slot;
    row.appendChild(timeCell);

    weekDates.forEach((date) => {
      const cell = document.createElement("td");
      const dot = document.createElement("span");
      dot.classList.add("status-dot");
      cell.appendChild(dot);
      row.appendChild(cell);
    });
    summaryBody.appendChild(row);
  });

  const resRes = await fetch(`${BASE_URL}?mode=all&room=${room}`);
  const { reservations } = await resRes.json();
  reservations.forEach((resv) => {
    const date = new Date(resv.date);
    const index = weekDates.findIndex(
      (d) => formatDate(d) === formatDate(date)
    );
    if (index !== -1) {
      const startIndex = slots.indexOf(resv.start);
      const endIndex = slots.indexOf(resv.end);
      for (let i = startIndex; i < endIndex; i++) {
        const row = summaryBody.children[i];
        const cell = row.children[index + 1];
        const dot = cell.querySelector(".status-dot");
        if (dot) {
          dot.classList.add("unavailable");
          dot.classList.remove("available");
        }
      }
    }
  });
}

async function showDetail(date) {
  document.getElementById("selectedDate").textContent = `${date} 상세 예약`;
  const room = document.getElementById("room").value;
  const res = await fetch(
    `${BASE_URL}?mode=detail&room=${room}&date=${date}`
  );
  const { reservations } = await res.json();
  const detailBody = document.querySelector("#detailTable tbody");
  detailBody.innerHTML = "";
  reservations.forEach((resv) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${resv.start}</td>
      <td>${resv.end}</td>
      <td>${resv.title}</td>
      <td>${resv.reserver}</td>
      <td>${resv.note || ""}</td>
    `;
    detailBody.appendChild(row);
  });
}

function toggleReservationForm() {
  const form = document.getElementById("reservationForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function submitReservation() {
  const baseDate = new Date(document.getElementById("date").value);
  const room = document.getElementById("room").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const title = document.getElementById("title").value;
  const reserver = document.getElementById("reserver").value;
  const repeat = document.getElementById("repeatToggle").checked;
  const repeatWeeks = parseInt(document.getElementById("repeatWeeks").value || "1");

  const reservations = [];

  for (let i = 0; i < (repeat ? repeatWeeks : 1); i++) {
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + i * 7);
    reservations.push({
      date: targetDate.toISOString().split("T")[0],
      room,
      start: startTime,
      end: endTime,
      title,
      reserver,
    });
  }

  let successCount = 0;
  let failCount = 0;

  for (const r of reservations) {
    const checkRes = await fetch(`${BASE_URL}?mode=check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    const checkData = await checkRes.json();
    if (checkData.conflict) {
      failCount++;
      continue;
    }

    await fetch(`${BASE_URL}?mode=add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    successCount++;
  }

  alert(`예약 완료: ${successCount}건\n중복으로 제외: ${failCount}건`);
  document.getElementById("reservationForm").style.display = "none";
  await loadSchedule();
}

async function populateTimeOptions() {
  const res = await fetch(`${BASE_URL}?mode=slots`);
  const data = await res.json();
  const startSelect = document.getElementById("startTime");
  const endSelect = document.getElementById("endTime");
  data.slots.forEach((slot) => {
    const option1 = document.createElement("option");
    option1.value = slot;
    option1.textContent = slot;
    startSelect.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = slot;
    option2.textContent = slot;
    endSelect.appendChild(option2);
  });
}
