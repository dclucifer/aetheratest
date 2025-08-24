// =================================================================
// ONBOARDING TUTORIAL SYSTEM
// =================================================================

import { showNotification, languageState } from './utils.js';
import { t } from './i18n.js';

let currentOnboardingStep = 1;
const totalOnboardingSteps = 5;

// Check if user has completed onboarding
function checkOnboardingStatus() {
    const hasCompletedOnboarding = localStorage.getItem('aethera_onboarding_completed');
    if (!hasCompletedOnboarding) {
        showOnboarding();
    }
}

// Show onboarding overlay
function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        updateOnboardingStep(1);
    }
}

// Hide onboarding overlay
function hideOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        localStorage.setItem('aethera_onboarding_completed', 'true');
    }
}

// Update onboarding step
function updateOnboardingStep(step) {
    currentOnboardingStep = step;
    
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(stepEl => {
        stepEl.classList.add('hidden');
    });
    
    // Show current step
    const currentStepEl = document.querySelector(`[data-step="${step}"]`);
    if (currentStepEl) {
        currentStepEl.classList.remove('hidden');
    }
    
    // Update dots
    document.querySelectorAll('.onboarding-dot').forEach((dot, index) => {
        if (index + 1 <= step) {
            dot.classList.remove('bg-muted');
            dot.classList.add('bg-accent');
        } else {
            dot.classList.remove('bg-accent');
            dot.classList.add('bg-muted');
        }
    });
    
    // Update buttons
    const prevBtn = document.getElementById('onboarding-prev');
    const nextBtn = document.getElementById('onboarding-next');
    
    if (prevBtn) {
        prevBtn.classList.toggle('hidden', step === 1);
    }
    
    if (nextBtn) {
        if (step === totalOnboardingSteps) {
            nextBtn.textContent = 'Mulai Sekarang!';
        } else {
            nextBtn.textContent = 'Selanjutnya';
        }
    }
}

// =================================================================
// QUICK START TEMPLATES SYSTEM
// =================================================================

const quickStartTemplates = {
    'tiktok-viral': {
        name: 'TikTok Viral 2025',
        settings: {
            hookType: 'hook_future_pacing',
            ctaType: 'cta_tiktok',
            targetAudience: 'audience_young_pro',
            writingStyle: 'style_storytelling',
            toneVibe: 'tone_inspiring',
            duration: '15'
        }
    },
    'shopee-sales': {
        name: 'Shopee Sales',
        settings: {
            hookType: 'hook_negativity_bias',
            ctaType: 'cta_shopee',
            targetAudience: 'audience_general',
            writingStyle: 'style_persuasive',
            toneVibe: 'tone_urgent',
            duration: '30'
        }
    },
    'instagram-story': {
        name: 'Instagram Story',
        settings: {
            hookType: 'hook_question',
            ctaType: 'cta_instagram',
            targetAudience: 'audience_young_pro',
            writingStyle: 'style_storytelling',
            toneVibe: 'tone_inspiring',
            duration: '15'
        }
    },
    'youtube-review': {
        name: 'YouTube Review',
        settings: {
            hookType: 'hook_statistic',
            ctaType: 'cta_youtube',
            targetAudience: 'audience_gamers',
            writingStyle: 'style_informative',
            toneVibe: 'tone_professional',
            duration: '60'
        }
    }
};

// Apply quick start template
function applyQuickStartTemplate(templateKey) {
    const template = quickStartTemplates[templateKey];
    if (!template) return;
    
    const settings = template.settings;
    
    // Helper function to set select value by data-lang-key
    function setSelectByLangKey(selectId, langKey) {
        const select = document.getElementById(selectId);
        if (!select) return false;
        
        const option = select.querySelector(`option[data-lang-key="${langKey}"]`);
        if (option) {
            select.value = option.value || langKey;
            return true;
        }
        return false;
    }
    
    // Helper function to set select value directly
    function setSelectValue(selectId, value) {
        const select = document.getElementById(selectId);
        if (!select) return false;
        
        select.value = value;
        return true;
    }
    
    // Apply settings to form elements
    if (settings.hookType) {
        setSelectByLangKey('hook-type', settings.hookType);
    }
    
    if (settings.ctaType) {
        setSelectByLangKey('cta-type', settings.ctaType);
    }
    
    if (settings.targetAudience) {
        setSelectByLangKey('target-audience', settings.targetAudience);
    }
    
    if (settings.writingStyle) {
        setSelectByLangKey('writing-style', settings.writingStyle);
    }

    if (settings.toneVibe) {
        setSelectByLangKey('tone-vibe', settings.toneVibe);
    }
    
    if (settings.duration) {
        setSelectValue('script-duration', settings.duration);
    }
    
    // Show notification
    if (typeof showNotification === 'function') {
        showNotification(t('template_applied_success', { name: template.name }), 'success');
    }
    
    // Scroll to product input
    const productNameInput = document.getElementById('product-name');
    if (productNameInput) {
        productNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        productNameInput.focus();
    }
}

// Auto-save form data
function autoSaveFormData() {
    const formData = {
        productName: document.getElementById('product-name')?.value || '',
        productDesc: document.getElementById('product-desc')?.value || '',
        hookType: document.getElementById('hook-type')?.value || '',
        ctaType: document.getElementById('cta-type')?.value || '',
        targetAudience: document.getElementById('target-audience')?.value || '',
        writingStyle: document.getElementById('writing-style')?.value || '',
        toneVibe: document.getElementById('tone-vibe')?.value || ''
    };
    
    localStorage.setItem('aethera_form_autosave', JSON.stringify(formData));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_form_last_modified', new Date().toISOString());
}

// Load auto-saved form data
function loadAutoSavedFormData() {
    const savedData = localStorage.getItem('aethera_form_autosave');
    if (savedData) {
        try {
            const formData = JSON.parse(savedData);
            
            Object.keys(formData).forEach(key => {
                const element = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
                if (element && formData[key]) {
                    element.value = formData[key];
                }
            });
        } catch (e) {
            console.warn('Failed to load auto-saved form data:', e);
        }
    }
}

// Initialize enhanced features
document.addEventListener('DOMContentLoaded', () => {
    // Check onboarding status after a short delay
    setTimeout(() => {
        checkOnboardingStatus();
    }, 1000);
    
    // Onboarding event listeners
    const nextBtn = document.getElementById('onboarding-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentOnboardingStep < totalOnboardingSteps) {
                updateOnboardingStep(currentOnboardingStep + 1);
            } else {
                hideOnboarding();
            }
        });
    }
    
    const prevBtn = document.getElementById('onboarding-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentOnboardingStep > 1) {
                updateOnboardingStep(currentOnboardingStep - 1);
            }
        });
    }
    
    const skipBtn = document.getElementById('onboarding-skip');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            hideOnboarding();
        });
    }
    
    // Quick template event listeners
    document.querySelectorAll('.quick-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateKey = btn.dataset.template;
            applyQuickStartTemplate(templateKey);
            
            // Add visual feedback
            btn.classList.add('pulse-glow');
            setTimeout(() => {
                btn.classList.remove('pulse-glow');
            }, 1000);
        });
    });
    
    // Load auto-saved data
    setTimeout(() => {
        loadAutoSavedFormData();
    }, 500);
    
    // Auto-save on input changes
    const formInputs = [
        'product-name', 'product-desc', 'hook-type', 'cta-type',
        'target-audience', 'writing-style', 'tone-vibe'
    ];
    
    formInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', autoSaveFormData);
            element.addEventListener('change', autoSaveFormData);
        }
    });
});