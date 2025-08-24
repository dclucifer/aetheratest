// js/ux-improvements.js
// Improvements untuk desktop & mobile user experience

/**
 * Initialize Back-to-Top button with smooth scroll behavior
 */
export function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    if (!backToTopBtn) return;

    // Show/hide button based on scroll position
    const toggleVisibility = () => {
        const scrolled = window.pageYOffset;
        const threshold = 200; // Show after 200px scroll
        
        if (scrolled > threshold) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.pointerEvents = 'auto';
            backToTopBtn.setAttribute('aria-hidden', 'false');
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.pointerEvents = 'none';
            backToTopBtn.setAttribute('aria-hidden', 'true');
        }
    };

    // Smooth scroll to top
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // Event listeners
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    backToTopBtn.addEventListener('click', scrollToTop);

    // Initial check
    toggleVisibility();
}

/**
 * Make Generate button sticky on mobile for better UX
 */
export function initStickyGenerateButton() {
    const generateBtn = document.getElementById('generate-btn');
    const generateContainer = generateBtn?.closest('.mt-6.pt-6.border-t.border-gray-800.space-y-4');
    
    if (!generateBtn || !generateContainer) return;

    const makeSticky = () => {
        const isMobile = window.innerWidth < 768;
        const isGeneratorPage = !document.getElementById('generator-page').classList.contains('hidden');
        
        if (isMobile && isGeneratorPage) {
            generateContainer.style.position = 'sticky';
            generateContainer.style.bottom = '0';
            generateContainer.style.backgroundColor = 'var(--bg-primary)';
            generateContainer.style.borderTop = '1px solid var(--border-color)';
            generateContainer.style.zIndex = '20';
            generateContainer.style.padding = '1rem';
            generateContainer.style.margin = '0 -1.5rem';
            
            // Add subtle shadow for depth
            generateContainer.style.boxShadow = '0 -4px 12px rgba(0, 0, 0, 0.15)';
        } else {
            // Reset to original styles
            generateContainer.style.position = '';
            generateContainer.style.bottom = '';
            generateContainer.style.backgroundColor = '';
            generateContainer.style.borderTop = '';
            generateContainer.style.zIndex = '';
            generateContainer.style.padding = '';
            generateContainer.style.margin = '';
            generateContainer.style.boxShadow = '';
        }
    };

    // Apply on load and resize
    window.addEventListener('resize', makeSticky, { passive: true });
    makeSticky();
}

/**
 * Enhanced mobile menu with accessibility improvements
 */
export function enhanceMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOpenIcon = document.getElementById('menu-open-icon');
    const menuCloseIcon = document.getElementById('menu-close-icon');
    
    if (!mobileMenuButton || !mobileMenu) return;

    // Add ARIA attributes for accessibility
    mobileMenuButton.setAttribute('aria-expanded', 'false');
    mobileMenuButton.setAttribute('aria-controls', 'mobile-menu');
    mobileMenuButton.setAttribute('aria-label', 'Toggle mobile menu');
    
    mobileMenu.setAttribute('role', 'navigation');
    mobileMenu.setAttribute('aria-label', 'Mobile navigation');

    // Enhanced toggle function with accessibility and scroll lock
    const enhancedToggle = (e) => {
        if (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        const isHidden = mobileMenu.classList.contains('hidden');
        
        // Toggle menu visibility
        mobileMenu.classList.toggle('hidden');
        menuOpenIcon.classList.toggle('hidden');
        menuCloseIcon.classList.toggle('hidden');
        
        // Update ARIA attributes
        mobileMenuButton.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        
        // Body scroll lock for better mobile UX
        if (isHidden) {
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = getScrollbarWidth() + 'px';
        } else {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
        
        // Focus management
        if (isHidden) {
            // Focus first menu item when opened
            const firstMenuItem = mobileMenu.querySelector('a, button');
            if (firstMenuItem) {
                setTimeout(() => firstMenuItem.focus(), 100);
            }
        } else {
            // Return focus to menu button when closed
            mobileMenuButton.focus();
        }
    };

    // Replace the original toggle function (ensure ours runs first and prevents duplicates)
    // (Removed: mobileMenuButton.removeEventListener('click', window.originalToggleMobileMenu));
    mobileMenuButton.addEventListener('click', enhancedToggle, { capture: true });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileMenu.classList.contains('hidden') && 
            !mobileMenu.contains(e.target) && 
            !mobileMenuButton.contains(e.target)) {
            enhancedToggle();
        }
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
            enhancedToggle();
        }
    });

    // Close menu and unlock scroll when navigating
    const menuLinks = mobileMenu.querySelectorAll('a, button');
    menuLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (!mobileMenu.classList.contains('hidden')) {
                enhancedToggle();
            }
        });
    });

    // Store original function reference for cleanup if needed
    window.originalToggleMobileMenu = enhancedToggle;
}

/**
 * Utility function to get scrollbar width for scroll lock
 */
function getScrollbarWidth() {
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    outer.style.msOverflowStyle = 'scrollbar';
    document.body.appendChild(outer);
    
    const inner = document.createElement('div');
    outer.appendChild(inner);
    
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    
    outer.parentNode.removeChild(outer);
    
    return scrollbarWidth;
}

/**
 * Smart form field improvements for mobile
 */
export function initSmartFormFields() {
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        // Prevent zoom on iOS devices for input fields
        if (input.type !== 'date' && input.type !== 'datetime-local') {
            if (parseFloat(getComputedStyle(input).fontSize) < 16) {
                input.style.fontSize = '16px';
            }
        }
        
        // Enhanced focus states for better mobile interaction
        input.addEventListener('focus', () => {
            input.parentElement?.classList.add('field-focused');
        });
        
        input.addEventListener('blur', () => {
            input.parentElement?.classList.remove('field-focused');
        });
    });
}

/**
 * Keyboard navigation improvements
 */
export function initKeyboardNavigation() {
    // Skip to content link for accessibility
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50';
    skipLink.style.transform = 'translateY(-100%)';
    skipLink.style.transition = 'transform 0.3s ease';
    
    skipLink.addEventListener('focus', () => {
        skipLink.style.transform = 'translateY(0)';
    });
    
    skipLink.addEventListener('blur', () => {
        skipLink.style.transform = 'translateY(-100%)';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Trap focus in modals
    const modals = document.querySelectorAll('[role="dialog"], .modal-overlay');
    modals.forEach(modal => {
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                trapFocus(e, modal);
            }
        });
    });
}

/**
 * Focus trap utility for modals
 */
function trapFocus(e, container) {
    const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
        if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
        }
    } else {
        if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
        }
    }
}

/**
 * Initialize all UX improvements
 */
export function initUXImprovements() {
    initBackToTop();
    initStickyGenerateButton();
    enhanceMobileMenu();
    initSmartFormFields();
    initKeyboardNavigation();
    
    console.log('✅ UX improvements initialized');
}