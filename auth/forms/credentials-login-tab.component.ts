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
import { Component, inject, Injector } from '@angular/core';
import { I18nService, XcI18nTranslateDirective } from '@zeta/i18n';

import { XcTabComponent } from '../../xc';
import { XcFormInputComponent } from '../../xc/xc-form/xc-form-input/xc-form-input.component';
import { LoginComponentData } from '../login/auth-login.component';


@Component({
    selector: 'credentials-login-tab',
    templateUrl: './credentials-login.component.html',
    styleUrls: ['./credentials-login.component.scss'],
    imports: [XcFormInputComponent, XcI18nTranslateDirective]
})
export class CredentialsLoginTabComponent extends XcTabComponent<void, LoginComponentData> {
    readonly i18n = inject(I18nService);


    data: LoginComponentData = {
        username: '',
        password: '',
        onEnter: () => { },
        usernameTabIndex: 1,
        usernameSuffixTabIndex: 4,
        passwordTabIndex: 2,
        passwordSuffixTabIndex: 5,
    };

    constructor() {
        const injector = inject(Injector);

        super(injector);
        this.data = this.injectedData;
    }
}
