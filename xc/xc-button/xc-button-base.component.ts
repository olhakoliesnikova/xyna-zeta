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
import { AfterContentInit, Component, ElementRef, HostBinding, HostListener, inject, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatRipple } from '@angular/material/core';

import { Subscription } from 'rxjs';

import { coerceBoolean } from '../../base';
import { I18nService, LocaleService } from '../../i18n';
import { ATTRIBUTE_ARIALABEL, KeyTranslationPair } from '../shared/xc-i18n-attributes';
import { XcThemeableComponent } from '../shared/xc-themeable.component';


@Component({
    template: ''
})
export class XcButtonBaseComponent extends XcThemeableComponent implements OnInit, AfterContentInit, OnDestroy {
    protected elementRef = inject(ElementRef);
    protected readonly i18n = inject(I18nService);


    protected _ariaLabel: KeyTranslationPair = { key: '', translated: '' };
    protected _tabDisabled = false;
    protected _disabled = false;
    protected _busy = false;
    protected _focusInitial = false;

    protected subs: Subscription[] = [];

    @Input()
    type = 'button';

    @ViewChild('button', { read: ElementRef, static: false })
    buttonElementRef: ElementRef;

    /** material design ripple directive of the button */
    @ViewChild(MatRipple, { static: false })
    ripple: MatRipple;


    i18nContext: string;

    protected readonly localeService: LocaleService = inject<LocaleService>(LocaleService);

    constructor() {
        super();
        const elementRef = this.elementRef;

        (elementRef.nativeElement as HTMLElement).onclick = (event: MouseEvent) => {
            // prevent clicks outside of button dom element
            if (!this.buttonElementRef.nativeElement.contains(event.target)) {
                event.stopPropagation();
            }
        };
    }


    protected setAriaLabel(value: string) {
        this._ariaLabel.key = value;
    }


    ngOnInit() {
        // initially, the setter has to be triggered to get a default value for ariaLabel
        this.setAriaLabel(this.ariaLabel);
    }


    ngOnDestroy(): void {
        this.subs.forEach(sub => sub.unsubscribe());
    }


    ngAfterContentInit() {
        this.i18nContext = this.elementRef.nativeElement.getAttribute('xc-i18n');
        this.subs.push(this.localeService.languageChange.subscribe(() => {
            if (this._ariaLabel.key) {
                this.translate(ATTRIBUTE_ARIALABEL);
            }
        }));
    }


    protected translate(attribute: string) {
        if (this.i18nContext !== undefined && this.i18nContext !== null && this[attribute]["key"]) {
            this[attribute]["translated"] = this.i18n.translate(this.i18nContext ? this.i18nContext + '.' + this[attribute]["key"] : this[attribute]["key"]);
        } else {
            this[attribute]["translated"] = this[attribute]["key"];
        }
    }


    @Input({transform: coerceBoolean})
    set tabDisabled(value: boolean) {
        this._tabDisabled = value;
    }


    get tabDisabled(): boolean {
        return this._tabDisabled;
    }


    @HostBinding('class.disabled')
    @Input({transform: coerceBoolean})
    set disabled(value: boolean) {
        this._disabled = value;
    }


    get disabled(): boolean {
        return this._disabled;
    }


    @HostBinding('class.busy')
    @Input({transform: coerceBoolean})
    set busy(value: boolean) {
        this._busy = value;
    }


    get busy(): boolean {
        return this._busy;
    }


    get focusInitial(): boolean {
        return this._focusInitial;
    }


    @Input({alias: 'xc-focus-initial', transform: coerceBoolean})
    set focusInitial(value: boolean) {
        this._focusInitial = value;
    }


    @Input('xc-button-aria-label')
    set ariaLabel(value: string) {
        this.setAriaLabel(value);
        this.translate(ATTRIBUTE_ARIALABEL);
    }


    get ariaLabel(): string {
        return this._ariaLabel.translated;
    }

    @Input('xc-button-tab-index')
    tabIndex?: number = 0;


    @HostListener('keydown.enter')
    @HostListener('keydown.space')
    launchRipple() {
        this.ripple.launch(0, 0, { centered: true });
    }


    @HostListener('mousedown', ['$event'])
    @HostListener('click', ['$event'])
    prevent(event: Event) {
        // prevents table selection when user clicks on an actionElement (XcIconButton)
        event.stopPropagation();
    }
}
