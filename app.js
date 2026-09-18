/* =========================================================
   DENTAL CASE SHARING PLATFORM - APP LOGIC WITH AUTO-SUGGEST
   ========================================================= */

let cases = [];
let currentTab = 'available';
let displayLimit = 15;
let doctorProfile = JSON.parse(localStorage.getItem('qs_doctor')) || { name: '', phone: '' };

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  updateDoctorBadgeUI();
  displayHeaderDate();

  // 1. العرض الفوري السريع من الكاش
  const cachedData = localStorage.getItem('qs_cases_cache');
  if (cachedData) {
    try {
      cases = JSON.parse(cachedData);
      cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      populateFilterOptions();
      updateDatalists();
      applyFilters();
    } catch (e) {
      console.error("Cache read error", e);
    }
  }

  // 2. المزامنة مع Firebase
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
        cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        localStorage.setItem('qs_cases_cache', JSON.stringify(cases));

        populateFilterOptions();
        updateDatalists();
        applyFilters();
      });
    }
  }, 200);
}

function displayHeaderDate() {
  const dateEl = document.getElementById('currentDateDisplay');
  if (dateEl) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = `📅 ${now.toLocaleDateString('ar-EG', options)}`;
  }
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
  if (!name || !phone) return alert("يرجى إدخال اسم الطبيب ورقم التواصل.");

  doctorProfile = { name, phone };
  localStorage.setItem('qs_doctor', JSON.stringify(doctorProfile));
  updateDoctorBadgeUI();
  closeProfileModal();
  applyFilters();
}

function switchTab(tab) {
  currentTab = tab;
  displayLimit = 15;
  document.getElementById('tabAvailable').classList.toggle('active', tab === 'available');
  document.getElementById('tabMyBooked').classList.toggle('active', tab === 'my_booked');
  applyFilters();
}

function onFilterChange() {
  displayLimit = 15;
  applyFilters();
}

function getCaseTreatments(c) {
  if (!c.treatment) return [];
  if (Array.isArray(c.treatment)) return c.treatment;
  return c.treatment.split(',').map(t => t.trim()).filter(Boolean);
}

// تحديث قوائم المقترحات (Datalists) لخانات الإضافة
function updateDatalists() {
  const locDatalist = document.getElementById('locationsDatalist');
  const treatDatalist = document.getElementById('treatmentsDatalist');
  if (!locDatalist || !treatDatalist) return;

  const locations = [...new Set(cases.map(c => c.location))].filter(Boolean);
  const allTreatments = [];
  cases.forEach(c => {
    getCaseTreatments(c).forEach(t => {
      if (!allTreatments.includes(t)) allTreatments.push(t);
    });
  });

  locDatalist.innerHTML = locations.map(l => `<option value="${l}">`).join('');
  treatDatalist.innerHTML = allTreatments.map(t => `<option value="${t}">`).join('');
}

function populateFilterOptions() {
  const locations = [...new Set(cases.map(c => c.location))].filter(Boolean);
  const allTreatments = [];
  cases.forEach(c => {
    getCaseTreatments(c).forEach(t => {
      if (!allTreatments.includes(t)) allTreatments.push(t);
    });
  });

  const locSelect = document.getElementById('filterLocation');
  const treatSelect = document.getElementById('filterTreatment');

  const currentLoc = locSelect.value;
  const currentTreat = treatSelect.value;

  locSelect.innerHTML = '<option value="">كل الأماكن</option>' + locations.map(l => `<option value="${l}">${l}</option>`).join('');
  treatSelect.innerHTML = '<option value="">كل العلاجات</option>' + allTreatments.map(t => `<option value="${t}">${t}</option>`).join('');

  locSelect.value = currentLoc;
  treatSelect.value = currentTreat;
}

function applyFilters() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const gender = document.getElementById('filterGender').value;
  const location = document.getElementById('filterLocation').value;
  const selectedTreatment = document.getElementById('filterTreatment').value;

  const filtered = cases.filter(item => {
    if (currentTab === 'available' && item.status !== 'available') return false;
    if (currentTab === 'my_booked' && (item.status !== 'booked' || item.bookedBy !== doctorProfile.name)) return false;

    if (gender && item.gender !== gender) return false;
    if (location && item.location !== location) return false;

    const itemTreatments = getCaseTreatments(item);
    if (selectedTreatment && !itemTreatments.includes(selectedTreatment)) return false;

    if (query) {
      const matchName = item.patientName ? item.patientName.toLowerCase().includes(query) : false;
      const matchPhone = item.patientPhone ? item.patientPhone.includes(query) : false;
      const matchNotes = item.notes ? item.notes.toLowerCase().includes(query) : false;
      const matchTreatment = itemTreatments.some(t => t.toLowerCase().includes(query));
      if (!matchName && !matchPhone && !matchNotes && !matchTreatment) return false;
    }
    return true;
  });

  renderCases(filtered);
  updateBadges();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterGender').value = '';
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterTreatment').value = '';
  displayLimit = 15;
  applyFilters();
}

function renderCases(items) {
  const container = document.getElementById('casesContainer');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">لا توجد حالات مطابقة حالياً.</div>`;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  const visibleItems = items.slice(0, displayLimit);

  visibleItems.forEach(c => {
    const isMyBooked = c.status === 'booked' && c.bookedBy === doctorProfile.name;
    const isMyCreated = c.createdBy === doctorProfile.name;
    const treatments = getCaseTreatments(c);

    const formattedDate = c.createdAt ? new Date(c.createdAt).toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'غير محدد';

    const card = document.createElement('div');
    card.className = 'case-card';
    card.innerHTML = `
      <div class="case-card-header">
        <div class="treatment-badges-wrapper">
          ${treatments.map(t => `<span class="treatment-badge">${t}</span>`).join('')}
        </div>
        <span class="status-tag ${c.status === 'available' ? 'status-available' : 'status-booked'}">
          ${c.status === 'available' ? '🟢 متاحة' : `📌 محجوزة لـ د.${c.bookedBy}`}
        </span>
      </div>
      <div class="case-card-body">
        <div class="info-item"><span class="info-label">المريض:</span><span>${c.patientName}</span></div>
        <div class="info-item"><span class="info-label">الهاتف:</span><span><a href="tel:${c.patientPhone}">${c.patientPhone}</a></span></div>
        <div class="info-item"><span class="info-label">المكان:</span><span>📍 ${c.location}</span></div>
        <div class="info-item"><span class="info-label">العمر/الجنس:</span><span>${c.patientAge} سنة (${c.gender === 'Male' ? 'ذكر' : 'أنثى'})</span></div>
        <div class="info-item"><span class="info-label">الناشر:</span><span>د. ${c.createdBy || 'غير محدد'}</span></div>
        ${c.bookedByPhone ? `<div class="info-item"><span class="info-label">هاتف الحاجز:</span><span><a href="tel:${c.bookedByPhone}">${c.bookedByPhone}</a></span></div>` : ''}
        <div class="info-item"><span class="info-label">تاريخ الإضافة:</span><span style="font-size:11px; color:#64748b;">⏱️ ${formattedDate}</span></div>
      </div>
      ${c.notes ? `<div class="case-notes-box">${c.notes}</div>` : ''}
      <div class="case-card-footer">
        <div class="action-buttons">
          ${c.status === 'available' ? `<button class="btn-claim" onclick="claimCase('${c.id}')">➕ حجز الحالة</button>` : ''}
          ${isMyBooked ? `
            <button class="btn-complete" onclick="completeCase('${c.id}')">✓ إكمال العلاج</button>
            <button class="btn-cancel" onclick="cancelBooking('${c.id}')">إلغاء الحجز</button>
          ` : ''}
          ${isMyCreated && c.status === 'available' ? `
            <button class="btn-cancel" style="width:100%;" onclick="deleteMyCreatedCase('${c.id}')">🗑️ حذف حالتي</button>
          ` : ''}
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  if (loadMoreBtn) {
    loadMoreBtn.style.display = items.length > displayLimit ? 'inline-block' : 'none';
  }
}

function loadMoreCases() {
  displayLimit += 15;
  applyFilters();
}

function addTreatmentField(value = '') {
  const container = document.getElementById('treatmentsContainer');
  const row = document.createElement('div');
  row.className = 'treatment-input-row';
  row.innerHTML = `
    <input type="text" class="case-treatment-field" list="treatmentsDatalist" placeholder="اختر أو اكتب علاج إضافي..." value="${value}">
    <button type="button" class="btn-remove-treatment" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

function resetAddCaseForm() {
  document.getElementById('casePatientName').value = '';
  document.getElementById('casePatientPhone').value = '';
  document.getElementById('casePatientAge').value = '';
  document.getElementById('caseLocationInput').value = '';
  document.getElementById('caseNotes').value = '';

  const container = document.getElementById('treatmentsContainer');
  container.innerHTML = `
    <div class="treatment-input-row">
      <input type="text" class="case-treatment-field" list="treatmentsDatalist" placeholder="اختر أو اكتب العلاج الأول *">
    </div>
  `;
}

function claimCase(id) {
  if (!doctorProfile.name || !doctorProfile.phone) {
    alert("يرجى تسجيل بياناتك ورقم هاتفك أولاً لحجز الحالة.");
    return openProfileModal();
  }
  const caseRef = window.dbRef(window.db, `cases/${id}`);
  window.dbUpdate(caseRef, { 
    status: 'booked', 
    bookedBy: doctorProfile.name,
    bookedByPhone: doctorProfile.phone
  });
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
    window.dbUpdate(caseRef, { status: 'available', bookedBy: null, bookedByPhone: null });
  }
}

function deleteMyCreatedCase(id) {
  if (confirm("هل أنت تأكد من حذف هذه الحالة التي قمت بنشرها؟")) {
    const caseRef = window.dbRef(window.db, `cases/${id}`);
    window.dbRemove(caseRef);
  }
}

function handleNewCaseClick() {
  if (!doctorProfile.name) {
    alert("يرجى تسجيل بياناتك أولاً لإضافة حالة.");
    return openProfileModal();
  }
  resetAddCaseForm();
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
  const notes = document.getElementById('caseNotes').value.trim();

  const treatmentInputs = document.querySelectorAll('.case-treatment-field');
  const treatments = Array.from(treatmentInputs)
    .map(input => input.value.trim())
    .filter(val => val.length > 0);

  if (!name || !phone || !age || !location) return alert("يرجى إكمال جميع الحقول المطلوبة.");
  if (treatments.length === 0) return alert("يرجى إدخال العلاج الأول على الأقل.");

  const casesListRef = window.dbRef(window.db, 'cases');
  const newCaseRef = window.dbPush(casesListRef);

  window.dbSet(newCaseRef, {
    patientName: name,
    patientPhone: phone,
    patientAge: parseInt(age),
    gender,
    location,
    treatment: treatments.join(', '),
    notes,
    status: 'available',
    createdBy: doctorProfile.name,
    createdByPhone: doctorProfile.phone,
    bookedBy: null,
    bookedByPhone: null,
    createdAt: new Date().toISOString()
  });

  closeAddCaseModal();
}

function updateBadges() {
  const availableCount = cases.filter(c => c.status === 'available').length;
  const bookedCount = cases.filter(c => c.status === 'booked' && c.bookedBy === doctorProfile.name).length;

  const availBadge = document.getElementById('availableBadge');
  const myBookedBadge = document.getElementById('myBookedBadge');

  if (availBadge) availBadge.textContent = availableCount;
  if (myBookedBadge) myBookedBadge.textContent = bookedCount;
}
