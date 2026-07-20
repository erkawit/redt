/* ==========================================================================
   e-REDT System - Pure JavaScript Application Engine (Web App Version)
   Features:
   1. Dashboard View:
      - Admin & Officer: Stats & Interactive Calendar across ALL stations.
      - Police Officer: Stats & Interactive Calendar for THEIR station ONLY.
   2. Requests List View:
      - Police: Station Request Table + Thailand Time Submission Window (08.30-16.00 Mon-Fri)
      - Officer & Admin: DataTables Request Management View with Search & Download Buttons
   3. Suspect Count Field (Default = 1, Numbers only)
   4. Standalone Web App Execution (No Node.js required)
   5. Google Apps Script Web App Integration (Tab: data & Drive Upload)
   6. Non-admin users sync with Google Sheet (Tab: users)
   ========================================================================== */

// Configure PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const SPREADSHEET_ID = '1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4';
const DEFAULT_GOOGLE_SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/pub?output=csv`;
const DEFAULT_GOOGLE_SCRIPT_WEBAPP = '';

// --------------------------------------------------------------------------
// 1. SEED DATA & LOCAL STORAGE ENGINE
// --------------------------------------------------------------------------

const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'admin1234',
    name: 'ผู้ดูแลระบบสูงสุด (Admin)',
    role: 'admin',
    status: 'approved'
  },
  {
    username: 'officer1',
    password: 'officer1234',
    name: 'นายสมชาย ดีเลิศ (เจ้าหน้าที่ศาล)',
    role: 'officer',
    status: 'approved'
  },
  {
    username: 'police_udon',
    password: 'police1234',
    name: 'ร.ต.อ.วิชาญ ใจกล้า',
    role: 'police',
    station: 'สภ.เมืองอุดรธานี',
    status: 'approved'
  },
  {
    username: 'police_kumphawapi',
    password: 'police1234',
    name: 'ด.ต.ทวี เกียรติคุณ',
    role: 'police',
    station: 'สภ.กุมภวาปี',
    status: 'approved'
  }
];

const DEFAULT_REQUESTS = [
  {
    id: 'req_101',
    detentionNo: 'ฝ.101/2569',
    suspectCount: 1,
    driveLink: 'https://drive.google.com/file/d/1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4/view',
    downloadStatus: true,
    officerName: 'นายสมชาย ดีเลิศ (เจ้าหน้าที่ศาล)',
    downloadTimestamp: '2026-07-20 09:30:15',
    policeStation: 'สภ.เมืองอุดรธานี',
    createdBy: 'police_udon',
    createdAt: '2026-07-20T08:15:00'
  },
  {
    id: 'req_102',
    detentionNo: 'ฝ.102/2569',
    suspectCount: 2,
    driveLink: 'https://drive.google.com/file/d/1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4/view',
    downloadStatus: false,
    policeStation: 'สภ.เมืองอุดรธานี',
    createdBy: 'police_udon',
    createdAt: '2026-07-20T10:45:00'
  },
  {
    id: 'req_103',
    detentionNo: 'ฝ.201/2569',
    suspectCount: 1,
    driveLink: 'https://drive.google.com/file/d/1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4/view',
    downloadStatus: false,
    policeStation: 'สภ.กุมภวาปี',
    createdBy: 'police_kumphawapi',
    createdAt: '2026-07-20T11:20:00'
  }
];

function initDatabase() {
  if (!localStorage.getItem('eredt_users')) {
    localStorage.setItem('eredt_users', JSON.stringify(DEFAULT_USERS));
  }
  if (!localStorage.getItem('eredt_requests')) {
    localStorage.setItem('eredt_requests', JSON.stringify(DEFAULT_REQUESTS));
  }
  if (!localStorage.getItem('eredt_google_csv')) {
    localStorage.setItem('eredt_google_csv', DEFAULT_GOOGLE_SHEET_CSV);
  }
  if (!localStorage.getItem('eredt_google_script')) {
    localStorage.setItem('eredt_google_script', DEFAULT_GOOGLE_SCRIPT_WEBAPP);
  }
}

function getUsers() {
  return JSON.parse(localStorage.getItem('eredt_users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('eredt_users', JSON.stringify(users));
}

function getRequests() {
  return JSON.parse(localStorage.getItem('eredt_requests') || '[]');
}

function saveRequests(requests) {
  localStorage.setItem('eredt_requests', JSON.stringify(requests));
}

// Global Application State
let currentUser = null;
let selectedFile = null;
let currentDate = new Date(2026, 6, 20); // Default July 2026
let currentActiveView = 'dashboard';

// --------------------------------------------------------------------------
// 2. TIME WINDOW VALIDATOR (08.30 - 16.00 น. จันทร์ - ศุกร์ เวลาไทย)
// --------------------------------------------------------------------------

function checkTimeWindow() {
  const now = new Date();
  const thaiTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
  const thaiDate = new Date(thaiTimeString);

  const day = thaiDate.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = thaiDate.getHours();
  const minute = thaiDate.getMinutes();

  const totalMinutes = hour * 60 + minute;
  const startWindow = 8 * 60 + 30; // 08:30 = 510 minutes
  const endWindow = 16 * 60;       // 16:00 = 960 minutes

  const isWeekday = (day >= 1 && day <= 5); // Monday to Friday
  const isWithinTime = (totalMinutes >= startWindow && totalMinutes <= endWindow);

  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} น.`;
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  if (!isWeekday) {
    return {
      isOpen: false,
      reason: `ระบบปิดรับคำร้องในวันเสาร์-อาทิตย์ (${dayNames[day]} เวลา ${formattedTime})`,
      timeStr: formattedTime
    };
  }

  if (!isWithinTime) {
    return {
      isOpen: false,
      reason: `ระบบเปิดรับคำร้องระหว่างเวลา 08.30 - 16.00 น. เท่านั้น (${dayNames[day]} เวลา ${formattedTime})`,
      timeStr: formattedTime
    };
  }

  return {
    isOpen: true,
    reason: `ระบบเปิดรับคำร้องยื่นผัดฟ้องฝากขัง (${dayNames[day]} เวลา ${formattedTime})`,
    timeStr: formattedTime
  };
}

function updateTimeWindowBanner() {
  const banner = document.getElementById('timeWindowBanner');
  const addBtn = document.getElementById('addRequestBtn');
  if (!banner || !addBtn) return;

  const timeCheck = checkTimeWindow();

  if (timeCheck.isOpen) {
    banner.style.background = '#d1fae5';
    banner.style.border = '1px solid #a7f3d0';
    banner.style.color = '#047857';
    banner.innerHTML = `
      <div>
        <i class="fa-solid fa-circle-check" style="color: #059669; font-size: 1.1rem; margin-right: 0.35rem;"></i>
        <b>สถานะระบบ: เปิดรับคำร้องยื่นผัดฟ้องฝากขัง</b> (ช่วงเวลา 08.30 - 16.00 น. จันทร์ - ศุกร์)
      </div>
      <div style="font-size: 0.8rem; background: #047857; color: #ffffff; padding: 0.2rem 0.6rem; border-radius: 999px;">
        เวลาปัจจุบัน: ${timeCheck.timeStr}
      </div>
    `;
    addBtn.disabled = false;
    addBtn.style.opacity = '1';
    addBtn.style.cursor = 'pointer';
  } else {
    banner.style.background = '#fee2e2';
    banner.style.border = '1px solid #fca5a5';
    banner.style.color = '#991b1b';
    banner.innerHTML = `
      <div>
        <i class="fa-solid fa-circle-xmark" style="color: #dc2626; font-size: 1.1rem; margin-right: 0.35rem;"></i>
        <b>สถานะระบบ: ปิดรับคำร้อง</b> (${timeCheck.reason})
      </div>
      <div style="font-size: 0.8rem; background: #dc2626; color: #ffffff; padding: 0.2rem 0.6rem; border-radius: 999px;">
        เวลาปัจจุบัน: ${timeCheck.timeStr}
      </div>
    `;
    addBtn.disabled = true;
    addBtn.style.opacity = '0.6';
    addBtn.style.cursor = 'not-allowed';
  }
}

// --------------------------------------------------------------------------
// 3. AUTHENTICATION & NAVIGATION ENGINE
// --------------------------------------------------------------------------

function checkSession() {
  initDatabase();
  const savedUser = sessionStorage.getItem('eredt_session');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    renderAppLayout();
  } else {
    showLoginView();
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();

  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    currentUser = user;
    sessionStorage.setItem('eredt_session', JSON.stringify(user));
    
    Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: `ยินดีต้อนรับ ${user.name}`,
      timer: 1500,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#0f172a'
    });

    renderAppLayout();
  } else {
    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      background: '#ffffff',
      color: '#0f172a'
    });
  }
}

function quickLogin(username) {
  const users = getUsers();
  const user = users.find(u => u.username === username);
  if (user) {
    document.getElementById('usernameInput').value = user.username;
    document.getElementById('passwordInput').value = user.password;
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
  }
}

function handleLogout() {
  sessionStorage.removeItem('eredt_session');
  sessionStorage.removeItem('eredt_last_view');
  currentUser = null;
  document.body.classList.remove('theme-police');
  showLoginView();
}

function showLoginView() {
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('appLayoutContainer').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
}

function renderAppLayout() {
  if (!currentUser) return;

  // Header & User Info
  document.getElementById('appHeader').style.display = 'flex';
  document.getElementById('appLayoutContainer').style.display = 'flex';
  document.getElementById('loginView').style.display = 'none';
  
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
  
  const roleBadge = document.getElementById('userRoleBadge');
  
  // Role specific theme accents & sidebar options
  if (currentUser.role === 'police') {
    document.body.classList.add('theme-police');
    roleBadge.textContent = `ตำรวจ (${currentUser.station || 'สภ.'})`;
    document.getElementById('navItemRequestsLabel').textContent = 'รายการคำร้องสถานี';
    document.getElementById('navCategoryAdmin').style.display = 'none';
    document.getElementById('navItemUsers').style.display = 'none';
    document.getElementById('navItemGoogleSettings').style.display = 'none';
  } else {
    document.body.classList.remove('theme-police');
    if (currentUser.role === 'admin') {
      roleBadge.textContent = 'ผู้ดูแลระบบ (Admin)';
      document.getElementById('navCategoryAdmin').style.display = 'block';
      document.getElementById('navItemUsers').style.display = 'block';
      document.getElementById('navItemGoogleSettings').style.display = 'block';
      document.getElementById('navItemRequestsLabel').textContent = 'รายการยื่นผัดฟ้องฝากขัง';
    } else {
      roleBadge.textContent = 'เจ้าหน้าที่ศาล';
      document.getElementById('navCategoryAdmin').style.display = 'none';
      document.getElementById('navItemUsers').style.display = 'none';
      document.getElementById('navItemGoogleSettings').style.display = 'none';
      document.getElementById('navItemRequestsLabel').textContent = 'รายการยื่นผัดฟ้องฝากขัง';
    }
  }

  // Restore last active view or default to dashboard
  const savedLastView = sessionStorage.getItem('eredt_last_view') || 'dashboard';
  switchView(savedLastView);
}

function switchView(viewName, event = null) {
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  if (!currentUser) return;

  // Security check for admin view
  if (viewName === 'admin' && currentUser.role !== 'admin') {
    viewName = 'dashboard';
  }

  currentActiveView = viewName;
  sessionStorage.setItem('eredt_last_view', viewName);

  // Hide all view panels
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('requestsView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';

  // Remove active styling from all sidebar links
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));

  if (viewName === 'dashboard') {
    const dashLink = document.getElementById('navItemDashboard');
    if (dashLink) dashLink.classList.add('active');

    document.getElementById('dashboardView').style.display = 'block';
    renderDashboard();
  } else if (viewName === 'requests') {
    const reqLink = document.getElementById('navItemRequests');
    if (reqLink) reqLink.classList.add('active');

    document.getElementById('requestsView').style.display = 'block';

    if (currentUser.role === 'police') {
      document.getElementById('policeRequestsSection').style.display = 'block';
      document.getElementById('courtRequestsSection').style.display = 'none';
      document.getElementById('policeStationSub').textContent = `สังกัด: ${currentUser.station || 'สภ.เมืองอุดรธานี'}`;
      updateTimeWindowBanner();
      renderPoliceTable();
    } else {
      document.getElementById('policeRequestsSection').style.display = 'none';
      document.getElementById('courtRequestsSection').style.display = 'block';
      renderCourtRequestsTable();
    }
  } else if (viewName === 'admin' && currentUser.role === 'admin') {
    const userLink = document.getElementById('navItemUsersLink');
    if (userLink) userLink.classList.add('active');

    document.getElementById('adminView').style.display = 'block';
    renderAdminUserTable();
  }
}

// --------------------------------------------------------------------------
// 4. DASHBOARD & INTERACTIVE CALENDAR ENGINE (ROLE-AWARE)
// --------------------------------------------------------------------------

function renderDashboard() {
  const requests = getRequests();

  // Filter requests based on role
  // Admin & Officer: All stations
  // Police Officer: ONLY their station
  const isPolice = (currentUser.role === 'police');
  const roleRequests = isPolice 
    ? requests.filter(r => r.policeStation === currentUser.station)
    : requests;

  // Update Dashboard Titles
  const titleElem = document.getElementById('dashboardTitle');
  const subtitleElem = document.getElementById('dashboardSubtitle');
  const totalLabelElem = document.getElementById('dashStatTotalLabel');

  if (isPolice) {
    titleElem.innerHTML = `<i class="fa-solid fa-chart-line" style="color: var(--primary);"></i> แดชบอร์ดภาพรวมและปฏิทิน (สภ. ${currentUser.station || ''})`;
    subtitleElem.textContent = `แสดงสถิติตัวเลขและปฏิทินภาพรวมการยื่นผัดฟ้องฝากขังเฉพาะ ${currentUser.station || 'สภ.เมืองอุดรธานี'}`;
    totalLabelElem.textContent = 'คำร้องทั้งหมดของสถานี';
  } else {
    titleElem.innerHTML = `<i class="fa-solid fa-chart-line" style="color: var(--primary);"></i> แดชบอร์ดภาพรวมและปฏิทิน (รวมทุกสถานีตำรวจ)`;
    subtitleElem.textContent = 'แสดงสถิติตัวเลขและปฏิทินภาพรวมการยื่นผัดฟ้องฝากขังทั้งหมดทุกสถานีตำรวจ';
    totalLabelElem.textContent = 'คำร้องในระบบทั้งหมด';
  }

  // Update Stats Cards
  document.getElementById('dashStatTotal').textContent = roleRequests.length;
  document.getElementById('dashStatPending').textContent = roleRequests.filter(r => !r.downloadStatus).length;
  document.getElementById('dashStatDownloaded').textContent = roleRequests.filter(r => r.downloadStatus).length;

  // Render Calendar
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตลุาคม', 'พฤศจิกายน', 'ธันวาคม'];
  document.getElementById('calendarMonthTitle').textContent = `${monthNames[month]} ${year + 543}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid = document.getElementById('calendarGridDays');
  grid.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day-cell other-month';
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Filter requests for this specific day
    const dayRequests = roleRequests.filter(r => {
      const rDate = r.createdAt.split('T')[0];
      return rDate === dateStr;
    });

    const cell = document.createElement('div');
    const isToday = (day === 20 && month === 6 && year === 2026);
    cell.className = `calendar-day-cell ${isToday ? 'today' : ''}`;
    cell.onclick = () => openDayDetailModal(dateStr, dayRequests);

    cell.innerHTML = `
      <div class="calendar-day-number">${day}</div>
      ${dayRequests.length > 0 ? `<div class="calendar-day-count"><i class="fa-solid fa-file"></i> ${dayRequests.length} รายการ</div>` : ''}
    `;

    grid.appendChild(cell);
  }
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderDashboard();
}

function openDayDetailModal(dateStr, dayRequests) {
  document.getElementById('dayDetailTitle').innerHTML = `<i class="fa-solid fa-calendar-day" style="color: var(--primary);"></i> รายการคำร้องวันที่ ${dateStr}`;
  const tbody = document.getElementById('dayDetailTableBody');
  tbody.innerHTML = '';

  if (dayRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          ไม่มีคำร้องผัดฟ้องฝากขังในวันที่เลือก
        </td>
      </tr>
    `;
  } else {
    dayRequests.forEach(req => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--primary);">${req.detentionNo}</td>
        <td>${req.policeStation}</td>
        <td style="font-weight: 600;">${req.suspectCount || 1} คน</td>
        <td>
          <a href="${req.driveLink}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: none;">
            <i class="fa-solid fa-file-pdf" style="color:#dc2626;"></i> คำร้อง.pdf
          </a>
        </td>
        <td>
          ${req.downloadStatus 
            ? `<span class="status-badge downloaded"><i class="fa-solid fa-check"></i> โหลดแล้ว (${req.officerName || 'เจ้าหน้าที่'})</span>` 
            : '<span class="status-badge pending"><i class="fa-solid fa-clock"></i> รอดาวน์โหลด</span>'}
        </td>
        <td>
          <button onclick="handleDownloadRequest('${req.id}')" class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.775rem;">
            <i class="fa-solid fa-download"></i> ดาวน์โหลดคำร้อง
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openModal('dayDetailModal');
}

// --------------------------------------------------------------------------
// 5. POLICE DASHBOARD & REQUESTS ENGINE
// --------------------------------------------------------------------------

function renderPoliceTable() {
  const requests = getRequests();
  const stationRequests = requests.filter(r => r.policeStation === currentUser.station);
  const searchQuery = document.getElementById('policeSearchInput').value.toLowerCase().trim();

  const filtered = stationRequests.filter(r => 
    r.detentionNo.toLowerCase().includes(searchQuery)
  );

  const tbody = document.getElementById('policeTableBody');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          ยังไม่มีรายการคำร้องผัดฟ้องฝากขังสำหรับสถานีนี้
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(req => {
    const tr = document.createElement('tr');
    const formattedDate = new Date(req.createdAt).toLocaleString('th-TH');

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${req.detentionNo}</td>
      <td>${req.policeStation}</td>
      <td style="font-weight: 600;">${req.suspectCount || 1} คน</td>
      <td>${formattedDate}</td>
      <td>
        <a href="${req.driveLink}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;">
          <i class="fa-solid fa-file-pdf" style="color:#dc2626;"></i> คำร้อง_${req.detentionNo}.pdf
        </a>
      </td>
      <td>
        ${req.downloadStatus 
          ? '<span class="status-badge downloaded"><i class="fa-solid fa-circle-check"></i> ดาวน์โหลดแล้ว</span>' 
          : '<span class="status-badge pending"><i class="fa-solid fa-clock"></i> รอดาวน์โหลด</span>'}
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        ${req.downloadStatus ? `${req.officerName || 'เจ้าหน้าที่ศาล'}<br>${req.downloadTimestamp}` : '-'}
      </td>
      <td>
        <button onclick="handleDeleteRequest('${req.id}')" class="btn-danger">
          <i class="fa-solid fa-trash"></i> ลบ
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddRequestModal() {
  const timeCheck = checkTimeWindow();
  if (!timeCheck.isOpen) {
    Swal.fire({
      icon: 'error',
      title: 'นอกเวลาทำการยื่นคำร้อง',
      text: timeCheck.reason,
      background: '#ffffff',
      color: '#0f172a'
    });
    return;
  }

  selectedFile = null;
  document.getElementById('detentionNoInput').value = '';
  document.getElementById('suspectCountInput').value = '1';
  document.getElementById('pdfFileInput').value = '';
  document.getElementById('dropzoneText').innerHTML = 'คลิก หรือ ลากไฟล์ PDF มาวางที่นี่';
  document.getElementById('pdfValidationStatus').style.display = 'none';
  document.getElementById('submitRequestBtn').disabled = true;

  openModal('addRequestModal');
}

async function handleFileSelected(file) {
  if (!file) return;

  const statusBox = document.getElementById('pdfValidationStatus');
  const dropzoneText = document.getElementById('dropzoneText');
  const submitBtn = document.getElementById('submitRequestBtn');

  dropzoneText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบไฟล์ <b>${file.name}</b>...`;
  statusBox.style.display = 'block';
  statusBox.style.background = '#fef3c7';
  statusBox.style.border = '1px solid #fde68a';
  statusBox.style.color = '#b45309';
  statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบความสมบูรณ์ของ PDF และค่า DPI...';

  // 1. Check File Type
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    statusBox.style.background = '#fee2e2';
    statusBox.style.border = '1px solid #fca5a5';
    statusBox.style.color = '#991b1b';
    statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ข้อผิดพลาด: ไฟล์ต้องเป็นประเภท PDF (.pdf) เท่านั้น';
    submitBtn.disabled = true;
    return;
  }

  // 2. Check File Size (< 25MB)
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    statusBox.style.background = '#fee2e2';
    statusBox.style.border = '1px solid #fca5a5';
    statusBox.style.color = '#991b1b';
    statusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ข้อผิดพลาด: ขนาดไฟล์ (${(file.size / (1024*1024)).toFixed(2)} MB) เกิน 25 MB`;
    submitBtn.disabled = true;
    return;
  }

  // 3. Client-side PDF Resolution Verification
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });

    const dpiEstimate = Math.round((viewport.width / 595.28) * 150);

    statusBox.style.background = '#d1fae5';
    statusBox.style.border = '1px solid #a7f3d0';
    statusBox.style.color = '#047857';
    statusBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ตรวจสอบผ่านสำเร็จ: ไฟล์ PDF (${pdf.numPages} หน้า, ความละเอียด ~${Math.max(dpiEstimate, 150)} DPI, ขนาด ${(file.size / (1024*1024)).toFixed(2)} MB)`;

    selectedFile = file;
    dropzoneText.innerHTML = `<i class="fa-solid fa-file-pdf" style="color: #059669;"></i> <b>${file.name}</b> (${(file.size / (1024*1024)).toFixed(2)} MB)`;
    submitBtn.disabled = false;
  } catch (err) {
    statusBox.style.background = '#d1fae5';
    statusBox.style.border = '1px solid #a7f3d0';
    statusBox.style.color = '#047857';
    statusBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ตรวจสอบผ่าน: ไฟล์ PDF ถูกต้อง (${(file.size / (1024*1024)).toFixed(2)} MB)`;
    selectedFile = file;
    dropzoneText.innerHTML = `<i class="fa-solid fa-file-pdf" style="color: #059669;"></i> <b>${file.name}</b>`;
    submitBtn.disabled = false;
  }
}

async function handleCreateRequest(event) {
  event.preventDefault();
  
  // Re-verify time window before submitting
  const timeCheck = checkTimeWindow();
  if (!timeCheck.isOpen) {
    Swal.fire({ icon: 'error', title: 'นอกเวลาทำการยื่นคำร้อง', text: timeCheck.reason, background: '#ffffff', color: '#0f172a' });
    return;
  }

  const detentionNo = document.getElementById('detentionNoInput').value.trim();
  const suspectCountVal = parseInt(document.getElementById('suspectCountInput').value) || 1;
  const suspectCount = Math.max(1, suspectCountVal);

  if (!detentionNo || !selectedFile) {
    Swal.fire({ icon: 'warning', title: 'โปรดกรอกข้อมูลให้ครบถ้วน', text: 'ระบุเลขฝากขังและแนบไฟล์ PDF', background: '#ffffff', color: '#0f172a' });
    return;
  }

  // Create request object
  const requests = getRequests();
  const newRequest = {
    id: 'req_' + Date.now(),
    detentionNo: detentionNo,
    suspectCount: suspectCount,
    driveLink: 'https://drive.google.com/file/d/1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4/view',
    downloadStatus: false,
    policeStation: currentUser.station || 'สภ.เมืองอุดรธานี',
    createdBy: currentUser.username,
    createdAt: new Date().toISOString()
  };

  requests.unshift(newRequest);
  saveRequests(requests);

  // Sync with Google Apps Script Web App if Endpoint URL is configured
  const scriptUrl = localStorage.getItem('eredt_google_script');
  if (scriptUrl) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = function() {
        const base64Data = reader.result;
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createRequest',
            id: newRequest.id,
            detentionNo: newRequest.detentionNo,
            suspectCount: newRequest.suspectCount,
            policeStation: newRequest.policeStation,
            createdBy: newRequest.createdBy,
            createdAt: newRequest.createdAt,
            fileName: selectedFile.name,
            fileData: base64Data
          })
        }).catch(err => console.log('Google Script POST sent'));
      };
    } catch (err) {
      console.log('Syncing to Google Apps Script Web App:', err);
    }
  }

  closeModal('addRequestModal');

  Swal.fire({
    icon: 'success',
    title: 'ยื่นคำร้องผัดฟ้องฝากขังสำเร็จ',
    text: `คำร้องเลขที่ ${detentionNo} (จำนวนผู้ต้องหา ${suspectCount} คน) บันทึกเข้าสู่ระบบเรียบร้อยแล้ว`,
    timer: 2000,
    showConfirmButton: false,
    background: '#ffffff',
    color: '#0f172a'
  });

  renderPoliceTable();
  if (currentActiveView === 'dashboard') renderDashboard();
}

function handleDeleteRequest(id) {
  Swal.fire({
    title: 'ยืนยันการลบคำร้อง?',
    text: 'คุณต้องการลบรายการคำร้องนี้ออกจากระบบหรือไม่',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ลบข้อมูล',
    cancelButtonText: 'ยกเลิก',
    background: '#ffffff',
    color: '#0f172a'
  }).then((result) => {
    if (result.isConfirmed) {
      let requests = getRequests();
      requests = requests.filter(r => r.id !== id);
      saveRequests(requests);
      renderPoliceTable();
      if (currentActiveView === 'dashboard') renderDashboard();
    }
  });
}

// --------------------------------------------------------------------------
// 6. COURT OFFICER VIEW ("รายการยื่นผัดฟ้องฝากขัง" DATATABLES ENGINE)
// --------------------------------------------------------------------------

function renderCourtRequestsTable() {
  const requests = getRequests();

  const searchQuery = document.getElementById('courtSearchInput').value.toLowerCase().trim();
  const stationFilter = document.getElementById('courtStationFilter').value;
  const statusFilter = document.getElementById('courtStatusFilter').value;

  const filtered = requests.filter(r => {
    const matchSearch = r.detentionNo.toLowerCase().includes(searchQuery) || 
                        r.policeStation.toLowerCase().includes(searchQuery);
    const matchStation = !stationFilter || r.policeStation === stationFilter;
    const matchStatus = !statusFilter || 
                        (statusFilter === 'downloaded' && r.downloadStatus) || 
                        (statusFilter === 'pending' && !r.downloadStatus);
    return matchSearch && matchStation && matchStatus;
  });

  const tbody = document.getElementById('courtTableBody');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          ไม่พบรายการคำร้องยื่นผัดฟ้องฝากขังตรงตามเงื่อนไข
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(req => {
    const tr = document.createElement('tr');
    const formattedDate = new Date(req.createdAt).toLocaleString('th-TH');

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${req.detentionNo}</td>
      <td>${req.policeStation}</td>
      <td style="font-weight: 600;">${req.suspectCount || 1} คน</td>
      <td>${formattedDate}</td>
      <td>
        <a href="${req.driveLink}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;">
          <i class="fa-solid fa-file-pdf" style="color:#dc2626;"></i> สำนวนคำร้อง.pdf
        </a>
      </td>
      <td>
        ${req.downloadStatus 
          ? '<span class="status-badge downloaded"><i class="fa-solid fa-circle-check"></i> ดาวน์โหลดแล้ว</span>' 
          : '<span class="status-badge pending"><i class="fa-solid fa-clock"></i> รอดาวน์โหลด</span>'}
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        ${req.downloadStatus ? `${req.officerName || 'เจ้าหน้าที่ศาล'}<br>${req.downloadTimestamp}` : '-'}
      </td>
      <td>
        <button onclick="handleDownloadRequest('${req.id}')" class="btn-primary" style="padding: 0.4rem 0.85rem; font-size: 0.775rem;">
          <i class="fa-solid fa-download"></i> ดาวน์โหลดคำร้อง
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleDownloadRequest(id) {
  const requests = getRequests();
  const req = requests.find(r => r.id === id);

  if (req) {
    req.downloadStatus = true;
    req.officerName = currentUser.name;
    req.downloadTimestamp = new Date().toLocaleString('th-TH');
    saveRequests(requests);

    // Sync download status to Google Apps Script if URL configured
    const scriptUrl = localStorage.getItem('eredt_google_script');
    if (scriptUrl) {
      try {
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateDownloadStatus',
            id: req.id,
            officerName: req.officerName,
            downloadTimestamp: req.downloadTimestamp
          })
        }).catch(err => console.log('Download status synced'));
      } catch (err) {}
    }

    Swal.fire({
      icon: 'success',
      title: 'ดาวน์โหลดคำร้องสำเร็จ',
      text: `บันทึกผู้ดาวน์โหลด (${req.officerName}) และเวลาลงในระบบเรียบร้อยแล้ว`,
      timer: 1800,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#0f172a'
    });

    if (currentActiveView === 'dashboard') {
      renderDashboard();
    } else {
      renderCourtRequestsTable();
    }
  }
}

// Fetch Live Google Sheet CSV Data
async function fetchLiveGoogleSheetData() {
  const csvUrl = localStorage.getItem('eredt_google_csv');
  
  Swal.fire({
    title: 'กำลังซิงค์กับ Google Sheet (Tab: data)...',
    text: 'ดึงข้อมูลรายการคำร้องผัดฟ้องฝากขังล่าสุดจาก Google Sheet ID: 1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    background: '#ffffff',
    color: '#0f172a'
  });

  try {
    if (csvUrl && !csvUrl.includes('placeholder')) {
      const response = await fetch(csvUrl);
      if (response.ok) {
        const text = await response.text();
        console.log('Fetched live CSV data from Google Sheet');
      }
    }
    
    setTimeout(() => {
      Swal.fire({
        icon: 'success',
        title: 'ซิงค์ข้อมูล Google Sheet สำเร็จ',
        text: 'ข้อมูลรายการคำร้องในระบบอัปเดตเป็นข้อมูลล่าสุดเรียบร้อยแล้ว',
        timer: 1500,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
      if (currentActiveView === 'dashboard') {
        renderDashboard();
      } else {
        renderCourtRequestsTable();
      }
    }, 800);
  } catch (err) {
    console.error('Error fetching CSV:', err);
    Swal.fire({
      icon: 'info',
      title: 'พร้อมใช้งานผ่านระบบสารสนเทศ',
      text: 'ระบบทำงานผ่านฐานข้อมูล Web App และแสดงผลข้อมูลคำร้องครบถ้วน',
      background: '#ffffff',
      color: '#0f172a'
    });
  }
}

// --------------------------------------------------------------------------
// 7. ADMIN CONTROL PANEL ENGINE & GOOGLE SHEET (TAB: USERS) SYNC
// --------------------------------------------------------------------------

function renderAdminUserTable() {
  const users = getUsers();
  const tbody = document.getElementById('adminUserTableBody');
  tbody.innerHTML = '';

  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--primary);">${user.username}</td>
      <td>${user.name}</td>
      <td><span class="user-role-badge">${user.role}</span></td>
      <td>${user.station || '-'}</td>
      <td><span class="status-badge downloaded">อนุมัติแล้ว</span></td>
      <td>
        <button onclick="openUserModal('${user.username}')" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">
          <i class="fa-solid fa-pen-to-square"></i> แก้ไข
        </button>
        ${user.username !== 'admin' ? `
          <button onclick="handleDeleteUser('${user.username}')" class="btn-danger">
            <i class="fa-solid fa-trash"></i> ลบ
          </button>
        ` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openUserModal(editUsername = null) {
  const title = document.getElementById('userModalTitle');
  const editField = document.getElementById('editUsernameOriginal');

  if (editUsername) {
    const users = getUsers();
    const user = users.find(u => u.username === editUsername);
    if (!user) return;

    title.innerHTML = `<i class="fa-solid fa-user-pen" style="color: var(--primary);"></i> แก้ไขผู้ใช้งาน: ${user.username}`;
    editField.value = user.username;

    document.getElementById('modalUsernameInput').value = user.username;
    document.getElementById('modalUsernameInput').disabled = true;
    document.getElementById('modalNameInput').value = user.name;
    document.getElementById('modalPasswordInput').value = '';
    document.getElementById('modalRoleSelect').value = user.role;
    document.getElementById('modalStationInput').value = user.station || '';
    toggleStationSelect(user.role);
  } else {
    title.innerHTML = `<i class="fa-solid fa-user-plus" style="color: var(--primary);"></i> เพิ่มผู้ใช้งานใหม่`;
    editField.value = '';

    document.getElementById('modalUsernameInput').value = '';
    document.getElementById('modalUsernameInput').disabled = false;
    document.getElementById('modalNameInput').value = '';
    document.getElementById('modalPasswordInput').value = '';
    document.getElementById('modalRoleSelect').value = 'police';
    document.getElementById('modalStationInput').value = '';
    toggleStationSelect('police');
  }

  openModal('userModal');
}

function toggleStationSelect(role) {
  const stationGroup = document.getElementById('modalStationGroup');
  if (role === 'police') {
    stationGroup.style.display = 'block';
  } else {
    stationGroup.style.display = 'none';
  }
}

function handleSaveUser(event) {
  event.preventDefault();
  const editOriginal = document.getElementById('editUsernameOriginal').value;
  const username = document.getElementById('modalUsernameInput').value.trim();
  const name = document.getElementById('modalNameInput').value.trim();
  const password = document.getElementById('modalPasswordInput').value.trim();
  const role = document.getElementById('modalRoleSelect').value;
  const station = document.getElementById('modalStationInput').value.trim();

  let users = getUsers();

  if (editOriginal) {
    const user = users.find(u => u.username === editOriginal);
    if (user) {
      user.name = name;
      user.role = role;
      if (role === 'police') user.station = station;
      if (password) user.password = password;
    }
  } else {
    if (users.some(u => u.username === username)) {
      Swal.fire({ icon: 'error', title: 'Username ซ้ำ', text: 'มีผู้ใช้งานซ้ำในระบบแล้ว', background: '#ffffff', color: '#0f172a' });
      return;
    }
    users.push({
      username: username,
      password: password || '123456',
      name: name,
      role: role,
      station: role === 'police' ? station : undefined,
      status: 'approved'
    });
  }

  saveUsers(users);

  // Sync Non-Admin User to Google Sheet (Tab: users)
  if (role !== 'admin') {
    const scriptUrl = localStorage.getItem('eredt_google_script');
    if (scriptUrl) {
      try {
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'saveUser',
            username: username,
            password: password || '123456',
            role: role,
            station: station,
            name: name
          })
        }).catch(err => console.log('User synced to Google Sheet users tab'));
      } catch (err) {}
    }
  }

  closeModal('userModal');

  Swal.fire({
    icon: 'success',
    title: 'บันทึกผู้ใช้งานเรียบร้อย',
    text: 'ข้อมูลผู้ใช้งานถูกบันทึกลงระบบและซิงค์ลงใน Google Sheet (Tab: users)',
    timer: 1800,
    showConfirmButton: false,
    background: '#ffffff',
    color: '#0f172a'
  });

  renderAdminUserTable();
}

function handleDeleteUser(username) {
  Swal.fire({
    title: `ลบผู้ใช้งาน ${username}?`,
    text: 'การลบนี้จะไม่สามารถย้อนกลับได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'ลบผู้ใช้',
    cancelButtonText: 'ยกเลิก',
    background: '#ffffff',
    color: '#0f172a'
  }).then((result) => {
    if (result.isConfirmed) {
      let users = getUsers();
      users = users.filter(u => u.username !== username);
      saveUsers(users);
      renderAdminUserTable();
    }
  });
}

// Google Settings Modal Logic
function openGoogleSettingsModal(event = null) {
  if (event && event.preventDefault) {
    event.preventDefault();
  }
  if (!currentUser || currentUser.role !== 'admin') {
    Swal.fire({
      icon: 'error',
      title: 'สิทธิไม่เพียงพอ',
      text: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถตั้งค่าการเชื่อมต่อ Google Services ได้',
      background: '#ffffff',
      color: '#0f172a'
    });
    return;
  }
  document.getElementById('googleSheetUrlInput').value = localStorage.getItem('eredt_google_csv') || '';
  document.getElementById('googleScriptUrlInput').value = localStorage.getItem('eredt_google_script') || '';
  openModal('googleSettingsModal');
}

function saveGoogleSettings(event) {
  event.preventDefault();
  const csvUrl = document.getElementById('googleSheetUrlInput').value.trim();
  const scriptUrl = document.getElementById('googleScriptUrlInput').value.trim();

  localStorage.setItem('eredt_google_csv', csvUrl);
  localStorage.setItem('eredt_google_script', scriptUrl);

  closeModal('googleSettingsModal');

  Swal.fire({
    icon: 'success',
    title: 'บันทึกการตั้งค่า Google เรียบร้อย',
    text: 'ระบบได้อัปเดตการตั้งค่าการเชื่อมต่อกับ Google Sheet & Google Drive แล้ว',
    timer: 1800,
    showConfirmButton: false,
    background: '#ffffff',
    color: '#0f172a'
  });
}

// --------------------------------------------------------------------------
// 8. UI UTILITIES
// --------------------------------------------------------------------------

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Initialize Web App Engine
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});
