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
import { BehaviorSubject } from 'rxjs';

import { ApiService, RuntimeContext, XoArray, XoDescriber, XoDescriberCache, XoObject, XoStructureArray, XoStructureComplexField, XoStructureField, XoStructureMethod, XoStructureObject } from '../../api';
import { I18nService } from '../../i18n';
import { XcTreeDataSource, XcTreeNode } from './xc-tree-data-source';


export abstract class XcBaseStructureTreeDataSource<T extends XcTreeNode = XcTreeNode> extends XcTreeDataSource<T> {

    structureCache = new XoDescriberCache<XoStructureObject>();
    orderId: string;

    /**
     * Structure fallback for an entry in the container that does not exist
     */
    structureFallback: typeof XoStructureObject | typeof XoStructureArray = XoStructureObject;
    structureFallbackFunction: (idx: number) => typeof XoStructureObject | typeof XoStructureArray;


    constructor(protected apiService: ApiService, i18n: I18nService, public rtc: RuntimeContext, public describers: XoDescriber[], public container = new XoArray(), translateLabels: boolean = true) {
        super(i18n, translateLabels);
    }


    protected createNode(name: string, parent: T): T {
        const node: T = <T>{ parent: parent, name: name };
        node.children = new BehaviorSubject([]);
        return node;
    }


    protected createNodeFromField(field: XoStructureField, parent: T): T {
        const node = this.createNode(field.label, parent);
        return node;
    }


    getStructureTreeData(describer: XoDescriber, field: XoStructureComplexField, node: T) {
        this.apiService.getStructure(
            this.rtc, [describer], this.structureCache,
            this.orderId
        ).get(describer).subscribe(resultField => {
            field.children = resultField.children;
            node.children.next(
                field.children
                    .filter(childField => !(childField instanceof XoStructureMethod))
                    .map(childField => this.createNodeFromField(childField, node))
            );
        });
    }


    refresh() {
        super.refresh();
        // set data with one node for each describer
        this.data = this.describers
            .filter(describer => describer)
            .map((describer, idx) => {
                const array = this.container ? this.container.data : [];
                // determine structure class for entry in container
                let clazz = this.structureFallbackFunction?.(idx) ?? this.structureFallback;
                if (array[idx] instanceof XoObject) {
                    clazz = XoStructureObject;
                }
                if (array[idx] instanceof XoArray) {
                    clazz = XoStructureArray;
                }
                // create structure field
                const field = new clazz(null, String(idx));
                field.typeRtc = describer.rtc;
                field.typeFqn = describer.fqn;
                field.typeLabel = describer.fqn.name;
                field.label = describer.ident || describer.fqn.name;
                return this.createNodeFromField(field, null);
            });
    }


    get structureTreeData(): T[] {
        return this.data;
    }


    /**
     * Returns a string representation of this tree's content
     * @remark Only returns already opened/requested nodes
     */
    toString(): string {
        const treeNodeToString = (node: XcTreeNode, indentation: string): string => {
            let result = indentation + node.name + ': ' + node.value + '\n';
            if (node.children) {
                result += node.children.value.map(child => treeNodeToString(child, indentation + '  ')).join('');
            }
            return result;
        };

        return this.structureTreeData.map(node => treeNodeToString(node, '')).join('');
    }
}
