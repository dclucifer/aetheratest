// js/ui.interactions.js
// Micro-interactions and polish utilities

export function initMicroInteractions() {
    // Initialize all micro-interactions
    initButtonRipples();
    initCardHoverEffects();
    initScrollEnhancements();
    initFeedbackAnimations();
    initAccessibilityEnhancements();
}

// Button ripple effects
function initButtonRipples() {
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.btn, .icon-btn');
        if (!button) return;
        
        createRipple(button, e);
    });
}

function createRipple(element, event) {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
        z-index: 1;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    // Add ripple animation keyframes if not exists
    if (!document.querySelector('#ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = `
            @keyframes ripple-animation {
                to {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Enhanced card hover effects
function initCardHoverEffects() {
    const cards = document.querySelectorAll('.result-card, .persona-card, .history-item');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px) scale(1.02)';
            card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Scroll enhancements
function initScrollEnhancements() {
    // Add smooth scrolling to document
    document.documentElement.classList.add('smooth-scroll');
    
    // Parallax effect for hero sections
    const parallaxElements = document.querySelectorAll('.parallax');
    
    if (parallaxElements.length > 0) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const rate = scrolled * -0.5;
                element.style.transform = `translateY(${rate}px)`;
            });
        }, { passive: true });
    }
    
    // Scroll-triggered animations
    initScrollAnimations();
}

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements that should animate on scroll
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    animateElements.forEach(el => observer.observe(el));
}

// Feedback animations
function initFeedbackAnimations() {
    // Success feedback
    window.showSuccessFeedback = (element) => {
        element.classList.add('bounce');
        setTimeout(() => {
            element.classList.remove('bounce');
        }, 600);
    };
    
    // Error feedback
    window.showErrorFeedback = (element) => {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    };
    
    // Loading feedback
    window.showLoadingFeedback = (element) => {
        element.classList.add('pulse');
    };
    
    window.hideLoadingFeedback = (element) => {
        element.classList.remove('pulse');
    };
}

// Accessibility enhancements
function initAccessibilityEnhancements() {
    // Focus management
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
    
    // Enhanced focus indicators
    const style = document.createElement('style');
    style.textContent = `
        .keyboard-navigation *:focus {
            outline: 2px solid var(--primary-color) !important;
            outline-offset: 2px !important;
        }
        
        .keyboard-navigation .btn:focus,
        .keyboard-navigation .icon-btn:focus {
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3) !important;
        }
    `;
    document.head.appendChild(style);
    
    // Reduced motion support
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('reduce-motion');
    }
}

// Utility functions for animations
export function animateElement(element, animation, duration = 300) {
    return new Promise((resolve) => {
        element.style.animation = `${animation} ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        
        const handleAnimationEnd = () => {
            element.style.animation = '';
            element.removeEventListener('animationend', handleAnimationEnd);
            resolve();
        };
        
        element.addEventListener('animationend', handleAnimationEnd);
    });
}

export function fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    
    requestAnimationFrame(() => {
        element.style.opacity = '1';
    });
    
    return new Promise(resolve => {
        setTimeout(resolve, duration);
    });
}

export function fadeOut(element, duration = 300) {
    element.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    element.style.opacity = '0';
    
    return new Promise(resolve => {
        setTimeout(() => {
            element.style.display = 'none';
            resolve();
        }, duration);
    });
}

export function slideUp(element, duration = 300) {
    const height = element.offsetHeight;
    element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    element.style.height = height + 'px';
    element.style.overflow = 'hidden';
    
    requestAnimationFrame(() => {
        element.style.height = '0';
        element.style.paddingTop = '0';
        element.style.paddingBottom = '0';
        element.style.marginTop = '0';
        element.style.marginBottom = '0';
    });
    
    return new Promise(resolve => {
        setTimeout(() => {
            element.style.display = 'none';
            resolve();
        }, duration);
    });
}

export function slideDown(element, duration = 300) {
    element.style.display = 'block';
    const height = element.scrollHeight;
    
    element.style.height = '0';
    element.style.overflow = 'hidden';
    element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    
    requestAnimationFrame(() => {
        element.style.height = height + 'px';
    });
    
    return new Promise(resolve => {
        setTimeout(() => {
            element.style.height = 'auto';
            element.style.overflow = 'visible';
            resolve();
        }, duration);
    });
}

// Enhanced notification system
export function showEnhancedNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <div class="icon icon-sm icon-${getNotificationIcon(type)}"></div>
            </div>
            <div class="notification-message">${message}</div>
            <button class="notification-close icon-btn">
                <div class="icon icon-sm icon-close"></div>
            </button>
        </div>
    `;
    
    // Add to container
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    notification.style.pointerEvents = 'auto';
    container.appendChild(notification);
    
    // Auto remove
    const autoRemove = setTimeout(() => {
        removeNotification(notification);
    }, duration);
    
    // Manual close
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(autoRemove);
        removeNotification(notification);
    });
    
    return notification;
}

function removeNotification(notification) {
    notification.classList.add('removing');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    return icons[type] || 'info';
}