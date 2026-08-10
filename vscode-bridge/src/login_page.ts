import { setCurrentUser, ACCOUNTS } from './auth';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
  const emailInput = document.getElementById('emailInput') as HTMLInputElement | null;
  const passwordInput = document.getElementById('passwordInput') as HTMLInputElement | null;
  const roleSelect = document.getElementById('roleSelect') as HTMLSelectElement | null;
  const loginAlert = document.getElementById('loginAlert');

  // Quick 1-click login buttons
  const quickDoctorBtn = document.getElementById('quickDoctorBtn');
  const quickFoBtn = document.getElementById('quickFoBtn');

  if (quickDoctorBtn) {
    quickDoctorBtn.addEventListener('click', () => {
      setCurrentUser('doctor');
      window.location.href = 'doctor_dashboard.html';
    });
  }

  if (quickFoBtn) {
    quickFoBtn.addEventListener('click', () => {
      setCurrentUser('front_office');
      window.location.href = 'index.html';
    });
  }

  if (roleSelect && emailInput) {
    roleSelect.addEventListener('change', () => {
      if (roleSelect.value === 'doctor') {
        emailInput.value = ACCOUNTS.doctor.email;
      } else {
        emailInput.value = ACCOUNTS.front_office.email;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const email = (emailInput?.value || '').trim().toLowerCase();
      const pass = passwordInput?.value || '';

      if (!pass) {
        if (loginAlert) {
          loginAlert.textContent = 'Harap masukkan password terlebih dahulu.';
          loginAlert.classList.remove('hidden');
        }
        return;
      }

      if (email.includes('doctor') || roleSelect?.value === 'doctor') {
        setCurrentUser('doctor');
        window.location.href = 'doctor_dashboard.html';
      } else {
        setCurrentUser('front_office');
        window.location.href = 'index.html';
      }
    });
  }

  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }
});
