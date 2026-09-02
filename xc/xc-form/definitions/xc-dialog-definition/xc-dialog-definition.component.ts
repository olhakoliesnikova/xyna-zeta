/*
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Copyright 2024 Xyna GmbH, Germany
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

import { ApiService, StartOrderOptionsBuilder, Xo, XoManagedFileID, XoXPRCRuntimeContext, XoXPRCRuntimeContextFromRuntimeContext } from '@zeta/api';
import { pack } from '@zeta/base';
import { I18nService } from '@zeta/i18n';
import { XcDialogComponent } from '@zeta/xc/xc-dialog/xc-dialog.component';
import { XcDialogService } from '@zeta/xc/xc-dialog/xc-dialog.service';

import { filter, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { XcI18nContextDirective, XcI18nTranslateDirective } from '../../../../i18n';
import { XcButtonComponent } from '../../../xc-button/xc-button.component';
import { XcDialogWrapperComponent } from '../../../xc-dialog/xc-dialog-wrapper.component';
import { XcFormDirective } from '../../xc-form-base/xc-form.directive';
import { XcDefinitionProxyComponent } from '../containers/xc-definition-proxy/xc-definition-proxy.component';
import { XoBaseDefinition, XoDefinition, XoDefinitionBundle, XoDefinitionObserver } from '../xo/base-definition.model';
import { XoStartOrderButtonDefinition } from '../xo/item-definition.model';
import { ConfigService } from '@zeta/api/config.service';


@Component({
    templateUrl: './xc-dialog-definition.component.html',
    styleUrls: ['./xc-dialog-definition.component.scss'],
    imports: [XcDialogWrapperComponent, XcFormDirective, XcI18nContextDirective, XcI18nTranslateDirective, XcDefinitionProxyComponent, XcButtonComponent]
})
export class XcDialogDefinitionComponent extends XcDialogComponent<Xo[], XoDefinitionBundle> implements XoDefinitionObserver {
    readonly injector: Injector;
    private readonly api = inject(ApiService);
    private readonly dialogs = inject(XcDialogService);
    private readonly i18n = inject(I18nService);
    private readonly configService = inject(ConfigService);


    header = '';

    constructor() {
        super();

        if (this.injectedData.definition instanceof XoBaseDefinition) {
            this.header = this.injectedData.definition.label;
        }
    }

    // ========================================================================================================================
    // XO DEFINITION OBSERVER
    // ========================================================================================================================

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
                    this.dialogs.error('No definition found in resolved definition-Workflow');
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
