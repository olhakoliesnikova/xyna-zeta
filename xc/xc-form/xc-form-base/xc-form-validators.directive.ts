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
import { Directive, forwardRef, HostBinding, Input } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { coerceBoolean } from '../../../base';
import { XcFormValidatorBaseDirective } from './xc-form-validator-base.directive';


/**
 * @see https://github.com/angular/angular/blob/master/packages/forms/src/validators.ts
 */
function isEmptyInputValue(value: any): boolean {
    return value == null || value.length === 0;
}


@Directive({
    selector: '[xc-form-validators]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorsDirective) }]
})
export class XcFormValidatorsDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return this.validators;
    }

    @Input('xc-form-validators')
    validators: ValidatorFn[];
}


export const XcFormValidatorEmail = (): ValidatorFn => Validators.email;


@Directive({
    selector: '[xc-form-validator-email]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorEmailDirective) }]
})
export class XcFormValidatorEmailDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorEmail()];
    }
}


export const XcFormValidatorMaxValue = (maxValue: number): ValidatorFn => Validators.max(maxValue);


@Directive({
    selector: '[xc-form-validator-maxvalue]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorMaxValueDirective) }]
})
export class XcFormValidatorMaxValueDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorMaxValue(this.maxValue)];
    }

    @Input('xc-form-validator-maxvalue')
    maxValue: number;
}


export const XcFormValidatorMinValue = (minValue: number): ValidatorFn => Validators.min(minValue);


@Directive({
    selector: '[xc-form-validator-minvalue]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorMinValueDirective) }]
})
export class XcFormValidatorMinValueDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorMinValue(this.minValue)];
    }

    @Input('xc-form-validator-minvalue')
    minValue: number;
}


export const XcFormValidatorMaxLength = (maxLength: number): ValidatorFn => Validators.maxLength(maxLength);


@Directive({
    selector: '[xc-form-validator-maxlength]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorMaxLengthDirective) }]
})
export class XcFormValidatorMaxLengthDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorMaxLength(this.maxLength)];
    }

    @Input('xc-form-validator-maxlength')
    maxLength: number;
}


export const XcFormValidatorMinLength = (minLength: number): ValidatorFn => Validators.minLength(minLength);


@Directive({
    selector: '[xc-form-validator-minlength]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorMinLengthDirective) }]
})
export class XcFormValidatorMinLengthDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorMinLength(this.minLength)];
    }

    @Input('xc-form-validator-minlength')
    minLength: number;
}


export const XcFormValidatorNumber = (format = 'decimal'): ValidatorFn => {
    const regExp = {
        hexadecimal: /^0x[a-fA-F0-9]+$/,
        decimal: /^(?:0|-?[1-9]\d*)$/,
        binary: /^0b[01]+$/,
        float: /^[+-]?\d+(\.\d+)?$/
    };
    return (control: AbstractControl): ValidationErrors | null => {
        if (isEmptyInputValue(control.value)) {
            return null;
        }
        return !(regExp[format].test(control.value))
            ? {'number': {'format': format, 'actualValue': control.value}}
            : null;
    };
};


@Directive({
    selector: '[xc-form-validator-number]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorNumberDirective) }]
})
export class XcFormValidatorNumberDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorNumber(this.number || undefined)];
    }

    @Input('xc-form-validator-number')
    number: 'hexadecimal' | 'decimal' | 'binary' | 'float';
}


export const XcFormValidatorRequired = (): ValidatorFn => Validators.required;


@Directive({
    selector: '[xc-form-validator-required]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorRequiredDirective) }]
})
export class XcFormValidatorRequiredDirective extends XcFormValidatorBaseDirective {
    private _required: boolean;

    getValidatorFns(): ValidatorFn[] {
        return coerceBoolean(this.required) ? [XcFormValidatorRequired()] : [];
    }

    @Input({alias: 'xc-form-validator-required', transform: coerceBoolean})
    @HostBinding('attr.xc-form-validator-required')
    set required(value: boolean) {
        this._required = value;
    }

    get required(): boolean {
        return this._required;
    }
}


export const XcFormValidatorPattern = (pattern: string | RegExp): ValidatorFn => Validators.pattern(pattern);


@Directive({
    selector: '[xc-form-validator-pattern]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorPatternDirective) }]
})
export class XcFormValidatorPatternDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorPattern(this.pattern)];
    }

    @Input('xc-form-validator-pattern')
    pattern: string | RegExp;
}


export const XcFormValidatorIPv4 = (): ValidatorFn => {
    const re = /^(?:(?:2[0-4]\d|25[0-5]|1\d\d|\d\d?)\.){3}(?:2[0-4]\d|25[0-5]|1\d\d|\d\d?)$/;
    return Validators.pattern(re);
};


@Directive({
    selector: '[xc-form-validator-ipv4]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorIpv4Directive) }]
})
export class XcFormValidatorIpv4Directive extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [(control: AbstractControl): ValidationErrors | null => XcFormValidatorIPv4()(control)
            ? <ValidationErrors>{'ipv4': {value: control.value}}
            : null];
    }
}


export const XcFormValidatorIPv6 = (): ValidatorFn => {
    // see https://www.regexpal.com/93988
    const re = /^((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:)))(%.+)?s*(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/;
    return Validators.pattern(re);
};


@Directive({
    selector: '[xc-form-validator-ipv6]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorIpv6Directive) }]
})
export class XcFormValidatorIpv6Directive extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [(control: AbstractControl): ValidationErrors | null => XcFormValidatorIPv6()(control)
            ? <ValidationErrors>{'ipv4': {value: control.value}}
            : null];
    }
}


@Directive({
    selector: '[xc-form-validator-ip]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorIpDirective) }]
})
export class XcFormValidatorIpDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [(control: AbstractControl): ValidationErrors | null => !!XcFormValidatorIPv4()(control) && !!XcFormValidatorIPv6()(control)
            ? <ValidationErrors>{'ip': {value: control.value}}
            : null];
    }
}


export interface XcCustomValidatorFunction {
    onValidate: (value: any, args: any[]) => boolean;
    errorText: string;
}


export const XcFormValidatorCustom = (valFunction: XcCustomValidatorFunction, args?: any[]): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
    const str = valFunction.errorText;
    let result = null;
    if (!(valFunction.onValidate(control.value, args))) {
        result = {};
        result[str] = {'actualValue': control.value};
    }
    return result;
};


@Directive({
    selector: '[xc-form-validator-custom]',
    providers: [{ provide: XcFormValidatorBaseDirective, useExisting: forwardRef(() => XcFormValidatorCustomDirective) }]
})
export class XcFormValidatorCustomDirective extends XcFormValidatorBaseDirective {
    getValidatorFns(): ValidatorFn[] {
        return [XcFormValidatorCustom(this.validatorFunction, this.args)];
    }

    @Input('xc-form-validator-custom')
    validatorFunction: XcCustomValidatorFunction;

    @Input('xc-form-validator-custom-arguments')
    args: any[];
}
