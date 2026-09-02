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
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

import { ApiService, StartOrderOptionsBuilder } from '../../../../../api';
import { RouteComponent } from '../../../../../nav/route.component';
import { XcStackDataSource } from '../../../../xc-stack/xc-stack-data-source';
import { XcStackItem } from '../../../../xc-stack/xc-stack-item/xc-stack-item';
import { XcStackComponent } from '../../../../xc-stack/xc-stack.component';
import { XcComponentTemplate } from '../../../../xc-template/xc-template';
import { XoFormDefinition } from '../../xo/containers.model';
import { DefinitionStackItemComponentData, XcDefinitionStackItemComponent } from '../xc-definition-stack-item/xc-definition-stack-item.component';
import { ConfigService } from '@zeta/api/config.service';


@Component({
    selector: 'xc-definition-stack-master',
    templateUrl: './xc-definition-stack-master.component.html',
    styleUrls: ['./xc-definition-stack-master.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [XcStackComponent]
})
export class XcDefinitionStackMasterComponent extends RouteComponent implements OnDestroy {
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly route = inject(ActivatedRoute);
    private readonly api = inject(ApiService);
    private readonly configService = inject(ConfigService);


    readonly stackDataSource = new XcStackDataSource();
    private readonly subscription: Subscription;

    active = false;


    constructor() {
        super();

        this.route.data.pipe(
            take(1),
            filter(data => data.fqn)
        ).subscribe(data => {
            this.api.startOrder(
                this.configService.config.zeta.xo.runtimeContext,
                data.fqn,
                data.input,
                null,
                StartOrderOptionsBuilder.defaultOptionsWithErrorMessage
            ).subscribe(response => {
                const formDefinition = response.output[0] as XoFormDefinition;
                const detailData = response.output.slice(1);

                // create stack item
                const item = new XcStackItem();
                item.setTemplate(new XcComponentTemplate(
                    XcDefinitionStackItemComponent,
                    <DefinitionStackItemComponentData>{ stackItem: item, definition: formDefinition, data: detailData }
                ));
                this.stackDataSource.add(item);
            });
        });

        this.subscription = this.stackDataSource.stackItemsChange.subscribe(() =>
            this.cdr.markForCheck()
        );
    }


    ngOnDestroy() {
        this.subscription.unsubscribe();
    }


    defaultTitle(): string {
        return '<unnamed>';
    }


    onShow() {
        super.onShow();

        this.active = true;
        this.cdr.markForCheck();
    }


    onHide() {
        this.active = false;

        /*
         * REMARK
         * For some reason, "detectChanges" instead of "markForCheck" has to be called here
         * to get the active state into the stack
         */
        this.cdr.detectChanges();
    }
}
