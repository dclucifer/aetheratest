// js/ui.generator.js (split from ui.js)
import { elements } from './utils.js';
import { handleCharacterModeChange } from './ui.character.js';

export function switchMode(newMode) {
    // Simpan mode yang baru dipilih
    localStorage.setItem('currentMode', newMode);
    
    // Perbarui tampilan tombol (Post/Carousel)
    const isSingle = newMode === 'single';
    elements.modeSingleBtn.classList.toggle('bg-blue-600', isSingle); // Gunakan 'bg-blue-600' atau warna aksen tema Anda
    elements.modeSingleBtn.classList.toggle('text-white', isSingle);
    elements.modeSingleBtn.classList.toggle('text-gray-400', !isSingle);
    elements.modeSingleBtn.classList.toggle('hover:bg-gray-700', !isSingle);
    
    elements.modeCarouselBtn.classList.toggle('bg-blue-600', !isSingle);
    elements.modeCarouselBtn.classList.toggle('text-white', !isSingle);
    elements.modeCarouselBtn.classList.toggle('text-gray-400', isSingle);
    elements.modeCarouselBtn.classList.toggle('hover:bg-gray-700', isSingle);

      // Tambahan untuk styling emas di dark-mode (dipakai CSS baru)
    elements.modeSingleBtn.classList.toggle('is-active', isSingle);
    elements.modeCarouselBtn.classList.toggle('is-active', !isSingle);

    // LOGIKA BARU UNTUK MENAMPILKAN/MENYEMBUNYIKAN ELEMEN FORMULIR
    
    // Ambil elemen durasi langsung di sini
    const durationGroup = document.getElementById('duration-group');

    // Kontrol visibilitas berdasarkan mode yang dipilih
    if (isSingle) { // Jika mode adalah "Post"
        elements.scriptCountGroup.classList.remove('hidden');
        if (durationGroup) durationGroup.classList.remove('hidden');
        elements.visualStrategyGroup.classList.remove('hidden');
        
        elements.slideCountGroup.classList.add('hidden');
        elements.carouselTemplateGroup.classList.add('hidden');
    } else { // Jika mode adalah "Carousel"
        elements.scriptCountGroup.classList.add('hidden');
        if (durationGroup) durationGroup.classList.add('hidden');
        elements.visualStrategyGroup.classList.add('hidden');
        
        elements.slideCountGroup.classList.remove('hidden');
        elements.carouselTemplateGroup.classList.remove('hidden');
    }
}

export function switchVisualStrategy(newStrategy) {
    localStorage.setItem('visualStrategy', newStrategy);

    // Logika baru untuk toggle tombol track
    document.querySelectorAll('#visual-strategy-group .track-btn').forEach(btn => {
        btn.classList.remove('is-active');
    });
    const activeBtn = document.getElementById(`strategy-${newStrategy}`);
    if (activeBtn) {
        activeBtn.classList.add('is-active');
    }

    // Sisa logika untuk menampilkan/menyembunyikan form karakter (tetap sama)
    const characterModeGroup = document.getElementById('character-mode-group');
    const characterPresetControls = document.getElementById('character-preset-controls');
    const area = document.getElementById('dynamic-character-sheet-area');
    const interactionContainer = document.getElementById('interaction-description-container');

    if (newStrategy === 'character') {
        characterModeGroup.classList.remove('hidden');
        characterPresetControls.classList.remove('hidden');
        handleCharacterModeChange();
    } else {
        characterModeGroup.classList.add('hidden');
        characterPresetControls.classList.add('hidden');
        area.innerHTML = '';
        interactionContainer.classList.add('hidden');
    }
}

export function switchAspectRatio(newRatio) {
  // Simpan pilihan rasio ke localStorage
  localStorage.setItem('aspectRatio', newRatio);

  // Cari semua tombol di dalam track
  document.querySelectorAll('.ratio-toggle-track .track-btn').forEach(btn => {
    // Hapus class 'is-active' dari semua tombol
    btn.classList.remove('is-active');
  });

  // Tambahkan class 'is-active' hanya ke tombol yang diklik
  const activeBtn = document.getElementById(`ratio-${newRatio.replace(':', '')}`);
  if (activeBtn) {
    activeBtn.classList.add('is-active');
  }
}
