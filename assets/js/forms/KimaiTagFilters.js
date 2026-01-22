/*
 * This file is part of the Kimai time-tracking app.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*!
 * [KIMAI] KimaiTagFilters: Unified display for include/exclude tag filters
 */

import KimaiFormPlugin from './KimaiFormPlugin';

export default class KimaiTagFilters extends KimaiFormPlugin {

    constructor(selector) {
        super();
        this._selector = selector;
    }

    getId() {
        return 'tag-filters';
    }

    /**
     * @param {HTMLFormElement} form
     * @return boolean
     */
    supportsForm(form) {
        return form.querySelector(this._selector) !== null;
    }

    /**
     * @param {HTMLFormElement} form
     */
    activateForm(form) {
        for (const container of form.querySelectorAll(this._selector)) {
            this._initContainer(container);
        }
    }

    /**
     * @param {HTMLFormElement} form
     */
    destroyForm(form) { // eslint-disable-line no-unused-vars
    }

    /**
     * @param {HTMLElement} container
     * @private
     */
    _initContainer(container) {
        const tagsSelectId = container.dataset.tagsSelect;
        const excludeTagsSelectId = container.dataset.excludeTagsSelect;

        if (!tagsSelectId || !excludeTagsSelectId) {
            return;
        }

        const tagsSelect = document.querySelector(tagsSelectId);
        const excludeTagsSelect = document.querySelector(excludeTagsSelectId);

        if (!tagsSelect || !excludeTagsSelect) {
            return;
        }

        const display = container.querySelector('.tag-filters-display');
        const chipsContainer = container.querySelector('.tag-filters-chips');

        if (!display || !chipsContainer) {
            return;
        }

        const updateFn = () => {
            // Small delay to ensure TomSelect has updated its state
            setTimeout(() => {
                this._updateDisplay(display, chipsContainer, tagsSelect, excludeTagsSelect);
            }, 10);
        };

        // Initial render (with delay to wait for TomSelect initialization)
        setTimeout(() => {
            this._updateDisplay(display, chipsContainer, tagsSelect, excludeTagsSelect);
        }, 100);

        // Listen for changes on both selects
        tagsSelect.addEventListener('change', updateFn);
        excludeTagsSelect.addEventListener('change', updateFn);

        // Also listen for TomSelect item events if available
        this._watchTomSelect(tagsSelect, updateFn);
        this._watchTomSelect(excludeTagsSelect, updateFn);
    }

    /**
     * Watch TomSelect for item changes
     * @param {HTMLSelectElement} select
     * @param {Function} callback
     * @private
     */
    _watchTomSelect(select, callback) {
        // TomSelect might not be initialized yet, so we poll for it
        const checkInterval = setInterval(() => {
            if (select.tomselect) {
                clearInterval(checkInterval);
                select.tomselect.on('item_add', callback);
                select.tomselect.on('item_remove', callback);
                // Update display once TomSelect is ready
                callback();
            }
        }, 50);

        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    /**
     * @param {HTMLElement} display
     * @param {HTMLElement} chipsContainer
     * @param {HTMLSelectElement} tagsSelect
     * @param {HTMLSelectElement} excludeTagsSelect
     * @private
     */
    _updateDisplay(display, chipsContainer, tagsSelect, excludeTagsSelect) {
        chipsContainer.innerHTML = '';

        const includeTags = this._getSelectedTags(tagsSelect);
        const excludeTags = this._getSelectedTags(excludeTagsSelect);
        const hasAnyTags = includeTags.length > 0 || excludeTags.length > 0;
        display.style.display = hasAnyTags ? 'block' : 'none';
        
        // Toggle class on container to control TomSelect item visibility via CSS
        const container = display.parentElement;
        if (container) {
            container.classList.toggle('tag-filters-active', hasAnyTags);
        }

        // Render include tags
        for (const tag of includeTags) {
            const chip = this._createChip(tag, 'include', tagsSelect, excludeTagsSelect);
            chipsContainer.appendChild(chip);
        }

        // Render exclude tags
        for (const tag of excludeTags) {
            const chip = this._createChip(tag, 'exclude', excludeTagsSelect, tagsSelect);
            chipsContainer.appendChild(chip);
        }
    }

    /**
     * @param {HTMLSelectElement} select
     * @returns {Array<{value: string, text: string, color: string|null}>}
     * @private
     */
    _getSelectedTags(select) {
        const tags = [];
        for (const option of select.selectedOptions) {
            if (option.value) {
                tags.push({
                    value: option.value,
                    text: option.text,
                    color: option.dataset.color || null
                });
            }
        }
        return tags;
    }

    /**
     * @param {{value: string, text: string, color: string|null}} tag
     * @param {string} type - 'include' or 'exclude'
     * @param {HTMLSelectElement} primarySelect
     * @param {HTMLSelectElement} secondarySelect
     * @returns {HTMLElement}
     * @private
     */
    _createChip(tag, type, primarySelect, secondarySelect) {
        const chip = document.createElement('span');
        chip.className = `tag-chip tag-chip-${type}`;
        chip.dataset.value = tag.value;
        chip.dataset.type = type;

        let html = '';

        // Color indicator if available
        if (tag.color) {
            html += `<span class="tag-chip-color" style="background-color: ${this._escapeHtml(tag.color)}"></span>`;
        }

        // Icon for exclude tags
        if (type === 'exclude') {
            html += '<span class="tag-chip-icon" title="Excluded">&#8722;</span>'; // minus sign
        }

        // Tag name
        html += `<span class="tag-chip-name" title="${this._escapeHtml(tag.text)}">${this._escapeHtml(tag.text)}</span>`;

        // Remove button
        html += '<span class="tag-chip-remove" title="Remove">&times;</span>';

        chip.innerHTML = html;

        // Remove click handler - removes from both selects in case tag exists in both
        const removeBtn = chip.querySelector('.tag-chip-remove');
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._removeTag(tag.value, primarySelect, secondarySelect);
        });

        return chip;
    }

    /**
     * @param {string} value
     * @param {HTMLSelectElement} primarySelect
     * @param {HTMLSelectElement|null} secondarySelect
     * @private
     */
    _removeTag(value, primarySelect, secondarySelect = null) {
        // Remove from primary select
        this._removeFromSelect(value, primarySelect);
        
        // Also remove from secondary select if provided (in case tag exists in both)
        if (secondarySelect) {
            this._removeFromSelect(value, secondarySelect);
        }
    }

    /**
     * @param {string} value
     * @param {HTMLSelectElement} select
     * @private
     */
    _removeFromSelect(value, select) {
        let found = false;
        
        // Find and deselect the option
        for (const option of select.options) {
            if (option.value === value && option.selected) {
                option.selected = false;
                found = true;
                break;
            }
        }

        if (found) {
            // If TomSelect is attached, update it
            if (select.tomselect) {
                select.tomselect.removeItem(value, true);
            }

            // Trigger change event
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
