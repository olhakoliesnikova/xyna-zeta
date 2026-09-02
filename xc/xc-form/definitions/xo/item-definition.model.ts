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
import { ValidatorFn } from '@angular/forms';

import { isArray } from '../../../../base';
import { combineLatest, Observable, of } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';

import { Xo, XoArray, XoArrayClass, XoObjectClass, XoProperty } from '../../../../api';
import { XoXPRCRuntimeContext } from '../../../../api/xo/runtime-context.model';
import { XcIdentityDataWrapper } from '../../../shared/xc-data-wrapper';
import { XcOptionItem } from '../../../shared/xc-item';
import { XcButtonTemplate, XcButtonBaseTemplate, XcCheckboxTemplate, XcFormAutocompleteTemplate, XcFormInputTemplate, XcFormTextAreaTemplate, XcTemplate, XcDefinitionListEntryTemplate, XcFormTextTemplate } from '../../../xc-template/xc-template';
import { XcAutocompleteDataWrapper } from '../../xc-form-autocomplete/xc-form-autocomplete.component';
import { XoBaseDefinition, XoDefinition, XoDefinitionObserver, XoDefinitionWorkflow } from './base-definition.model';
import { XcDefinitionEventService, XoDefinitionEventArray } from '../xc-definition-event.service';


/***********************************************
 * ITEM
 **********************************************/

@XoObjectClass(XoBaseDefinition, 'xmcp.forms.datatypes', 'ItemDefinition')
export class XoItemDefinition extends XoBaseDefinition {
}


@XoArrayClass(XoItemDefinition)
export class XoItemDefinitionArray extends XoArray<XoItemDefinition> {
}



/***********************************************
 * TEXT ITEM
 **********************************************/

@XoObjectClass(XoItemDefinition, 'xmcp.forms.datatypes', 'TextItemDefinition')
export class XoTextItemDefinition extends XoItemDefinition {

    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcFormTextTemplate(new XcIdentityDataWrapper<string>(
                () => this.resolveData(data).join(', '),
                () => {}
            ));
            template.compact = true;
            template.stylename = this.style;
            return this.translate(this.label).pipe(map(translated => {
                template.label = translated;
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoTextItemDefinition)
export class XoTextItemDefinitionArray extends XoArray<XoTextItemDefinition> {
}



/***********************************************
 * DEFINITION LIST ENTRY
 **********************************************/

@XoObjectClass(XoItemDefinition, 'xmcp.forms.datatypes', 'DefinitionListEntryDefinition')
export class XoDefinitionListEntryDefinition extends XoItemDefinition {

    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcDefinitionListEntryTemplate('', this.resolveData(data).join(', '));
            template.stylename = this.style;
            return this.translate(this.label).pipe(map(translated => {
                template.label = translated;
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoDefinitionListEntryDefinition)
export class XoDefinitionListEntryDefinitionArray extends XoArray<XoDefinitionListEntryDefinition> {
}



/***********************************************
 * INPUT
 **********************************************/

@XoObjectClass(XoItemDefinition, 'xmcp.forms.datatypes', 'InputDefinition')
export class XoInputDefinition extends XoItemDefinition {

    @XoProperty()
    placeholder = '';

    @XoProperty()
    validatorClass = '';    // comma-separated for multiple validators

    private validators: ValidatorFn[] = [];


    setObserver(value: XoDefinitionObserver) {
        super.setObserver(value);

        if (this.observer && this.observer.getValidator) {
            const validatorNames = this.validatorClass.split(',');
            this.validators = validatorNames.map(validatorName => this.observer.getValidator(validatorName));
        }
    }


    /**
     * @inheritdoc
     */
    getValidators(): ValidatorFn[] {
        return this.validators;
    }
}


@XoArrayClass(XoInputDefinition)
export class XoInputDefinitionArray extends XoArray<XoInputDefinition> {
}



/***********************************************
 * TEXT INPUT
 **********************************************/

@XoObjectClass(XoInputDefinition, 'xmcp.forms.datatypes', 'TextInputDefinition')
export class XoTextInputDefinition extends XoInputDefinition {

    @XoProperty()
    isPassword = false;

    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcFormInputTemplate(new XcIdentityDataWrapper<string>(
                () => this.resolveData(data).join(', '),
                value => this.resolveAssignData(data, value)
            ));
            template.disabled = this.disabled;
            template.compact = true;
            template.stylename = this.style;
            if (this.isPassword) {
                template.type = 'password';
                template.suffix = 'password';
            }
            const validators = this.getValidators();
            if (validators.length > 0) {
                template.validators = validators;
            }
            return combineLatest([this.translate(this.label), this.translate(this.placeholder)]).pipe(map(translated => {
                template.label = translated[0];
                template.placeholder = translated[1];
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoTextInputDefinition)
export class XoTextInputDefinitionArray extends XoArray<XoTextInputDefinition> {
}



/***********************************************
 * DROPDOWN
 **********************************************/

@XoObjectClass(XoDefinition, 'xmcp.forms.datatypes', 'PossibleValuesDefinition')
export class XoPossibleValuesDefinition extends XoDefinition {

    @XoProperty()
    listItemLabelPath = '';

    @XoProperty()
    listItemValuePath = '';

    getOptionItems(data: Xo[]): XcOptionItem[] {
        // resolve list of objects which serve as root for the dropdown-option-items
        let rawOptionsList: XoArray = this.resolveDataForFirstPath(data);
        if (!rawOptionsList || !isArray(rawOptionsList.data)) {
            rawOptionsList = new XoArray();
            console.warn('No possible values defined for DropDown. DataPath of PossibleValuesDefinition: ' + this.dataPath);
        }

        return rawOptionsList.data.map(item => <XcOptionItem>{name: item.resolve(this.listItemLabelPath), value: item.resolve(this.listItemValuePath)});
    }
}


@XoObjectClass(XoInputDefinition, 'xmcp.forms.datatypes', 'DropdownDefinition')
export class XoDropdownDefinition extends XoInputDefinition {

    @XoProperty(XoPossibleValuesDefinition)
    possibleValues: XoPossibleValuesDefinition;


    protected afterDecode() {
        super.afterDecode();

        if (!this.possibleValues) {
            this.possibleValues = new XoPossibleValuesDefinition();
        }
        this.possibleValues.setParent(this);
    }


    setObserver(value: XoDefinitionObserver) {
        super.setObserver(value);
        this.possibleValues.setObserver(value);
    }


    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcFormAutocompleteTemplate(new XcAutocompleteDataWrapper(
                () => this.resolveDataForFirstPath(data),
                value => this.resolveAssignData(data, value),
                this.possibleValues.getOptionItems(data)
            ));
            template.disabled = this.disabled;
            template.compact = true;
            template.asDropdown = true;
            template.stylename = this.style;
            return combineLatest([this.translate(this.label), this.translate(this.placeholder)]).pipe(map(translated => {
                template.label = translated[0];
                template.placeholder = translated[1];
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoDropdownDefinition)
export class XoDropdownDefinitionArray extends XoArray<XoDropdownDefinition> {
}



/***********************************************
 * TEXT AREA
 **********************************************/

@XoObjectClass(XoInputDefinition, 'xmcp.forms.datatypes', 'TextAreaDefinition')
export class XoTextAreaDefinition extends XoInputDefinition {

    @XoProperty()
    numberOfLines: number;

    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcFormTextAreaTemplate(new XcIdentityDataWrapper<string>(
                () => this.resolveData(data).join(', '),
                value => this.resolveAssignData(data, value)
            ));
            template.disabled = this.disabled;
            template.lines = this.numberOfLines || 4;
            template.compact = true;
            template.stylename = this.style;
            const validators = this.getValidators();
            if (validators.length > 0) {
                template.validators = validators;
            }
            return combineLatest([this.translate(this.label), this.translate(this.placeholder)]).pipe(map(translated => {
                template.label = translated[0];
                template.placeholder = translated[1];
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoTextAreaDefinition)
export class XoTextAreaDefinitionArray extends XoArray<XoTextAreaDefinition> {
}



/***********************************************
 * CHECKBOX
 **********************************************/

@XoObjectClass(XoInputDefinition, 'xmcp.forms.datatypes', 'CheckboxDefinition')
export class XoCheckboxDefinition extends XoInputDefinition {

    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcCheckboxTemplate(new XcIdentityDataWrapper<boolean>(
                () => this.resolveDataForFirstPath(data),       // multiple data paths make no sense here
                value => this.resolveAssignData(data, value)
            ));
            template.disabled = this.disabled;
            template.stylename = this.style;
            return this.translate(this.label).pipe(map(translated => {
                template.label = translated;
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoCheckboxDefinition)
export class XoCheckboxDefinitionArray extends XoArray<XoCheckboxDefinition> {
}



/***********************************************
 * BUTTON
 **********************************************/

@XoObjectClass(XoItemDefinition, 'xmcp.forms.datatypes', 'ButtonDefinition')
export class XoButtonDefinition extends XoItemDefinition {

    getTemplate(data: Xo[]): Observable<XcButtonBaseTemplate> {
        if (!this.isHiddenFor(data)) {
            const template = new XcButtonTemplate();
            template.disabled = this.disabled;
            template.stylename = this.style;
            return this.translate(this.label).pipe(map(translated => {
                template.label = translated;
                return template;
            }));
        }
        return of(null);
    }
}


@XoArrayClass(XoButtonDefinition)
export class XoButtonDefinitionArray extends XoArray<XoButtonDefinition> {
}



/***********************************************
 * OPEN DETAILS-BUTTON
 **********************************************/

@XoObjectClass(XoButtonDefinition, 'xmcp.forms.datatypes', 'OpenDetailsButtonDefinition')
export class XoOpenDetailsButtonDefinition extends XoButtonDefinition {

    @XoProperty(XoDefinition)
    detailsDefinitionReference: XoDefinition;


    setParent(parent: XoBaseDefinition) {
        // Only set parent to detailsDefinitionReference, if it is a true reference to a definition and not a definition itself
        // Because the definition opened with Open-Details-Button starts a new data-path-hierarchy
        if (this.detailsDefinitionReference instanceof XoDefinitionWorkflow) {
            this.detailsDefinitionReference.setParent(parent);
        }
    }


    setObserver(value: XoDefinitionObserver) {
        super.setObserver(value);
        if (this.detailsDefinitionReference) {
            this.detailsDefinitionReference.setObserver(value);
        }
    }


    getTemplate(data: Xo[]): Observable<XcButtonTemplate> {
        return super.getTemplate(data).pipe(tap((template: XcButtonBaseTemplate) => {
            if (template) {
                template.action = () => {
                    /* Use passed definition or call detail-definition-workflow with resolved data of this button
                     * The output is a new definition and maybe data.
                     * This is passed to the definition observer to open the new definition
                     */
                    if (this.detailsDefinitionReference) {
                        const resolvedData = this.resolveData(data);
                        this.detailsDefinitionReference.resolveDefinition(resolvedData).subscribe({
                            next: definitionBundle => {
                                // open the resolved definition
                                if (this.observer && this.observer.openDefinition && definitionBundle.definition instanceof XoBaseDefinition) {
                                    this.observer.openDefinition(definitionBundle.definition, definitionBundle.data).subscribe();
                                }
                            }
                        });
                    }
                };
            }
        }));
    }
}


@XoArrayClass(XoOpenDetailsButtonDefinition)
export class XoOpenDetailsButtonDefinitionArray extends XoArray<XoOpenDetailsButtonDefinition> {
}



/***********************************************
 * OPEN DIALOG-BUTTON
 **********************************************/

@XoObjectClass(XoButtonDefinition, 'xmcp.forms.datatypes', 'OpenDialogButtonDefinition')
export class XoOpenDialogButtonDefinition extends XoButtonDefinition {

    @XoProperty(XoDefinition)
    dialogDefinitionReference: XoDefinition;


    setParent(parent: XoBaseDefinition) {
        // Only set parent to dialogDefinitionReference, if it is a true reference to a definition and not a definition itself
        // Because the definition opened with Open-Dialog-Button starts a new data-path-hierarchy
        if (this.dialogDefinitionReference instanceof XoDefinitionWorkflow) {
            this.dialogDefinitionReference.setParent(parent);
        }
    }


    setObserver(value: XoDefinitionObserver) {
        super.setObserver(value);
        if (this.dialogDefinitionReference) {
            this.dialogDefinitionReference.setObserver(value);
        }
    }


    getTemplate(data: Xo[]): Observable<XcButtonTemplate> {
        return super.getTemplate(data).pipe(tap((template: XcButtonBaseTemplate) => {
            if (template) {
                template.action = () => {
                    /* Use passed definition or call detail-definition-workflow with resolved data of this button
                     * The output is a new definition and maybe data.
                     * This is passed to the definition observer to open the new definition
                     */
                    if (this.dialogDefinitionReference) {
                        const resolvedData = this.resolveData(data);
                        this.dialogDefinitionReference.resolveDefinition(resolvedData).subscribe({
                            next: definitionBundle => {
                                // open the resolved definition
                                if (this.observer && this.observer.openDialog && definitionBundle.definition instanceof XoBaseDefinition) {
                                    this.observer.openDialog(definitionBundle.definition, definitionBundle.data).subscribe();
                                }
                            }
                        });
                    }
                };
            }
        }));
    }
}


@XoArrayClass(XoOpenDialogButtonDefinition)
export class XoOpenDialogButtonDefinitionArray extends XoArray<XoOpenDialogButtonDefinition> {
}



/***********************************************
 * START ORDER-BUTTON
 **********************************************/

@XoObjectClass(XoButtonDefinition, 'xmcp.forms.datatypes', 'StartOrderButtonDefinition')
export class XoStartOrderButtonDefinition extends XoButtonDefinition {

    @XoProperty()
    serviceFQN: string;

    @XoProperty(XoXPRCRuntimeContext)
    serviceRTC: XoXPRCRuntimeContext;

    @XoProperty()
    synchronously: boolean;

    @XoProperty()
    showResult: boolean;

    @XoProperty(XoDefinitionEventArray)
    onStartorderResultEvent: XoDefinitionEventArray = new XoDefinitionEventArray();

    @XoProperty()
    encodeDataPath: string;


    getTemplate(data: Xo[]): Observable<XcButtonBaseTemplate> {
        return super.getTemplate(data).pipe(tap((template: XcButtonBaseTemplate) => {
            if (template) {
                template.action = () => {
                    // let observer start the Workflow
                    if (this.observer && this.observer.startOrder) {
                        const resolvedData = this.resolveData(data);
                        this.observer.startOrder(this, resolvedData).subscribe({
                            next: value => {
                                if (this.onStartorderResultEvent?.data) {
                                    XcDefinitionEventService.eventService?.triggerEventById(this.onStartorderResultEvent.data.map(e => e.eventId), value);
                                }
                            },
                            complete() {
                                template.busy = false;
                                template.triggerMarkForCheck();
                            }
                        });
                        template.busy = true;
                        template.triggerMarkForCheck();
                    }
                };
            }
        }));
    }
}


@XoArrayClass(XoStartOrderButtonDefinition)
export class XoStartOrderButtonDefinitionArray extends XoArray<XoStartOrderButtonDefinition> {
}



/***********************************************
 * DEFINITION EVENT-BUTTON
 **********************************************/

@XoObjectClass(XoButtonDefinition, 'xmcp.forms.datatypes', 'DefinitionEventButtonDefinition')
export class XoDefinitionEventButtonDefinition extends XoButtonDefinition {

    @XoProperty(XoDefinitionEventArray)
    onClickEvent: XoDefinitionEventArray = new XoDefinitionEventArray();


    getTemplate(data: Xo[]): Observable<XcButtonBaseTemplate> {
        return super.getTemplate(data).pipe(tap((template: XcButtonBaseTemplate) => {
            if (template) {
                template.action = () => {
                    if (this.onClickEvent?.data) {
                        const resolvedData = this.resolveData(data);
                        XcDefinitionEventService.eventService?.triggerEventById(this.onClickEvent.data.map(e => e.eventId), resolvedData);
                    }
                };
            }
        }));
    }
}


@XoArrayClass(XoDefinitionEventButtonDefinition)
export class XoDefinitionEventButtonDefinitionArray extends XoArray<XoDefinitionEventButtonDefinition> {
}



/***********************************************
 * UPLOAD-BUTTON
 **********************************************/

@XoObjectClass(XoButtonDefinition, 'xmcp.forms.datatypes', 'UploadButtonDefinition')
export class XoUploadButtonDefinition extends XoButtonDefinition {

    @XoProperty()
    host: string;


    getTemplate(data: Xo[]): Observable<XcButtonBaseTemplate> {
        return super.getTemplate(data).pipe(tap((template: XcButtonBaseTemplate) => {
            if (template) {
                template.action = () => {
                    if (this.observer && this.observer.uploadFile) {
                        this.observer.uploadFile(this.host).subscribe({
                            next: managedFileId => {
                                this.resolveAssignData(data, managedFileId.iD);
                            },
                            complete : () => {
                                template.busy = false;
                                template.triggerMarkForCheck();
                            }
                        });
                        template.busy = true;
                        template.triggerMarkForCheck();
                    }
                };
            }
        }));
    }
}


@XoArrayClass(XoStartOrderButtonDefinition)
export class XoUploadButtonDefinitionArray extends XoArray<XoUploadButtonDefinition> {
}



/***********************************************
 * COMPONENT
 **********************************************/

@XoObjectClass(XoItemDefinition, 'xmcp.forms.datatypes', 'ComponentDefinition')
export class XoComponentDefinition extends XoItemDefinition {

    @XoProperty()
    componentName: string;

    @XoProperty()
    parameter: string;


    getTemplate(data: Xo[]): Observable<XcTemplate> {
        if (!this.isHiddenFor(data)) {
            return this.observerChange.pipe(
                filter(observer => !!observer),
                map(observer => {
                    const template = observer.getComponent?.(this.componentName);
                    if (template) {
                        template.disabled = this.disabled;
                        template.stylename = this.style;
                        template.data.definition = this;
                        template.data.data = data;
                        template.data.resolvedData = this.resolveData(data);
                    } else {
                        console.error(`ComponentDefinition: Component-class "${this.componentName}" cannot be resolved. `
                            + ' Either there\'s no XoDefinitionObserver defined or the observer does not resolve this component within getComponent().');
                    }
                    return template;
                }),
                mergeMap(template => this.translate(this.label).pipe(
                    map(translated => {
                        template.label = translated;
                        return template;
                    })
                ))
            );
        }
        return of(null);
    }
}


@XoArrayClass(XoComponentDefinition)
export class XoComponentDefinitionArray extends XoArray<XoComponentDefinition> {
}
