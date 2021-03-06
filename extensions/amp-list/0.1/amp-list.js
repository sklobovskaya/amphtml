/**
 * Copyright 2015 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AmpEvents} from '../../../src/amp-events';
import {createCustomEvent} from '../../../src/event-helper';
import {fetchBatchedJsonFor} from '../../../src/batched-json';
import {isArray} from '../../../src/types';
import {isLayoutSizeDefined} from '../../../src/layout';
import {removeChildren} from '../../../src/dom';
import {templatesFor} from '../../../src/services';
import {dev, user} from '../../../src/log';

/**
 * The implementation of `amp-list` component. See {@link ../amp-list.md} for
 * the spec.
 */
export class AmpList extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private {?Element} */
    this.container_ = null;

    /** @private {boolean} */
    this.fallbackDisplayed_ = false;
  }

  /** @override */
  isLayoutSupported(layout) {
    return isLayoutSizeDefined(layout);
  }

  /** @override */
  buildCallback() {
    this.container_ = this.win.document.createElement('div');
    this.applyFillContent(this.container_, true);
    this.element.appendChild(this.container_);

    if (!this.container_.hasAttribute('role')) {
      this.container_.setAttribute('role', 'list');
    }

    if (!this.element.hasAttribute('aria-live')) {
      this.element.setAttribute('aria-live', 'polite');
    }
  }

  /** @override */
  reconstructWhenReparented() {
    return false;
  }

  /** @override */
  layoutCallback() {
    const populate = this.populateList_();
    if (this.getFallback()) {
      populate.then(() => {
        // Hide in case fallback was displayed for a previous fetch.
        this.toggleFallbackInMutate_(false);
      }, unusedError => {
        // On fetch success, firstLayoutCompleted() hides placeholder.
        // On fetch error, hide placeholder if fallback exists.
        this.togglePlaceholder(false);
        this.toggleFallbackInMutate_(true);
      });
    }
    return populate;
  }

  /** @override */
  mutatedAttributesCallback(mutations) {
    const src = mutations['src'];
    const state = mutations['state'];
    if (src != undefined) {
      this.populateList_();
    } else if (state != undefined) {
      const items = isArray(state) ? state : [state];
      templatesFor(this.win).findAndRenderTemplateArray(
          this.element, items).then(this.rendered_.bind(this));
    }
    if (src != undefined && state != undefined) {
      user().warn('AMP-LIST', '[src] and [state] mutated simultaneously.' +
          ' The [state] mutation will be dropped.');
    }
  }

  /**
   * Wraps `toggleFallback()` in a mutate context.
   * @param {boolean} state
   */
  toggleFallbackInMutate_(state) {
    if (state) {
      this.getVsync().mutate(() => {
        this.toggleFallback(true);
        this.fallbackDisplayed_ = true;
      });
    } else {
      // Don't queue mutate if fallback isn't already visible.
      if (this.fallbackDisplayed_) {
        this.getVsync().mutate(() => {
          this.toggleFallback(false);
          this.fallbackDisplayed_ = false;
        });
      }
    }
  }

  /**
   * Request list data from `src` and return a promise that resolves when
   * the list has been populated with rendered list items.
   * @return {!Promise}
   */
  populateList_() {
    const itemsExpr = this.element.getAttribute('items') || 'items';
    return this.fetchItems_(itemsExpr).then(items => {
      user().assert(isArray(items),
          'Response must contain an array at "%s". %s',
          itemsExpr, this.element);
      return templatesFor(this.win).findAndRenderTemplateArray(
          this.element, items).then(this.rendered_.bind(this));
    }, error => {
      throw user().createError('Error fetching amp-list', error);
    });
  }

  /**
   * @param {!Array<!Element>} elements
   * @private
   */
  rendered_(elements) {
    removeChildren(dev().assertElement(this.container_));
    elements.forEach(element => {
      if (!element.hasAttribute('role')) {
        element.setAttribute('role', 'listitem');
      }
      this.container_.appendChild(element);
    });

    const templatedEvent = createCustomEvent(this.win,
        AmpEvents.TEMPLATE_RENDERED, /* detail */ null, {bubbles: true});
    this.container_.dispatchEvent(templatedEvent);

    // Change height if needed.
    this.getVsync().measure(() => {
      const scrollHeight = this.container_./*OK*/scrollHeight;
      const height = this.element./*OK*/offsetHeight;
      if (scrollHeight > height) {
        this.attemptChangeHeight(scrollHeight).catch(() => {});
      }
    });
  }

  /**
   * @param {string} itemsExpr
   * @visibleForTesting
   */
  fetchItems_(itemsExpr) {
    return fetchBatchedJsonFor(this.getAmpDoc(), this.element, itemsExpr);
  }
}

AMP.registerElement('amp-list', AmpList);
