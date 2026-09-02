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
import { Component, Input } from '@angular/core';

import { LoginComponentData } from '../login/auth-login.component';
import { XcFormInputComponent } from '../../xc/xc-form/xc-form-input/xc-form-input.component';
import { XcFormAutocompleteComponent } from '../../xc/xc-form/xc-form-autocomplete/xc-form-autocomplete.component';
import { XcI18nTranslateDirective } from '../../i18n/i18n.directive';


@Component({
    selector: 'smart-card-login',
    templateUrl: './smart-card-login.component.html',
    styleUrls: ['./smart-card-login.component.scss'],
    imports: [XcFormInputComponent, XcFormAutocompleteComponent, XcI18nTranslateDirective]
})
export class SmartCardLoginComponent {

    @Input()
    data: LoginComponentData;

}
