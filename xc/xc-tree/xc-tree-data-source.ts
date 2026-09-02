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
import { BehaviorSubject, Observable } from 'rxjs';

import { I18nService } from '../../i18n';
import { XcDataSource } from '../shared/xc-data-source';
import { XcSelectionModel } from '../shared/xc-selection';
import { XcTemplate } from '../xc-template/xc-template';


export interface XcTreeNode {
    parent: this;
    name: string;
    children?: BehaviorSubject<this[]>;
    value?: XcTemplate[] | any;
    readonly?: boolean;
    disabled?: boolean;
    tooltip?: string;
    fixed?: boolean;
    limit?: number;
    action?: (...args: any[]) => void;
    classes?: string[];
}


export abstract class XcTreeDataSource<T extends XcTreeNode> extends XcDataSource<T> {

    protected readonly _selectionModel = new XcSelectionModel<T>();

    readonlyMode = false;
    readonlyHidden = false;


    constructor(readonly i18n?: I18nService, readonly translateLabels?: boolean) {
        super();
    }


    getNodeChildren(node: T): Observable<T[]> {
        return node.children.asObservable();
    }


    get selectionModel(): XcSelectionModel<T> {
        return this._selectionModel;
    }
}
