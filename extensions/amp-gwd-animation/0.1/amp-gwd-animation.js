/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
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
import {ActionTrust} from '../../../src/action-trust';
import {CSS} from '../../../build/amp-gwd-animation-0.1.css';
import {actionServiceForDoc} from '../../../src/services';
import {getServiceForDoc} from '../../../src/service';
import {
  GWD_SERVICE_NAME,
  GWD_TIMELINE_EVENT,
  installGwdRuntimeServiceForDoc,
} from './amp-gwd-animation-impl';

/** @const {string} The custom element tag name for this extension. */
export const TAG = 'amp-gwd-animation';

/**
 * The names of actions supported by this extension, which correspond to an
 * identically-named method in the GWD runtime, and the parameters they require.
 * This map is used to automatically generate and register AMP actions for each
 * of these runtime methods (@see buildCallback).
 * @const {!Object<string, !Array<string>>}
 */
const ACTIONS_PARAMS = {
  'play': ['id'],
  'pause': ['id'],
  'togglePlay': ['id'],
  'gotoAndPlay': ['id', 'label'],
  'gotoAndPause': ['id', 'label'],
  'gotoAndPlayNTimes': ['id', 'label', 'count', 'eventName'],
};

export class GwdAnimation extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /**
     * The prefix to use for triggered timeline events if it is necessary to
     * avoid event name conflicts, supplied via the `timeline-event-prefix`
     * attribute (@see buildCallback).
     * At this time, a prefix does not need to be used because the extension
     * does not dispatch any events other than timeline events.
     * @private {string}
     */
    this.timelineEventPrefix_ = '';

    /** @private {!Function} */
    this.boundOnGwdTimelineEvent_ = this.onGwdTimelineEvent_.bind(this);
  }

  /** @override */
  buildCallback() {
    // Ensure GWD animation runtime service factory is registered for this
    // ampdoc. In the event multiple copies of this extension exist in the doc,
    // the runtime service will only be started once.
    installGwdRuntimeServiceForDoc(this.getAmpDoc());

    this.timelineEventPrefix_ =
        this.element.getAttribute('timeline-event-prefix') || '';

    // Listen for GWD timeline events to re-broadcast them via the doc action
    // service.
    this.getAmpDoc().win.addEventListener(
        GWD_TIMELINE_EVENT, this.boundOnGwdTimelineEvent_, true);

    // Register supported actions.
    for (const name in ACTIONS_PARAMS) {
      this.registerAction(name, this.createAction_(name, ACTIONS_PARAMS[name]));
    }
  }

  /**
   * Returns a registrable AMP action function which invokes the provided GWD
   * runtime method with the provided arguments extracted from the invocation
   * detail. The GWD runtime service is expected to already be registered.
   * @return {!function(!../../../src/service/action-impl.ActionInvocation)}
   * @private
   */
  createAction_(methodName, args) {
    const service = getServiceForDoc(this.getAmpDoc(), GWD_SERVICE_NAME);
    return (invocation) => {
      service[methodName].apply(
          service, args.map((arg) => invocation.args[arg]));
    };
  }

  /**
   * Handles `gwd.timelineEvent` events dispatched by the runtime service, which
   * indicate that the animation has reached a GWD event marker. Triggers a
   * custom event via the doc action service.
   * @param {!Event} event
   * @private
   */
  onGwdTimelineEvent_(event) {
    actionServiceForDoc(this.getAmpDoc()).trigger(
        this.element,
        `${this.timelineEventPrefix_}${event.detail.eventName}`,
        event,
        ActionTrust.HIGH);
  }

  /** @override */
  detachedCallback() {
    this.getAmpDoc().win.removeEventListener(
        GWD_TIMELINE_EVENT, this.boundOnGwdTimelineEvent_, true);
    return true;
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerElement(TAG, GwdAnimation, CSS);
});
