// js/persona.js
import { elements, showNotification, openConfirmModal, languageState} from './utils.js';
import { t } from './i18n.js';

export const DEFAULT_PERSONAS = [
    {
        nameKey: 'persona_template_industry_expert_name',
        descKey: 'persona_template_industry_expert_desc'
    },
    {
        nameKey: 'persona_template_close_friend_name',
        descKey: 'persona_template_close_friend_desc'
    },
    {
        nameKey: 'persona_template_honest_reviewer_name',
        descKey: 'persona_template_honest_reviewer_desc'
    },
    {
        nameKey: 'persona_template_smart_comedian_name',
        descKey: 'persona_template_smart_comedian_desc'
    }
];

export function getPersonas() {
    return JSON.parse(localStorage.getItem('aethera_personas')) || [];
}

export function savePersonas(personas) {
    localStorage.setItem('aethera_personas', JSON.stringify(personas));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_personas_last_modified', new Date().toISOString());
    renderPersonas();
    populatePersonaSelector();
}

export function openPersonaModal(persona = null) {
    const { personaModal } = elements;
    if (persona) {
        personaModal.title.textContent = t('edit_persona_title') || 'Edit Persona';
        personaModal.idInput.value = persona.id;
        personaModal.nameInput.value = persona.name;
        personaModal.descInput.value = persona.description;
    } else {
        personaModal.title.textContent = t('add_new_persona_modal_title');
        personaModal.idInput.value = '';
        personaModal.nameInput.value = '';
        personaModal.descInput.value = '';
    }
    personaModal.el.classList.remove('opacity-0', 'pointer-events-none');
    personaModal.el.querySelector('.modal-content').classList.remove('scale-95');
}

export function closePersonaModal() {
    elements.personaModal.el.classList.add('opacity-0', 'pointer-events-none');
    elements.personaModal.el.querySelector('.modal-content').classList.add('scale-95');
}

export function handleSavePersona() {
    const { nameInput, descInput, idInput } = elements.personaModal;
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const id = idInput.value;
    if (!name || !description) {
        showNotification(t('notification_persona_empty'), 'error');
        return;
    }
    let personas = getPersonas();
    if (id) {
        const index = personas.findIndex(p => p.id === id);
        if (index > -1) {
            personas[index] = { ...personas[index], name, description };
        }
    } else {
        const newPersona = { id: `persona_${Date.now()}`, name, description };
        personas.push(newPersona);
    }
    savePersonas(personas);
    closePersonaModal();
    showNotification(t('notification_persona_saved'));
}

export function handleDeletePersona(id) {
    openConfirmModal(
        t('notification_persona_delete_confirm'),
        () => {
            let personas = getPersonas();
            const filteredPersonas = personas.filter(p => p.id !== id);
            savePersonas(filteredPersonas);
            showNotification(t('notification_persona_deleted'));
        }
    );
}

export function handleAddDefaultPersona(name, description) {
    let personas = getPersonas();
    if (personas.some(p => p.name.trim() === name.trim())) {
        showNotification(t('notification_persona_exists').replace('{name}', name), 'warning');
        return;
    }
    const newPersona = { id: `persona_${Date.now()}`, name, description };
    personas.push(newPersona);
    savePersonas(personas);
    showNotification(t('notification_persona_added').replace('{name}', name));
}

export function renderPersonas() {
    const personas = getPersonas();
    const { listContainer } = elements.personaModal;
    listContainer.innerHTML = '';
    if (personas.length === 0) {
        listContainer.innerHTML = `<p class="text-sm text-gray-500 text-center py-4">${t('no_persona_yet') || 'Belum ada persona. Tambahkan satu atau pilih dari template di bawah!'}</p>`;
        return;
    }

    try { const pinned=new Set(JSON.parse(localStorage.getItem('aethera_pinned_personas')||'[]')); const usage=JSON.parse(localStorage.getItem('aethera_persona_usage')||'{}'); const sorted=[...personas].sort((a,b)=>{const ap=pinned.has(String(a.id||a.name||'')), bp=pinned.has(String(b.id||b.name||'')); if(ap!==bp) return ap? -1: 1; const ua=usage[a.id||a.name]||0, ub=usage[b.id||b.name]||0; if(ua!==ub) return ub-ua; return String(a.name||'').localeCompare(String(b.name||''));}); const picks=sorted.slice(0,6); const wrap=document.getElementById('persona-quick-picks'); if(wrap){ wrap.innerHTML=''; picks.forEach(p=>{ const chip=document.createElement('button'); chip.className='px-2 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700'; chip.textContent=p.name||'Persona'; chip.title=(p.description||'').slice(0,140); chip.addEventListener('click', ()=>{ selector.value=p.name; const disp=document.getElementById('persona-description-display'); if(disp) disp.textContent=p.description||''; try{ cloudStorage.incrementPersonaUsage(p.id||p.name,p.name);}catch(e){} }); const star=document.createElement('button'); star.className='ml-1 text-yellow-400 text-xs hover:opacity-80'; const id=p.id||p.name; const isPinned=pinned.has(String(id)); star.textContent=isPinned?'★':'☆'; star.addEventListener('click',(ev)=>{ ev.stopPropagation(); const next=!pinned.has(String(id)); if(next) pinned.add(String(id)); else pinned.delete(String(id)); localStorage.setItem('aethera_pinned_personas', JSON.stringify([...pinned])); try{ cloudStorage.togglePersonaPin(id,next);}catch(e){}; star.textContent=next?'★':'☆'; }); const holder=document.createElement('div'); holder.className='inline-flex items-center'; holder.appendChild(chip); holder.appendChild(star); wrap.appendChild(holder); }); } }catch(e){}

    personas.forEach(persona => {
        const personaEl = document.createElement('div');
        personaEl.className = 'bg-gray-800/70 p-4 rounded-lg flex items-center justify-between animate-fade-in';
        personaEl.innerHTML = `
            <div>
                <h4 class="font-semibold text-white">${persona.name}</h4>
                <p class="text-xs text-gray-400 truncate max-w-md">${persona.description}</p>
            </div>
            <div class="flex space-x-2 flex-shrink-0">
                <button class="edit-persona-btn icon-btn primary" data-id="${persona.id}" title="${t('edit_button') || 'Edit'}">
                    <div class="icon icon-md icon-edit"></div>
                </button>
                <button class="delete-persona-btn icon-btn danger" data-id="${persona.id}" title="${t('delete_button') || 'Hapus'}">
                    <div class="icon icon-md icon-delete"></div>
                </button>
            </div>
        `;
        listContainer.appendChild(personaEl);
    });
}

export function renderDefaultPersonas() {
  const { defaultContainer } = elements.personaModal;
  defaultContainer.innerHTML = '';

  const currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('aethera_language')) || document.documentElement.lang || 'id';

  DEFAULT_PERSONAS.forEach(p => {
    const name = t(p.nameKey) || p.nameKey;
    const description = t(p.descKey) || p.descKey;

    // Card wrapper
    const personaCard = document.createElement('div');
    personaCard.className = 'bg-gray-800/70 p-4 rounded-lg flex flex-col justify-between';

    // Title
    const title = document.createElement('h5');
    title.className = 'font-semibold text-white mb-1';
    title.textContent = name;

    // Description
    const desc = document.createElement('p');
    desc.className = 'text-xs text-gray-400 mb-4';
    desc.textContent = description; // safe text

    // Button
    const btn = document.createElement('button');
    btn.className =
      'add-default-persona-btn mt-auto w-full text-center text-sm font-semibold py-1.5 rounded-md ' +
      'bg-sky-600/50 hover:bg-sky-600/80 transition-colors';
    btn.textContent = t('add_to_my_list') || '+ Add to My List';

    // Simpan data via dataset menggunakan nilai tampilan (terjemahan)
    btn.dataset.name = name;
    btn.dataset.desc = description;

    personaCard.appendChild(title);
    personaCard.appendChild(desc);
    personaCard.appendChild(btn);
    defaultContainer.appendChild(personaCard);
  });
}

import { cloudStorage } from './cloud-storage.js';
export function populatePersonaSelector() {
    const personas = getPersonas();
    const selector = elements.personaSelector;
    selector.innerHTML = `<option value="">${t('persona_default')}</option>`;

    try { const pinned=new Set(JSON.parse(localStorage.getItem('aethera_pinned_personas')||'[]')); const usage=JSON.parse(localStorage.getItem('aethera_persona_usage')||'{}'); const sorted=[...personas].sort((a,b)=>{const ap=pinned.has(String(a.id||a.name||'')), bp=pinned.has(String(b.id||b.name||'')); if(ap!==bp) return ap? -1: 1; const ua=usage[a.id||a.name]||0, ub=usage[b.id||b.name]||0; if(ua!==ub) return ub-ua; return String(a.name||'').localeCompare(String(b.name||''));}); const picks=sorted.slice(0,6); const wrap=document.getElementById('persona-quick-picks'); if(wrap){ wrap.innerHTML=''; picks.forEach(p=>{ const chip=document.createElement('button'); chip.className='px-2 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700'; chip.textContent=p.name||'Persona'; chip.title=(p.description||'').slice(0,140); chip.addEventListener('click', ()=>{ selector.value=p.name; const disp=document.getElementById('persona-description-display'); if(disp) disp.textContent=p.description||''; try{ cloudStorage.incrementPersonaUsage(p.id||p.name,p.name);}catch(e){} }); const star=document.createElement('button'); star.className='ml-1 text-yellow-400 text-xs hover:opacity-80'; const id=p.id||p.name; const isPinned=pinned.has(String(id)); star.textContent=isPinned?'★':'☆'; star.addEventListener('click',(ev)=>{ ev.stopPropagation(); const next=!pinned.has(String(id)); if(next) pinned.add(String(id)); else pinned.delete(String(id)); localStorage.setItem('aethera_pinned_personas', JSON.stringify([...pinned])); try{ cloudStorage.togglePersonaPin(id,next);}catch(e){}; star.textContent=next?'★':'☆'; }); const holder=document.createElement('div'); holder.className='inline-flex items-center'; holder.appendChild(chip); holder.appendChild(star); wrap.appendChild(holder); }); } }catch(e){}

    personas.forEach(persona => {
        const option = document.createElement('option');
        option.value = persona.id;
        option.textContent = persona.name;
        selector.appendChild(option);
    });
}

