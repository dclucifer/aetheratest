// Parallax Controller - Premium Visual Effects for Aethera Studio

class ParallaxController {
    constructor() {
        this.scrollY = 0;
        this.ticking = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        
        this.init();
    }
    
    init() {
        // Check if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        
        // Disable parallax on mobile for performance
        if (this.windowWidth <= 768) {
            return;
        }
        
        this.bindEvents();
        this.setupIntersectionObserver();
        this.initParallaxElements();
        this.startAnimationLoop();
    }
    
    bindEvents() {
        // Scroll events
        window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
        
        // Mouse events for mouse parallax
        document.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: true });
        
        // Resize events
        window.addEventListener('resize', this.onResize.bind(this), { passive: true });
        
        // Touch events for mobile interactions
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });
    }
    
    onScroll() {
        this.scrollY = window.pageYOffset;
        
        if (!this.ticking) {
            requestAnimationFrame(this.updateParallax.bind(this));
            this.ticking = true;
        }
    }
    
    onMouseMove(e) {
        this.mouseX = (e.clientX / this.windowWidth) * 2 - 1;
        this.mouseY = (e.clientY / this.windowHeight) * 2 - 1;
        
        this.updateMouseParallax();
    }
    
    onTouchMove(e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.mouseX = (touch.clientX / this.windowWidth) * 2 - 1;
            this.mouseY = (touch.clientY / this.windowHeight) * 2 - 1;
            
            this.updateMouseParallax();
        }
    }
    
    onResize() {
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        
        // Reinitialize if switching between mobile and desktop
        if (this.windowWidth <= 768) {
            this.destroy();
        } else {
            this.init();
        }
    }
    
    updateParallax() {
        // Update scroll-based parallax elements
        this.updateScrollParallax();
        
        // Update hero parallax
        this.updateHeroParallax();
        
        // Update section parallax
        this.updateSectionParallax();
        
        // Update navigation parallax
        this.updateNavigationParallax();
        
        this.ticking = false;
    }
    
    updateScrollParallax() {
        const elements = document.querySelectorAll('.scroll-parallax');
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const speed = element.dataset.parallaxSpeed || 0.5;
            const yPos = -(this.scrollY * speed);
            
            if (rect.bottom >= 0 && rect.top <= this.windowHeight) {
                element.style.transform = `translateY(${yPos}px)`;
            }
        });
        
        // Update specific parallax classes
        this.updateParallaxClass('.scroll-parallax-slow', 0.3);
        this.updateParallaxClass('.scroll-parallax-medium', 0.5);
        this.updateParallaxClass('.scroll-parallax-fast', 0.7);
    }
    
    updateParallaxClass(selector, speed) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const yPos = -(this.scrollY * speed);
            
            if (rect.bottom >= 0 && rect.top <= this.windowHeight) {
                element.style.transform = `translateY(${yPos}px)`;
            }
        });
    }
    
    updateHeroParallax() {
        const heroBackground = document.querySelector('.hero-background');
        const heroParticles = document.querySelector('.hero-particles');
        const heroContent = document.querySelector('.hero-content');
        
        if (heroBackground) {
            const yPos = this.scrollY * 0.5;
            heroBackground.style.transform = `translateY(${yPos}px)`;
        }
        
        if (heroParticles) {
            const yPos = this.scrollY * 0.3;
            const xPos = Math.sin(this.scrollY * 0.001) * 10;
            heroParticles.style.transform = `translateY(${yPos}px) translateX(${xPos}px)`;
        }
        
        if (heroContent) {
            const yPos = this.scrollY * 0.1;
            const scale = 1 - (this.scrollY * 0.0005);
            heroContent.style.transform = `translateY(${yPos}px) scale(${Math.max(scale, 0.8)})`;
        }
    }
    
    updateSectionParallax() {
        const sections = document.querySelectorAll('.section-parallax');
        
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const bg = section.querySelector('.section-parallax-bg');
            const content = section.querySelector('.section-parallax-content');
            
            if (rect.bottom >= 0 && rect.top <= this.windowHeight) {
                const progress = (this.windowHeight - rect.top) / (this.windowHeight + rect.height);
                
                if (bg) {
                    const yPos = progress * 100;
                    bg.style.transform = `translateY(${yPos}px)`;
                }
                
                if (content) {
                    const yPos = progress * 50;
                    content.style.transform = `translateY(${yPos}px)`;
                }
            }
        });
    }
    
    updateNavigationParallax() {
        const nav = document.querySelector('.nav-parallax');
        
        if (nav) {
            if (this.scrollY > 100) {
                nav.classList.add('visible');
                nav.classList.remove('hidden');
            } else {
                nav.classList.add('hidden');
                nav.classList.remove('visible');
            }
        }
    }
    
    updateMouseParallax() {
        const elements = document.querySelectorAll('.mouse-parallax');
        
        elements.forEach(element => {
            const intensity = element.dataset.mouseIntensity || 20;
            const xPos = this.mouseX * intensity;
            const yPos = this.mouseY * intensity;
            
            element.style.transform = `translateX(${xPos}px) translateY(${yPos}px)`;
        });
        
        // Update mouse parallax layers
        this.updateMouseParallaxLayers();
        
        // Update magnetic elements
        this.updateMagneticElements();
    }
    
    updateMouseParallaxLayers() {
        const containers = document.querySelectorAll('.mouse-parallax');
        
        containers.forEach(container => {
            const layer1 = container.querySelector('.mouse-parallax-layer-1');
            const layer2 = container.querySelector('.mouse-parallax-layer-2');
            const layer3 = container.querySelector('.mouse-parallax-layer-3');
            
            if (layer1) {
                const xPos = this.mouseX * 10;
                const yPos = this.mouseY * 10;
                layer1.style.transform = `translateX(${xPos}px) translateY(${yPos}px)`;
            }
            
            if (layer2) {
                const xPos = this.mouseX * 20;
                const yPos = this.mouseY * 20;
                layer2.style.transform = `translateX(${xPos}px) translateY(${yPos}px)`;
            }
            
            if (layer3) {
                const xPos = this.mouseX * 30;
                const yPos = this.mouseY * 30;
                layer3.style.transform = `translateX(${xPos}px) translateY(${yPos}px)`;
            }
        });
    }
    
    updateMagneticElements() {
        const elements = document.querySelectorAll('.parallax-magnetic');
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const deltaX = this.mouseX * this.windowWidth - centerX;
            const deltaY = this.mouseY * this.windowHeight - centerY;
            
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 100;
            
            if (distance < maxDistance) {
                const strength = (maxDistance - distance) / maxDistance;
                const moveX = (deltaX / distance) * strength * 20;
                const moveY = (deltaY / distance) * strength * 20;
                
                element.style.setProperty('--mouse-x', `${moveX}px`);
                element.style.setProperty('--mouse-y', `${moveY}px`);
                element.classList.add('attracted');
            } else {
                element.style.setProperty('--mouse-x', '0px');
                element.style.setProperty('--mouse-y', '0px');
                element.classList.remove('attracted');
            }
        });
    }
    
    setupIntersectionObserver() {
        const options = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    
                    // Trigger text parallax reveal
                    if (entry.target.classList.contains('text-parallax')) {
                        entry.target.classList.add('revealed');
                    }
                } else {
                    entry.target.classList.remove('in-view');
                    
                    if (entry.target.classList.contains('text-parallax')) {
                        entry.target.classList.remove('revealed');
                    }
                }
            });
        }, options);
        
        // Observe parallax trigger elements
        document.querySelectorAll('.parallax-trigger').forEach(el => {
            observer.observe(el);
        });
        
        // Observe text parallax elements
        document.querySelectorAll('.text-parallax').forEach(el => {
            observer.observe(el);
        });
    }
    
    initParallaxElements() {
        // Initialize card parallax effects
        this.initCardParallax();
        
        // Initialize button parallax effects
        this.initButtonParallax();
        
        // Initialize tilt effects
        this.initTiltEffects();
    }
    
    initCardParallax() {
        const cards = document.querySelectorAll('.card-parallax');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', (e) => {
                const rect = e.target.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                e.target.style.transformOrigin = `${centerX}px ${centerY}px`;
            });
            
            card.addEventListener('mousemove', (e) => {
                const rect = e.target.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / centerY * 10;
                const rotateY = (centerX - x) / centerX * 10;
                
                e.target.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
            });
            
            card.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
            });
        });
    }
    
    initButtonParallax() {
        const buttons = document.querySelectorAll('.btn-parallax');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                e.target.style.transform = 'translateZ(10px) rotateX(10deg)';
            });
            
            button.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'translateZ(0px) rotateX(0deg)';
            });
        });
    }
    
    initTiltEffects() {
        const tiltElements = document.querySelectorAll('.parallax-tilt');
        
        tiltElements.forEach(element => {
            element.addEventListener('mousemove', (e) => {
                const rect = e.target.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / centerY * 15;
                const rotateY = (centerX - x) / centerX * 15;
                
                e.target.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });
            
            element.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
            });
        });
    }
    
    startAnimationLoop() {
        const animate = () => {
            // Update floating elements
            this.updateFloatingElements();
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    updateFloatingElements() {
        const floatingElements = document.querySelectorAll('.float-parallax');
        const time = Date.now() * 0.001;
        
        floatingElements.forEach((element, index) => {
            const offset = index * 2;
            const y = Math.sin(time + offset) * 10;
            const z = Math.cos(time + offset) * 5;
            
            element.style.transform = `translateY(${y}px) translateZ(${z}px)`;
        });
    }
    
    destroy() {
        // Remove event listeners
        window.removeEventListener('scroll', this.onScroll.bind(this));
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        window.removeEventListener('resize', this.onResize.bind(this));
        document.removeEventListener('touchmove', this.onTouchMove.bind(this));
        
        // Reset transforms
        const parallaxElements = document.querySelectorAll('[class*="parallax"]');
        parallaxElements.forEach(element => {
            element.style.transform = '';
        });
    }
}

// Micro-interactions Controller
class MicroInteractionsController {
    constructor() {
        this.init();
    }
    
    init() {
        this.initButtonInteractions();
        this.initFormInteractions();
        this.initCardInteractions();
        this.initNavigationInteractions();
        this.initScrollInteractions();
    }
    
    initButtonInteractions() {
        // Ripple effect for buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.btn-primary, .btn-secondary, .icon-btn')) {
                this.createRipple(e);
            }
        });
        
        // Button hover sound effect (optional)
        const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px) scale(1.02)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0) scale(1)';
            });
        });
    }
    
    createRipple(e) {
        const button = e.target;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
            z-index: 1;
        `;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    initFormInteractions() {
        // Enhanced focus states
        const inputs = document.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                const parent = input.closest('.form-group');
                if (parent) {
                    parent.classList.add('focused');
                }
            });
            
            input.addEventListener('blur', () => {
                const parent = input.closest('.form-group');
                if (parent) {
                    parent.classList.remove('focused');
                }
            });
        });
    }
    
    initCardInteractions() {
        const cards = document.querySelectorAll('.result-card, .quick-template-btn');
        
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
    
    initNavigationInteractions() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('mouseenter', () => {
                link.style.transform = 'translateY(-1px)';
                link.style.transition = 'all 0.2s ease';
            });
            
            link.addEventListener('mouseleave', () => {
                link.style.transform = 'translateY(0)';
            });
        });
    }
    
    initScrollInteractions() {
        // Smooth scroll behavior
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const href = this.getAttribute('href');
                // Validate href is not just '#' and has a valid target
                if (href && href.length > 1) {
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
        });
    }
}

// Initialize controllers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize controllers
    new ParallaxController();
    // Removed MicroInteractionsController auto-initialization and ripple keyframes injection (handled by ui.interactions.js)
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ParallaxController, MicroInteractionsController };
}