/* =========================================================
   DENTAL CASE SHARING PLATFORM - APP LOGIC
   ========================================================= */

let cases = [];
let currentTab = 'available';
let doctorProfile = JSON.parse(localStorage.getItem('qs_doctor')) || { name: '', phone: '' };

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  updateDoctorBadgeUI();

  // المزامنة مع Firebase Realtime Database
  const checkDb = setInterval(() => {
    if (window.db) {
      clearInterval(checkDb);
      const casesRef = window.dbRef(window.db, 'cases');
      
      window.dbOnValue(casesRef, (snapshot) => {
        const data = snapshot.val();
        cases = [];
        if (data) {
          Object.keys(data).forEach(key => {
            cases.push({ id: key, ...data[key] });
          });
        }
        populateFilterOptions();
        applyFilters();
      });
    }
  }, 200);
}

function updateDoctorBadgeUI() {
  const badgeEl = document.getElementById('userBadge');
  if (doctorProfile.name) {
    badgeEl.textContent = `👨‍⚕️ د. ${doctorProfile.name}`;
  } else {
    badgeEl.textContent = `👤 تسجيل الدخول`;
  }
}

function openProfileModal() {
  document.getElementById('doctorNameInput').value = doctorProfile.name || '';
  document.getElementById('doctorPhoneInput').value = doctorProfile.phone || '';
  document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('active');
}

function saveDoctorProfile() {
  const name = document.getElementById('doctorNameInput').value.trim();
  const phone = document.getElementById('doctorPhoneInput').value.trim();
  if (!name) return alert("يرجى إدخال اسم الطبيب.");

  doctorProfile = { name, phone };
  localStorage.setItem('qs_doctor', JSON.stringify(doctorProfile));
  updateDoctorBadgeUI();
  closeProfileModal();
  applyFilters();
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabAvailable').classList.toggle('active', tab === 'available');
  document.getElementById('tabMyBooked').classList.toggle('active', tab === 'my_booked');
  applyFilters();
}

function populateFilterOptions() {
  const locations = [...new Set(cases.map(c => c.location))].filter(Boolean);
  const treatments = [...new Set(cases.map(c => c.treatment))].filter(Boolean);

  const locSelect = document.getElementById('filterLocation');
  const treatSelect = document.getElementById('filterTreatment');

  const currentLoc = locSelect.value;
  const currentTreat = treatSelect.value;

  locSelect.innerHTML = '<option value="">كل الأماكن</option>' + locations.map(l => `<option value="${l}">${l}</option>`).join('');
  treatSelect.innerHTML = '<option value="">كل العلاجات</option>' + treatments.map(t => `<option value="${t}">${t}</option>`).join('');

  locSelect.value = currentLoc;
  treatSelect.value = currentTreat;
}

function applyFilters() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const gender = document.getElementById('filterGender').value;
  const location = document.getElementById('filterLocation').value;
  const treatment = document.getElementById('filterTreatment').value;

  const filtered = cases.filter(item => {
    if (currentTab === 'available' && item.status !== 'available') return false;
    if (currentTab === 'my_booked' && (item.status !== 'booked' || item.bookedBy !== doctorProfile.name)) return false;

    if (gender && item.gender !== gender) return false;
    if (location && item.location !== location) return false;
    if (treatment && item.treatment !== treatment) return false;

    if (query) {
      const matchName = item.patientName ? item.patientName.toLowerCase().includes(query) : false;
      const matchPhone = item.patientPhone ? item.patientPhone.includes(query) : false;
      const matchNotes = item.notes ? item.notes.toLowerCase().includes(query) : false;
      const matchTreatment = item.treatment ? item.treatment.toLowerCase().includes(query) : false;
      if (!matchName && !matchPhone && !matchNotes && !matchTreatment) return false;
    }
    return true;
  });

  renderCases(filtered);
  updateStats();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterGender').value = '';
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterTreatment').value = '';
  applyFilters();
}

function renderCases(items) {
  const container = document.getElementById('casesContainer');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">لا توجد حالات مطابقة حالياً.</div>`;
    return;
  }

  items.forEach(c => {
    const isMyBooked = c.status === 'booked' && c.bookedBy === doctorProfile.name;
    const card = document.createElement('div');
    card.className = 'case-card';
    card.innerHTML = `
      <div class="case-card-header">
        <span class="treatment-badge">${c.treatment}</span>
        <span class="status-tag ${c.status === 'available' ? 'status-available' : 'status-booked'}">
          ${c.status === 'available' ? '🟢 متاحة' : '📌 محجوزة'}
        </span>
      </div>
      <div class="case-card-body">
        <div class="info-item"><span class="info-label">المريض:</span><span>${c.patientName}</span></div>
        <div class="info-item"><span class="info-label">الهاتف:</span><span><a href="tel:${c.patientPhone}">${c.patientPhone}</a></span></div>
        <div class="info-item"><span class="info-label">المكان:</span><span>📍 ${c.location}</span></div>
        <div class="info-item"><span class="info-label">العمر/الجنس:</span><span>${c.patientAge} سنة (${c.gender === 'Male' ? 'ذكر' : 'أنثى'})</span></div>
      </div>
      ${c.notes ? `<div class="case-notes-box">${c.notes}</div>` : ''}
      <div class="case-card-footer">
        <div class="action-buttons">
          ${c.status === 'available' ? `<button class="btn-claim" onclick="claimCase('${c.id}')">➕ حجز الحالة</button>` : ''}
          ${isMyBooked ? `
            <button class="btn-complete" onclick="completeCase('${c.id}')">✓ إكمال</button>
            <button class="btn-cancel" onclick="cancelBooking('${c.id}')">إلغاء الحجز</button>
          ` : ''}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function claimCase(id) {
  if (!doctorProfile.name) {
    alert("يرجى تسجيل بياناتك أولاً لحجز الحالة.");
    return openProfileModal();
  }
  const caseRef = window.dbRef(window.db, `cases/${id}`);
  window.dbUpdate(caseRef, { status: 'booked', bookedBy: doctorProfile.name });
}

function completeCase(id) {
  if (confirm("هل تم الانتهاء من علاج هذه الحالة؟")) {
    const caseRef = window.dbRef(window.db, `cases/${id}`);
    window.dbRemove(caseRef);
  }
}

function cancelBooking(id) {
  if (confirm("هل تريد إلغاء حجز هذه الحالة؟")) {
    const caseRef = window.dbRef(window.db, `cases/${id}`);
    window.dbUpdate(caseRef, { status: 'available', bookedBy: null });
  }
}

function handleNewCaseClick() {
  document.getElementById('addCaseModal').classList.add('active');
}

function closeAddCaseModal() {
  document.getElementById('addCaseModal').classList.remove('active');
}

function submitNewCase() {
  const name = document.getElementById('casePatientName').value.trim();
  const phone = document.getElementById('casePatientPhone').value.trim();
  const age = document.getElementById('casePatientAge').value.trim();
  const gender = document.getElementById('caseGender').value;
  const location = document.getElementById('caseLocationInput').value.trim();
  const treatment = document.getElementById('caseTreatmentInput').value.trim();
  const notes = document.getElementById('caseNotes').value.trim();

  if (!name || !phone || !age || !location || !treatment) return alert("يرجى إكمال جميع الحقول المطلوبة.");

  const casesListRef = window.dbRef(window.db, 'cases');
  const newCaseRef = window.dbPush(casesListRef);

  window.dbSet(newCaseRef, {
    patientName: name,
    patientPhone: phone,
    patientAge: parseInt(age),
    gender,
    location,
    treatment,
    notes,
    status: 'available',
    bookedBy: null,
    createdAt: new Date().toISOString()
  });

  document.getElementById('casePatientName').value = '';
  document.getElementById('casePatientPhone').value = '';
  document.getElementById('casePatientAge').value = '';
  document.getElementById('caseLocationInput').value = '';
  document.getElementById('caseTreatmentInput').value = '';
  document.getElementById('caseNotes').value = '';
  closeAddCaseModal();
}

function updateStats() {
  const avail = cases.filter(c => c.status === 'available').length;
  const booked = cases.filter(c => c.status === 'booked' && c.bookedBy === doctorProfile.name).length;
  const cities = new Set(cases.map(c => c.location)).size;

  document.getElementById('statAvailableCases').textContent = avail;
  document.getElementById('statMyBookedCases').textContent = booked;
  document.getElementById('statCities').textContent = cities;
  document.getElementById('myBookedBadge').textContent = booked;
}