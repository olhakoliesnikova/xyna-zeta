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
import { isObject } from '@zeta/base';
import { I18nService } from '@zeta/i18n';

import { ApiService, RuntimeContext, Xo, XoArray, XoDescriber, XoObject, XoStructureArray, XoStructureComplexField, XoStructureField, XoStructureMethod, XoStructureObject } from '../../api';
import { XcBaseStructureTreeDataSource } from './xc-base-structure-tree-data-source';
import { XcTreeNode } from './xc-tree-data-source';


export interface XcStructureTreeNode extends XcTreeNode {
    field: XoStructureField;
    complete: boolean;      // structure for this node has already been requested
    expandable: boolean;
}


export class XcReadonlyStructureTreeDataSource extends XcBaseStructureTreeDataSource<XcStructureTreeNode> {

    constructor(apiService: ApiService, i18n: I18nService, rtc: RuntimeContext, content: Xo[], translateLabels: boolean = true) {
        super(apiService, i18n, rtc, content, new XoArray().append(...content), translateLabels);
    }


    protected createNodeFromField(field: XoStructureField, parent: XcStructureTreeNode): XcStructureTreeNode {
        const node = super.createNodeFromField(field, parent);
        // get value xo instance from container
        const value = this.container.resolve(field.path);
        // the value of xo objects can contain instances of a sub class, so overwrite the field's type info
        // this is not possible for xo arrays though (due to server limitation).
        if (value instanceof XoObject) {
            field.typeRtc = value.rtc;
            field.typeFqn = value.fqn;
            field.typeLabel = value.fqn.name;
        }
        // set node properties
        node.field = field;
        node.value = isObject(value) ? field.toTypeLabel() : value;
        node.expandable = field.isExpandable() && value != null;
        return node;
    }


    getStructureTreeData(describer: XoDescriber, field: XoStructureComplexField, node: XcStructureTreeNode) {
        super.getStructureTreeData(describer, field, node);
        node.complete = true;
    }


    getArrayData(field: XoStructureArray, node: XcStructureTreeNode) {
        // create node for each array-element
        const array = this.container.resolve(field.path) as XoArray;
        const children = (array?.data ?? new XoArray().data).map((_: Xo, index: number) =>
            new XoStructureObject(
                field, `${index}`, `[${index}]`, field.docu,
                field.typeRtc, field.typeFqn, field.typeLabel, field.typeAbstract, field.typeDocu
            )
        );
        field.children = children;
        node.children.next(
            field.children
                .filter(childField => !(childField instanceof XoStructureMethod))
                .map(childField => this.createNodeFromField(childField, node))
        );
    }
}
