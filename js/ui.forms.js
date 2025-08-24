// js/ui.forms.js
import { elements } from './utils.js';

export function initFormAnimations() {
    // Temporarily disable floating labels due to visual issues
    // convertFormGroups();
    
    // Add event listeners for form interactions
    // addFormEventListeners();
    
    // Initialize form validation states
    initFormValidation();
}

function convertFormGroups() {
    const formGroups = document.querySelectorAll('.form-group');
    
    formGroups.forEach(group => {
        const input = group.querySelector('input, textarea, select');
        const label = group.querySelector('label');
        
        if (input && label && !group.classList.contains('form-field')) {
            // Skip file inputs and buttons
            if (input.type === 'file' || input.type === 'button' || input.type === 'submit') {
                return;
            }
            
            // Skip if it's a toggle or special control
            if (group.querySelector('.ratio-toggle-track') || group.querySelector('.track-btn')) {
                return;
            }
            
            // Convert to form-field structure
            group.classList.add('form-field');
            group.classList.remove('form-group');
            
            // Update label classes for floating effect
            label.classList.remove('block', 'text-sm', 'font-medium', 'text-gray-300', 'mb-1');
            
            // Set initial state for filled inputs
            if (input.value || (input.type === 'select-one' && input.selectedIndex > 0)) {
                group.classList.add('has-value');
            }
            
            // Add placeholder if not exists
            if (!input.placeholder && input.type !== 'select-one') {
                input.placeholder = ' '; // Space to trigger :not(:placeholder-shown)
            }
        }
    });
}

function addFormEventListeners() {
    const formFields = document.querySelectorAll('.form-field');
    
    formFields.forEach(field => {
        const input = field.querySelector('input, textarea, select');
        const label = field.querySelector('label');
        
        if (!input || !label) return;
        
        // Focus events
        input.addEventListener('focus', () => {
            field.classList.add('focused');
        });
        
        // Blur events
        input.addEventListener('blur', () => {
            field.classList.remove('focused');
            
            // Update has-value class
            updateFieldValue(field, input);
            
            // Validate field on blur
            validateField(field, input);
        });
        
        // Input events for real-time validation
        input.addEventListener('input', () => {
            // Update has-value class
            updateFieldValue(field, input);
            
            // Clear error state on input
            if (field.classList.contains('error')) {
                removeFieldError(field);
            }
        });
        
        // Change events for select elements
        if (input.tagName === 'SELECT') {
            input.addEventListener('change', () => {
                updateFieldValue(field, input);
                validateField(field, input);
            });
        }
    });
}

function updateFieldValue(field, input) {
    if (input.value || (input.type === 'select-one' && input.selectedIndex > 0)) {
        field.classList.add('has-value');
    } else {
        field.classList.remove('has-value');
    }
}

// Label animation is now handled by CSS

function initFormValidation() {
    // Add validation for required fields
    const requiredInputs = document.querySelectorAll('input[required], textarea[required]');
    
    requiredInputs.forEach(input => {
        const field = input.closest('.form-field');
        if (!field) return;
        
        input.addEventListener('blur', () => {
            validateField(field, input);
        });
        
        input.addEventListener('input', () => {
            // Clear error state on input
            if (field.classList.contains('error')) {
                field.classList.remove('error');
            }
        });
    });
}

function validateField(field, input) {
    const isValid = input.checkValidity() && input.value.trim() !== '';
    
    field.classList.remove('error', 'success');
    
    if (!isValid && input.value.trim() !== '') {
        field.classList.add('error');
        addFieldError(field, getValidationMessage(input));
    } else if (isValid && input.value.trim() !== '') {
        field.classList.add('success');
        removeFieldError(field);
    } else {
        removeFieldError(field);
    }
}

function addFieldError(field, message) {
    removeFieldError(field); // Remove existing error first
    
    const errorElement = document.createElement('div');
    errorElement.className = 'form-field-helper error-message';
    errorElement.textContent = message;
    
    field.appendChild(errorElement);
}

function removeFieldError(field) {
    const existingError = field.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
}

function getValidationMessage(input) {
    if (input.validity.valueMissing) {
        return 'Field ini wajib diisi';
    }
    if (input.validity.typeMismatch) {
        return 'Format input tidak valid';
    }
    if (input.validity.tooShort) {
        return `Minimal ${input.minLength} karakter`;
    }
    if (input.validity.tooLong) {
        return `Maksimal ${input.maxLength} karakter`;
    }
    return 'Input tidak valid';
}

// Export validation functions for external use
export function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId)?.closest('.form-field');
    if (field) {
        field.classList.add('error');
        addFieldError(field, message);
    }
}

export function setFieldSuccess(fieldId) {
    const field = document.getElementById(fieldId)?.closest('.form-field');
    if (field) {
        field.classList.remove('error');
        field.classList.add('success');
        removeFieldError(field);
    }
}

export function clearFieldState(fieldId) {
    const field = document.getElementById(fieldId)?.closest('.form-field');
    if (field) {
        field.classList.remove('error', 'success');
        removeFieldError(field);
    }
}