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
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Injector, OnDestroy } from '@angular/core';

import { pack } from '@zeta/base';

import { Observable, of, Subscription, throwError } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

import { ApiService, StartOrderOptionsBuilder, Xo, XoManagedFileID, XoXPRCRuntimeContext, XoXPRCRuntimeContextFromRuntimeContext } from '../../../../../api';
import { I18nService } from '../../../../../i18n';
import { XcDialogService } from '../../../../xc-dialog/xc-dialog.service';
import { XcStackItem, XcStackItemInterface, XcStackItemObserver } from '../../../../xc-stack/xc-stack-item/xc-stack-item';
import { XcStackItemComponent, XcStackItemComponentData } from '../../../../xc-stack/xc-stack-item/xc-stack-item.component';
import { XcComponentTemplate } from '../../../../xc-template/xc-template';
import { XcDefinitionProxyComponent } from '../../containers/xc-definition-proxy/xc-definition-proxy.component';
import { XcDialogDefinitionComponent } from '../../xc-dialog-definition/xc-dialog-definition.component';
import { XoBaseDefinition, XoCloseDefinitionData, XoDefinition, XoDefinitionBundle, XoDefinitionObserver } from '../../xo/base-definition.model';
import { XoFormDefinition } from '../../xo/containers.model';
import { XoStartOrderButtonDefinition } from '../../xo/item-definition.model';
import { ConfigService } from '@zeta/api/config.service';


export interface DefinitionStackItemComponentData extends XcStackItemComponentData {
    definition: XoFormDefinition;
    data: Xo[];
}


interface DefinitionStackItem {
    item: XcStackItem;
    definition: XoBaseDefinition;
}


@Component({
    templateUrl: './xc-definition-stack-item.component.html',
    styleUrls: ['./xc-definition-stack-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [XcDefinitionProxyComponent]
})
export class XcDefinitionStackItemComponent extends XcStackItemComponent<DefinitionStackItemComponentData> implements XoDefinitionObserver, AfterViewInit, OnDestroy {
    readonly injector: Injector;
    private readonly api = inject(ApiService);
    private readonly dialogs = inject(XcDialogService);
    private readonly i18n = inject(I18nService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly configService = inject(ConfigService);


    private detailsItem: DefinitionStackItem;
    private readonly subscriptions: Subscription[] = [];


    constructor() {
        super();
    }


    ngAfterViewInit() {
        if (this.injectedData.definition) {
            this.subscriptions.push(this.injectedData.definition.getContainerLabel(this.injectedData.data).subscribe(label =>
                this.injectedData.stackItem.setBreadcrumbLabel(label)
            ));
        }
    }


    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }


    // ========================================================================================================================
    // XO DEFINITION OBSERVER
    // ========================================================================================================================

    openDefinition(definition: XoBaseDefinition, data: Xo[]): Observable<XcStackItemInterface> {
        // triggered from somewhere: table-row-selection, open-definition-Button, rich-list-selection, ...
        // opens new stack item with this definition
        // caches stack item to replace it when new definition shall be opened

        const openDetailsItem = (): Observable<XcStackItemInterface> => {
            this.detailsItem = { item: new XcStackItem(), definition: definition };
            this.detailsItem.item.addItemObserver(<XcStackItemObserver>{
                beforeClose: () => this.detailsItem.definition.hasDataChanges()
                    ? this.dialogs.confirm(this.i18n.translate('Confirm Close'), this.i18n.translate('There are unsaved changes. Close anyway and discard changes?')).afterDismiss()
                    : of(true),
                afterClose: () => {
                    this.detailsItem = null;
                }
            });
            this.detailsItem.item.setTemplate(new XcComponentTemplate(
                XcDefinitionStackItemComponent,
                <DefinitionStackItemComponentData>{ stackItem: this.detailsItem.item, definition: definition, data: data }
            ));
            // markForCheck has to be called before stack.open to work propperly
            return of(null).pipe(tap(() => this.cdr.markForCheck()), switchMap(() => this.stackItem.stack.open(this.detailsItem.item)));
        };

        // close current details item, if any
        if (this.detailsItem && this.detailsItem.definition && this.detailsItem.definition.observer) {
            return this.detailsItem.definition.observer.closeDefinition().pipe(
                switchMap(closed => closed ? openDetailsItem() : of(null))
            );
        }
        return openDetailsItem();
    }


    openDialog(definition: XoDefinition, data: Xo[]): Observable<Xo[]> {
        return this.dialogs.custom(XcDialogDefinitionComponent, { definition: definition, data: data }).afterDismiss();
    }


    closeDefinition(data?: XoCloseDefinitionData): Observable<boolean> {
        if (data && data.force && this.injectedData.definition) {
            // force - remove dirty flags
            this.injectedData.definition.clearDataChangeState();
        }
        return this.stackItem.stack.close(this.stackItem).pipe(
            tap(closed => {
                if (closed) {
                    this.cdr.markForCheck();
                }
            })
        );
    }


    close(data?: XoCloseDefinitionData) {
        this.closeDefinition(data).subscribe();
    }


    definitionClosed(): Observable<XoCloseDefinitionData> {
        return of(<XoCloseDefinitionData>{
            definition: this.injectedData.definition,
            data: this.injectedData.data
        });
    }


    resolveDefinition(definitionWorkflowRTC: XoXPRCRuntimeContext, definitionWorkflowFQN: string, data: Xo[]): Observable<XoDefinitionBundle> {
        return this.api.startOrder(
            definitionWorkflowRTC.toRuntimeContext(),
            definitionWorkflowFQN,
            data, null,
            new StartOrderOptionsBuilder().withErrorMessage(true).options
        ).pipe(
            filter(result => {
                if (result.errorMessage || result.output?.length === 0) {
                    throwError(() => new Error('no definition found'));
                    const errorMessage = result.errorMessage ? result.errorMessage : 'No definition found in resolved definition-Workflow';
                    this.dialogs.error(errorMessage);
                    return false;
                }
                return true;
            }),
            map(result => <XoDefinitionBundle>{
                definition: result.output[0],
                data: result.output.slice(1)
            })
        );
    }


    translate(value: string): string {
        return value;
    }


    getDefaultRTC(): XoXPRCRuntimeContext {
        return XoXPRCRuntimeContextFromRuntimeContext(this.configService.config.zeta.xo.runtimeContext);
    }


    startOrder(definition: XoStartOrderButtonDefinition, input: Xo | Xo[]): Observable<Xo | Xo[]> {
        const packedInput = pack(input);
        let preStartorder: Observable<string[]> = of([]);
        if (definition.encodeDataPath) {
            const encodeDefinition = new XoDefinition();
            encodeDefinition.dataPath = definition.encodeDataPath;
            encodeDefinition.setParent(definition);
            preStartorder = this.api.encode(encodeDefinition.resolveData(packedInput)).pipe(
                filter(encodedValues => encodedValues.length > 0),
                tap(encodedValues => encodeDefinition.resolveAssignData(packedInput, encodedValues))
            );
        }

        const rtc = (definition.serviceRTC ? definition.serviceRTC : this.getDefaultRTC()).toRuntimeContext();
        return preStartorder.pipe(
            switchMap(() =>
                this.api.startOrder(rtc, definition.serviceFQN, input, null,
                    new StartOrderOptionsBuilder().withErrorMessage(true).async(!definition.synchronously).options)
            ),
            filter(result => {
                if (!result || result.errorMessage) {
                    if (definition.showResult) {
                        this.dialogs.error(result.errorMessage);
                    }
                    return false;
                }
                return true;
            }),
            map(result => result.output));
    }

    uploadFile?(host?: string): Observable<XoManagedFileID> {
        return this.api.upload(undefined, host);
    }
}
