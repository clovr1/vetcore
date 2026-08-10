import { getCurrentUser, setCurrentUser, initSidebarProfile, logout, ACCOUNTS } from './auth';

document.addEventListener('DOMContentLoaded', () => {
  initSidebarProfile();

  function renderProfile() {
    const user = getCurrentUser();

    // Top Back Link target based on role
    const backBtn = document.getElementById('profileBackBtn') as HTMLAnchorElement | null;
    if (backBtn) {
      backBtn.href = user.role === 'doctor' ? 'doctor_dashboard.html' : 'index.html';
      backBtn.innerHTML = user.role === 'doctor' 
        ? '<i data-lucide="arrow-left" class="w-4 h-4"></i> Kembali ke Portal Dokter'
        : '<i data-lucide="arrow-left" class="w-4 h-4"></i> Kembali ke Dashboard Utama';
    }

    // Header profile fields
    const avatarElem = document.getElementById('profileAvatar');
    const nameElem = document.getElementById('profileName');
    const titleElem = document.getElementById('profileTitle');
    const roleBadgeElem = document.getElementById('profileRoleBadge');
    const idBadgeElem = document.getElementById('profileIdBadge');

    if (avatarElem) avatarElem.textContent = user.avatar;
    if (nameElem) nameElem.textContent = user.name;
    if (titleElem) titleElem.textContent = user.title;
    if (idBadgeElem) idBadgeElem.textContent = user.nip_sip;

    if (roleBadgeElem) {
      if (user.role === 'doctor') {
        roleBadgeElem.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
        roleBadgeElem.innerHTML = '<span>👨‍⚕️</span> <span>Dokter Hewan Praktik (Vet Specialist)</span>';
      } else {
        roleBadgeElem.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300';
        roleBadgeElem.innerHTML = '<span>📋</span> <span>Front Office & Patient Admission</span>';
      }
    }

    // Detailed Info
    const emailElem = document.getElementById('profileEmail');
    const phoneElem = document.getElementById('profilePhone');
    const shiftElem = document.getElementById('profileShift');
    const joinedElem = document.getElementById('profileJoined');
    const specElem = document.getElementById('profileSpecialization');
    const bioElem = document.getElementById('profileBio');

    if (emailElem) emailElem.textContent = user.email;
    if (phoneElem) phoneElem.textContent = user.phone;
    if (shiftElem) shiftElem.textContent = user.shift;
    if (joinedElem) joinedElem.textContent = user.joined_date;
    if (specElem) specElem.textContent = user.specialization;
    if (bioElem) bioElem.textContent = user.bio;

    // Role Specific Card Visibility
    const docCard = document.getElementById('doctorCertCard');
    const foCard = document.getElementById('frontOfficeTaskCard');

    if (user.role === 'doctor') {
      docCard?.classList.remove('hidden');
      foCard?.classList.add('hidden');
    } else {
      foCard?.classList.remove('hidden');
      docCard?.classList.add('hidden');
    }

    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }

  renderProfile();

  // Quick Switch Role Button in Profile
  const switchRoleBtn = document.getElementById('switchRoleBtn');
  if (switchRoleBtn) {
    switchRoleBtn.addEventListener('click', () => {
      const currentUser = getCurrentUser();
      const newRole = currentUser.role === 'doctor' ? 'front_office' : 'doctor';
      setCurrentUser(newRole);
      renderProfile();
      initSidebarProfile();
    });
  }

  // Logout Button in Profile
  const logoutProfileBtn = document.getElementById('logoutProfileBtn');
  if (logoutProfileBtn) {
    logoutProfileBtn.addEventListener('click', () => logout());
  }
});
