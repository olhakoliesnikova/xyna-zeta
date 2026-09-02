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
import { ChangeDetectorRef, Component, HostBinding, HostListener, Injector, Input, inject } from '@angular/core';

import { Subscription } from 'rxjs';

import { coerceBoolean, templateClassType } from '../../base';
import { XcDataWrapper } from '../shared/xc-data-wrapper';
import { XcButtonTemplate, XcCheckboxTemplate, XcComponentTemplate, XcDataTemplate, XcDefinitionListEntryTemplate, XcFormAutocompleteTemplate, XcFormInputTemplate, XcFormTextAreaTemplate, XcFormTextTemplate, XcIconButtonTemplate, XcTemplate } from '../xc-template/xc-template';
import { XcFormTextComponent } from '../xc-form/xc-form-text/xc-form-text.component';
import { XcTooltipDirective } from '../xc-tooltip/xc-tooltip.directive';
import { XcDefinitionListEntryComponent } from '../xc-form/definitions/containers/xc-definition-list-definition/xc-definition-list-entry/xc-definition-list-entry.component';
import { XcUnwrapDirective } from '../shared/xc-unwrap.directive';
import { XcFormAutocompleteComponent } from '../xc-form/xc-form-autocomplete/xc-form-autocomplete.component';
import { XcFormValidatorsDirective, XcFormValidatorRequiredDirective } from '../xc-form/xc-form-base/xc-form-validators.directive';
import { XcFormInputComponent } from '../xc-form/xc-form-input/xc-form-input.component';
import { XcFormTextareaComponent } from '../xc-form/xc-form-textarea/xc-form-textarea.component';
import { XcCheckboxComponent } from '../xc-checkbox/xc-checkbox.component';
import { XcButtonComponent } from '../xc-button/xc-button.component';
import { XcIconComponent } from '../xc-icon/xc-icon.component';
import { XcIconButtonComponent } from '../xc-button/xc-icon-button.component';
import { NgComponentOutlet } from '@angular/common';


@Component({
    selector: 'xc-template',
    templateUrl: './xc-template.component.html',
    styleUrls: ['./xc-template.component.scss'],
    imports: [XcFormTextComponent, XcTooltipDirective, XcDefinitionListEntryComponent, XcUnwrapDirective, XcFormAutocompleteComponent, XcFormValidatorsDirective, XcFormValidatorRequiredDirective, XcFormInputComponent, XcFormTextareaComponent, XcCheckboxComponent, XcButtonComponent, XcIconComponent, XcIconButtonComponent, NgComponentOutlet]
})
export class XcTemplateComponent {
    injector = inject(Injector);
    private readonly cdRef = inject(ChangeDetectorRef);


    readonly Type = {
        XcTemplate: templateClassType(XcTemplate),
        XcFormTextTemplate: templateClassType(XcFormTextTemplate),
        XcDefinitionListEntryTemplate: templateClassType(XcDefinitionListEntryTemplate),
        XcFormAutocompleteTemplate: templateClassType(XcFormAutocompleteTemplate),
        XcFormInputTemplate: templateClassType(XcFormInputTemplate),
        XcFormTextAreaTemplate: templateClassType(XcFormTextAreaTemplate),
        XcCheckboxTemplate: templateClassType(XcCheckboxTemplate),
        XcButtonTemplate: templateClassType(XcButtonTemplate),
        XcIconButtonTemplate: templateClassType(XcIconButtonTemplate),
        XcComponentTemplate: templateClassType(XcComponentTemplate)
    };

    private _instance: XcTemplate | unknown;
    private _readonly = false;
    private _disabled = false;
    private _markForCheckSubscription: Subscription;

    @Input('xc-template-aria-label')
    ariaLabel = '';


    @Input('xc-template-instance')
    set instance(value: XcTemplate | unknown) {
        if (this._markForCheckSubscription) {
            this._markForCheckSubscription.unsubscribe();
        }

        this._instance = value;

        if (this._instance instanceof XcTemplate) {
            this._markForCheckSubscription = this._instance.markedForCheck.subscribe(() =>
                this.cdRef.markForCheck()
            );
        }
    }


    get instance(): XcTemplate | unknown {
        return this._instance;
    }


    @Input({alias: 'xc-template-readonly', transform: coerceBoolean})
    set readonly(value: boolean) {
        this._readonly = value;
    }

    get readonly(): boolean {
        return this._readonly;
    }


    @Input({alias: 'xc-template-disabled', transform: coerceBoolean})
    set disabled(value: boolean) {
        this._disabled = value;
    }


    get disabled(): boolean {
        return this._disabled;
    }


    get stringValue(): string {
        if (this.instance instanceof XcDataTemplate) {
            return '' + (this.instance.dataWrapper as XcDataWrapper<any, any>).value;
        }
        return '{null}';
    }


    @HostBinding('class.non-template')
    get nonTemplate(): boolean {
        return !(this.instance instanceof XcTemplate);
    }


    @HostListener('click', ['$event'])
    templateClick(event: Event) {
        if (this.instance instanceof XcTemplate && !(this.instance instanceof XcComponentTemplate)) {
            event.stopPropagation();
        }
    }
}
