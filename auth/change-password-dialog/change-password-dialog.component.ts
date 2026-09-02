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
import { Component } from '@angular/core';

import { ApiService, RuntimeContext } from '@zeta/api';

import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { I18nService, LocaleService } from '../../i18n';
import { XcI18nContextDirective, XcI18nTranslateDirective } from '../../i18n/i18n.directive';
import { XcI18nPipe } from '../../i18n/i18n.pipe';
import { XcCustomValidatorFunction, XcDialogComponent } from '../../xc';
import { XcButtonComponent } from '../../xc/xc-button/xc-button.component';
import { XcDialogWrapperComponent } from '../../xc/xc-dialog/xc-dialog-wrapper.component';
import { XcFormValidatorCustomDirective, XcFormValidatorRequiredDirective } from '../../xc/xc-form/xc-form-base/xc-form-validators.directive';
import { XcFormDirective } from '../../xc/xc-form/xc-form-base/xc-form.directive';
import { XcFormInputComponent } from '../../xc/xc-form/xc-form-input/xc-form-input.component';
import { AuthService } from '../auth.service';
import { XoXynaProperty, XoXynaPropertyKey } from '../xo/xyna-property.model';
import { changePassword_translations_de_DE } from './locale/change-password-translations.de-DE';
import { changePassword_translations_en_US } from './locale/change-password-translations.en-US';


@Component({
    templateUrl: './change-password-dialog.component.html',
    styleUrls: ['./change-password-dialog.component.scss'],
    imports: [XcDialogWrapperComponent, XcI18nContextDirective, XcFormDirective, XcI18nTranslateDirective, XcFormInputComponent, XcFormValidatorRequiredDirective, XcFormValidatorCustomDirective, XcButtonComponent, XcI18nPipe]
})
export class ChangePasswordDialogComponent extends XcDialogComponent {

    private static readonly PROPERTY_DETAILS_ORDER = 'xmcp.factorymanager.xynaproperties.GetXynaPropertyDetails';
    private static readonly PASSWORD_POLICY_PROPERTY_KEY = 'xyna.xfmg.xopctrl.usermanagement.passwordrestrictions';

    policy = '';
    private readonly regExps: RegExp[] = [];

    oldPassword: string;
    newPassword: string;
    confirmPassword: string;

    error = null;

    readonly newPasswordValidator: XcCustomValidatorFunction = {
        onValidate: (value: string) =>
            this.regExps.filter(regExp => !regExp.test(value)).length === 0,
        errorText: ''
    };

    readonly confirmPasswordValidator: XcCustomValidatorFunction = {
        onValidate: (value: string) => value === this.newPassword,
        errorText: ''
    };


    constructor(
        readonly api: ApiService,
        private readonly i18n: I18nService,
        private readonly auth: AuthService
    ) {
        super();

        this.i18n.setTranslations(LocaleService.DE_DE, changePassword_translations_de_DE);
        this.i18n.setTranslations(LocaleService.EN_US, changePassword_translations_en_US);

        api.startOrderAssert<XoXynaProperty>(
            RuntimeContext.guiHttpApplication,
            ChangePasswordDialogComponent.PROPERTY_DETAILS_ORDER,
            XoXynaPropertyKey.withKey(ChangePasswordDialogComponent.PASSWORD_POLICY_PROPERTY_KEY),
            XoXynaProperty
        ).subscribe({
            next: property => this.policy = property.value,
            complete: () => {
                if (!this.policy) {
                    console.log(`Could not retrieve Xyna Property "${ChangePasswordDialogComponent.PASSWORD_POLICY_PROPERTY_KEY}". ` +
                    'Assuming no policy at all.');
                    this.policy = '.*';
                }

                // split policy by unescaped ';'
                const rules = [];
                let lastIndex = 0;
                for (let i = 1; i < this.policy.length; i++) {
                    if (this.policy[i] === ';' && this.policy[i - 1] !== '\\') {
                        rules.push(this.policy.substring(lastIndex, i));
                        lastIndex = i + 1;
                    }
                }

                // make a regex out of each rule
                rules.push(this.policy.substring(lastIndex));
                rules.map(rule => rule.trim()).filter(rule => rule.length > 0);
                rules.forEach(rule => this.regExps.push(new RegExp(rule)));
            }
        });

        this.newPasswordValidator.errorText = this.i18n.translate('dialog.changePassword.newPassword.error').toUpperCase();
        this.confirmPasswordValidator.errorText = this.i18n.translate('dialog.changePassword.confirmPassword.error').toUpperCase();
    }


    apply() {
        this.error = null;
        this.auth.changePassword(this.oldPassword, this.newPassword).pipe(
            catchError(error => {
                this.error = error;
                return throwError(error);
            })
        ).subscribe(
            () => this.dismiss()
        );
    }
}
