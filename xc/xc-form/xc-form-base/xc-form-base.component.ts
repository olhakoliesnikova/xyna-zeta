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
import { AfterContentInit, Component, ElementRef, EventEmitter, HostBinding, inject, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, ValidatorFn, Validators } from '@angular/forms';

import { Subscription } from 'rxjs';

import { coerceBoolean } from '../../../base';
import { I18nService, LocaleService } from '../../../i18n';
import { ATTRIBUTE_ARIALABEL, ATTRIBUTE_ICONTOOLTIP, ATTRIBUTE_LABEL, ATTRIBUTE_PLACEHOLDER, KeyTranslationPair } from '../../../xc/shared/xc-i18n-attributes';
import { xcFormTranslations_deDE } from '../locale/xc-translations.de-DE';
import { xcFormTranslations_enUS } from '../locale/xc-translations.en-US';


export enum FloatStyle {
    never = 'never',
    auto = 'auto',
    always = 'always'
}


@Component({ template: '' })
export class XcFormComponent implements AfterContentInit, OnDestroy {
    protected readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
    protected readonly i18n = inject(I18nService);


    protected _compact = false;
    protected _semiCompact = false;
    protected _label: KeyTranslationPair = { key: '', translated: '' };
    protected _iconTooltip: KeyTranslationPair = { key: '', translated: '' };
    protected _ariaLabel: KeyTranslationPair = { key: '', translated: '' };

    protected subs: Subscription[] = [];

    @Input('xc-form-field-floatlabel')
    floatLabel: FloatStyle = FloatStyle.always;

    i18nContext: string;


    @Input()
    set label(value: string) {
        this._label.key = value;
        this.translate(ATTRIBUTE_LABEL);
    }


    get label(): string {
        return this._label.translated;
    }


    @Input()
    set iconTooltip(value: string) {
        this._iconTooltip.key = value;
        this.translate(ATTRIBUTE_ICONTOOLTIP);
    }


    get iconTooltip(): string {
        return this._iconTooltip.translated;
    }


    @Input('xc-form-field-aria-label')
    set ariaLabel(value: string) {
        this._ariaLabel.key = value;
        this.translate(ATTRIBUTE_ARIALABEL);
    }


    get ariaLabel(): string {
        return this._ariaLabel.translated || this.label;
    }


    @HostBinding('class.compact')
    @Input({alias: 'xc-form-field-compact', transform: coerceBoolean})
    set compact(value: boolean) {
        this._compact = value;
    }


    get compact(): boolean {
        return this._compact;
    }


    @HostBinding('class.nolabel')
    protected get _xc_nolabel(): boolean {
        return !this.label || this.floatLabel === FloatStyle.never;
    }

    protected readonly localeService: LocaleService = inject<LocaleService>(LocaleService);


    ngOnDestroy(): void {
        this.subs.forEach(sub => sub.unsubscribe());
    }


    ngAfterContentInit() {
        this.i18nContext = this.element.nativeElement.getAttribute('xc-i18n');
        this.subs.push(this.localeService.languageChange.subscribe(() => {
            if (this._label.key) {
                this.translate(ATTRIBUTE_LABEL);
            }
            if (this._ariaLabel.key) {
                this.translate(ATTRIBUTE_ARIALABEL);
            }
            if (this._iconTooltip.key) {
                this.translate(ATTRIBUTE_ICONTOOLTIP);
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
}


export type XcFormErrorMessageCase = 'default' | 'uppercase' | 'lowercase' | 'capitalize';

function normalizeErrorMessageCase(value: XcFormErrorMessageCase | string): XcFormErrorMessageCase {
    const normalizedValue = (value ?? '').toString().trim().toLowerCase();
    return normalizedValue === 'uppercase' || normalizedValue === 'lowercase' || normalizedValue === 'capitalize' ? normalizedValue : 'default';
}

@Component({ template: '' })
export class XcFormBaseComponent extends XcFormComponent implements AfterContentInit {

    protected _indicateChanges = false;
    protected _readonly = false;
    protected _errorMessageCase: XcFormErrorMessageCase = 'default';
    protected _errorMessageCaseExplicitlySet = false;
    protected _placeholder: KeyTranslationPair = { key: '', translated: '' };

    readonly formControl = new FormControl();

    @Output()
    readonly valueChange = this.formControl.valueChanges;

    @Output()
    readonly valueKeydown = new EventEmitter<KeyboardEvent>();

    @Output()

    readonly focus = new EventEmitter<FocusEvent>();

    @Output()

    readonly blur = new EventEmitter<FocusEvent>();

    @Input('xc-form-field-errorfunc')
    errorFunc: (key: string, data: any) => string;


    @Input({alias: 'xc-form-field-error-message-case', transform: normalizeErrorMessageCase})
    set errorMessageCase(value: XcFormErrorMessageCase) {
        this._errorMessageCaseExplicitlySet = true;
        this._errorMessageCase = value;
    }


    get errorMessageCase(): XcFormErrorMessageCase {
        return this._errorMessageCase;
    }


    @Input('xc-form-field-callback')
    set callback(callback: (component: this) => void) {
        callback?.(this);
    }


    @HostBinding('class.indicatechanges')
    @Input({alias: 'xc-form-field-indicatechanges', transform: coerceBoolean})
    set indicateChanges(value: boolean) {
        this._indicateChanges = value;
    }


    get indicateChanges(): boolean {
        return this._indicateChanges;
    }


    @HostBinding('class.noerror')
    protected get _xc_noerror(): boolean {
        return !this.errorVisible;
    }


    @Input()
    set value(value: any) {
        this.formControl.setValue(value);
    }


    get value(): any {
        return this.formControl.value;
    }


    @Input({transform: coerceBoolean})
    set disabled(value: boolean) {
        if (value) {
            this.formControl.disable({ emitEvent: false });
        } else {
            this.formControl.enable({ emitEvent: false });
        }
    }


    get disabled(): boolean {
        return this.formControl.disabled;
    }


    @Input({transform: coerceBoolean})
    set readonly(value: boolean) {
        this._readonly = value;
    }


    get readonly(): boolean {
        return this._readonly;
    }


    @Input()
    set placeholder(value: string) {
        this._placeholder.key = value;
        this.translate(ATTRIBUTE_PLACEHOLDER);
    }


    get placeholder(): string {
        // space needed for style "align-items: baseline;" in class ".items-row" for proper alignment when text is missing
        return this._placeholder.translated || ' ';
    }


    get errorVisible(): boolean {
        return this.formControl.errors !== null && this.formControl.touched && !this.readonly;
    }


    get errorContent(): string {
        const errorFunc = (key: string, data: any): string => {
            switch (key) {
                case 'email': return this.i18n.translate('zeta.xc-form-base.email');
                case 'max': return this.i18n.translate('zeta.xc-form-base.max') + data.max;
                case 'min': return this.i18n.translate('zeta.xc-form-base.min') + data.min;
                case 'maxlength': return this.i18n.translate('zeta.xc-form-base.maxlength') + data.requiredLength;
                case 'minlength': return this.i18n.translate('zeta.xc-form-base.minlength') + data.requiredLength;
                case 'number': return this.i18n.translate('zeta.xc-form-base.number', { key: '$0', value: (<string>data.format.toString()).toUpperCase() });
                case 'required': return this.i18n.translate('zeta.xc-form-base.required');
                case 'pattern': return this.i18n.translate('zeta.xc-form-base.pattern') + data.requiredPattern;
                case 'ipv4': return this.i18n.translate('zeta.xc-form-base.ipv4');
                case 'ipv6': return this.i18n.translate('zeta.xc-form-base.ipv6');
                case 'ip': return this.i18n.translate('zeta.xc-form-base.ip');
                case 'message': return data.message || this.i18n.translate('zeta.xc-form-base.message');
                default: return key;
            }
        };
        return Object.keys(this.formControl.errors).map(
            key => {
                const data = this.formControl.errors[key];
                const error = this.errorFunc ? this.errorFunc(key, data) : null;
                const message = error || errorFunc(key, data);
                return this.transformErrorMessageCase(message);
            }
        ).join(', ');
    }

    @Input('xc-form-field-tab-index')
    tabIndex?: number = 0;

    constructor() {
        super();

        this.i18n.setTranslations(LocaleService.EN_US, xcFormTranslations_enUS);
        this.i18n.setTranslations(LocaleService.DE_DE, xcFormTranslations_deDE);
    }


    ngAfterContentInit() {
        super.ngAfterContentInit();
        this.applyInheritedErrorMessageCase();

        this.subs.push(this.localeService.languageChange.subscribe(() => {
            if (this._placeholder.key) {
                this.translate(ATTRIBUTE_PLACEHOLDER);
            }
        }));
    }


    onkeydown(event: KeyboardEvent) {
        this.valueKeydown.emit(event);
        // stop bubbling up if someone presses the "Delete"-Key
        if (event.key === 'Delete' || event.code === 'Delete') {
            event.stopPropagation();
        }
    }


    addValidator(validator: ValidatorFn) {
        const composedValidators = Validators.compose([this.formControl.validator, validator]);
        this.formControl.setValidators(composedValidators);
    }


    protected transformErrorMessageCase(message: string): string {
        if (!message) {
            return message;
        }

        switch (this.errorMessageCase) {
            case 'uppercase':
                return message.toUpperCase();
            case 'lowercase':
                return message.toLowerCase();
            case 'capitalize':
                return message
                    .toLowerCase()
                    .replace(/\b\p{L}/gu, (char: string) => char.toUpperCase());
            default:
                return message;
        }
    }


    protected applyInheritedErrorMessageCase(): void {
        if (this._errorMessageCaseExplicitlySet) {
            return;
        }
        const inheritedErrorMessageCase = this.element.nativeElement.closest('[xc-form-field-error-message-case]')
            ?.getAttribute('xc-form-field-error-message-case');
        this._errorMessageCase = normalizeErrorMessageCase(inheritedErrorMessageCase);
    }
}
