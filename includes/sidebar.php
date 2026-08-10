<?php
// $active harus di-set di halaman pemanggil sebelum include ini, contoh: $active = 'pasien';
$active = $active ?? '';
?>
<aside class="w-56 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
    <div class="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <div class="w-7 h-7 rounded-md bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
            <i data-lucide="paw-print" class="w-4 h-4 text-slate-950"></i>
        </div>
        <span class="font-semibold text-[15px] tracking-tight">VetCore Systems</span>
    </div>
    <nav class="flex-1 px-3 py-4 space-y-1">
        <a href="index.html?view=overview" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors">
            <i data-lucide="layout-grid" class="w-4 h-4"></i> Ikhtisar
        </a>
        <a href="index.html?view=pasien" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors <?= $active === 'pasien' ? 'bg-teal-500/15 text-teal-300' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200' ?>">
            <i data-lucide="users" class="w-4 h-4"></i> Daftar Pasien
        </a>
        <a href="#" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors">
            <i data-lucide="file-text" class="w-4 h-4"></i> Laporan
        </a>
    </nav>
    <div class="px-5 py-4 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
        <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">DR</div>
        <span>Dr. Smith</span>
    </div>
</aside>
