import { seedDatabaseIfEmpty, subscribePatients, escapeHtml, Patient } from './firebase';
import { initSidebarProfile, getCurrentUser } from './auth';

let allPatients: Patient[] = [];
let currentPage = 1;
const pageSize = 10;
let currentViewMode: 'owner' | 'pet' = 'owner';
let isDoctor = false;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarProfile();
  const user = getCurrentUser();
  isDoctor = user.role === 'doctor';
  await seedDatabaseIfEmpty();

  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const speciesFilter = document.getElementById('speciesFilter') as HTMLSelectElement | null;
  const statusFilter = document.getElementById('statusFilter') as HTMLSelectElement | null;

  const resetPageAndRender = () => {
    currentPage = 1;
    renderTable();
  };

  if (searchInput) searchInput.addEventListener('keyup', resetPageAndRender);
  if (speciesFilter) speciesFilter.addEventListener('change', resetPageAndRender);
  if (statusFilter) statusFilter.addEventListener('change', resetPageAndRender);

  subscribePatients((patients) => {
    // Sort patients consistently by code ascending (#PT-0001, #PT-0002, etc.)
    allPatients = patients.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    renderTable();
  });
});

function setViewMode(mode: 'owner' | 'pet') {
  currentViewMode = mode;
  currentPage = 1;

  const ownerBtn = document.getElementById('viewModeOwnerBtn');
  const petBtn = document.getElementById('viewModePetBtn');

  if (mode === 'owner') {
    if (ownerBtn) {
      ownerBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white text-vetgreen-800 shadow-xs';
    }
    if (petBtn) {
      petBtn.className = 'px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5';
    }
  } else {
    if (petBtn) {
      petBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white text-vetgreen-800 shadow-xs';
    }
    if (ownerBtn) {
      ownerBtn.className = 'px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5';
    }
  }

  renderTable();
}

interface OwnerGroup {
  owner_name: string;
  phone: string;
  address: string;
  pets: Patient[];
  latest_visit: string;
  primary_code: string;
}

function renderTable() {
  const tbody = document.getElementById('patientTableBody');
  const noResultsRow = document.getElementById('noResultsRow');
  if (!tbody) return;

  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const speciesFilter = document.getElementById('speciesFilter') as HTMLSelectElement | null;
  const statusFilter = document.getElementById('statusFilter') as HTMLSelectElement | null;

  const query = (searchInput?.value || '').toLowerCase().trim();
  const speciesVal = (speciesFilter?.value || 'all').toLowerCase();
  const statusVal = (statusFilter?.value || 'all').toLowerCase();

  // Helper to remove initial loading row
  const loadingRow = document.getElementById('initialLoadingRow');
  if (loadingRow) loadingRow.remove();

  if (currentViewMode === 'owner') {
    // --- MODE GROUP PER-PEMILIK (1 BARIS 1 PEMILIK) ---
    const ownerMap = new Map<string, OwnerGroup>();

    allPatients.forEach(p => {
      const key = (p.owner_name || 'Tanpa Nama').toLowerCase().trim();
      if (!ownerMap.has(key)) {
        ownerMap.set(key, {
          owner_name: p.owner_name || 'Tanpa Nama',
          phone: p.phone || '-',
          address: p.address || '-',
          pets: [p],
          latest_visit: p.last_visit || 'Hari ini',
          primary_code: p.code || '#PT-0000'
        });
      } else {
        const group = ownerMap.get(key)!;
        group.pets.push(p);
        if (p.phone && p.phone !== '-') group.phone = p.phone;
        if (p.address && p.address !== '-') group.address = p.address;
      }
    });

    const ownerGroups = Array.from(ownerMap.values());

    // Filter Owner Groups
    const filteredGroups = ownerGroups.filter(g => {
      const ownerMatch = !query ||
        g.owner_name.toLowerCase().includes(query) ||
        g.phone.toLowerCase().includes(query) ||
        g.address.toLowerCase().includes(query) ||
        g.pets.some(p => 
          p.name.toLowerCase().includes(query) || 
          p.code.toLowerCase().includes(query) ||
          p.breed?.toLowerCase().includes(query) ||
          p.species.toLowerCase().includes(query)
        );

      const speciesMatch = speciesVal === 'all' || g.pets.some(p => p.species.toLowerCase().includes(speciesVal));
      const statusMatch = statusVal === 'all' || g.pets.some(p => p.status.toLowerCase() === statusVal);

      return ownerMatch && speciesMatch && statusMatch;
    });

    const totalFiltered = filteredGroups.length;
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalFiltered);
    const pageItems = filteredGroups.slice(startIdx, endIdx);

    updatePaginationUI(totalFiltered, startIdx, endIdx, totalPages);

    if (totalFiltered === 0) {
      if (noResultsRow) noResultsRow.classList.remove('hidden');
      const rows = tbody.querySelectorAll('.patient-row');
      rows.forEach(r => r.remove());
      return;
    }

    if (noResultsRow) noResultsRow.classList.add('hidden');

    const existingRows = tbody.querySelectorAll('.patient-row');
    existingRows.forEach(r => r.remove());

    pageItems.forEach(g => {
      const tr = document.createElement('tr');
      const allHealthy = g.pets.every(p => p.status === 'Sehat' || p.status === 'Selesai');
      const isDisabled = !isDoctor && allHealthy;
      tr.className = 'patient-row hover:bg-slate-50/80 transition-colors' + (isDisabled ? ' opacity-50' : '');

      const allSpeciesStr = Array.from(new Set(g.pets.map(p => p.species))).join(', ');
      const displayPets = g.pets.slice(0, 3);
      const morePetsCount = g.pets.length - 3;

      tr.innerHTML = `
        <td class="px-5 py-4 font-mono text-[11px] text-slate-400">${escapeHtml(g.primary_code)}</td>
        <td class="px-5 py-4">
          <div class="font-semibold text-sm text-slate-900">${escapeHtml(g.owner_name)}</div>
        </td>
        <td class="px-5 py-4 text-slate-600 text-xs max-w-[140px] truncate" title="${escapeHtml(g.address)}">${escapeHtml(g.address)}</td>
        <td class="px-5 py-4">
          <div class="flex flex-wrap gap-1">
            ${displayPets.map(p => {
              let icon = '🐾';
              const sp = (p.species || '').toLowerCase();
              if (sp.includes('kucing') || sp.includes('cat')) icon = '🐱';
              else if (sp.includes('anjing') || sp.includes('dog')) icon = '🐶';
              else if (sp.includes('kelinci') || sp.includes('rabbit')) icon = '🐰';
              const petDone = p.status === 'Sehat' || p.status === 'Selesai';
              const badge = !isDoctor && petDone ? '<span class="badge badge-slate text-[9px] ml-1">Selesai</span>' : '';
              return `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600">${icon} ${escapeHtml(p.name)}${badge}</span>`;
            }).join('')}
            ${morePetsCount > 0 ? `<span class="text-[10px] text-slate-400">+${morePetsCount}</span>` : ''}
          </div>
        </td>
        <td class="px-5 py-4 text-slate-600 text-xs">${escapeHtml(g.latest_visit || '-')}</td>
        <td class="px-5 py-4 font-mono text-[11px] text-slate-500">${escapeHtml(g.phone)}</td>
        <td class="px-5 py-4 text-right">
          ${isDisabled
            ? '<span class="text-xs text-slate-400 font-medium">Selesai</span>'
            : `<a href="patient.html?id=${escapeHtml(g.pets[0].id)}" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">Lihat →</a>`
          }
        </td>
      `;

      tbody.insertBefore(tr, noResultsRow || null);
    });

  } else {
    // --- MODE DETAIL PER-HEWAN (1 BARIS 1 PASIEN) ---
    const filtered = allPatients.filter(p => {
      const nameMatch = !query || 
        p.name.toLowerCase().includes(query) || 
        p.owner_name.toLowerCase().includes(query) ||
        (p.address || '').toLowerCase().includes(query) ||
        (p.phone || '').toLowerCase().includes(query) ||
        (p.code || '').toLowerCase().includes(query);
      const speciesMatch = speciesVal === 'all' || p.species.toLowerCase().includes(speciesVal);
      const statusMatch = statusVal === 'all' || p.status.toLowerCase() === statusVal;

      return nameMatch && speciesMatch && statusMatch;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalFiltered);
    const pageItems = filtered.slice(startIdx, endIdx);

    updatePaginationUI(totalFiltered, startIdx, endIdx, totalPages);

    if (totalFiltered === 0) {
      if (noResultsRow) noResultsRow.classList.remove('hidden');
      const rows = tbody.querySelectorAll('.patient-row');
      rows.forEach(r => r.remove());
      return;
    }

    if (noResultsRow) noResultsRow.classList.add('hidden');

    const existingRows = tbody.querySelectorAll('.patient-row');
    existingRows.forEach(r => r.remove());

    pageItems.forEach(p => {
      const tr = document.createElement('tr');
      const isHealthy = p.status === 'Sehat' || p.status === 'Selesai';
      const isDisabled = !isDoctor && isHealthy;
      tr.className = 'patient-row hover:bg-slate-50/80 cursor-pointer transition-colors' + (isDisabled ? ' opacity-50' : '');
      if (!isDisabled) {
        tr.onclick = () => {
          window.location.href = `patient.html?id=${p.id}`;
        };
      }

      const statusBadge = isDisabled
        ? '<span class="badge badge-slate text-[10px]">Selesai</span>'
        : `<span class="badge badge-emerald text-[10px]">${escapeHtml(p.status || '-')}</span>`;

      tr.innerHTML = `
        <td class="px-5 py-4 font-mono text-[11px] text-slate-400">${escapeHtml(p.code || '#PT-0000')}</td>
        <td class="px-5 py-4">
          <div class="font-semibold text-sm text-slate-900">${escapeHtml(p.owner_name)}</div>
        </td>
        <td class="px-5 py-4 text-slate-600 text-xs max-w-[140px] truncate" title="${escapeHtml(p.address || '-')}">${escapeHtml(p.address || '-')}</td>
        <td class="px-5 py-4">
          <div class="flex items-center gap-1.5">
            <span class="serif-title font-bold text-sm text-slate-900">${escapeHtml(p.name)}</span>
            ${statusBadge}
          </div>
          <div class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(p.species)} / ${escapeHtml(p.breed || '-')}</div>
        </td>
        <td class="px-5 py-4 text-slate-600 text-xs">${escapeHtml(p.last_visit || '-')}</td>
        <td class="px-5 py-4 font-mono text-[11px] text-slate-500">${escapeHtml(p.phone || '-')}</td>
        <td class="px-5 py-4 text-right">
          ${isDisabled
            ? '<span class="text-xs text-slate-400 font-medium">Selesai</span>'
            : `<a href="patient.html?id=${escapeHtml(p.id)}" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">Lihat →</a>`
          }
        </td>
      `;

      tbody.insertBefore(tr, noResultsRow || null);
    });
  }

  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }
}

function updatePaginationUI(totalFiltered: number, startIdx: number, endIdx: number, totalPages: number) {
  const showingText = document.getElementById('patientListShowingText');
  if (showingText) {
    if (totalFiltered === 0) {
      showingText.textContent = `Showing 0 to 0 of 0 entries`;
    } else {
      showingText.textContent = `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${totalFiltered.toLocaleString()} entries`;
    }
  }

  const paginationControls = document.getElementById('patientListPaginationControls');
  if (paginationControls) {
    if (totalFiltered === 0) {
      paginationControls.innerHTML = '';
    } else {
      let pageBtnsHtml = `
        <button 
          ${currentPage === 1 ? 'disabled' : ''} 
          onclick="changePatientPage(${currentPage - 1})"
          class="btn btn-secondary disabled:opacity-40 disabled:hover:bg-white transition-colors">
          Prev
        </button>
      `;

      const maxButtons = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
      if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      if (startPage > 1) {
        pageBtnsHtml += `<button onclick="changePatientPage(1)" class="btn btn-secondary">1</button>`;
        if (startPage > 2) {
          pageBtnsHtml += `<span class="px-1 text-slate-400 text-xs font-bold">...</span>`;
        }
      }

      for (let p = startPage; p <= endPage; p++) {
        if (p === currentPage) {
          pageBtnsHtml += `<button class="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-2xs">${p}</button>`;
        } else {
          pageBtnsHtml += `<button onclick="changePatientPage(${p})" class="btn btn-secondary transition-colors">${p}</button>`;
        }
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageBtnsHtml += `<span class="px-1 text-slate-400 text-xs font-bold">...</span>`;
        }
        pageBtnsHtml += `<button onclick="changePatientPage(${totalPages})" class="btn btn-secondary">${totalPages}</button>`;
      }

      pageBtnsHtml += `
        <button 
          ${currentPage === totalPages ? 'disabled' : ''} 
          onclick="changePatientPage(${currentPage + 1})"
          class="btn btn-secondary disabled:opacity-40 disabled:hover:bg-white transition-colors">
          Next
        </button>
      `;

      paginationControls.innerHTML = pageBtnsHtml;
    }
  }
}

(window as any).changePatientPage = (page: number) => {
  currentPage = page;
  renderTable();
};

(window as any).setViewMode = setViewMode;

