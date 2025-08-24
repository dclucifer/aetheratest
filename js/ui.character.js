import { t } from './i18n.js';
import { languageState } from './utils.js';

export function renderCharacterSheet(index) {
    const template = document.getElementById('character-sheet-template');
    const clone = template.content.cloneNode(true);
    const sheetInstance = clone.querySelector('.character-sheet-instance');
    sheetInstance.dataset.index = index;
    sheetInstance.querySelector('.character-title').textContent = t('character_number', { number: index + 1 }) || `Character ${index + 1}`;
    
    // Show delete button if this is the third character or more
    if (index >= 2) {
        sheetInstance.querySelector('.remove-character-btn').classList.remove('hidden');
    }
    
    // Apply translations to the newly created character sheet
    translateCharacterSheet(sheetInstance);
    
    return sheetInstance;
}

// Function to translate a specific character sheet instance
function translateCharacterSheet(sheetInstance) {
    // Translation check is handled by t() function
    
    sheetInstance.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.dataset.langKey;
        const translatedText = t(key);
        if (translatedText && translatedText !== key) {
            if (element.tagName === 'INPUT' && element.placeholder) {
                element.placeholder = translatedText;
            } else if (element.tagName === 'TEXTAREA' && element.placeholder) {
                element.placeholder = translatedText;
            }
            else if (element.tagName === 'OPTION') {
                element.textContent = translatedText;
            } else {
                element.textContent = translatedText;
            }
        }
    });
}

export function handleCharacterModeChange() {
    const mode = document.getElementById('character-mode').value;
    const area = document.getElementById('dynamic-character-sheet-area');
    const interactionContainer = document.getElementById('interaction-description-container');
    area.innerHTML = ''; // Selalu kosongkan area terlebih dahulu

    let characterCount = 1;
    if (mode === 'couple') {
        characterCount = 2;
    } else if (mode === 'group') {
        characterCount = 2; // Grup dimulai dengan 2 karakter
    }

    for (let i = 0; i < characterCount; i++) {
        area.appendChild(renderCharacterSheet(i));
    }
    
    interactionContainer.classList.toggle('hidden', mode === 'single');
    
    // Tambahkan tombol "Tambah Karakter" jika mode grup
    if (mode === 'group') {
        const addButton = document.createElement('button');
        addButton.id = 'add-character-btn';
        addButton.textContent = t('add_character_button') || '+ Add Another Character';
        addButton.type = 'button';
        addButton.className = 'btn-secondary text-sm font-semibold px-3 py-1.5 rounded-md w-full mt-4';
        area.appendChild(addButton);
    }
	// ALWAYS ADD SAVE BUTTON AT THE END
    const saveBtnTemplate = document.getElementById('save-character-button-template');
    const saveBtnClone = saveBtnTemplate.content.cloneNode(true);
    area.appendChild(saveBtnClone);
    
    // Apply translations to the newly added save button
    const saveButton = area.querySelector('[data-lang-key="save_character_button"]');
    if (saveButton) {
        const translatedText = t('save_character_button');
        if (translatedText && translatedText !== 'save_character_button') {
            saveButton.textContent = translatedText;
        }
    }
    
    handleCategoryChange(); // Panggil fungsi di bawah ini untuk menyesuaikan field
}

export function handleCategoryChange() {
    const category = document.getElementById('product-category').value;
    const allSheets = document.querySelectorAll('.character-sheet-instance');
    
    // Sembunyikan field gaya hanya jika kategori adalah "fashion"
    const isFashion = category === 'fashion';
    
    allSheets.forEach(sheet => {
        // Targetkan seluruh div section untuk disembunyikan
        const dynamicSection = sheet.querySelector('.dynamic-field-section');
        if (dynamicSection) {
            dynamicSection.classList.toggle('hidden', isFashion);
        }
    });
}
