import { Subscription } from 'rxjs';

/*
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Copyright 2023 Xyna GmbH, Germany
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 */
import { AfterViewInit, Directive, ElementRef, inject, Input, NgZone, numberAttribute, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';

import { A11yService, ScreenreaderPriority } from '../../a11y';
import { coerceBoolean, isArray, isObject, isString, retrieveFocusableElements } from '../../base';
import { I18nService, LocaleService } from '../../i18n';
import { ATTRIBUTE_TOOLTIP } from '../shared/xc-i18n-attributes';


export interface XcTooltipController {
    delegateFunction?: (element: HTMLElement) => HTMLElement;
    autoDelegate?: boolean;
    tooltip?: string | TemplateRef<any>;
}

export enum XcTooltipPosition {
    top = 'top',
    topRight = 'top-right',
    right = 'right',
    bottomRight = 'bottom-right',
    bottom = 'bottom',
    bottomLeft = 'bottom-left',
    left = 'left',
    topLeft = 'top-left'
}

type XcPreviousTooltipPosition = 'left' | 'right' | 'above' | 'below' | 'before' | 'after';


@Directive({ selector: '[xc-tooltip]' })
export class XcTooltipDirective implements OnInit, AfterViewInit, OnDestroy {
    private readonly elementRef = inject(ElementRef<HTMLElement>);
    private readonly ngZone = inject(NgZone);
    private readonly a11yService = inject(A11yService);
    private readonly i18n = inject(I18nService);


    private observer: MutationObserver;

    protected _tooltip: { key: string | TemplateRef<any>, translated: string } = { key: '', translated: '' };

    protected subs: Subscription[] = [];

    private static activeTooltip: XcTooltipDirective;

    private static instanceCounter = 0;

    private static tooltipKeyframesStyleElement: HTMLStyleElement;

    static tooltipInlineCSS = '';

    static tooltipCSSClass = 'xc-tooltip-class';

    static posOffsetX = 10;
    static posOffsetY = 10;

    // the order of position, of which the algorithm tries to test if the tooltip box fits
    static positionSequence = [
        XcTooltipPosition.bottom,
        XcTooltipPosition.bottomRight,
        XcTooltipPosition.top,
        XcTooltipPosition.topRight,
        XcTooltipPosition.bottomLeft,
        XcTooltipPosition.left,
        XcTooltipPosition.topLeft,
        XcTooltipPosition.right
    ];

    private get currentTemplateElement(): HTMLElement {
        return this.stack[this.stack.length - 1];
    }

    private focusableElement: HTMLElement;

    private get showing(): boolean {
        return !!this.stack.length;
    }

    // needed for the correct implementation of WAI-ARIA
    private readonly tooltipId = 'xc-tooltip-id-' + ++XcTooltipDirective.instanceCounter;
    private stack: HTMLElement[] = [];
    private _isLabel = false;
    private _beforeAriaText = '';
    private _disabled = false;
    private _showDelay = 0;
    private _hideDelay = 0;
    private _impolite = false;
    private _extraTooltipClasses: string[] = [];
    private _elementFocusStateChangeSubscription: Subscription;
    /**
     * elements, focused by pressing the tab, get an protection so that a mouseleave won't close it
     */
    private _mouseleaveProtection = false;

    private preferedPosition: XcTooltipPosition[];

    @Input('xc-tooltip')
    set tooltip(value: string | TemplateRef<any>) {
        this._tooltip.key = value;
        this.translate(ATTRIBUTE_TOOLTIP);
    }

    get tooltip(): string | TemplateRef<any> {
        return isString(this._tooltip.key) ? this._tooltip.translated : this._tooltip.key;
    }

    @Input({alias: 'xc-tooltip-islabel', transform: coerceBoolean})
    set tooltipIsLabel(value: boolean) {
        this._isLabel = value;
    }


    /**
     * use with care - can cause the screenreader to speak out tooltip twice.
     * in some widgets (like <xc-tree>) the tooltip is only spoken out if the source element is focused before
     * the tooltip appears, which is not the case. xc-tooltip-impolite rea
     */
    @Input({alias: 'xc-tooltip-impolite', transform: coerceBoolean})
    set impolite(value: boolean) {
        this._impolite = value;
    }


    @Input('xc-tooltip-controller')
    controller: XcTooltipController = {
        autoDelegate: false
    };


    /* @Input check for backward compatibility */
    @Input('xc-tooltip-position')
    set _xc_position(value: (XcPreviousTooltipPosition | XcTooltipPosition) | (XcPreviousTooltipPosition | XcTooltipPosition)[]) {
        if (isArray(value)) {
            this.preferedPosition = (value as XcTooltipPosition[]).map<XcTooltipPosition>(str => XcTooltipDirective.getXcTooltipPosition(str));
        } else {
            this.preferedPosition = [XcTooltipDirective.getXcTooltipPosition(value)];
        }
    }

    private static getXcTooltipPosition(value: (XcPreviousTooltipPosition | XcTooltipPosition)): XcTooltipPosition {
        switch (value) {
            case 'left': return XcTooltipPosition.left;
            case 'right': return XcTooltipPosition.right;
            case 'above': return XcTooltipPosition.top;
            case 'below': return XcTooltipPosition.bottom;
            case 'before': return XcTooltipPosition.left;
            case 'after': return XcTooltipPosition.right;
            default: return value;
        }
    }

    @Input({alias: 'xc-tooltip-disabled', transform: coerceBoolean})
    set _xc_disabled(value: boolean) {
        this._disabled = value;
    }

    @Input({alias: 'xc-tooltip-showdelay', transform: numberAttribute})
    set _xc_showDelay(value: number) {
        this._showDelay = value;
    }

    @Input({alias: 'xc-tooltip-hidedelay', transform: numberAttribute})
    set _xc_hideDelay(value: number) {
        this._hideDelay = value;
    }

    @Input('xc-tooltip-class')
    set _xc_tooltipClass(value: string | string[] | Set<string> | { [key: string]: any }) {
        let classes: string[] = [];
        switch (true) {

            case (isString(value)): classes.push(value as string); break;
            case (isArray(value)): classes = (value as string[]).map<string>(str => isString(str) ? str : ''); break;
            case (value instanceof Set): (value as Set<string>).forEach(str => classes.push(str)); break;
            case (isObject(value)): Object.keys(value).forEach(key => classes.push(value[key])); break;

        }

        this._extraTooltipClasses = classes;
    }

    private readonly viewContainerRef: ViewContainerRef;

    i18nContext: string;

    protected readonly localeService: LocaleService = inject<LocaleService>(LocaleService);

    constructor() {
        const viewContainerRef = inject(ViewContainerRef);


        this.viewContainerRef = viewContainerRef;

        if (!XcTooltipDirective.tooltipKeyframesStyleElement) {

            XcTooltipDirective.tooltipKeyframesStyleElement = document.createElement('style');

            const fadeInRule = this.getKeyframesRule('tooltipFadeIn', [
                { percent: 0, style: 'opacity: 0;' },
                { percent: 100, style: 'opacity: 1;' }
            ]);

            const fadeInNode = document.createTextNode(fadeInRule);
            XcTooltipDirective.tooltipKeyframesStyleElement.appendChild(fadeInNode);

            const fadeOutRule = this.getKeyframesRule('tooltipFadeOut', [
                { percent: 0, style: 'opacity: 1;' },
                { percent: 100, style: 'opacity: 0;' }
            ]);
            const fadeOutNode = document.createTextNode(fadeOutRule);
            XcTooltipDirective.tooltipKeyframesStyleElement.appendChild(fadeOutNode);
            document.head.appendChild(XcTooltipDirective.tooltipKeyframesStyleElement);
        }
    }


    protected translate(attribute: string) {
        if (this.i18nContext !== undefined && this.i18nContext !== null && this[attribute]["key"]) {
            this[attribute]["translated"] = this.i18n.translate(this.i18nContext ? this.i18nContext + '.' + this[attribute]["key"] : this[attribute]["key"]);
        } else {
            this[attribute]["translated"] = this[attribute]["key"];
        }
    }


    private getKeyframesRule(name: string, keyframes: { percent: number; style: string }[]): string {
        const combinedKeyframes = keyframes.map<string>(f => f.percent + '% {' + f.style + ' }').join(' ');
        return `@keyframes ${name} {${combinedKeyframes}}`;
    }


    ngOnInit() {
        const el = this.elementRef.nativeElement;

        this.i18nContext = el.getAttribute('xc-i18n');

        // Übersetzung, falls Tooltip bereits gesetzt ist
        if (this._tooltip.key) {
            this.translate(ATTRIBUTE_TOOLTIP);
        }

        // Subscription für Sprachwechsel
        this.subs.push(this.localeService.languageChange.subscribe(() => {
            if (this._tooltip.key) {
                this.translate(ATTRIBUTE_TOOLTIP);
            }
        }));

        // MutationObserver erstellen
        this.observer = new MutationObserver(() => {
            const newContext = el.getAttribute('xc-i18n');
            if (newContext !== this.i18nContext) {
                this.i18nContext = newContext;
                if (this._tooltip.key) {
                    this.translate(ATTRIBUTE_TOOLTIP);
                }
            }
        });

        // Beobachte nur Änderungen am Attribut 'xc-i18n'
        this.observer.observe(el, { attributes: true, attributeFilter: ['xc-i18n'] });
    }


    ngAfterViewInit() {
        this.resetFocusableElement();
    }


    resetFocusableElement() {

        this._mouseleaveProtection = false;

        // remove event listener on old focusable element if there is one
        if (this.focusableElement) {
            this.focusableElement.removeEventListener('mouseenter', this.mouseenterFn);
            this.focusableElement.removeEventListener('mouseleave', this.mouseleaveFn);
        }

        if (this._elementFocusStateChangeSubscription) {
            this._elementFocusStateChangeSubscription.unsubscribe();
        }

        // find a new focusable element
        const el = (this.elementRef.nativeElement as HTMLElement);

        let autoDelegateResult: HTMLElement;
        let specifiedDelegateResult: HTMLElement;

        // all html custom elements must have a dash ('-') in the tag name to differentiate them from native html tags
        if (el.tagName.includes('-')) {

            // we need no auto delegation if element has a tab index of 0 or higher because it means
            // that the user of this directive made it accessable by pressing tab
            if (this.controller && this.controller.autoDelegate && el.tabIndex < 0) {
                // make sure that no result has an tabIndex of -1
                const result = Array.from(retrieveFocusableElements(el)).filter(elem => elem.tabIndex >= 0);
                if (result.length > 1) {
                    console.warn('Auto delegation of the following element let to an inconclusive result.', el);
                    autoDelegateResult = el;
                } else {
                    autoDelegateResult = result[0];
                }
            }

            specifiedDelegateResult = this.controller.delegateFunction ? this.controller.delegateFunction(el) : null;
        }

        this.focusableElement = specifiedDelegateResult || autoDelegateResult || el;

        if (this.focusableElement) {

            this._elementFocusStateChangeSubscription = this.a11yService.emitElementFocusStateChange(this.focusableElement).subscribe(state => {
                if (state.type === 'focus') {
                    this._mouseleaveProtection = state.achieved === 'keyboard';
                    this.show();
                } else { // on blur
                    this._mouseleaveProtection = false;
                    this.hide();
                }
            });

            this.ngZone.runOutsideAngular(() => {
                this.focusableElement.addEventListener('mouseenter', this.mouseenterFn);
                this.focusableElement.addEventListener('mouseleave', this.mouseleaveFn);
            });
        }
    }


    ngOnDestroy() {

        if (this._elementFocusStateChangeSubscription) {
            this._elementFocusStateChangeSubscription.unsubscribe();
        }

        if (this.focusableElement) {
            this.focusableElement.removeEventListener('mouseenter', this.mouseenterFn);
            this.focusableElement.removeEventListener('mouseleave', this.mouseleaveFn);
            this.hide();
        }

        this.subs.forEach(sub => sub.unsubscribe());
    }


    show(animationLength = 300, delay = this._showDelay) {

        // check if tooltip is not disabled or falsfied
        if (!this._disabled && this.getCurrentTooltip() && !this.showing && XcTooltipDirective.activeTooltip !== this) {

            this.ngZone.runOutsideAngular(() => {
                window.addEventListener('scroll', this.scrollEventListenerIfShowing, true);
                window.addEventListener('keydown', this.keydownEventListenerIfShowing, true);
            });

            const localCurrentTemplateElement = this.getTemplateElement();
            localCurrentTemplateElement.style.opacity = '0';
            localCurrentTemplateElement.style.animationName = 'tooltipFadeIn';
            localCurrentTemplateElement.style.animationDuration = animationLength + 'ms';
            localCurrentTemplateElement.style.animationDelay = delay + 'ms';
            localCurrentTemplateElement.onanimationend = e => (e.target as HTMLElement).style.opacity = '1';

            if (this._isLabel) {
                this._beforeAriaText = this.focusableElement.getAttribute('aria-labelledby') || '';
                this.focusableElement.setAttribute('aria-labelledby', this.tooltipId);
            } else {
                this._beforeAriaText = this.focusableElement.getAttribute('aria-describedby') || '';
                this.focusableElement.setAttribute('aria-describedby', this.tooltipId);
            }


            // adding it to the dom so that its bounding rect can be calculated
            const overlayWrapper =
                this.focusableElement.closest('.cdk-global-overlay-wrapper')
                ?? this.focusableElement.closest('.cdk-overlay-container')
                ?? document.body;

            overlayWrapper.appendChild(localCurrentTemplateElement);
            this.stack.push(localCurrentTemplateElement);

            const origin = this.focusableElement.getBoundingClientRect();
            const tmp = localCurrentTemplateElement.getBoundingClientRect();
            const windowBox = document.body.getBoundingClientRect();

            // dynamically calculate the position of the tooltip box
            const pos = this.calculatePosition(origin, tmp, windowBox);
            localCurrentTemplateElement.style.left = pos.x + 'px';
            localCurrentTemplateElement.style.top = pos.y + 'px';
            localCurrentTemplateElement.classList.add('position-' + pos.pos);

            // hide other possible active tooltip
            XcTooltipDirective.activeTooltip?.hide(0);
            // set this tooltip as the active one
            XcTooltipDirective.activeTooltip = this;

            if (this._impolite) {
                let tooltip = this.getCurrentTooltip();

                if (tooltip instanceof TemplateRef) {
                    tooltip = localCurrentTemplateElement.innerText;
                }

                if (isString(tooltip)) {
                    this.a11yService.screenreaderSpeak(tooltip, ScreenreaderPriority.Assertive);
                }

            }
        }
    }


    /* hide - in milliseconds */
    hide(animationLength = 300, delay = this._hideDelay) {

        // a show() of another XcTooltipDirective.activeTooltip (!= this) will call this hide()
        // and remove this protection
        this._mouseleaveProtection = false;

        window.removeEventListener('scroll', this.scrollEventListenerIfShowing, true);
        window.removeEventListener('keydown', this.keydownEventListenerIfShowing, true);

        const removeElementFromDOM = () => {
            if (this.currentTemplateElement) {
                if (this._isLabel) {
                    if (this._beforeAriaText) {
                        this.focusableElement.setAttribute('aria-labelledby', this._beforeAriaText);
                    } else {
                        this.focusableElement.removeAttribute('aria-labelledby');
                    }
                } else if (this._beforeAriaText) {
                    this.focusableElement.setAttribute('aria-describedby', this._beforeAriaText);
                } else {
                    this.focusableElement.removeAttribute('aria-describedby');
                }

                this.removeElementsFromStack();

            }
        };

        if (this.showing) {

            XcTooltipDirective.activeTooltip = null;

            if (animationLength > 0) {
                this.currentTemplateElement.style.animationName = 'tooltipFadeOut';
                this.currentTemplateElement.style.animationDuration = animationLength + 'ms';
                this.currentTemplateElement.style.animationDelay = delay + 'ms';
                this.currentTemplateElement.onanimationend = () => removeElementFromDOM();
                this.currentTemplateElement.onanimationcancel = () => removeElementFromDOM();

            } else {
                // if animationLength = 0 - the user wants to remove it directly
                // note: setTimeout(fn, 0) - removes the fn at the end of the script...
                // enough scripting time to override the static template and cause irregularities
                removeElementFromDOM();
            }
        }

    }


    private removeElementsFromStack() {
        this.stack.forEach(el => {
            el.parentElement.removeChild(el);
        });
        this.stack = [];
    }


    private readonly mouseenterFn = () => {
        this.show();
    };


    private readonly mouseleaveFn = () => {
        // a mouseleave only triggers the tooltip to hide if its targeted element is not protected
        if (!this._mouseleaveProtection) {
            this.hide();
        }
    };


    private readonly scrollEventListenerIfShowing = () => this.hide();

    private readonly keydownEventListenerIfShowing = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.code === 'Escape') {
            this.hide();
            e.stopPropagation();
            e.preventDefault();
        }
    };


    private getCurrentTooltip(): string | TemplateRef<any> {
        return this.controller.tooltip || this.tooltip || '';
    }


    private getTemplateElement(): HTMLElement {
        const container = document.createElement('div');

        // necessary for aria
        container.setAttribute('role', 'tooltip');
        container.setAttribute('id', this.tooltipId);
        container.setAttribute('aria-live', 'polite');

        // the zeta framework class
        container.classList.add(XcTooltipDirective.tooltipCSSClass);
        // extra classes
        this._extraTooltipClasses.forEach(clazz => container.classList.add(clazz));
        // set XcTooltipDirective global inline style
        if (XcTooltipDirective.tooltipInlineCSS) {
            container.setAttribute('style', XcTooltipDirective.tooltipInlineCSS);
        }

        const currentTooltip = this.getCurrentTooltip();

        if (isString(currentTooltip)) {
            const textNode = document.createTextNode(currentTooltip);
            container.appendChild(textNode);
        }

        if (currentTooltip instanceof TemplateRef) {
            this.ngZone.run(() => {
                const embeddedViewRef = this.viewContainerRef.createEmbeddedView(currentTooltip);
                embeddedViewRef.rootNodes.forEach(node => {
                    container.appendChild(node);
                });
            });
        }
        return container;
    }


    private calculatePosition(
        origin: ClientRect | DOMRect,
        tmp: ClientRect | DOMRect,
        win: ClientRect | DOMRect
    ): { x: number; y: number; pos: XcTooltipPosition } {

        let thisFits: { x: number; y: number; pos: XcTooltipPosition } = null;

        const allPositions = [...XcTooltipDirective.positionSequence];
        if (this.preferedPosition) {
            allPositions.splice(0, 0, ...this.preferedPosition);
        }

        // tests all positions in the sequence until one fits
        allPositions.some(pos => thisFits = this.fits(pos, origin, tmp, win));

        // if no position in the sequence fits and the first position is calculated again with the "must"-Flag
        return thisFits || this.fits(allPositions[0], origin, tmp, win, true);
    }


    /**
     * @param origin Rect of the focused element
     * @param tmp Rect of the template / tooltip box
     * @param win Rect of the document.body
     */
    private fits(
        position: XcTooltipPosition,
        origin: ClientRect | DOMRect,
        tmp: ClientRect | DOMRect,
        win: ClientRect | DOMRect,
        must = false
    ): { x: number; y: number; pos: XcTooltipPosition } {

        const pointInBox = (px: number, py: number, box: ClientRect | DOMRect) => px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;

        switch (position) {
            case XcTooltipPosition.bottom: {
                const x1 = origin.left + (origin.width / 2) - (tmp.width / 2);
                const y1 = origin.bottom + XcTooltipDirective.posOffsetY;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.top: {
                const x1 = origin.left + (origin.width / 2) - (tmp.width / 2);
                const y1 = origin.top - tmp.height - XcTooltipDirective.posOffsetY;
                // const x2 = x1 + tmp.width;
                // const y2 = y1 + tmp.height;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.left: {
                const x1 = origin.left - tmp.width - XcTooltipDirective.posOffsetX;
                const y1 = origin.top + (origin.height / 2) - (tmp.height / 2);
                // const x2 = x1 + tmp.width;
                // const y2 = y1 + tmp.height;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.right: {
                const x1 = origin.right + XcTooltipDirective.posOffsetX;
                const y1 = origin.top + (origin.height / 2) - (tmp.height / 2);
                // const x2 = x1 + tmp.width;
                // const y2 = y1 + tmp.height;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.bottomLeft: {
                const x1 = origin.left - tmp.width - XcTooltipDirective.posOffsetX;
                const y1 = origin.bottom + XcTooltipDirective.posOffsetY;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.bottomRight: {
                const x1 = origin.right + XcTooltipDirective.posOffsetX;
                const y1 = origin.bottom + XcTooltipDirective.posOffsetY;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.topLeft: {
                const x1 = origin.left - tmp.width - XcTooltipDirective.posOffsetX;
                const y1 = origin.top - tmp.height - XcTooltipDirective.posOffsetY;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            case XcTooltipPosition.topRight: {
                const x1 = origin.right + XcTooltipDirective.posOffsetX;
                const y1 = origin.top - tmp.height - XcTooltipDirective.posOffsetY;
                return (must || (pointInBox(x1, y1, win) && pointInBox(x1 + tmp.width, y1 + tmp.height, win)))
                    ? { x: x1, y: y1, pos: position } : null;
            }
            default: return null;
        }
    }
}
