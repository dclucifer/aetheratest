// js/history.js
import { elements, languageState } from './utils.js';
import { t } from './i18n.js';

// Dynamic import to avoid circular dependency with ui.results.js
async function __getCreateResultCard() {
    const mod = await import('./ui.results.js');
    return mod.createResultCard;
}

// Pagination and filtering state
let currentPage = 1;
let itemsPerPage = 5;
let filteredHistory = [];
let allHistory = [];
let currentSort = 'newest';
let searchQuery = '';
let currentPostTypeFilter = 'all';
let isGroupedByProduct = false;
let expandedGroups = new Set();
const __tagSaveDebounce = {};
function __debounceSaveTags(entryId, tags) {
  clearTimeout(__tagSaveDebounce[entryId]);
  __tagSaveDebounce[entryId] = setTimeout(async () => {
    try {
      const { cloudStorage } = await import('./cloud-storage.js');
      if (cloudStorage && typeof cloudStorage.upsertHistoryTags === 'function') {
        await cloudStorage.upsertHistoryTags(entryId, tags);
      }
    } catch (e) {
      // ignore
    }
  }, 600);
}


export function saveToHistory(scripts, productName, mode) {
    let history = JSON.parse(localStorage.getItem('direktiva_history')) || [];
    
    // Determine the correct mode - prioritize parameter, then detect from script structure, fallback to localStorage
    let actualMode = mode;
    if (!actualMode && scripts && scripts.length > 0) {
        // Detect mode from script structure
        const firstScript = scripts[0];
        if (firstScript.slides && Array.isArray(firstScript.slides)) {
            actualMode = 'carousel';
        } else if (firstScript.hook || firstScript.body || firstScript.cta) {
            actualMode = 'single';
        }
    }
    if (!actualMode) {
        actualMode = localStorage.getItem('currentMode') || 'single';
    }
    
    const newEntry = {
        id: Date.now(),
        productName: productName || elements.inputs.productName.value || t('untitled_script'),
        mode: actualMode,
        scripts: scripts
    };
    history.unshift(newEntry);
    if (history.length > 50) history.pop();
    localStorage.setItem('direktiva_history', JSON.stringify(history));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('direktiva_history_last_modified', new Date().toISOString());

    // Also attempt to persist to Supabase (soft-fail)
    ;(async ()=>{
      try{
        const { cloudStorage } = await import('./cloud-storage.js');
        if (cloudStorage && typeof cloudStorage.upsertHistory === 'function') {
          await cloudStorage.upsertHistory({
            productName: newEntry.productName,
            mode: newEntry.mode,
            scripts: newEntry.scripts,
            created_at: new Date().toISOString()
          });
        }
      }catch(e){ /* ignore */ }
    })();
}

export async function loadHistory() {
    try {
        const { cloudStorage } = await import('./cloud-storage.js');
        if (cloudStorage && typeof cloudStorage.fetchHistoryTags === 'function') {
            const serverTags = await cloudStorage.fetchHistoryTags();
            if (serverTags && Object.keys(serverTags).length) {
                try {
                    const localMap = JSON.parse(localStorage.getItem('direktiva_history_tags')||'{}');
                    const merged = { ...serverTags, ...localMap };
                    localStorage.setItem('direktiva_history_tags', JSON.stringify(merged));
                } catch(e){}
            }
        }
    } catch (e) { console.warn('Fetch server tags skipped', e); }

    allHistory = JSON.parse(localStorage.getItem('direktiva_history')) || [];
    applyFiltersAndSort();
    renderHistoryPage();
    return allHistory;
}

function applyFiltersAndSort() {
    let filtered = [...allHistory];
    
    // Apply post type filter
    if (currentPostTypeFilter !== 'all') {
        filtered = filtered.filter(entry => entry.mode === currentPostTypeFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
        filtered = filtered.filter(entry => 
            entry.productName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    // Apply sorting
    switch (currentSort) {
        case 'oldest':
            filtered.sort((a, b) => a.id - b.id);
            break;
        case 'name':
            filtered.sort((a, b) => a.productName.localeCompare(b.productName));
            break;
        case 'newest':
        default:
            filtered.sort((a, b) => b.id - a.id);
            break;
    }
    
    if (isGroupedByProduct) {
        filteredHistory = groupByProduct(filtered);
    } else {
        filteredHistory = filtered;
    }
    
    renderHistoryPage();
}

function groupByProduct(entries) {
    const groups = {};
    
    entries.forEach(entry => {
        if (!groups[entry.productName]) {
            groups[entry.productName] = [];
        }
        groups[entry.productName].push(entry);
    });
    
    // Convert to array format for rendering
    const result = Object.keys(groups).map(productName => ({
        productName,
        entries: groups[productName]
    }));
    
    return result;
}

async function renderHistoryPage() {
    const historyPanel = document.getElementById('history-panel');
    const emptyState = document.getElementById('history-empty-state');

    // Only proceed if the container exists (on some routes it may not)
    if (!historyPanel) return;

    if (filteredHistory.length === 0) {
        historyPanel.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
        }
        updateTabCounters();
        return;
    } else {
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentEntries = filteredHistory.slice(startIndex, endIndex);

    historyPanel.innerHTML = '';
    for (const entry of currentEntries) {
        const createResultCard = await __getCreateResultCard();
        const list = (entry && Array.isArray(entry.scripts)) ? entry.scripts : (entry ? [entry] : []);
        let idx = 0;
        for (const script of list) {
            if (!script) continue;
            const card = await createResultCard(script, idx++);
            historyPanel.appendChild(card);
        }
    }

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    updatePaginationControls(totalPages);
    updateTabCounters();
}

function updatePaginationControls(totalPages) {
    const paginationDiv = document.getElementById('history-pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');
    
    if (totalPages <= 1) {
        paginationDiv.classList.add('hidden');
        return;
    }
    
    paginationDiv.classList.remove('hidden');
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

export async function deleteFromHistory(entryIds) {
    let history = JSON.parse(localStorage.getItem('direktiva_history')) || [];
    // Pastikan entryIds adalah array
    const idsToDelete = Array.isArray(entryIds) ? entryIds.map(Number) : [Number(entryIds)];
    const updatedHistory = history.filter(entry => !idsToDelete.includes(entry.id));
    localStorage.setItem('direktiva_history', JSON.stringify(updatedHistory));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('direktiva_history_last_modified', new Date().toISOString());
    await loadHistory(); // Muat ulang tampilan
}

export async function deleteAllHistory() {
    localStorage.removeItem('direktiva_history');
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('direktiva_history_last_modified', new Date().toISOString());
    
    // Also delete from cloud storage if available
    try {
        const { cloudStorage } = await import('./cloud-storage.js');
        if (cloudStorage && typeof cloudStorage.deleteAllHistory === 'function') {
            await cloudStorage.deleteAllHistory();
        }
    } catch (error) {
        console.warn('Failed to delete history from cloud storage:', error.message);
    }
    
    await loadHistory(); // Muat ulang tampilan
}

// Pagination functions
export function goToPage(page) {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderHistoryPage();
    }
}

export function nextPage() {
    goToPage(currentPage + 1);
}

export function prevPage() {
    goToPage(currentPage - 1);
}

// Search and filter functions
export function setSearchQuery(query) {
    searchQuery = query;
    applyFiltersAndSort();
    renderHistoryPage();
}

export function setSortOrder(sort) {
    currentSort = sort;
    currentPage = 1;
    applyFiltersAndSort();
    renderHistoryPage();
}

export function setPostTypeFilter(filter) {
    currentPostTypeFilter = filter;
    currentPage = 1;
    applyFiltersAndSort();
    updateActiveTab(filter);
}

window.toggleGroup = function(productName) {
    if (expandedGroups.has(productName)) {
        expandedGroups.delete(productName);
    } else {
        expandedGroups.add(productName);
    }
    applyFiltersAndSort();
}

window.selectGroupEntries = function(productName) {
    const groupCheckboxes = document.querySelectorAll(`[data-group-name="${productName}"] .history-checkbox`);
    const allChecked = Array.from(groupCheckboxes).every(cb => cb.checked);
    
    groupCheckboxes.forEach(cb => {
        cb.checked = !allChecked;
        cb.dispatchEvent(new Event('change'));
    });
}

function updateActiveTab(filter) {
    const tabs = document.querySelectorAll('.post-type-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`.post-type-tab[data-filter="${filter}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

function updateTabCounters() {
    const counters = {
        all: document.getElementById('count-all'),
        single: document.getElementById('count-single'),
        carousel: document.getElementById('count-carousel')
    };
    
    if (!counters.all || !counters.single || !counters.carousel) return;
    
    counters.all.textContent = allHistory.length;
    counters.single.textContent = allHistory.filter(e => e.mode === 'single').length;
    counters.carousel.textContent = allHistory.filter(e => e.mode === 'carousel').length;
}

export function selectAllHistory(checked) {
    const checkboxes = document.querySelectorAll('.history-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateDeleteSelectedButton();
}

export function updateDeleteSelectedButton() {
    const anyChecked = document.querySelectorAll('.history-checkbox:checked').length > 0;
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (!deleteSelectedBtn) return;
    deleteSelectedBtn.disabled = !anyChecked;
    // Toggle visibility to improve UX
    if (anyChecked) deleteSelectedBtn.classList.remove('hidden');
    else deleteSelectedBtn.classList.add('hidden');
}

export function toggleGroupByProduct() {
    const checkbox = document.getElementById('group-by-product');
    isGroupedByProduct = !!(checkbox && checkbox.checked);
    applyFiltersAndSort();
}

export function updateSelectAllCheckbox() {
    const allCheckboxes = document.querySelectorAll('.history-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-history');
    if (!selectAllCheckbox) return;
    const allChecked = Array.from(allCheckboxes).length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
}

// Event handlers for buttons
window.handleSearchInput = function(e) {
    setSearchQuery(e.target.value);
}

window.handleSortChange = function(e) {
    setSortOrder(e.target.value);
}

window.handlePostTypeFilter = function(e) {
    setPostTypeFilter(e.target.dataset.filter);
}

window.handleDeleteSelected = async function() {
    const selectedIds = Array.from(document.querySelectorAll('.history-checkbox:checked')).map(cb => Number(cb.closest('.history-entry').dataset.entryId));
    if (selectedIds.length > 0) {
        await deleteFromHistory(selectedIds);
    }
}

window.handleDeleteAll = async function() {
    await deleteAllHistory();
}
