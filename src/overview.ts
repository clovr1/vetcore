import { 
  seedDatabaseIfEmpty, 
  subscribePatients, 
  subscribeMedicalRecords, 
  db,
  escapeHtml 
} from './firebase';
import { initSidebarProfile } from './auth';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  await seedDatabaseIfEmpty();

  const overviewDateElem = document.getElementById('overviewDate');
  if (overviewDateElem) {
    overviewDateElem.textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // State
  let patientsCount = 0;
  let recordsCount = 0;
  let medicalRecordsList: any[] = [];

  // Subscribe to patients
  subscribePatients((patients) => {
    patientsCount = patients.length;
    const totalElem = document.getElementById('totalPatientsCount');
    if (totalElem) {
      totalElem.textContent = patientsCount.toLocaleString('id-ID');
    }

    const newThisMonthElem = document.getElementById('newPatientsThisMonth');
    if (newThisMonthElem) {
      // Calculate created this month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const newThisMonth = patients.filter(p => {
        if (!p.created_at?.seconds) return true;
        const d = new Date(p.created_at.seconds * 1000);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length;
      newThisMonthElem.textContent = newThisMonth.toString();
    }
  });

  // Subscribe to medical records for chart and total count
  subscribeMedicalRecords((records) => {
    recordsCount = records.length;
    medicalRecordsList = records;

    const medRecElem = document.getElementById('totalMedicalRecords');
    if (medRecElem) {
      medRecElem.textContent = recordsCount.toLocaleString('id-ID');
    }

    renderDynamicLineChart(medicalRecordsList);
  });

  // Subscribe to prescriptions count
  onSnapshot(collection(db, 'prescriptions'), (snap) => {
    const rxElem = document.getElementById('totalPrescriptions');
    if (rxElem) {
      rxElem.textContent = snap.size.toLocaleString('id-ID');
    }
  });

  // Recent activity feed from recent clinical notes or medical records
  const recentFeedContainer = document.getElementById('recentActivityFeed');
  if (recentFeedContainer) {
    const notesQuery = query(collection(db, 'clinical_notes'), orderBy('created_at', 'desc'), limit(5));
    onSnapshot(notesQuery, (snap) => {
      if (snap.empty) {
        recentFeedContainer.innerHTML = '<div class="text-xs text-slate-400 p-3">Belum ada aktivitas terbaru.</div>';
        return;
      }

      recentFeedContainer.innerHTML = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return `
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                ${escapeHtml(data.title ? data.title.substring(0,2).toUpperCase() : 'CL')}
              </div>
              <div>
                <span class="font-bold text-slate-900 block">${escapeHtml(data.title || 'Catatan Klinis')}</span>
                <span class="text-slate-500">${escapeHtml(data.detail || '')}</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(data.note_date || 'Hari ini')}</span>
          </div>
        `;
      }).join('');
    });
  }
});

// Render SVG Line Chart dynamically based on records per month
function renderDynamicLineChart(records: any[]) {
  const container = document.getElementById('dynamicTrendChart');
  if (!container) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthCounts = [0, 0, 0, 0, 0, 0];

  // Parse records dates e.g. "24 Oct 2023", "10 Jan 2026", "2026-08-10"
  records.forEach(rec => {
    const dateStr = rec.date || '';
    if (!dateStr) return;

    months.forEach((m, idx) => {
      if (dateStr.toLowerCase().includes(m.toLowerCase())) {
        monthCounts[idx]++;
      }
    });

    // Also check created_at month if applicable
    if (rec.created_at?.seconds) {
      const d = new Date(rec.created_at.seconds * 1000);
      const mIdx = d.getMonth(); // 0 to 11
      if (mIdx >= 0 && mIdx < 6) {
        // If date string didn't explicitly match, count by created month
        if (!months.some(m => dateStr.toLowerCase().includes(m.toLowerCase()))) {
          monthCounts[mIdx]++;
        }
      }
    }
  });

  const maxVal = Math.max(10, ...monthCounts);
  const xCoords = [60, 130, 200, 270, 340, 410];
  
  // Y range: min value (0) -> y=155, max value (maxVal) -> y=30
  const points = monthCounts.map((val, idx) => {
    const x = xCoords[idx];
    const y = 155 - (val / maxVal) * 115;
    return { x, y, val, month: months[idx] };
  });

  // Build smooth path
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cx = (p1.x + p2.x) / 2;
    pathD += ` C ${cx},${p1.y} ${cx},${p2.y} ${p2.x},${p2.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x},160 L ${points[0].x},160 Z`;

  // Grid line label values
  const topVal = maxVal;
  const midVal2 = Math.round(maxVal * 0.66);
  const midVal1 = Math.round(maxVal * 0.33);

  container.innerHTML = `
    <svg class="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#044e3a" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#044e3a" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      
      <!-- Grid lines -->
      <line x1="30" y1="30" x2="470" y2="30" stroke="#f1f5f9" stroke-dasharray="3"/>
      <text x="22" y="33" fill="#cbd5e1" font-size="8" text-anchor="end">${topVal}</text>
      
      <line x1="30" y1="70" x2="470" y2="70" stroke="#f1f5f9" stroke-dasharray="3"/>
      <text x="22" y="73" fill="#cbd5e1" font-size="8" text-anchor="end">${midVal2}</text>
      
      <line x1="30" y1="110" x2="470" y2="110" stroke="#f1f5f9" stroke-dasharray="3"/>
      <text x="22" y="113" fill="#cbd5e1" font-size="8" text-anchor="end">${midVal1}</text>
      
      <line x1="30" y1="160" x2="470" y2="160" stroke="#e2e8f0"/>
      <text x="22" y="163" fill="#cbd5e1" font-size="8" text-anchor="end">0</text>

      <!-- Area fill -->
      <path d="${areaD}" fill="url(#lineGrad)" />

      <!-- Smooth Line path -->
      <path d="${pathD}" fill="none" stroke="#044e3a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Points & Values -->
      ${points.map(pt => `
        <circle cx="${pt.x}" cy="${pt.y}" r="5" fill="#ffffff" stroke="#044e3a" stroke-width="2.5"/>
        <text x="${pt.x}" y="${pt.y - 9}" fill="#044e3a" font-size="9" font-weight="bold" text-anchor="middle">${pt.val}</text>
        <text x="${pt.x}" y="174" fill="#64748b" font-size="9" font-weight="500" text-anchor="middle">${pt.month}</text>
      `).join('')}
    </svg>
  `;
}

