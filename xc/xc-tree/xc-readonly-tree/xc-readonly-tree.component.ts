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
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, QueryList, ViewChildren, inject } from '@angular/core';

import { Subscription } from 'rxjs';

import { XoDescriber, XoStructureArray, XoStructureObject } from '../../../api';
import { coerceBoolean } from '../../../base';
import { I18nService, LocaleService } from '../../../i18n';
import { xcTreeTranslations_deDE } from '../locale/xc-translations.de-DE';
import { xcTreeTranslations_enUS } from '../locale/xc-translations.en-US';
import { XcReadonlyStructureTreeDataSource, XcStructureTreeNode } from '../xc-readonly-structure-tree-data-source';
import { ResizeEvent, XcTreeNodeComponent } from './shared/xc-tree-node.component';
import { XcTreeItemComponent } from './xc-tree-item/xc-tree-item.component';


@Component({
    selector: 'xc-readonly-tree',
    templateUrl: './xc-readonly-tree.component.html',
    styleUrls: ['./xc-readonly-tree.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [XcTreeItemComponent]
})
export class XcReadonlyTreeComponent extends XcTreeNodeComponent implements OnDestroy {
    private readonly _i18n = inject(I18nService);
    private readonly cdRef = inject(ChangeDetectorRef);


    private _dataSource: XcReadonlyStructureTreeDataSource;
    private _subscription: Subscription;
    private _keepBreaks = false;

    @ViewChildren(XcTreeItemComponent)
    items: QueryList<XcTreeItemComponent>;

    firstColumnWidth = 100;
    changeWidthTimer = undefined;


    constructor() {
        super();
        const _i18n = this._i18n;

        _i18n.setTranslations(LocaleService.EN_US, xcTreeTranslations_enUS);
        _i18n.setTranslations(LocaleService.DE_DE, xcTreeTranslations_deDE);
    }


    ngOnDestroy() {
        this._subscription?.unsubscribe();
    }


    widthChange(event: ResizeEvent) {
        const propagateWidth = (width: number) => {
            this.firstColumnWidth = width;
            this.cdRef.markForCheck();
            this.changeWidthTimer = undefined;
        };

        const maxChildWidth = this.updateChildWidth(event.node, event.width);

        // debounce events before propagating new width to all the tree nodes
        clearTimeout(this.changeWidthTimer);
        if (event.width !== this.firstColumnWidth) {
            this.changeWidthTimer = setTimeout(propagateWidth, 5, maxChildWidth);
        }
    }


    expandNode(node: XcStructureTreeNode) {
        if (node.field instanceof XoStructureObject) {
            const describer = <XoDescriber>{ rtc: node.field.typeRtc, fqn: node.field.typeFqn };
            this.dataSource.getStructureTreeData(describer, node.field, node);
        } else if (node.field instanceof XoStructureArray) {
            this.dataSource.getArrayData(node.field, node);
        }
    }


    @Input('xc-tree-datasource')
    set dataSource(value: XcReadonlyStructureTreeDataSource) {
        this._subscription?.unsubscribe();
        this._dataSource = value;
        this._subscription = this.dataSource.dataChange.subscribe(() => this.cdRef.markForCheck());
    }


    get dataSource(): XcReadonlyStructureTreeDataSource {
        return this._dataSource;
    }


    @Input({alias: 'xc-tree-keep-breaks', transform: coerceBoolean})
    set keepBreaks(value: boolean) {
        this._keepBreaks = value;
    }


    get keepBreaks(): boolean {
        return this._keepBreaks;
    }


    get i18n(): I18nService {
        // use i18n service from data source, if available
        if (this.dataSource && this.dataSource.i18n) {
            return this.dataSource.i18n;
        }
        // use zeta's i18n service
        return this._i18n;
    }
}
